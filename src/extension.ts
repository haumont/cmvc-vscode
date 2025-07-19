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

    constructor() {
        // Load saved configuration
        this.loadConfig();
    }

    private loadConfig() {
        const workspaceConfig = vscode.workspace.getConfiguration('cmvc');
        this.config.family = workspaceConfig.get('family', '');
        this.config.release = workspaceConfig.get('release', '');
        this.config.defect = workspaceConfig.get('defect', '');
    }

    private saveConfig() {
        const workspaceConfig = vscode.workspace.getConfiguration('cmvc');
        workspaceConfig.update('family', this.config.family, vscode.ConfigurationTarget.Workspace);
        workspaceConfig.update('release', this.config.release, vscode.ConfigurationTarget.Workspace);
        workspaceConfig.update('defect', this.config.defect, vscode.ConfigurationTarget.Workspace);
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

class CMVCExplorerProvider implements vscode.TreeDataProvider<CMVCExplorerItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<CMVCExplorerItem | undefined | null | void> = new vscode.EventEmitter<CMVCExplorerItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<CMVCExplorerItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private cmvcService: CMVCService;

    constructor(cmvcService: CMVCService) {
        this.cmvcService = cmvcService;
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: CMVCExplorerItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: CMVCExplorerItem): Thenable<CMVCExplorerItem[]> {
        if (!element) {
            // Root level - return configuration items and file explorer
            return Promise.resolve([
                new ConfigSectionItem('Configuration'),
                new FileExplorerItem('Files'),
                new TrackSectionItem('Track')
            ]);
        }

        if (element instanceof ConfigSectionItem) {
            const config = this.cmvcService.getConfig();
            return Promise.resolve([
                new ConfigItem('Family', config.family, 'cmvc.setFamily'),
                new ConfigItem('Release', config.release, 'cmvc.setRelease'),
                new ConfigItem('Defect', config.defect, 'cmvc.setDefect')
            ]);
        }

        if (element instanceof FileExplorerItem) {
            return this.getFiles();
        }

        if (element instanceof TrackSectionItem) {
            return Promise.resolve([
                new TrackItem('Track support in the future')
            ]);
        }

        return Promise.resolve([]);
    }

    private async getFiles(): Promise<CMVCExplorerItem[]> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return [];
        }

        const files: CMVCExplorerItem[] = [];
        this.getFilesRecursively(workspaceFolder.uri.fsPath, files, workspaceFolder.uri.fsPath);
        return files;
    }

    private getFilesRecursively(dirPath: string, items: CMVCExplorerItem[], rootPath: string) {
        try {
            const files = fs.readdirSync(dirPath);
            for (const file of files) {
                const fullPath = path.join(dirPath, file);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    // Skip node_modules and .git directories
                    if (file !== 'node_modules' && file !== '.git' && !file.startsWith('.')) {
                        const folderItem = new FolderItem(file, fullPath);
                        items.push(folderItem);
                        this.getFilesRecursively(fullPath, items, rootPath);
                    }
                } else {
                    // Include all files - let the user decide which ones to work with
                    const relativePath = path.relative(rootPath, fullPath);
                    items.push(new FileItem(file, fullPath, relativePath));
                }
            }
        } catch (error) {
            console.error('Error reading directory:', error);
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

let cmvcService: CMVCService;
let cmvcExplorerProvider: CMVCExplorerProvider;

export function activate(context: vscode.ExtensionContext) {
    // Initialize CMVC service
    cmvcService = new CMVCService();

    // Register tree data provider
    cmvcExplorerProvider = new CMVCExplorerProvider(cmvcService);
    const treeView = vscode.window.registerTreeDataProvider('cmvcExplorer', cmvcExplorerProvider);

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('cmvc.setFamily', async () => {
            const value = await vscode.window.showInputBox({
                prompt: 'Enter Family value',
                value: cmvcService.getConfig().family
            });
            if (value !== undefined) {
                cmvcService.setFamily(value);
                cmvcExplorerProvider.refresh();
            }
        }),

        vscode.commands.registerCommand('cmvc.setRelease', async () => {
            const value = await vscode.window.showInputBox({
                prompt: 'Enter Release value',
                value: cmvcService.getConfig().release
            });
            if (value !== undefined) {
                cmvcService.setRelease(value);
                cmvcExplorerProvider.refresh();
            }
        }),

        vscode.commands.registerCommand('cmvc.setDefect', async () => {
            const value = await vscode.window.showInputBox({
                prompt: 'Enter Defect value',
                value: cmvcService.getConfig().defect
            });
            if (value !== undefined) {
                cmvcService.setDefect(value);
                cmvcExplorerProvider.refresh();
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
        })
    );
}

export function deactivate() {} 