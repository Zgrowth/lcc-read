import * as vscode from 'vscode';
import { Commands } from '../config';

export class TreeNode extends vscode.TreeItem {
    protected data;
    protected parent: TreeNode;
    protected childs: TreeNode[];

    constructor(data: any, collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None) {
        super(data.name, collapsibleState);
        this.data = data;
        this.parent = this.data.parent;
        this.childs = [];
    }

    get name(): string {
        return this.data.name;
    }
    get text(): string {
        return this.data.name;
    }
    get path(): string {
        throw new Error("请去重写该方法");
    }
    get parentNode(): TreeNode {
        return this.parent;
    }
    public async getChildren(): Promise<TreeNode[]> {
        return this.childs;
    }
    get ruleId(): number {
        return this.data.ruleId;
    }
    get previewCommand() {
        return {
            title: this.text,
            command: Commands.openReaderView,
            arguments: [this]
        };
    }
    addChildren(child: TreeNode) {
        this.childs.push(child);
    }
    prevChild(child: TreeNode): TreeNode | null {
        const index = this.childs.indexOf(child);
        const prev = index > 0 ? this.childs[index - 1] : null;
        return prev;
    }
    nextChild(child: TreeNode): TreeNode | null {
        const index = this.childs.indexOf(child);
        const next = index < this.childs.length - 1 ? this.childs[index + 1] : null;
        return next;
    }
}

export class LocalFileTreeNode extends TreeNode {
    constructor(name: string, filePath: string, parent?: TreeNode) {
        const data = {
            name,
            filePath,
            ruleId: -1, // 本地文件的特殊标识
            parent
        };
        super(data, vscode.TreeItemCollapsibleState.None);
        this.parent = parent || this;
        
        // 设置图标
        this.iconPath = vscode.ThemeIcon.File;
        
        // 设置工具提示
        this.tooltip = `本地文件: ${name}`;
        
        // 设置命令
        this.command = {
            command: Commands.openReaderView,
            title: '打开文件',
            arguments: [this]
        };
    }

    get text(): string {
        return this.data.name;
    }

    get path(): string {
        return this.data.filePath;
    }

    get filePath(): string {
        return this.data.filePath;
    }

    get ruleId(): number {
        return this.data.ruleId;
    }

    get previewCommand() {
        return {
            title: this.text,
            command: Commands.openReaderView,
            arguments: [this]
        };
    }

    contextValue = 'LocalFileTreeNode';
}