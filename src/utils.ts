import iconv = require('iconv-lite');
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { parseChapters, ChapterIndex } from './treeExplorer/chapter';
import { PaginationManager } from './treeExplorer/pagination';
import { ChapterNavigator, ProgressManager } from './treeExplorer/navigation';
import { ChapterTreeDataProvider } from './treeExplorer/chapterTreeProvider';

const execAsync = promisify(exec);

const config = vscode.workspace.getConfiguration();
const localFilesPath: string = config.get('lccReader.localFilesPath', "./novels");

export namespace utils {
  export async function init() {
  }
  
  export async function readLocalTxtFile(filePath: string): Promise<string> {
    try {
      const buffer = fs.readFileSync(filePath);
      const content = iconv.decode(buffer, 'utf-8');

      const chapters = parseChapters(content);
      const paginationManager = new PaginationManager();
      const pages = paginationManager.createPagesFromChapters(chapters);

      try {
        const { ChapterTreeDataProvider } = require('./treeExplorer/chapterTreeProvider');
        const chapterTreeProvider = new ChapterTreeDataProvider();
        chapterTreeProvider.setCurrentFile(filePath, chapters, pages);

        const vscode = require('vscode');
        vscode.window.registerTreeDataProvider('lccReader-chapters', chapterTreeProvider);

        (global as any).currentChapters = chapters;
        (global as any).currentPages = pages;
        (global as any).currentFilePath = filePath;
        (global as any).currentChapterTreeProvider = chapterTreeProvider;

      } catch (error) {
        console.error(`[LCC Reader] 章节视图初始化失败:`, error);
      }

      const chapterInfo = chapters.map((chapter, index) =>
        `${index + 1}. ${chapter.title} (${chapter.wordCount} 字)`
      ).join('\n');

      const chapterSummary = `📚 章节信息 (共${chapters.length}章)\n\n${chapterInfo}`;

      return `${chapterSummary}\n\n${content}`;
    } catch (error) {
      console.error(`[LCC Reader] 读取本地文件失败: ${filePath}`, error);
      throw error;
    }
  }

  export function jumpToChapter(chapterId: number): string | null {
    const chapters = (global as any).currentChapters;
    const pages = (global as any).currentPages;

    if (!chapters || !pages) {
      return null;
    }

    const chapter = chapters.find((c: any) => c.id === chapterId);
    if (!chapter) {
      return null;
    }

    const chapterContent = `📖 ${chapter.title}\n\n${chapter.content}`;

    try {
      const { ProgressManager } = require('./treeExplorer/navigation');
      const progressManager = ProgressManager.getInstance();
      const filePath = (global as any).currentFilePath;
      if (filePath) {
        progressManager.updateProgress(filePath, chapterId, chapterId);
      }
    } catch (error) {
      console.error(`[LCC Reader] 更新进度失败:`, error);
    }

    return chapterContent;
  }

  export function getFirstChapter(): string | null {
    const chapters = (global as any).currentChapters;
    if (!chapters || chapters.length === 0) {
      return null;
    }

    const firstChapter = chapters[0];

    const chapterContent = `📖 ${firstChapter.title}\n\n${firstChapter.content}`;

    try {
      const { ProgressManager } = require('./treeExplorer/navigation');
      const progressManager = ProgressManager.getInstance();
      const filePath = (global as any).currentFilePath;
      if (filePath) {
        progressManager.updateProgress(filePath, firstChapter.id, firstChapter.id);
      }
    } catch (error) {
      console.error(`[LCC Reader] 更新进度失败:`, error);
    }

    return chapterContent;
  }

