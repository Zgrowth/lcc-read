import iconv = require('iconv-lite');
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { parseChapters } from './treeExplorer/chapter';
import { PaginationManager } from './treeExplorer/pagination';
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
        // 获取已存在的章节树提供者，如果不存在则创建新的
        let chapterTreeProvider = (global as any).currentChapterTreeProvider;
        
        if (!chapterTreeProvider) {
          // 如果全局变量中没有，创建新的（这通常不应该发生）
          chapterTreeProvider = new ChapterTreeDataProvider();
          (global as any).currentChapterTreeProvider = chapterTreeProvider;
        }
        
        // 设置当前文件数据，这会刷新视图
        await chapterTreeProvider.setCurrentFile(filePath, chapters, pages);

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
    // 提取章节标题
    const lines = content.split('\n');
    let chapterTitle = '';
    let mainContent = content;
    
    // 如果内容以📖开头，说明是章节内容
    if (lines[0] && lines[0].startsWith('📖 ')) {
      chapterTitle = lines[0].replace('📖 ', '').trim();
      // 移除标题行和空行，保留主要内容
      mainContent = lines.slice(2).join('\n').trim();
    }
    
    // 生成带有章节标题的完整内容
    const formattedContent = chapterTitle 
      ? `/* ========== ${chapterTitle} ========== */\n\n${insertComments(splitSentences(mainContent), getTsCode())}`
      : insertComments(splitSentences(content), getTsCode());
      
    writeAndOpenFile(formattedContent);
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

/** foo 现在是字符串类型2 */
function controlFlowAnalysisWithNever(foo: Foo) {
  if (typeof foo === "string") {
    /** foo 现在是字符串类型 */
  } else if (typeof foo === "number") {
    /** foo 现在是数字类型 */
  } else {
    /** foo 在这里是 never 类型 */
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
