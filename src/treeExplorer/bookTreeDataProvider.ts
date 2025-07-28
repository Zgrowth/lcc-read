import * as vscode from 'vscode';
import { TreeNode } from './treeNode';

export class BookTreeDataProvider implements vscode.TreeDataProvider<TreeNode> {
    private _onDidChangeTreeData: vscode.EventEmitter<TreeNode | undefined> = new vscode.EventEmitter<TreeNode | undefined>();
    readonly onDidChangeTreeData: vscode.Event<TreeNode | undefined> = this._onDidChangeTreeData.event;
    private books: TreeNode[] = [];
    private curNode: TreeNode | undefined;
    constructor(books: TreeNode[]) {
        this.books = books;
    }
    setData(books: TreeNode[]): BookTreeDataProvider {
        this.books = books;
        return this;
    }
    getTreeItem(element: TreeNode): vscode.TreeItem {
        return {
            label: element.text,
            tooltip: element.text,
            iconPath: '',
            contextValue: element.contextValue,
            collapsibleState: element.collapsibleState,
            command: element.collapsibleState === vscode.TreeItemCollapsibleState.None ? element.previewCommand : undefined
        };
    }
    async getChildren(element?: TreeNode): Promise<TreeNode[]> {
        if (!element) {
            return this.books;
        }
        return await element.getChildren();
    }
    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }
    set curData(curNode: TreeNode | undefined) {
        if (curNode) {
            this.curNode = curNode;
        }
    }
    get curData(): TreeNode | undefined {
        return this.curNode;
    }
}


// 本地文件数据提供者
export class LocalFileDataProvider implements vscode.TreeDataProvider<TreeNode> {
    private _onDidChangeTreeData: vscode.EventEmitter<TreeNode | undefined | null> = new vscode.EventEmitter<TreeNode | undefined | null>();
    readonly onDidChangeTreeData: vscode.Event<TreeNode | undefined | null> = this._onDidChangeTreeData.event;

    private data: TreeNode[] = [];

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    setData(data: TreeNode[]): LocalFileDataProvider {
        this.data = data;
        return this;
    }

    getTreeItem(element: TreeNode): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TreeNode): Thenable<TreeNode[]> {
        if (element) {
            return element.getChildren();
        } else {
            return Promise.resolve(this.data);
        }
    }
}

export const localFileDataProvider = new LocalFileDataProvider();