  // 获取下一页内容
  export function getNextPage(): string | null {
    const chapters = (global as any).currentChapters;
    const pages = (global as any).currentPages;
    const filePath = (global as any).currentFilePath;

    if (!chapters || !pages || !filePath) {
      return null;
    }

    try {
      const { ProgressManager } = require('./treeExplorer/navigation');
      const progressManager = ProgressManager.getInstance();
      const currentProgress = progressManager.getProgress(filePath);

      if (!currentProgress) {
        console.log(`[LCC Reader] 没有阅读进度，返回第一章节`);
        return getFirstChapter();
      }

      // 查找当前章节
      const currentChapter = chapters.find((c: any) => c.id === currentProgress.currentChapterId);
      if (!currentChapter) {
        console.log(`[LCC Reader] 找不到当前章节，返回第一章节`);
        return getFirstChapter();
      }

      // 查找当前章节的所有页面
      const chapterPages = pages.filter((p: any) => p.chapterId === currentChapter.id);

      if (chapterPages.length === 1) {
        // 单页章节，跳转到下一章节
        const nextChapterIndex = chapters.findIndex((c: any) => c.id === currentChapter.id) + 1;
        if (nextChapterIndex < chapters.length) {
          const nextChapter = chapters[nextChapterIndex];

          const chapterContent = `📖 ${nextChapter.title}\n\n${nextChapter.content}`;
          progressManager.updateProgress(filePath, nextChapter.id, nextChapter.id);
          return chapterContent;
        } else {
          vscode.window.showInformationMessage('已经是最后一章节');
          return null;
        }
      } else {
        // 多页章节，查找下一页
        const currentPageIndex = chapterPages.findIndex((p: any) => p.id === currentProgress.currentPageId);
        const nextPageIndex = currentPageIndex + 1;

        if (nextPageIndex < chapterPages.length) {
          // 还有下一页
          const nextPage = chapterPages[nextPageIndex];

          const pageContent = `📖 ${nextPage.title}\n\n${nextPage.content}`;
          progressManager.updateProgress(filePath, currentChapter.id, nextPage.id);
          return pageContent;
        } else {
          // 当前章节的最后一页，跳转到下一章节
          const nextChapterIndex = chapters.findIndex((c: any) => c.id === currentChapter.id) + 1;
          if (nextChapterIndex < chapters.length) {
            const nextChapter = chapters[nextChapterIndex];

            const chapterContent = `📖 ${nextChapter.title}\n\n${nextChapter.content}`;
            progressManager.updateProgress(filePath, nextChapter.id, nextChapter.id);
            return chapterContent;
          } else {
            vscode.window.showInformationMessage('已经是最后一章节');
            return null;
          }
        }
      }
    } catch (error) {
      console.error(`[LCC Reader] 获取下一页失败:`, error);
      return null;
    }
  }

  // 获取上一页内容
  export function getPrevPage(): string | null {
    const chapters = (global as any).currentChapters;
    const pages = (global as any).currentPages;
    const filePath = (global as any).currentFilePath;

    if (!chapters || !pages || !filePath) {
      return null;
    }

    try {
      const { ProgressManager } = require('./treeExplorer/navigation');
      const progressManager = ProgressManager.getInstance();
      const currentProgress = progressManager.getProgress(filePath);

      if (!currentProgress) {
        console.log(`[LCC Reader] 没有阅读进度，返回第一章节`);
        return getFirstChapter();
      }

      // 查找当前章节
      const currentChapter = chapters.find((c: any) => c.id === currentProgress.currentChapterId);
      if (!currentChapter) {
        console.log(`[LCC Reader] 找不到当前章节，返回第一章节`);
        return getFirstChapter();
      }

      // 查找当前章节的所有页面
      const chapterPages = pages.filter((p: any) => p.chapterId === currentChapter.id);

      if (chapterPages.length === 1) {
        // 单页章节，跳转到上一章节
        const prevChapterIndex = chapters.findIndex((c: any) => c.id === currentChapter.id) - 1;
        if (prevChapterIndex >= 0) {
          const prevChapter = chapters[prevChapterIndex];
          console.log(`[LCC Reader] 跳转到上一章节: ${prevChapter.title}`);

          const chapterContent = `📖 ${prevChapter.title}\n\n${prevChapter.content}`;
          progressManager.updateProgress(filePath, prevChapter.id, prevChapter.id);
          return chapterContent;
        } else {
          console.log(`[LCC Reader] 已经是第一章节`);
          vscode.window.showInformationMessage('已经是第一章节');
          return null;
        }
      } else {
        // 多页章节，查找上一页
        const currentPageIndex = chapterPages.findIndex((p: any) => p.id === currentProgress.currentPageId);
        const prevPageIndex = currentPageIndex - 1;

        if (prevPageIndex >= 0) {
          // 还有上一页
          const prevPage = chapterPages[prevPageIndex];
          console.log(`[LCC Reader] 跳转到上一页: ${prevPage.title}`);

          const pageContent = `📖 ${prevPage.title}\n\n${prevPage.content}`;
          progressManager.updateProgress(filePath, currentChapter.id, prevPage.id);
          return pageContent;
        } else {
          // 当前章节的第一页，跳转到上一章节
          const prevChapterIndex = chapters.findIndex((c: any) => c.id === currentChapter.id) - 1;
          if (prevChapterIndex >= 0) {
            const prevChapter = chapters[prevChapterIndex];
            console.log(`[LCC Reader] 跳转到上一章节: ${prevChapter.title}`);

            const chapterContent = `📖 ${prevChapter.title}\n\n${prevChapter.content}`;
            progressManager.updateProgress(filePath, prevChapter.id, prevChapter.id);
            return chapterContent;
          } else {
            console.log(`[LCC Reader] 已经是第一章节`);
            vscode.window.showInformationMessage('已经是第一章节');
            return null;
          }
        }
      }
    } catch (error) {
      console.error(`[LCC Reader] 获取上一页失败:`, error);
      return null;
    }
  }

