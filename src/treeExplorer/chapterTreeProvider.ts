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
        collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.Collapsed
    ) {
        super(chapter.title, collapsibleState);
        
        this.tooltip = `${chapter.title} (${chapter.wordCount} 字)`;
        
        // 设置上下文值
        this.contextValue = 'chapter';
        
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
        public readonly isRead: boolean = false
    ) {
        super(page.title, vscode.TreeItemCollapsibleState.None);
        
        this.tooltip = `${page.title} (${page.wordCount} 字)`;
        
        // 设置上下文值
        this.contextValue = 'page';
        
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
        // 初始化进度管理器
        ProgressManager.getInstance().loadProgress();
    }
    
    // 设置当前文件
    setCurrentFile(filePath: string, chapters: Chapter[], pages: Page[]): void {
        this.currentFilePath = filePath;
        this.chapterIndex = new ChapterIndex(chapters);
        this.paginationManager = new PaginationManager();
        this.paginationManager.createPagesFromChapters(chapters);
        this.navigator = new ChapterNavigator(this.chapterIndex, this.paginationManager);
        
        // 初始化进度
        const progressManager = ProgressManager.getInstance();
        const existingProgress = progressManager.getProgress(filePath);
        if (!existingProgress) {
            const fileName = filePath.split('/').pop() || 'unknown';
            progressManager.initializeProgress(filePath, fileName, chapters.length, pages.length);
        }
        
        this.refresh();
    }
    
    // 刷新视图
    refresh(): void {
        this._onDidChangeTreeData.fire(null);
    }
    
    // 获取树项
    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }
    
    // 获取子项
    getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
        if (!this.chapterIndex || !this.paginationManager || !this.navigator) {
            return Promise.resolve([]);
        }
        
        if (!element) {
            // 根级别：显示所有章节
            return this.getChapterItems();
        } else if (element instanceof ChapterTreeItem) {
            // 章节级别：显示该章节的所有页面
            return this.getPageItems(element.chapter);
        }
        
        return Promise.resolve([]);
    }
    
    // 获取章节项
    private async getChapterItems(): Promise<ChapterTreeItem[]> {
        if (!this.chapterIndex || !this.navigator) {
            return [];
        }
        
        const chapters = this.chapterIndex.getAllChapters();
        
        return chapters.map(chapter => {
            // 检查章节是否有子页面
            const chapterPages = this.paginationManager!.getChapterPages(chapter.id);
            const hasSubPages = chapterPages.length > 1;
            
            const item = new ChapterTreeItem(
                chapter,
                this.currentFilePath,
                this.navigator!,
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
            const isRead = progress ? progress.readPages.includes(page.id) : false;
            
            return new PageTreeItem(
                page,
                this.currentFilePath,
                this.navigator!,
                isRead
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
} 