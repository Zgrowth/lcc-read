// 阅读进度管理和导航系统

import * as vscode from 'vscode';
import { Chapter, Page } from './chapter';
import { PaginationManager } from './pagination';
import { ChapterIndex } from './chapter';

// 阅读进度接口
export interface ReadingProgress {
    filePath: string;
    fileName: string;
    currentChapterId: number;
    currentPageId: number;
    lastReadTime: number;
    totalChapters: number;
    totalPages: number;
    readPages: number[];
}

// 阅读进度管理器
export class ProgressManager {
    private static instance: ProgressManager;
    private progressMap: Map<string, ReadingProgress> = new Map();
    private readonly progressFile: string;
    
    private constructor() {
        this.progressFile = vscode.workspace.getConfiguration('eReader').get('progressFile', '.eReader-progress.json');
    }
    
    static getInstance(): ProgressManager {
        if (!ProgressManager.instance) {
            ProgressManager.instance = new ProgressManager();
        }
        return ProgressManager.instance;
    }
    
    // 保存进度
    saveProgress(filePath: string, progress: ReadingProgress): void {
        this.progressMap.set(filePath, progress);
        this.persistProgress();
    }
    
    // 获取进度
    getProgress(filePath: string): ReadingProgress | undefined {
        return this.progressMap.get(filePath);
    }
    
    // 更新进度
    updateProgress(filePath: string, chapterId: number, pageId: number): void {
        const progress = this.progressMap.get(filePath);
        if (progress) {
            progress.currentChapterId = chapterId;
            progress.currentPageId = pageId;
            progress.lastReadTime = Date.now();
            
            // 记录已读页面
            if (!progress.readPages.includes(pageId)) {
                progress.readPages.push(pageId);
            }
            
            this.saveProgress(filePath, progress);
        }
    }
    
    // 初始化进度
    initializeProgress(filePath: string, fileName: string, totalChapters: number, totalPages: number): ReadingProgress {
        const progress: ReadingProgress = {
            filePath,
            fileName,
            currentChapterId: 1,
            currentPageId: 1,
            lastReadTime: Date.now(),
            totalChapters,
            totalPages,
            readPages: [1]
        };
        
        this.saveProgress(filePath, progress);
        return progress;
    }
    
    // 持久化进度到文件
    private persistProgress(): void {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders && workspaceFolders.length > 0) {
                const progressPath = vscode.Uri.file(workspaceFolders[0].uri.fsPath + '/' + this.progressFile);
                const progressData = JSON.stringify(Array.from(this.progressMap.entries()), null, 2);
                
                // 使用Node.js fs模块写入文件
                const fs = require('fs');
                const path = require('path');
                const fullPath = path.join(workspaceFolders[0].uri.fsPath, this.progressFile);
                fs.writeFileSync(fullPath, progressData, 'utf8');
            }
        } catch (error) {
            console.error(`[LCC Reader] 保存进度失败: ${error}`);
        }
    }
    
    // 从文件加载进度
    async loadProgress(): Promise<void> {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders && workspaceFolders.length > 0) {
                const fs = require('fs');
                const path = require('path');
                const fullPath = path.join(workspaceFolders[0].uri.fsPath, this.progressFile);
                
                try {
                    const data = fs.readFileSync(fullPath, 'utf8');
                    const progressData = JSON.parse(data);
                    this.progressMap = new Map(progressData);
                } catch (error) {
                    // 文件不存在，使用空进度
                    this.progressMap.clear();
                }
            }
        } catch (error) {
            console.error(`[LCC Reader] 加载进度失败: ${error}`);
        }
    }
    
    // 获取阅读统计
    getReadingStats(filePath: string): { readPages: number; totalPages: number; progress: number } {
        const progress = this.getProgress(filePath);
        if (!progress) {
            return { readPages: 0, totalPages: 0, progress: 0 };
        }
        
        return {
            readPages: progress.readPages.length,
            totalPages: progress.totalPages,
            progress: Math.round((progress.readPages.length / progress.totalPages) * 100)
        };
    }
}

// 章节导航器
export class ChapterNavigator {
    private chapterIndex: ChapterIndex;
    private paginationManager: PaginationManager;
    private progressManager: ProgressManager;
    
    constructor(chapterIndex: ChapterIndex, paginationManager: PaginationManager) {
        this.chapterIndex = chapterIndex;
        this.paginationManager = paginationManager;
        this.progressManager = ProgressManager.getInstance();
    }
    