  // 获取本地txt文件列表
  export async function getLocalTxtFiles(): Promise<string[]> {
    try {
      let novelsDir: string;

      if (path.isAbsolute(localFilesPath)) {
        novelsDir = localFilesPath;
      } else {
        // 相对于插件目录（out目录）
        novelsDir = path.join(__dirname, localFilesPath);
      }

      console.log(`[LCC Reader] 本地文件目录: ${novelsDir}`);

      // 确保目录存在
      if (!fs.existsSync(novelsDir)) {
        console.log(`[LCC Reader] 创建本地文件目录: ${novelsDir}`);
        fs.mkdirSync(novelsDir, { recursive: true });
      }

      const txtFiles: string[] = [];

      // 只扫描指定目录中的txt文件
      try {
        const files = fs.readdirSync(novelsDir);
        for (const file of files) {
          const fullPath = path.join(novelsDir, file);
          const stat = fs.statSync(fullPath);

          if (stat.isFile() && file.toLowerCase().endsWith('.txt')) {
            txtFiles.push(fullPath);
          }
        }
      } catch (error) {
        console.error(`[LCC Reader] 扫描目录失败: ${novelsDir}`, error);
      }

      return txtFiles;
    } catch (error) {
      console.error(`[LCC Reader] 获取本地文件列表失败:`, error);
      return [];
    }
  }

  // 打开本地文件目录
  export async function openLocalFilesDirectory(): Promise<void> {
    try {
      let novelsDir: string;

      if (path.isAbsolute(localFilesPath)) {
        novelsDir = localFilesPath;
      } else {
        // 相对于插件目录（out目录）
        novelsDir = path.join(__dirname, localFilesPath);
      }

      // 确保目录存在
      if (!fs.existsSync(novelsDir)) {
        console.log(`[LCC Reader] 创建本地文件目录: ${novelsDir}`);
        fs.mkdirSync(novelsDir, { recursive: true });
      }

      console.log(`[LCC Reader] 打开本地文件目录: ${novelsDir}`);

      // 根据操作系统调用不同的命令打开目录
      const platform = process.platform;
      let command: string;

      switch (platform) {
        case 'darwin': // macOS
          command = `open "${novelsDir}"`;
          break;
        case 'win32': // Windows
          command = `explorer "${novelsDir}"`;
          break;
        case 'linux': // Linux
          command = `xdg-open "${novelsDir}"`;
          break;
        default:
          throw new Error(`不支持的操作系统: ${platform}`);
      }

      await execAsync(command);
      console.log(`[LCC Reader] 目录打开成功: ${novelsDir}`);

    } catch (error) {
      console.error(`[LCC Reader] 打开目录失败:`, error);
      vscode.window.showErrorMessage(`打开目录失败: ${error}`);
    }
  }

  // 获取本地文件目录路径
  export function getLocalFilesDirectory(): string {
    if (path.isAbsolute(localFilesPath)) {
      return localFilesPath;
    } else {
      // 相对于插件目录（out目录）
      return path.join(__dirname, localFilesPath);
    }
  }
}

export namespace render {
  export function show(content: string, node?: any): void {
    writeAndOpenFile(insertComments(splitSentences(content), getTsCode()));
  }

