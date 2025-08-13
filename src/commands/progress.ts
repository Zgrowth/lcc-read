// 进度相关命令

import * as vscode from 'vscode';
import { ProgressManager } from '../treeExplorer/navigation';

export async function showProgress() {
    try {
        const progressManager = ProgressManager.getInstance();
        await progressManager.loadProgress();
        
        // 获取所有已保存的阅读进度
        const allProgress: any[] = [];
        const progressMap = (progressManager as any).progressMap as Map<string, any>;
        
        if (progressMap.size === 0) {
            vscode.window.showInformationMessage('📚 还没有任何阅读进度记录');
            return;
        }
        
        progressMap.forEach((progress, filePath) => {
            allProgress.push({
                fileName: progress.fileName,
                filePath: filePath,
                currentChapter: progress.currentChapterId,
                currentPage: progress.currentPageId,
                totalChapters: progress.totalChapters,
                totalPages: progress.totalPages,
                readPages: progress.readPages.length,
                progressPercent: Math.round((progress.readPages.length / progress.totalPages) * 100),
                lastReadTime: new Date(progress.lastReadTime).toLocaleString()
            });
        });
        
        // 按最后阅读时间排序
        allProgress.sort((a, b) => new Date(b.lastReadTime).getTime() - new Date(a.lastReadTime).getTime());
        
        // 生成进度报告
        const progressReport = allProgress.map((item, index) => 
            `${index + 1}. 📖 ${item.fileName}\n` +
            `   进度: ${item.progressPercent}% (${item.readPages}/${item.totalPages}页)\n` +
            `   当前位置: 第${item.currentChapter}章 第${item.currentPage}页\n` +
            `   最后阅读: ${item.lastReadTime}\n`
        ).join('\n');
        
        const fullReport = `📚 阅读进度报告 (共${allProgress.length}本书)\n\n${progressReport}`;
        
        // 显示进度报告
        const doc = await vscode.workspace.openTextDocument({
            content: fullReport,
            language: 'plaintext'
        });
        
        await vscode.window.showTextDocument(doc);
        
        vscode.window.showInformationMessage(`📊 已显示 ${allProgress.length} 本书的阅读进度`);
        
    } catch (error) {
        console.error(`[LCC Reader] 显示进度失败:`, error);
        vscode.window.showErrorMessage(`显示进度失败: ${error}`);
    }
}
