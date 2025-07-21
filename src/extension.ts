import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface CMVCConfig {
    family: string;
    release: string;
    defect: string;
}

class CMVCService {
    private config: CMVCConfig = {
        family: '',
        release: '',
        defect: ''
    };
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        // Load saved configuration
        this.loadConfig();
    }

    private loadConfig() {
        this.config.family = this.context.workspaceState.get('cmvc.family', '');
        this.config.release = this.context.workspaceState.get('cmvc.release', '');
        this.config.defect = this.context.workspaceState.get('cmvc.defect', '');
    }

    private saveConfig() {
        this.context.workspaceState.update('cmvc.family', this.config.family);
        this.context.workspaceState.update('cmvc.release', this.config.release);
        this.context.workspaceState.update('cmvc.defect', this.config.defect);
    }

    getConfig(): CMVCConfig {
        return { ...this.config };
    }

    setFamily(value: string) {
        this.config.family = value;
        this.saveConfig();
    }

    setRelease(value: string) {
        this.config.release = value;
        this.saveConfig();
    }

    setDefect(value: string) {
        this.config.defect = value;
        this.saveConfig();
    }

    async checkin(filePath: string) {
        if (!this.config.family || !this.config.release || !this.config.defect) {
            vscode.window.showErrorMessage('Please set Family, Release, and Defect values first.');
            return;
        }

        try {
            const command = `File -checkin "${filePath}" -defect "${this.config.defect}" -release "${this.config.release}" -family "${this.config.family}"`;
            const { stdout, stderr } = await execAsync(command);

            if (stderr) {
                vscode.window.showErrorMessage(`Checkin failed: ${stderr}`);
            } else {
                vscode.window.showInformationMessage(`Successfully checked in: ${path.basename(filePath)}`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Checkin failed: ${error}`);
        }
    }

    async checkout(filePath: string) {
        if (!this.config.family || !this.config.release || !this.config.defect) {
            vscode.window.showErrorMessage('Please set Family, Release, and Defect values first.');
            return;
        }

        try {
            const command = `File -checkout "${filePath}" -defect "${this.config.defect}" -release "${this.config.release}" -family "${this.config.family}"`;
            const { stdout, stderr } = await execAsync(command);

            if (stderr) {
                vscode.window.showErrorMessage(`Checkout failed: ${stderr}`);
            } else {
                vscode.window.showInformationMessage(`Successfully checked out: ${path.basename(filePath)}`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Checkout failed: ${error}`);
        }
    }

    async view(filePath: string) {
        if (!this.config.family || !this.config.release) {
            vscode.window.showErrorMessage('Please set Family and Release values first.');
            return;
        }

        try {
            const command = `File -view "${filePath}" -release "${this.config.release}" -family "${this.config.family}"`;
            const { stdout, stderr } = await execAsync(command);

            if (stderr) {
                vscode.window.showErrorMessage(`View failed: ${stderr}`);
            } else {
                // Create a new document with the output
                const document = await vscode.workspace.openTextDocument({
                    content: stdout,
                    language: 'text'
                });
                await vscode.window.showTextDocument(document, { preview: false });
            }
        } catch (error) {
            vscode.window.showErrorMessage(`View failed: ${error}`);
        }
    }
}

abstract class CMVCExplorerItem extends vscode.TreeItem {
    constructor(
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
    ) {
        super(label, collapsibleState);
    }
}

class ConfigSectionItem extends CMVCExplorerItem {
    public iconPath: vscode.ThemeIcon;

    constructor(label: string) {
        super(label, vscode.TreeItemCollapsibleState.Expanded);
        this.iconPath = new vscode.ThemeIcon('gear');
    }
}

class ConfigItem extends CMVCExplorerItem {
    public command: vscode.Command;
    public iconPath: vscode.ThemeIcon;

    constructor(label: string, value: string, command: string) {
        super(`${label}: ${value || 'Not set'}`, vscode.TreeItemCollapsibleState.None);
        this.command = {
            command: command,
            title: `Set ${label}`,
            arguments: []
        };
        this.iconPath = new vscode.ThemeIcon('edit');
    }
}

class FileExplorerItem extends CMVCExplorerItem {
    public iconPath: vscode.ThemeIcon;

    constructor(label: string) {
        super(label, vscode.TreeItemCollapsibleState.Expanded);
        this.iconPath = new vscode.ThemeIcon('files');
    }
}

class FileItem extends CMVCExplorerItem {
    public tooltip: string;
    public resourceUri: vscode.Uri;
    public contextValue: string;
    public iconPath: vscode.ThemeIcon;

    constructor(label: string, fullPath: string, relativePath: string) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.tooltip = relativePath;
        this.resourceUri = vscode.Uri.file(fullPath);
        this.contextValue = 'file';
        this.iconPath = new vscode.ThemeIcon('file');
    }
}

class FolderItem extends CMVCExplorerItem {
    public resourceUri: vscode.Uri;
    public iconPath: vscode.ThemeIcon;