    // 跳转到指定章节
    jumpToChapter(filePath: string, chapterId: number): Page | null {
        const chapter = this.chapterIndex.getChapter(chapterId);
        if (!chapter) {
            console.log(`[LCC Reader] 章节不存在: ${chapterId}`);
            return null;
        }
        
        const chapterPages = this.paginationManager.getChapterPages(chapterId);
        if (chapterPages.length === 0) {
            console.log(`[LCC Reader] 章节没有页面: ${chapterId}`);
            return null;
        }
        
        const firstPage = chapterPages[0];
        
        // 更新进度
        this.progressManager.updateProgress(filePath, chapterId, firstPage.id);
        
        console.log(`[LCC Reader] 跳转到章节: ${chapter.title}, 页面: ${firstPage.title}`);
        return firstPage;
    }
    
    // 跳转到指定页面
    jumpToPage(filePath: string, pageId: number): Page | null {
        const page = this.paginationManager.getPage(pageId);
        if (!page) {
            console.log(`[LCC Reader] 页面不存在: ${pageId}`);
            return null;
        }
        
        // 更新进度
        this.progressManager.updateProgress(filePath, page.chapterId, pageId);
        
        console.log(`[LCC Reader] 跳转到页面: ${page.title}`);
        return page;
    }
    
    // 获取下一页
    getNextPage(filePath: string, currentPageId: number): Page | null {
        const adjacent = this.paginationManager.getAdjacentPages(currentPageId);
        if (adjacent.next) {
            this.progressManager.updateProgress(filePath, adjacent.next.chapterId, adjacent.next.id);
            console.log(`[LCC Reader] 下一页: ${adjacent.next.title}`);
            return adjacent.next;
        }
        
        console.log(`[LCC Reader] 已经是最后一页`);
        return null;
    }
    
    // 获取上一页
    getPrevPage(filePath: string, currentPageId: number): Page | null {
        const adjacent = this.paginationManager.getAdjacentPages(currentPageId);
        if (adjacent.prev) {
            this.progressManager.updateProgress(filePath, adjacent.prev.chapterId, adjacent.prev.id);
            console.log(`[LCC Reader] 上一页: ${adjacent.prev.title}`);
            return adjacent.prev;
        }
        
        console.log(`[LCC Reader] 已经是第一页`);
        return null;
    }
    
    // 搜索章节
    searchChapters(keyword: string): Chapter[] {
        const allChapters = this.chapterIndex.getAllChapters();
        return allChapters.filter(chapter => 
            chapter.title.toLowerCase().includes(keyword.toLowerCase())
        );
    }
    
    // 搜索页面内容
    searchPages(keyword: string): Page[] {
        return this.paginationManager.searchPages(keyword);
    }
    
    // 获取章节的阅读进度
    getChapterProgress(filePath: string, chapterId: number): { readPages: number; totalPages: number; progress: number } {
        const chapterPages = this.paginationManager.getChapterPages(chapterId);
        const progress = this.progressManager.getProgress(filePath);
        
        if (!progress || chapterPages.length === 0) {
            return { readPages: 0, totalPages: chapterPages.length, progress: 0 };
        }
        
        const readPages = chapterPages.filter(page => 
            progress.readPages.includes(page.id)
        ).length;
        
        return {
            readPages,
            totalPages: chapterPages.length,
            progress: Math.round((readPages / chapterPages.length) * 100)
        };
    }
    
    // 获取当前阅读位置信息
    getCurrentPosition(filePath: string): { chapter: Chapter | null; page: Page | null; progress: ReadingProgress | null } {
        const progress = this.progressManager.getProgress(filePath);
        if (!progress) {
            return { chapter: null, page: null, progress: null };
        }
        
        const chapter = this.chapterIndex.getChapter(progress.currentChapterId) || null;
        const page = this.paginationManager.getPage(progress.currentPageId) || null;
        
        return { chapter, page, progress };
    }
    
    // 继续上次阅读
    continueReading(filePath: string): Page | null {
        const position = this.getCurrentPosition(filePath);
        if (position.page) {
            console.log(`[LCC Reader] 继续阅读: ${position.page.title}`);
            return position.page;
        }
        
        // 如果没有进度，从第一页开始
        const firstPage = this.paginationManager.getAllPages()[0];
        if (firstPage) {
            this.progressManager.updateProgress(filePath, firstPage.chapterId, firstPage.id);
            console.log(`[LCC Reader] 开始阅读: ${firstPage.title}`);
            return firstPage;
        }
        
        return null;
    }
} 