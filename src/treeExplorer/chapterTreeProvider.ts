// 章节列表视图数据提供者

import * as vscode from 'vscode';
import { Chapter, Page } from './chapter';
import { ChapterIndex } from './chapter';
import { PaginationManager } from './pagination';
import { ChapterNavigator, ProgressManager } from './navigation';

// 章节树节点
export class ChapterTreeItem extends vscode.TreeItem {
    constructor(
        public readonly chapter: Chapter,
        public readonly filePath: string,
        public readonly navigator: ChapterNavigator,
        public readonly isCurrent: boolean = false,
        collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.Collapsed
    ) {
        super(chapter.title, collapsibleState);
        
        this.tooltip = `${chapter.title} (${chapter.wordCount} 字)`;
        
        // 设置上下文值
        this.contextValue = 'chapter';
        
        // 设置唯一ID以确保树项稳定性
        this.id = `chapter-${chapter.id}`;
        
        // 如果是当前章节，添加高亮样式
        if (isCurrent) {
            this.iconPath = vscode.ThemeIcon.File;
            this.label = `📖 ${chapter.title} (当前阅读)`;
            this.contextValue = 'chapter-current';
        }
        
        // 设置命令 - 点击章节跳转到该章节
        this.command = {
            command: 'vsc-plugin-lcc-reader.command.openChapter',
            title: '打开章节',
            arguments: [this]
        };
    }
}

// 页面树节点
export class PageTreeItem extends vscode.TreeItem {
    constructor(
        public readonly page: Page,
        public readonly filePath: string,
        public readonly navigator: ChapterNavigator,
        public readonly isCurrent: boolean = false
    ) {
        super(page.title, vscode.TreeItemCollapsibleState.None);
        
        this.tooltip = `${page.title} (${page.wordCount} 字)`;
        
        // 设置上下文值
        this.contextValue = 'page';
        
        // 设置唯一ID以确保树项稳定性
        this.id = `page-${page.id}`;
        
        // 设置样式和图标
        if (isCurrent) {
            // 当前正在阅读的页面
            this.iconPath = vscode.ThemeIcon.File;
            this.label = `📖 ${page.title} (当前阅读)`;
            this.contextValue = 'page-current';
        } else {
            // 未读页面
            this.iconPath = vscode.ThemeIcon.File;
            this.label = page.title;
            this.contextValue = 'page-unread';
        }
        
        // 设置命令
        this.command = {
            command: 'vsc-plugin-lcc-reader.command.openPage',
            title: '打开页面',
            arguments: [this]
        };
    }
}

