import { TFile, Vault, normalizePath, Modal, App } from 'obsidian';
import { GithubRepository, UserRepoEnhancements, ExportOptions, ExportResult, RepoExportData, DEFAULT_EXPORT_OPTIONS } from './types';
import { EmojiUtils } from './emojiUtils';

/**
 * GitHub Stars 导出服务
 * 负责将星标仓库导出为Markdown文件
 */
export class ExportService {
    private vault: Vault;
    private app: App;
    private overwriteAll: boolean | null = null; // 用于跟踪"覆盖全部"的状态

    constructor(app: App) {
        this.app = app;
        this.vault = app.vault;
    }


    /**
     * 导出所有仓库
     */
    async exportAllRepositories(
        repositories: GithubRepository[],
        userEnhancements: { [repoId: number]: UserRepoEnhancements },
        options: Partial<ExportOptions> = {}
    ): Promise<ExportResult> {
        const exportOptions = { ...DEFAULT_EXPORT_OPTIONS, ...options };
        this.overwriteAll = null; // 重置覆盖状态
        const result: ExportResult = {
            success: true,
            exportedCount: 0,
            skippedCount: 0,
            errors: [],
            exportedFiles: []
        };

        try {
            // 确保目标文件夹存在
            await this.ensureFolderExists(exportOptions.targetFolder);

            // 为每个仓库生成导出数据
            const exportDataList = repositories.map(repo => 
                this.generateRepoExportData(repo, userEnhancements[repo.id], exportOptions)
            );

            // 执行导出
            for (const exportData of exportDataList) {
                try {
                    const success = await this.exportSingleRepository(exportData, exportOptions);
                    if (success) {
                        result.exportedCount++;
                        result.exportedFiles.push(exportData.filename);
                    } else {
                        result.skippedCount++;
                    }
                } catch (error) {
                    result.errors.push(`导出 ${exportData.repository.full_name} 失败: ${error.message}`);
                    result.skippedCount++;
                }
            }

            if (result.errors.length > 0) {
                result.success = false;
            }

        } catch (error) {
            result.success = false;
            result.errors.push(`导出过程失败: ${error.message}`);
        }

        return result;
    }

    /**
     * 导出单个仓库
     */
    async exportSingleRepositoryById(
        repository: GithubRepository,
        userEnhancements: UserRepoEnhancements | undefined,
        options: Partial<ExportOptions> = {}
    ): Promise<boolean> {
        const exportOptions = { ...DEFAULT_EXPORT_OPTIONS, ...options };
        
        try {
            // 确保目标文件夹存在
            await this.ensureFolderExists(exportOptions.targetFolder);

            // 生成导出数据
            const exportData = this.generateRepoExportData(repository, userEnhancements, exportOptions);

            // 执行导出
            return await this.exportSingleRepository(exportData, exportOptions);
        } catch (error) {
            // 静默处理单个仓库导出错误
            return false;
        }
    }

    /**
     * 生成单个仓库的导出数据
     */
    private generateRepoExportData(
        repository: GithubRepository,
        enhancements: UserRepoEnhancements | undefined,
        options: ExportOptions
    ): RepoExportData {
        const filename = this.generateFilename(repository, options.filenameTemplate);
        const content = this.generateMarkdownContent(repository, enhancements, options);

        return {
            repository,
            enhancements,
            filename,
            content
        };
    }

    /**
     * 执行单个仓库的导出
     */
    private async exportSingleRepository(
        exportData: RepoExportData,
        options: ExportOptions
    ): Promise<boolean> {
        const filePath = normalizePath(`${options.targetFolder}/${exportData.filename}.md`);

        // 检查文件是否已存在
        const existingFile = this.vault.getAbstractFileByPath(filePath);
        if (existingFile && !options.overwriteExisting) {
            if (this.overwriteAll === true) {
                // 用户已选择"覆盖全部"
            } else if (this.overwriteAll === false) {
                // 用户已选择"跳过全部"
                return false;
            } else {
                // 询问用户
                const userChoice = await this.confirmOverwrite(filePath);
                    if (userChoice === 'overwriteAll') {
                        this.overwriteAll = true;
                    } else if (userChoice === 'skipAll') {
                        this.overwriteAll = false;
                        return false;
                    } else if (userChoice === 'skip') {
                        return false;
                    }
                    // 如果是 'overwrite'，则继续执行
                }
            }

        // 创建或更新文件
        if (existingFile instanceof TFile) {
            await this.vault.modify(existingFile, exportData.content);
        } else {
            await this.vault.create(filePath, exportData.content);
        }

        return true;
    }