    constructor(label: string, fullPath: string) {
        super(label, vscode.TreeItemCollapsibleState.Collapsed);
        this.resourceUri = vscode.Uri.file(fullPath);
        this.iconPath = new vscode.ThemeIcon('folder');
    }
}

class TrackSectionItem extends CMVCExplorerItem {
    public iconPath: vscode.ThemeIcon;

    constructor(label: string) {
        super(label, vscode.TreeItemCollapsibleState.Expanded);
        this.iconPath = new vscode.ThemeIcon('timeline');
    }
}

class TrackItem extends CMVCExplorerItem {
    public iconPath: vscode.ThemeIcon;

    constructor(label: string) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.iconPath = new vscode.ThemeIcon('info');
    }
}

// --- Config Provider ---
class CMVCConfigProvider implements vscode.TreeDataProvider<ConfigItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ConfigItem | undefined | null | void> = new vscode.EventEmitter<ConfigItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ConfigItem | undefined | null | void> = this._onDidChangeTreeData.event;
    private cmvcService: CMVCService;
    constructor(cmvcService: CMVCService) {
        this.cmvcService = cmvcService;
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element: ConfigItem): vscode.TreeItem {
        return element;
    }
    getChildren(element?: ConfigItem): Thenable<ConfigItem[]> {
        if (!element) {
            const config = this.cmvcService.getConfig();
            return Promise.resolve([
                new ConfigItem('Family', config.family, 'cmvc.setFamily'),
                new ConfigItem('Release', config.release, 'cmvc.setRelease'),
                new ConfigItem('Defect', config.defect, 'cmvc.setDefect')
            ]);
        }
        return Promise.resolve([]);
    }
}

// --- Files Provider ---
class CMVCFilesProvider implements vscode.TreeDataProvider<CMVCExplorerItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<CMVCExplorerItem | undefined | null | void> = new vscode.EventEmitter<CMVCExplorerItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<CMVCExplorerItem | undefined | null | void> = this._onDidChangeTreeData.event;
    private cmvcService: CMVCService;
    private fileSystemWatcher: vscode.FileSystemWatcher | undefined;
    constructor(cmvcService: CMVCService) {
        this.cmvcService = cmvcService;
        this.setupFileSystemWatcher();
    }
    private setupFileSystemWatcher() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }
        this.fileSystemWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(workspaceFolder, '**/*')
        );
        this.fileSystemWatcher.onDidCreate(() => this.refresh());
        this.fileSystemWatcher.onDidDelete(() => this.refresh());
        this.fileSystemWatcher.onDidChange(() => this.refresh());
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    dispose() {
        if (this.fileSystemWatcher) {
            this.fileSystemWatcher.dispose();
        }
    }
    getTreeItem(element: CMVCExplorerItem): vscode.TreeItem {
        return element;
    }
    getChildren(element?: CMVCExplorerItem): Thenable<CMVCExplorerItem[]> {
        if (!element) {
            return this.getWorkspaceFiles();
        }
        if (element instanceof FolderItem) {
            return this.getFolderContents(element.resourceUri.fsPath);
        }
        return Promise.resolve([]);
    }
    private async getWorkspaceFiles(): Promise<CMVCExplorerItem[]> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return [];
        }
        const items: CMVCExplorerItem[] = [];
        this.getDirectoryContents(workspaceFolder.uri.fsPath, items);
        return items;
    }
    private async getFolderContents(folderPath: string): Promise<CMVCExplorerItem[]> {
        const items: CMVCExplorerItem[] = [];
        this.getDirectoryContents(folderPath, items);
        return items;
    }
    private getDirectoryContents(dirPath: string, items: CMVCExplorerItem[]) {
        try {
            const files = fs.readdirSync(dirPath);
            const directories: string[] = [];
            const filesList: string[] = [];
            for (const file of files) {
                const fullPath = path.join(dirPath, file);
                const stat = fs.statSync(fullPath);
                if (stat.isDirectory()) {
                    if (file !== 'node_modules' && file !== '.git' && !file.startsWith('.')) {
                        directories.push(file);
                    }
                } else {
                    filesList.push(file);
                }
            }
            directories.sort();
            filesList.sort();
            for (const dir of directories) {
                const fullPath = path.join(dirPath, dir);
                items.push(new FolderItem(dir, fullPath));
            }
            for (const file of filesList) {
                const fullPath = path.join(dirPath, file);
                const relativePath = path.relative(vscode.workspace.workspaceFolders![0].uri.fsPath, fullPath);
                items.push(new FileItem(file, fullPath, relativePath));
            }
        } catch (error) {
            console.error('Error reading directory:', error);
        }
    }
}

// --- Track Provider ---
class CMVCTrackProvider implements vscode.TreeDataProvider<TrackItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TrackItem | undefined | null | void> = new vscode.EventEmitter<TrackItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TrackItem | undefined | null | void> = this._onDidChangeTreeData.event;
    constructor() {}
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element: TrackItem): vscode.TreeItem {
        return element;
    }
    getChildren(element?: TrackItem): Thenable<TrackItem[]> {
        if (!element) {
            return Promise.resolve([
                new TrackItem('Track support in the future')
            ]);
        }
        return Promise.resolve([]);
    }
}