// 章节列表数据提供者
export class ChapterTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null> = new vscode.EventEmitter<vscode.TreeItem | undefined | null>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null> = this._onDidChangeTreeData.event;
    
    private chapterIndex: ChapterIndex | null = null;
    private paginationManager: PaginationManager | null = null;
    private navigator: ChapterNavigator | null = null;
    private currentFilePath: string = '';
    
    constructor() {
        // 构造函数中不需要加载进度，将在setCurrentFile时加载
    }
    
    // 设置当前文件
    async setCurrentFile(filePath: string, chapters: Chapter[], pages: Page[]): Promise<void> {
        this.currentFilePath = filePath;
        this.chapterIndex = new ChapterIndex(chapters);
        this.paginationManager = new PaginationManager();
        this.paginationManager.createPagesFromChapters(chapters);
        this.navigator = new ChapterNavigator(this.chapterIndex, this.paginationManager);
        
        // 每次切换文件时重新加载进度
        const progressManager = ProgressManager.getInstance();
        await progressManager.loadProgress();
        
        const existingProgress = progressManager.getProgress(filePath);
        if (!existingProgress) {
            const fileName = filePath.split('/').pop() || 'unknown';
            console.log(`[LCC Reader] 初始化新文件进度: ${fileName}`);
            progressManager.initializeProgress(filePath, fileName, chapters.length, pages.length);
        } else {
            console.log(`[LCC Reader] 加载已有进度: ${existingProgress.fileName}, 当前章节: ${existingProgress.currentChapterId}, 当前页面: ${existingProgress.currentPageId}`);
        }
        
        this.refresh();
    }
    
    // 刷新视图
    refresh(): void {
        this._onDidChangeTreeData.fire(null);
    }
    
    // 获取树项
    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        try {
            // 确保返回的树项有正确的结构
            if (element instanceof ChapterTreeItem || element instanceof PageTreeItem) {
                console.log(`[LCC Reader] getTreeItem: ${element.label}`);
                return element;
            }
            
            // 如果是其他类型的树项，也直接返回
            console.log(`[LCC Reader] getTreeItem: 其他类型`, element);
            return element;
        } catch (error) {
            console.error(`[LCC Reader] getTreeItem 错误:`, error, element);
            // 返回一个空的树项作为fallback
            return new vscode.TreeItem('Error Item', vscode.TreeItemCollapsibleState.None);
        }
    }
    
    // 获取子项
    getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
        try {
            if (!this.chapterIndex || !this.paginationManager || !this.navigator) {
                console.log(`[LCC Reader] getChildren: 数据未初始化`);
                return Promise.resolve([]);
            }
            
            if (!element) {
                // 根级别：显示所有章节
                console.log(`[LCC Reader] getChildren: 获取根级别章节`);
                return this.getChapterItems();
            } else if (element instanceof ChapterTreeItem) {
                // 章节级别：显示该章节的所有页面
                console.log(`[LCC Reader] getChildren: 获取章节页面 - ${element.chapter.title}`);
                return this.getPageItems(element.chapter);
            } else {
                console.log(`[LCC Reader] getChildren: 未知元素类型`, element);
            }
            
            return Promise.resolve([]);
        } catch (error) {
            console.error(`[LCC Reader] getChildren 错误:`, error);
            return Promise.resolve([]);
        }
    }
    
    // 获取父项 - 这是让 reveal 方法正常工作的关键
    getParent(element: vscode.TreeItem): vscode.TreeItem | null {
        if (element instanceof PageTreeItem) {
            // 页面的父项是章节
            const chapters = this.chapterIndex?.getAllChapters() || [];
            const parentChapter = chapters.find(chapter => chapter.id === element.page.chapterId);
            if (parentChapter) {
                return new ChapterTreeItem(
                    parentChapter,
                    this.currentFilePath,
                    this.navigator!,
                    false // 这里先设为false，后面会在getChapterItems中正确设置
                );
            }
        }
        // 章节的父项是null（根级别）
        return null;
    }
    
    // 获取章节项
    private async getChapterItems(): Promise<ChapterTreeItem[]> {
        if (!this.chapterIndex || !this.navigator) {
            return [];
        }
        
        const chapters = this.chapterIndex.getAllChapters();
        const progressManager = ProgressManager.getInstance();
        const progress = progressManager.getProgress(this.currentFilePath);
        
        return chapters.map(chapter => {
            // 检查章节是否有子页面
            const chapterPages = this.paginationManager!.getChapterPages(chapter.id);
            const hasSubPages = chapterPages.length > 1;
            
            // 检查是否为当前阅读的章节
            const isCurrent = progress ? progress.currentChapterId === chapter.id : false;
            
            const item = new ChapterTreeItem(
                chapter,
                this.currentFilePath,
                this.navigator!,
                isCurrent,
                hasSubPages ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
            );
            
            return item;
        });
    }
    
    // 获取页面项
    private async getPageItems(chapter: Chapter): Promise<PageTreeItem[]> {
        if (!this.paginationManager || !this.navigator) {
            return [];
        }
        
        const chapterPages = this.paginationManager.getChapterPages(chapter.id);
        const progressManager = ProgressManager.getInstance();
        const progress = progressManager.getProgress(this.currentFilePath);
        
        return chapterPages.map(page => {
            const isCurrent = progress ? progress.currentPageId === page.id : false;
            
            return new PageTreeItem(
                page,
                this.currentFilePath,
                this.navigator!,
                isCurrent,
            );
        });
    }
    
    // 获取当前导航器
    getNavigator(): ChapterNavigator | null {
        return this.navigator;
    }
    
    // 获取当前文件路径
    getCurrentFilePath(): string {
        return this.currentFilePath;
    }
    
    // 搜索章节
    searchChapters(keyword: string): Chapter[] {
        if (!this.navigator) {
            return [];
        }
        return this.navigator.searchChapters(keyword);
    }
    
    // 搜索页面
    searchPages(keyword: string): Page[] {
        if (!this.navigator) {
            return [];
        }
        return this.navigator.searchPages(keyword);
    }
    
    // 滚动到当前阅读位置
    async revealCurrentPosition(treeView: vscode.TreeView<vscode.TreeItem>): Promise<void> {
        if (!this.navigator || !treeView) {
            console.log(`[LCC Reader] 滚动失败: 缺少必要组件`);
            return;
        }
        
        const progressManager = ProgressManager.getInstance();
        const progress = progressManager.getProgress(this.currentFilePath);
        
        if (!progress) {
            console.log(`[LCC Reader] 滚动失败: 没有进度信息`);
            return;
        }
        
        console.log(`[LCC Reader] 准备滚动到: 第${progress.currentChapterId}章 第${progress.currentPageId}页`);
        
        try {
            // 获取所有章节项
            const chapterItems = await this.getChapterItems();
            const currentChapterItem = chapterItems.find(item => item.chapter.id === progress.currentChapterId);
            
            if (!currentChapterItem) {
                console.log(`[LCC Reader] 滚动失败: 找不到当前章节树项`);
                return;
            }
            
            // 检查章节是否有多个页面
            const chapterPages = this.paginationManager?.getChapterPages(progress.currentChapterId) || [];
            
            if (chapterPages.length > 1) {
                console.log(`[LCC Reader] 章节有 ${chapterPages.length} 个页面，尝试滚动到页面`);
                
                // 获取当前章节的页面项
                const pageItems = await this.getPageItems(currentChapterItem.chapter);
                const currentPageItem = pageItems.find(item => item.page.id === progress.currentPageId);
                
                if (currentPageItem) {
                    console.log(`[LCC Reader] 滚动到页面: ${currentPageItem.page.title}`);
                    
                    // 先获取父项（章节）
                    const parentItem = this.getParent(currentPageItem);
                    console.log(`[LCC Reader] 页面的父项:`, parentItem ? '找到章节' : '未找到');
                    
                    // 先尝试滚动到父项（章节）
                    if (parentItem) {
                        await treeView.reveal(parentItem, { select: false, focus: false });
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                    
                    // 再滚动到目标页面
                    await treeView.reveal(currentPageItem, { select: true, focus: false });
                } else {
                    console.log(`[LCC Reader] 找不到当前页面，滚动到章节`);
                    
                    // 获取章节的父项（应该是null，表示根级别）
                    const parentItem = this.getParent(currentChapterItem);
                    console.log(`[LCC Reader] 章节的父项:`, parentItem ? '找到' : '根级别');
                    
                    await treeView.reveal(currentChapterItem, { select: true, focus: false });
                }
            } else {
                console.log(`[LCC Reader] 章节只有一个页面，滚动到章节: ${currentChapterItem.chapter.title}`);
                
                // 获取章节的父项（应该是null，表示根级别）
                const parentItem = this.getParent(currentChapterItem);
                console.log(`[LCC Reader] 章节的父项:`, parentItem ? '找到' : '根级别');
                
                await treeView.reveal(currentChapterItem, { select: true, focus: false });
            }
            
            console.log(`[LCC Reader] 滚动操作完成`);
            
        } catch (error) {
            console.error(`[LCC Reader] 滚动失败:`, error);
            // 发送提示消息作为备用方案
            vscode.window.showInformationMessage(`📖 当前阅读: 第${progress.currentChapterId}章 第${progress.currentPageId}页`);
        }
    }

} 