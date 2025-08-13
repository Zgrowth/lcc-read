import * as vscode from 'vscode';
import * as commands from './commands';
import * as progressCommands from './commands/progress';
import { Commands } from './config';
import { utils } from './utils';
import { localFileDataProvider } from './treeExplorer/bookTreeDataProvider';
import { ChapterTreeDataProvider } from './treeExplorer/chapterTreeProvider';

export async function activate(context: vscode.ExtensionContext) {
	await utils.init();

	vscode.commands.registerCommand(Commands.openLocal, () => {
		commands.openLocalFile();
	});

	vscode.commands.registerCommand(Commands.refreshLocal, () => {
		commands.refreshLocalFiles();
	});

	vscode.commands.registerCommand(Commands.openReaderView, commands.openReaderView);

	vscode.window.registerTreeDataProvider('lccReader-local', localFileDataProvider);

	const chapterTreeProvider = new ChapterTreeDataProvider();
	const chapterTreeView = vscode.window.createTreeView('lccReader-chapters', {
		treeDataProvider: chapterTreeProvider
	});
	
	// 将章节树提供者和视图保存到全局，供其他地方使用
	(global as any).currentChapterTreeProvider = chapterTreeProvider;
	(global as any).currentChapterTreeView = chapterTreeView;

	const prevButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
	prevButton.text = '上一页';
	prevButton.show();
	prevButton.command = Commands.prevPage;

	const nextButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
	nextButton.text = '下一页';
	nextButton.show();
	nextButton.command = Commands.nextPage;

	const openPageCommand = vscode.commands.registerCommand(Commands.openPage, commands.openPage);
	const nextPageCommand = vscode.commands.registerCommand(Commands.nextPage, commands.nextPage);
	const prevPageCommand = vscode.commands.registerCommand(Commands.prevPage, commands.prevPage);
	const openChapterCommand = vscode.commands.registerCommand(Commands.openChapter, commands.openChapter);
	const showProgressCommand = vscode.commands.registerCommand(Commands.showProgress, progressCommands.showProgress);
	const revealCurrentPositionCommand = vscode.commands.registerCommand(Commands.revealCurrentPosition, commands.revealCurrentPosition);

	context.subscriptions.push(
		openPageCommand, 
		nextPageCommand, 
		prevPageCommand, 
		openChapterCommand, 
		showProgressCommand,
		revealCurrentPositionCommand,
		chapterTreeView
	);

	commands.updateLocalFileView();
}

export function deactivate() { }