  function writeAndOpenFile(content: string): void {
    const fileName = 'reader.ts';
    const filePath = path.join(__dirname, fileName);

    fs.writeFile(filePath, content, { flag: "w" }, (err) => {
      if (err) {
        vscode.window.showErrorMessage(`Failed to write file: ${err.message}`);
        return;
      }

      vscode.workspace.openTextDocument(filePath).then(document => {
        vscode.window.showTextDocument(document).then(editor => {
          let firstLine = editor.document.lineAt(0);
          let firstLineRange = new vscode.Range(firstLine.range.start, firstLine.range.start);
          editor.revealRange(firstLineRange, vscode.TextEditorRevealType.AtTop);
        });
      });
    });
  }

  function getTsCode(): string {
    return `
/** 这是一个加法函数 */
function add(x: number, y: number): number {
  const sum = x + y;
  return sum;
}

/** 这是一个乘法函数 */
function multiply(x: number, y: number): number {
  const product = x * y;
  return product;
}

/** 这是一个计算阶乘的函数 */
function factorial(n: number): number {
  if (n <= 1) {
    return 1;
  }
  return n * factorial(n - 1);
}

/** 这是一个字符串处理函数 */
function processString(str: string): string {
  return str.trim().toLowerCase();
}

/** 这是一个数组排序函数 */
function sortArray(arr: number[]): number[] {
  return arr.sort((a, b) => a - b);
}

/** 这是一个对象合并函数 */
function mergeObjects(obj1: any, obj2: any): any {
  return { ...obj1, ...obj2 };
}

/** 这是一个日期格式化函数 */
function formatDate(date: Date): string {
  return date.toLocaleDateString();
}

/** 这是一个数字验证函数 */
function isValidNumber(num: any): boolean {
  return typeof num === 'number' && !isNaN(num);
}

/** 这是一个URL验证函数 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

interface Admin {
  name: string;
  privileges: string[];
}

interface Employee {
  name: string;
  startDate: Date;
}

type UnknownEmployee = Employee | Admin;

function printEmployeeInformation(emp: UnknownEmployee) {
  console.log("Name: " + emp.name);
  if ("privileges" in emp) {
    console.log("Privileges: " + emp.privileges);
  }
  if ("startDate" in emp) {
    console.log("Start Date: " + emp.startDate);
  }
}

type Foo = string | number;

function controlFlowAnalysisWithNever(foo: Foo) {
  if (typeof foo === "string") {
    // 这里 foo 被收窄为 string 类型
  } else if (typeof foo === "number") {
    // 这里 foo 被收窄为 number 类型
  } else {
    // foo 在这里是 never
    const check: never = foo;
  }
}
`;
  }

  function splitSentences(str: string): string[] {
    const fixedCommentLength = 80;
    const result: string[] = [];

    const regex = /(.+?)(["!！。\?？]+|$)/g;
    const sentences = str.match(regex) || [];

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (trimmedSentence.length === 0) continue;

      if (trimmedSentence.length <= fixedCommentLength) {
        result.push(trimmedSentence);
      } else {
        for (let i = 0; i < trimmedSentence.length; i += fixedCommentLength) {
          const chunk = trimmedSentence.slice(i, i + fixedCommentLength);
          if (chunk.length > 0) {
            result.push(chunk);
          }
        }
      }
    }

    return result;
  }

  function insertComments(strings: string[], code: string): string {
    const regex = /\/\*\*[^]*?\*\//g;
    let matches = code.match(regex) || [];
    let codeCopy = code;

    if (matches.length === 0) {
      return codeCopy;
    }

    const totalStrings = strings.length;
    const commentsPerTemplate = matches.length;
    const templatesNeeded = Math.ceil(totalStrings / commentsPerTemplate);

    let result = '';
    let stringIndex = 0;

    for (let templateIndex = 0; templateIndex < templatesNeeded; templateIndex++) {
      let currentCode = templateIndex === 0 ? code : getTsCode();
      let currentMatches = currentCode.match(regex) || [];

      for (let j = 0; j < currentMatches.length; j++) {
        if (stringIndex < strings.length) {
          currentCode = currentCode.replace(currentMatches[j], "// " + strings[stringIndex]);
          stringIndex++;
        } else {
          currentCode = currentCode.replace(currentMatches[j], "");
        }
      }

      result += currentCode;
    }

    return result;
  }
}
