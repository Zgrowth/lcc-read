// 分页系统

import { Chapter, Page, PageSplitMode } from './chapter';

// 分页配置
export interface PaginationConfig {
    mode: PageSplitMode;
    maxWordsPerPage: number;  // 每页最大字数
    maxPagesPerChapter: number; // 每章节最大页数
}

// 默认分页配置
export const DEFAULT_PAGINATION_CONFIG: PaginationConfig = {
    mode: PageSplitMode.BY_CHAPTER,
    maxWordsPerPage: 3000,
    maxPagesPerChapter: 10
};

// 分页管理器
export class PaginationManager {
    private pages: Page[] = [];
    private pageMap: Map<number, Page> = new Map();
    private chapterPageMap: Map<number, Page[]> = new Map();
    private config: PaginationConfig;
    
    constructor(config: PaginationConfig = DEFAULT_PAGINATION_CONFIG) {
        this.config = config;
    }
    
    // 设置分页配置
    setConfig(config: PaginationConfig) {
        this.config = config;
    }
    
    // 根据章节创建分页
    createPagesFromChapters(chapters: Chapter[]): Page[] {
        console.log(`[LCC Reader] 开始创建分页，章节数: ${chapters.length}`);
        
        this.pages = [];
        this.pageMap.clear();
        this.chapterPageMap.clear();
        
        let pageId = 1;
        
        for (const chapter of chapters) {
            const chapterPages = this.splitChapterIntoPages(chapter, pageId);
            
            // 添加到总页面列表
            this.pages.push(...chapterPages);
            
            // 添加到章节页面映射
            this.chapterPageMap.set(chapter.id, chapterPages);
            
            // 更新页面ID
            pageId += chapterPages.length;
        }
        
        // 建立页面映射
        this.pages.forEach(page => {
            this.pageMap.set(page.id, page);
        });
        
        console.log(`[LCC Reader] 分页创建完成，总页数: ${this.pages.length}`);
        return this.pages;
    }
    
    // 将章节分割为页面
    private splitChapterIntoPages(chapter: Chapter, startPageId: number): Page[] {
        const pages: Page[] = [];
        
        // 如果章节字数不超过限制，直接作为一页
        if (chapter.wordCount <= this.config.maxWordsPerPage) {
            pages.push({
                id: startPageId,
                title: chapter.title,
                content: chapter.content,
                chapterId: chapter.id,
                wordCount: chapter.wordCount,
                type: 'chapter'
            });
            console.log(`[LCC Reader] 章节 "${chapter.title}" 作为单页，字数: ${chapter.wordCount}`);
        } else {
            // 大章节需要分割
            const subPages = this.splitLargeChapter(chapter, startPageId);
            pages.push(...subPages);
            console.log(`[LCC Reader] 章节 "${chapter.title}" 分割为 ${subPages.length} 页`);
        }
        
        return pages;
    }
    
    // 分割大章节
    private splitLargeChapter(chapter: Chapter, startPageId: number): Page[] {
        const pages: Page[] = [];
        const paragraphs = chapter.content.split('\n\n');
        let currentPage = '';
        let pageId = startPageId;
        let currentWordCount = 0;
        
        for (const paragraph of paragraphs) {
            const paragraphWordCount = paragraph.length;
            
            // 如果当前段落加上现有内容超过限制，且当前页面不为空，则创建新页
            if (currentPage && (currentWordCount + paragraphWordCount) > this.config.maxWordsPerPage) {
                pages.push({
                    id: pageId++,
                    title: chapter.title,
                    content: currentPage.trim(),
                    chapterId: chapter.id,
                    wordCount: currentWordCount,
                    type: 'subpage'
                });
                
                currentPage = paragraph;
                currentWordCount = paragraphWordCount;
            } else {
                // 添加到当前页面
                currentPage += (currentPage ? '\n\n' : '') + paragraph;
                currentWordCount += paragraphWordCount;
            }
            
            // 检查是否达到最大页数限制
            if (pages.length >= this.config.maxPagesPerChapter) {
                console.log(`[LCC Reader] 章节 "${chapter.title}" 达到最大页数限制，剩余内容将合并到最后一页`);
                break;
            }
        }
        
        // 添加最后一页
        if (currentPage) {
            pages.push({
                id: pageId,
                title: chapter.title,
                content: currentPage.trim(),
                chapterId: chapter.id,
                wordCount: currentWordCount,
                type: pages.length === 0 ? 'chapter' : 'subpage'
            });
        }
        
        return pages;
    }
    
    // 获取页面
    getPage(pageId: number): Page | undefined {
        return this.pageMap.get(pageId);
    }
    
    // 获取章节的所有页面
    getChapterPages(chapterId: number): Page[] {
        return this.chapterPageMap.get(chapterId) || [];
    }
    
    // 获取所有页面
    getAllPages(): Page[] {
        return [...this.pages];
    }
    
    // 获取页面总数
    getPageCount(): number {
        return this.pages.length;
    }
    
    // 获取章节的页面数
    getChapterPageCount(chapterId: number): number {
        return this.getChapterPages(chapterId).length;
    }
    
    // 获取页面统计信息
    getStats() {
        const totalWords = this.pages.reduce((sum, p) => sum + p.wordCount, 0);
        const avgWords = this.pages.length > 0 ? Math.round(totalWords / this.pages.length) : 0;
        
        return {
            totalPages: this.pages.length,
            totalWords,
            averageWordsPerPage: avgWords,
            shortestPage: this.pages.length > 0 ? Math.min(...this.pages.map(p => p.wordCount)) : 0,
            longestPage: this.pages.length > 0 ? Math.max(...this.pages.map(p => p.wordCount)) : 0,
            chapterCount: this.chapterPageMap.size
        };
    }
    
    // 搜索页面
    searchPages(keyword: string): Page[] {
        return this.pages.filter(page => 
            page.title.includes(keyword) || 
            page.content.includes(keyword)
        );
    }
    
    // 获取相邻页面
    getAdjacentPages(pageId: number): { prev: Page | null, next: Page | null } {
        const currentIndex = this.pages.findIndex(p => p.id === pageId);
        if (currentIndex === -1) {
            return { prev: null, next: null };
        }
        
        return {
            prev: currentIndex > 0 ? this.pages[currentIndex - 1] : null,
            next: currentIndex < this.pages.length - 1 ? this.pages[currentIndex + 1] : null
        };
    }
    
    // 获取章节的相邻页面
    getAdjacentChapterPages(chapterId: number, pageId: number): { prev: Page | null, next: Page | null } {
        const chapterPages = this.getChapterPages(chapterId);
        const currentIndex = chapterPages.findIndex(p => p.id === pageId);
        
        if (currentIndex === -1) {
            return { prev: null, next: null };
        }
        
        return {
            prev: currentIndex > 0 ? chapterPages[currentIndex - 1] : null,
            next: currentIndex < chapterPages.length - 1 ? chapterPages[currentIndex + 1] : null
        };
    }
} 