import * as vscode from 'vscode';
import * as path from 'path';
import { TreeNode } from '../treeExplorer/treeNode';
import { render, utils } from '../utils';

import { localFileDataProvider } from '../treeExplorer/bookTreeDataProvider';
import { LocalFileTreeNode } from '../treeExplorer/treeNode';

// 辅助函数：获取当前的章节树提供者和导航器
function getCurrentNavigator() {
    const chapterTreeProvider = (global as any).currentChapterTreeProvider;
    if (!chapterTreeProvider) {
        vscode.window.showWarningMessage('请先打开一个文件');
        return null;
    }

    const navigator = chapterTreeProvider.getNavigator();
    const filePath = chapterTreeProvider.getCurrentFilePath();
    
    if (!navigator || !filePath) {
        vscode.window.showWarningMessage('导航器未初始化，请重新打开文件');
        return null;
    }

    return { navigator, filePath, chapterTreeProvider };
}

// 辅助函数：刷新章节视图并滚动到当前位置
async function refreshAndRevealChapterView() {
    try {
        const chapterTreeProvider = (global as any).currentChapterTreeProvider;
        const chapterTreeView = (global as any).currentChapterTreeView;
        
        if (chapterTreeProvider) {
            // 刷新视图以更新高亮状态
            chapterTreeProvider.refresh();
            
            // 等待一小段时间让视图刷新
            setTimeout(async () => {
                try {
                    // 先尝试使用数据提供者的滚动方法
                    await chapterTreeProvider.revealCurrentPosition(chapterTreeView);
                } catch (error) {
                    console.error(`[LCC Reader] 滚动到当前位置失败:`, error);
                }
            }, 100);
        }
    } catch (error) {
        console.error(`[LCC Reader] 刷新章节视图失败:`, error);
    }
}

export async function openReaderView(node: TreeNode) {
    vscode.window.showInformationMessage(`正在加载: ${node.text}`);
    
    try {
        if (node.ruleId === -1) {
            const content = await utils.readLocalTxtFile(node.path);
            render.show(content, node);
            
            vscode.window.showInformationMessage(`📚 已解析章节信息，请在"章节"视图中查看详细结构`);
            
            setTimeout(async () => {
                try {
                    // 获取当前的导航器
                    const navInfo = getCurrentNavigator();
                    if (navInfo) {
                        const { navigator, filePath } = navInfo;
                        
                        // 尝试继续上次阅读
                        const currentPage = navigator.continueReading(filePath);
                        if (currentPage) {
                            const pageContent = `📖 ${currentPage.title}\n\n${currentPage.content}`;
                            render.show(pageContent, node);
                            vscode.window.showInformationMessage(`📖 继续上次阅读: ${currentPage.title}`);
                            
                            // 刷新章节视图并滚动到当前位置
                            await refreshAndRevealChapterView();
                        }
                    }
                } catch (error) {
                    console.error(`[LCC Reader] 自动显示章节失败:`, error);
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
    try {
        const navInfo = getCurrentNavigator();
        if (!navInfo) return;

        const { navigator, filePath } = navInfo;

        // 跳转到指定页面并更新进度
        const page = navigator.jumpToPage(filePath, pageItem.page.id);
        if (page) {
            const pageContent = `📖 ${page.title}\n\n${page.content}`;
            render.show(pageContent, pageItem);
            
            // 刷新章节视图并滚动到当前位置
            await refreshAndRevealChapterView();
        } else {
            vscode.window.showErrorMessage(`无法打开页面: ${pageItem.page.title}`);
        }
    } catch (error) {
        console.error(`[LCC Reader] 打开页面失败:`, error);
        vscode.window.showErrorMessage(`打开页面失败: ${error}`);
    }
}

export async function nextPage() {
    try {
        const navInfo = getCurrentNavigator();
        if (!navInfo) return;

        const { navigator, filePath } = navInfo;

        // 获取当前进度
        const currentPosition = navigator.getCurrentPosition(filePath);
        if (!currentPosition.progress) {
            // 没有进度，开始阅读
            const firstPage = navigator.continueReading(filePath);
            if (firstPage) {
                const pageContent = `📖 ${firstPage.title}\n\n${firstPage.content}`;
                render.show(pageContent);
                
                // 刷新章节视图并滚动到当前位置
                await refreshAndRevealChapterView();
            }
            return;
        }

        // 获取下一页
        const nextPage = navigator.getNextPage(filePath, currentPosition.progress.currentPageId);
        if (nextPage) {
            const pageContent = `📖 ${nextPage.title}\n\n${nextPage.content}`;
            render.show(pageContent);
            
            // 刷新章节视图并滚动到当前位置
            await refreshAndRevealChapterView();
        } else {
            vscode.window.showInformationMessage('已经是最后一页');
        }
    } catch (error) {
        console.error(`[LCC Reader] 下一页失败:`, error);
        vscode.window.showErrorMessage(`下一页失败: ${error}`);
    }
}

export async function prevPage() {
    try {
        const navInfo = getCurrentNavigator();
        if (!navInfo) return;

        const { navigator, filePath } = navInfo;

        // 获取当前进度
        const currentPosition = navigator.getCurrentPosition(filePath);
        if (!currentPosition.progress) {
            // 没有进度，开始阅读
            const firstPage = navigator.continueReading(filePath);
            if (firstPage) {
                const pageContent = `📖 ${firstPage.title}\n\n${firstPage.content}`;
                render.show(pageContent);
                
                // 刷新章节视图并滚动到当前位置
                await refreshAndRevealChapterView();
            }
            return;
        }

        // 获取上一页
        const prevPage = navigator.getPrevPage(filePath, currentPosition.progress.currentPageId);
        if (prevPage) {
            const pageContent = `📖 ${prevPage.title}\n\n${prevPage.content}`;
            render.show(pageContent);
            
            // 刷新章节视图并滚动到当前位置
            await refreshAndRevealChapterView();
        } else {
            vscode.window.showInformationMessage('已经是第一页');
        }
    } catch (error) {
        console.error(`[LCC Reader] 上一页失败:`, error);
        vscode.window.showErrorMessage(`上一页失败: ${error}`);
    }
}

export async function openChapter(chapterItem: any) {
    try {
        const navInfo = getCurrentNavigator();
        if (!navInfo) return;

        const { navigator, filePath } = navInfo;

        // 跳转到指定章节并更新进度
        const page = navigator.jumpToChapter(filePath, chapterItem.chapter.id);
        if (page) {
            const pageContent = `📖 ${page.title}\n\n${page.content}`;
            render.show(pageContent, chapterItem);
            
            // 刷新章节视图并滚动到当前位置
            await refreshAndRevealChapterView();
        } else {
            vscode.window.showErrorMessage(`无法获取章节内容: ${chapterItem.chapter.title}`);
        }
    } catch (error) {
        console.error(`[LCC Reader] 打开章节失败:`, error);
        vscode.window.showErrorMessage(`打开章节失败: ${error}`);
    }
}

export async function revealCurrentPosition() {
    try {
        const chapterTreeProvider = (global as any).currentChapterTreeProvider;
        const chapterTreeView = (global as any).currentChapterTreeView;
        
        if (!chapterTreeProvider || !chapterTreeView) {
            vscode.window.showWarningMessage('章节视图未初始化');
            return;
        }
        
        await chapterTreeProvider.revealCurrentPosition(chapterTreeView);
    } catch (error) {
        console.error(`[LCC Reader] 滚动到当前位置失败:`, error);
        vscode.window.showErrorMessage(`滚动到当前位置失败: ${error}`);
    }
}