    /**
     * 确认是否覆盖现有文件
     */
    private async confirmOverwrite(filePath: string): Promise<'overwrite' | 'skip' | 'overwriteAll' | 'skipAll'> {
        return new Promise((resolve) => {
            const modal = new OverwriteConfirmModal(this.app, filePath, resolve);
            modal.open();
        });
    }

    /**
     * 生成文件名
     */
    private generateFilename(repository: GithubRepository, template: string): string {
        let filename = template
            .replace(/\{\{owner\}\}/g, repository.owner?.login || 'unknown')
            .replace(/\{\{name\}\}/g, repository.name || 'unnamed')
            .replace(/\{\{full_name\}\}/g, repository.full_name || 'unknown/unnamed')
            .replace(/\{\{id\}\}/g, repository.id.toString());

        // 清理文件名中的非法字符
        filename = filename.replace(/[<>:"/\\|?*]/g, '-');
        
        return filename;
    }

    /**
     * 生成Markdown内容
     */
    private generateMarkdownContent(
        repository: GithubRepository,
        enhancements: UserRepoEnhancements | undefined,
        options: ExportOptions
    ): string {
        const lines: string[] = [];

        // 只生成Properties YAML前置内容，不生成正文
        if (options.includeProperties && options.propertiesTemplate && options.propertiesTemplate.length > 0) {
            lines.push('---');
            for (const property of options.propertiesTemplate) {
                // 只处理启用的属性
                if (property.enabled) {
                    let value = this.resolvePropertyValue(property.value, repository, enhancements, options);
                    
                    // 应用emoji保护和恢复
                    value = EmojiUtils.restoreEmojis(value);
                    
                    // For checkbox type, the value can be 'true' or 'false', so we don't check trim()
                    if (property.type === 'checkbox' || value.trim()) {
                        lines.push(`${property.key}: ${value}`);
                    }
                }
            }
            lines.push('---');
        }

        // 对整个内容应用emoji保护
        let content = lines.join('\n');
        content = EmojiUtils.restoreEmojis(content);
        
        return content;
    }

    /**
     * 格式化日期
     */
    private formatDate(dateString: string): string {
        try {
            const date = new Date(dateString);
            return date.toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return dateString;
        }
    }

    /**
     * 解析Properties模板变量
     */
    private resolvePropertyValue(
        template: string,
        repository: GithubRepository,
        enhancements: UserRepoEnhancements | undefined,
        options: ExportOptions
    ): string {
        let value = template;

        const placeholderToKey = (placeholder: string): string => {
            if (placeholder === 'full_name') return 'GSM-title';
            if (placeholder === 'id') return 'GSM-repo-id';
            if (placeholder === 'notes') return 'GSM-user-notes';
            if (placeholder === 'user_tags') return 'GSM-user-tags';
            if (placeholder === 'linked_note') return 'GSM-linked-note';
            return `GSM-${placeholder.replace(/_/g, '-')}`;
        };

        const isEnabled = (placeholder: string) => {
            const key = placeholderToKey(placeholder);
            const prop = options.propertiesTemplate.find(p => p.key === key);
            return prop ? prop.enabled : false; // Default to false if not found
        };

        const replacements: { [key: string]: () => string } = {
            'name': () => repository.name || '',
            'full_name': () => repository.full_name || '',
            'owner': () => repository.owner?.login || '',
            'description': () => repository.description || '',
            'language': () => repository.language || '',
            'url': () => repository.html_url || '',
            'id': () => repository.id.toString(),
            'stars': () => (repository.stargazers_count || 0).toString(),
            'forks': () => (repository.forks_count || 0).toString(),
            'watchers': () => (repository.watchers_count || 0).toString(),
            'issues': () => (repository.open_issues_count || 0).toString(),
            'created_at': () => repository.created_at ? this.formatDate(repository.created_at) : '',
            'updated_at': () => repository.updated_at ? this.formatDate(repository.updated_at) : '',
            'pushed_at': () => repository.pushed_at ? this.formatDate(repository.pushed_at) : '',
            'starred_at': () => repository.starred_at ? this.formatDate(repository.starred_at) : '',
            'is_private': () => repository.private ? 'true' : 'false',
            'is_fork': () => repository.fork ? 'true' : 'false',
            'topics': () => (repository.topics && repository.topics.length > 0) ? `[${repository.topics.map(t => `"${t}"`).join(', ')}]` : '[]',
            'notes': () => enhancements?.notes || '',
            'user_tags': () => (enhancements?.tags && enhancements.tags.length > 0) ? `\n${enhancements.tags.map(tag => `  - ${tag}`).join('\n')}` : '[]',
            'linked_note': () => enhancements?.linked_note || ''
        };

        for (const placeholder in replacements) {
            if (value.includes(`{{${placeholder}}}`)) {
                if (isEnabled(placeholder)) {
                    value = value.replace(new RegExp(`\\{\\{${placeholder}\\}\\}`, 'g'), replacements[placeholder]());
                } else {
                    value = value.replace(new RegExp(`\\{\\{${placeholder}\\}\\}`, 'g'), '');
                }
            }
        }

        return value;
    }

    /**
     * 格式化YAML值
     */
    private formatYamlValue(value: string): string {
        // 如果值包含特殊字符或空格，需要用引号包围
        if (value.includes(':') || value.includes('#') || value.includes('\n') || value.includes('"') || value.includes("'")) {
            return `"${value.replace(/"/g, '\\"')}"`;
        }
        
        // 如果值为空，返回空字符串
        if (!value.trim()) {
            return '""';
        }
        
        return value;
    }

    /**
     * 确保文件夹存在
     */
    private async ensureFolderExists(folderPath: string): Promise<void> {
        const normalizedPath = normalizePath(folderPath);
        
        if (!this.vault.getAbstractFileByPath(normalizedPath)) {
            await this.vault.createFolder(normalizedPath);
        }
    }
}

/**
 * 文件覆盖确认对话框
 */
class OverwriteConfirmModal extends Modal {
    private filePath: string;
    private resolve: (value: 'overwrite' | 'skip' | 'overwriteAll' | 'skipAll') => void;

    constructor(app: App, filePath: string, resolve: (value: 'overwrite' | 'skip' | 'overwriteAll' | 'skipAll') => void) {
        super(app);
        this.filePath = filePath;
        this.resolve = resolve;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        // 标题
        contentEl.createEl('h2', { text: '文件已存在' });

        // 提示信息
        const messageEl = contentEl.createDiv('overwrite-confirm-message');
        messageEl.createEl('p', { text: '以下文件已存在：' });
        messageEl.createEl('code', { text: this.filePath });
        messageEl.createEl('p', { text: '是否要覆盖现有文件？' });

        // 按钮容器
        const buttonContainer = contentEl.createDiv('overwrite-confirm-buttons button-flex-container');

        // 跳过按钮
        const skipButton = buttonContainer.createEl('button', { text: '跳过' });
        skipButton.addEventListener('click', () => {
            this.resolve('skip');
            this.close();
        });

        // 跳过全部按钮
        const skipAllButton = buttonContainer.createEl('button', { text: '跳过全部' });
        skipAllButton.addEventListener('click', () => {
            this.resolve('skipAll');
            this.close();
        });

        // 覆盖按钮
        const overwriteButton = buttonContainer.createEl('button', { text: '覆盖' });
        overwriteButton.addEventListener('click', () => {
            this.resolve('overwrite');
            this.close();
        });

        // 覆盖全部按钮
        const overwriteAllButton = buttonContainer.createEl('button', { text: '覆盖全部', cls: 'mod-cta' });
        overwriteAllButton.addEventListener('click', () => {
            this.resolve('overwriteAll');
            this.close();
        });

        // 默认焦点在跳过按钮上
        skipButton.focus();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}