// 章节相关类型定义和解析逻辑

export interface Chapter {
    id: number;           // 章节ID
    title: string;        // 章节标题
    startIndex: number;   // 在原文中的起始位置
    endIndex: number;     // 在原文中的结束位置
    content: string;      // 章节内容
    wordCount: number;    // 字数统计
}

export interface Page {
    id: number;           // 页面ID
    title: string;        // 页面标题
    content: string;      // 页面内容
    chapterId: number;    // 所属章节ID
    wordCount: number;    // 字数统计
    type: 'chapter' | 'subpage'; // 页面类型
}

export interface ContentSegment {
    startIndex: number;   // 在原文中的起始位置
    endIndex: number;     // 在原文中的结束位置
    content: string;      // 段落内容
}

export enum PageSplitMode {
    BY_CHAPTER = 'chapter',    // 按章节分页
    BY_WORDS = 'words',        // 按字数分页
    BY_PARAGRAPH = 'paragraph' // 按段落分页
}

// 章节识别规则
const chapterPatterns = [
    /^第[0-9零一二三四五六七八九十百千万]+章.*$/,
    /^第[0-9]+章.*$/,
    /^Chapter\s*[0-9]+.*$/i,
    /^[0-9]+\.\s*.*$/,
    /^第[0-9]+节.*$/,
    /^第[0-9]+回.*$/,
    /^第[0-9]+卷.*$/,
    /^第[0-9]+部.*$/,
    /^第[0-9零一二三四五六七八九十百千万]+篇.*$/,
    /^(?:第|第)(\d+)[章回节篇部卷](?:\s|$)/i,
];

// 特殊章节识别规则
const specialChapterPatterns = [
    /^内容简介.*$/,
    /^作者简介.*$/,
    /^序.*$/,
    /^目录.*$/,
    /^前言.*$/,
    /^后记.*$/,
    /^简介.*$/,
];

// 检查是否为章节标题
function isChapterTitle(line: string): boolean {
    const trimmedLine = line.trim();
    if (trimmedLine.length === 0) return false;
    
    // 排除对话内容（包含引号的行）
    if (trimmedLine.includes('"') || trimmedLine.includes('"') || trimmedLine.includes('"')) {
        return false;
    }
    
    // 检查特殊章节（内容简介、作者简介、序）
    for (const pattern of specialChapterPatterns) {
        if (pattern.test(trimmedLine)) {
            return true;
        }
    }
    
    // 排除过长的行（普通章节标题通常不会太长）
    if (trimmedLine.length > 30) {
        return false;
    }
    
    // 检查是否匹配普通章节模式
    for (const pattern of chapterPatterns) {
        if (pattern.test(trimmedLine)) {
            return true;
        }
    }
    
    return false;
}

// 按文本长度分段
function splitContentIntoSegments(content: string, segmentLength: number): ContentSegment[] {
    const segments: ContentSegment[] = [];
    let currentIndex = 0;
    
    while (currentIndex < content.length) {
        const endIndex = Math.min(currentIndex + segmentLength, content.length);
        let actualEndIndex = endIndex;
        
        // 如果不是最后一段，尝试在句号、问号、感叹号处分割
        if (endIndex < content.length) {
            const remainingText = content.substring(currentIndex, endIndex);
            const lastSentenceEnd = Math.max(
                remainingText.lastIndexOf('。'),
                remainingText.lastIndexOf('！'),
                remainingText.lastIndexOf('？'),
                remainingText.lastIndexOf('.'),
                remainingText.lastIndexOf('!'),
                remainingText.lastIndexOf('?')
            );
            
            if (lastSentenceEnd > 0 && lastSentenceEnd > segmentLength * 0.7) {
                actualEndIndex = currentIndex + lastSentenceEnd + 1;
            }
        }
        
        const segmentContent = content.substring(currentIndex, actualEndIndex).trim();
        
        if (segmentContent.length > 0) {
            segments.push({
                startIndex: currentIndex,
                endIndex: actualEndIndex,
                content: segmentContent
            });
        }
        
        currentIndex = actualEndIndex;
    }
    
    return segments;
}