let cmvcService: CMVCService;
let cmvcConfigProvider: CMVCConfigProvider;
let cmvcFilesProvider: CMVCFilesProvider;
let cmvcTrackProvider: CMVCTrackProvider;

export function activate(context: vscode.ExtensionContext) {
    // Initialize CMVC service
    cmvcService = new CMVCService(context);

    // Register three tree data providers for three views
    cmvcConfigProvider = new CMVCConfigProvider(cmvcService);
    cmvcFilesProvider = new CMVCFilesProvider(cmvcService);
    cmvcTrackProvider = new CMVCTrackProvider();
    vscode.window.registerTreeDataProvider('cmvcConfig', cmvcConfigProvider);
    vscode.window.registerTreeDataProvider('cmvcFiles', cmvcFilesProvider);
    vscode.window.registerTreeDataProvider('cmvcTrack', cmvcTrackProvider);

    // Register commands (no change needed)
    context.subscriptions.push(
        vscode.commands.registerCommand('cmvc.setFamily', async () => {
            const value = await vscode.window.showInputBox({
                prompt: 'Enter Family value',
                value: cmvcService.getConfig().family
            });
            if (value !== undefined) {
                cmvcService.setFamily(value);
                cmvcConfigProvider.refresh();
            }
        }),
        vscode.commands.registerCommand('cmvc.setRelease', async () => {
            const value = await vscode.window.showInputBox({
                prompt: 'Enter Release value',
                value: cmvcService.getConfig().release
            });
            if (value !== undefined) {
                cmvcService.setRelease(value);
                cmvcConfigProvider.refresh();
            }
        }),
        vscode.commands.registerCommand('cmvc.setDefect', async () => {
            const value = await vscode.window.showInputBox({
                prompt: 'Enter Defect value',
                value: cmvcService.getConfig().defect
            });
            if (value !== undefined) {
                cmvcService.setDefect(value);
                cmvcConfigProvider.refresh();
            }
        }),
        vscode.commands.registerCommand('cmvc.checkin', (item: FileItem) => {
            if (item && item.resourceUri) {
                cmvcService.checkin(item.resourceUri.fsPath);
            }
        }),
        vscode.commands.registerCommand('cmvc.checkout', (item: FileItem) => {
            if (item && item.resourceUri) {
                cmvcService.checkout(item.resourceUri.fsPath);
            }
        }),
        vscode.commands.registerCommand('cmvc.view', (item: FileItem) => {
            if (item && item.resourceUri) {
                cmvcService.view(item.resourceUri.fsPath);
            }
        }),
        vscode.commands.registerCommand('cmvc.checkinFile', (item: FileItem) => {
            if (item && item.resourceUri) {
                cmvcService.checkin(item.resourceUri.fsPath);
            }
        }),
        vscode.commands.registerCommand('cmvc.checkoutFile', (item: FileItem) => {
            if (item && item.resourceUri) {
                cmvcService.checkout(item.resourceUri.fsPath);
            }
        }),
        vscode.commands.registerCommand('cmvc.viewFile', (item: FileItem) => {
            if (item && item.resourceUri) {
                cmvcService.view(item.resourceUri.fsPath);
            }
        }),
        vscode.commands.registerCommand('cmvc.checkinInline', (item: FileItem) => {
            if (item && item.resourceUri) {
                cmvcService.checkin(item.resourceUri.fsPath);
            }
        }),
        vscode.commands.registerCommand('cmvc.checkoutInline', (item: FileItem) => {
            if (item && item.resourceUri) {
                cmvcService.checkout(item.resourceUri.fsPath);
            }
        }),
        vscode.commands.registerCommand('cmvc.viewInline', (item: FileItem) => {
            if (item && item.resourceUri) {
                cmvcService.view(item.resourceUri.fsPath);
            }
        }),
        vscode.commands.registerCommand('cmvc.create', async (item: FileItem) => {
            if (!item || !item.resourceUri) {
                vscode.window.showErrorMessage('No file selected for creation.');
                return;
            }
            const context = cmvcService['context'];
            const lastComponent = context.workspaceState.get<string>('cmvc.lastComponent', '');
            const component = await vscode.window.showInputBox({
                prompt: 'Enter Component',
                value: lastComponent
            });
            if (!component) {
                vscode.window.showErrorMessage('Component is required.');
                return;
            }
            context.workspaceState.update('cmvc.lastComponent', component);
            const config = cmvcService.getConfig();
            const command = `File -create "${item.resourceUri.fsPath}" -component "${component}" -defect "${config.defect}" -release "${config.release}" -family "${config.family}"`;
            try {
                const { stdout, stderr } = await execAsync(command);
                if (stderr) {
                    vscode.window.showErrorMessage(`Create failed: ${stderr}`);
                } else {
                    vscode.window.showInformationMessage(`Successfully created: ${item.resourceUri.fsPath}`);
                    cmvcFilesProvider.refresh();
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Create failed: ${error}`);
            }
        })
    );
}

export function deactivate() {
    if (cmvcFilesProvider) {
        cmvcFilesProvider.dispose();
    }
}
