import * as vscode from 'vscode';
import { TreeNode } from '../treeExplorer/treeNode';
import { render, utils } from '../utils';
import { Commands } from '../config';
import { localFileDataProvider } from '../treeExplorer/bookTreeDataProvider';
import { LocalFileTreeNode } from '../treeExplorer/treeNode';
import * as path from 'path';

export async function openReaderView(node: TreeNode) {
    vscode.window.showInformationMessage(`正在加载: ${node.text}`);
    
    try {
        if (node.ruleId === -1) {
            const content = await utils.readLocalTxtFile(node.path);
            render.show(content, node);
            
            vscode.window.showInformationMessage(`📚 已解析章节信息，请在"章节"视图中查看详细结构`);
            
            setTimeout(async () => {
                try {
                    const firstChapterContent = utils.getFirstChapter();
                    if (firstChapterContent) {
                        render.show(firstChapterContent, node);
                    }
                } catch (error) {
                    console.error(`[LCC Reader] 自动显示第一章节失败:`, error);
                }
            }, 1000);
        } else {
            vscode.window.showErrorMessage('只支持本地文件阅读');
        }
    } catch (error) {
        console.error(`[LCC Reader] openReaderView执行失败:`, error);
        vscode.window.showErrorMessage(`加载失败: ${error}`);
    }
}

export async function openLocalFile() {
    console.log(`[LCC Reader] 开始处理本地文件`);
    
    try {
        await utils.openLocalFilesDirectory();
        
    } catch (error) {
        console.error(`[LCC Reader] 处理本地文件失败:`, error);
        vscode.window.showErrorMessage(`处理本地文件失败: ${error}`);
    }
}

export async function refreshLocalFiles() {
    vscode.window.showInformationMessage('正在扫描本地txt文件...');
    
    try {
        const txtFiles = await utils.getLocalTxtFiles();
        
        if (txtFiles.length === 0) {
            vscode.window.showWarningMessage('未找到本地txt文件，请将txt文件放入指定目录');
            const dirPath = utils.getLocalFilesDirectory();
            vscode.window.showInformationMessage(`本地文件目录: ${dirPath}`);
        } else {
            const localFileNodes: LocalFileTreeNode[] = txtFiles.map((filePath) => {
                const fileName = path.basename(filePath, '.txt');
                return new LocalFileTreeNode(fileName, filePath);
            });
            
            localFileDataProvider.setData(localFileNodes).refresh();
            vscode.window.showInformationMessage(`找到 ${txtFiles.length} 个本地txt文件`);
        }
        
    } catch (error) {
        console.error(`[LCC Reader] 扫描本地文件失败:`, error);
        vscode.window.showErrorMessage(`扫描本地文件失败: ${error}`);
    }
}

export async function updateLocalFileView() {
    await refreshLocalFiles();
}

export async function openPage(pageItem: any) {
    render.show(pageItem.page.content, pageItem);
}

export async function nextPage() {
    try {
        const nextContent = utils.getNextPage();
        if (nextContent) {
            render.show(nextContent);
        }
    } catch (error) {
        console.error(`[LCC Reader] 下一页失败:`, error);
        vscode.window.showErrorMessage(`下一页失败: ${error}`);
    }
}

export async function prevPage() {
    try {
        const prevContent = utils.getPrevPage();
        if (prevContent) {
            render.show(prevContent);
        }
    } catch (error) {
        console.error(`[LCC Reader] 上一页失败:`, error);
        vscode.window.showErrorMessage(`上一页失败: ${error}`);
    }
}

export async function openChapter(chapterItem: any) {
    try {
        const chapterContent = utils.jumpToChapter(chapterItem.chapter.id);
        if (chapterContent) {
            render.show(chapterContent, chapterItem);
        } else {
            vscode.window.showErrorMessage(`无法获取章节内容: ${chapterItem.chapter.title}`);
        }
    } catch (error) {
        console.error(`[LCC Reader] 打开章节失败:`, error);
        vscode.window.showErrorMessage(`打开章节失败: ${error}`);
    }
}