// 解析章节
export function parseChapters(content: string): Chapter[] {
    console.log(`[LCC Reader] 开始解析章节，内容长度: ${content.length}`);
    
    const lines = content.split('\n');
    const chapters: Chapter[] = [];
    let currentChapter: Chapter | null = null;
    let lineIndex = 0;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();
        
        // 检查是否为章节标题
        if (isChapterTitle(trimmedLine)) {
            console.log(`[LCC Reader] 发现章节标题: ${trimmedLine}`);
            
            // 保存上一个章节
            if (currentChapter) {
                currentChapter.endIndex = lineIndex - 1;
                currentChapter.content = content.substring(
                    currentChapter.startIndex, 
                    currentChapter.endIndex
                ).trim();
                currentChapter.wordCount = currentChapter.content.length;
                chapters.push(currentChapter);
                console.log(`[LCC Reader] 保存章节: ${currentChapter.title}, 字数: ${currentChapter.wordCount}`);
            }
            
            // 创建新章节
            currentChapter = {
                id: chapters.length + 1,
                title: trimmedLine,
                startIndex: lineIndex,
                endIndex: 0,
                content: '',
                wordCount: 0
            };
        }
        
        lineIndex += line.length + 1; // +1 for newline
    }
    
    // 处理最后一个章节
    if (currentChapter) {
        currentChapter.endIndex = content.length;
        currentChapter.content = content.substring(currentChapter.startIndex).trim();
        currentChapter.wordCount = currentChapter.content.length;
        chapters.push(currentChapter);
        console.log(`[LCC Reader] 保存最后章节: ${currentChapter.title}, 字数: ${currentChapter.wordCount}`);
    }
    
    // 如果没有找到章节，按文本长度分段
    if (chapters.length === 0) {
        console.log(`[LCC Reader] 未找到章节标题，按文本长度分段`);
        const segmentLength = 2000; // 每段约2000字符
        const segments = splitContentIntoSegments(content, segmentLength);
        
        segments.forEach((segment: ContentSegment, index: number) => {
            chapters.push({
                id: index + 1,
                title: `第${index + 1}段`,
                startIndex: segment.startIndex,
                endIndex: segment.endIndex,
                content: segment.content,
                wordCount: segment.content.length
            });
        });
    }
    
    console.log(`[LCC Reader] 章节解析完成，共找到 ${chapters.length} 个章节`);
    return chapters;
}

// 章节索引管理
export class ChapterIndex {
    private chapters: Chapter[] = [];
    private chapterMap: Map<number, Chapter> = new Map();
    
    constructor(chapters: Chapter[] = []) {
        this.setChapters(chapters);
    }
    
    setChapters(chapters: Chapter[]) {
        this.chapters = [...chapters];
        this.chapterMap.clear();
        chapters.forEach(chapter => {
            this.chapterMap.set(chapter.id, chapter);
        });
    }
    
    addChapter(chapter: Chapter) {
        this.chapters.push(chapter);
        this.chapterMap.set(chapter.id, chapter);
    }
    
    getChapter(id: number): Chapter | undefined {
        return this.chapterMap.get(id);
    }
    
    getChapterByTitle(title: string): Chapter | undefined {
        return this.chapters.find(c => c.title === title);
    }
    
    getChapterByIndex(index: number): Chapter | undefined {
        return this.chapters[index];
    }
    
    getAllChapters(): Chapter[] {
        return [...this.chapters];
    }
    
    getChapterCount(): number {
        return this.chapters.length;
    }
    
    // 获取章节统计信息
    getStats() {
        const totalWords = this.chapters.reduce((sum, c) => sum + c.wordCount, 0);
        const avgWords = this.chapters.length > 0 ? Math.round(totalWords / this.chapters.length) : 0;
        
        return {
            totalChapters: this.chapters.length,
            totalWords,
            averageWordsPerChapter: avgWords,
            shortestChapter: this.chapters.length > 0 ? Math.min(...this.chapters.map(c => c.wordCount)) : 0,
            longestChapter: this.chapters.length > 0 ? Math.max(...this.chapters.map(c => c.wordCount)) : 0
        };
    }
} 