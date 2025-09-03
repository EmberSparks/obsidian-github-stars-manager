import { TFile, TFolder, Vault, normalizePath, Modal, App } from 'obsidian';
import { GithubRepository, UserRepoEnhancements, ExportOptions, ExportResult, RepoExportData, DEFAULT_EXPORT_OPTIONS } from './types';

/**
 * GitHub Stars 导出服务
 * 负责将星标仓库导出为Markdown文件
 */
export class ExportService {
    private vault: Vault;
    private app: App;

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
            console.error(`导出仓库 ${repository.full_name} 失败:`, error);
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

        try {
            // 检查文件是否已存在
            const existingFile = this.vault.getAbstractFileByPath(filePath);
            if (existingFile && !options.overwriteExisting) {
                // 询问用户是否覆盖
                const shouldOverwrite = await this.confirmOverwrite(filePath);
                if (!shouldOverwrite) {
                    console.log(`用户选择跳过文件: ${filePath}`);
                    return false;
                }
            }

            // 创建或更新文件
            if (existingFile instanceof TFile) {
                await this.vault.modify(existingFile, exportData.content);
            } else {
                await this.vault.create(filePath, exportData.content);
            }

            return true;
        } catch (error) {
            console.error(`写入文件失败 ${filePath}:`, error);
            throw error;
        }
    }

    /**
     * 确认是否覆盖现有文件
     */
    private async confirmOverwrite(filePath: string): Promise<boolean> {
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
                    const value = this.resolvePropertyValue(property.value, repository, enhancements);
                    lines.push(`${property.key}: ${value}`);
                }
            }
            lines.push('---');
        }

        return lines.join('\n');
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
        enhancements: UserRepoEnhancements | undefined
    ): string {
        let value = template;

        // 仓库基本信息变量
        value = value.replace(/\{\{name\}\}/g, repository.name || '');
        value = value.replace(/\{\{full_name\}\}/g, repository.full_name || '');
        value = value.replace(/\{\{owner\}\}/g, repository.owner?.login || '');
        value = value.replace(/\{\{description\}\}/g, repository.description || '');
        value = value.replace(/\{\{language\}\}/g, repository.language || '');
        value = value.replace(/\{\{url\}\}/g, repository.html_url || '');
        value = value.replace(/\{\{id\}\}/g, repository.id.toString());
        
        // 统计信息变量
        value = value.replace(/\{\{stars\}\}/g, (repository.stargazers_count || 0).toString());
        value = value.replace(/\{\{forks\}\}/g, (repository.forks_count || 0).toString());
        value = value.replace(/\{\{watchers\}\}/g, (repository.watchers_count || 0).toString());
        value = value.replace(/\{\{issues\}\}/g, (repository.open_issues_count || 0).toString());
        
        // 时间变量
        value = value.replace(/\{\{created_at\}\}/g, repository.created_at ? this.formatDate(repository.created_at) : '');
        value = value.replace(/\{\{updated_at\}\}/g, repository.updated_at ? this.formatDate(repository.updated_at) : '');
        value = value.replace(/\{\{pushed_at\}\}/g, repository.pushed_at ? this.formatDate(repository.pushed_at) : '');
        value = value.replace(/\{\{starred_at\}\}/g, repository.starred_at ? this.formatDate(repository.starred_at) : '');
        
        // 布尔值变量
        value = value.replace(/\{\{is_private\}\}/g, repository.private ? 'true' : 'false');
        value = value.replace(/\{\{is_fork\}\}/g, repository.fork ? 'true' : 'false');
        
        // 主题标签变量
        if (repository.topics && repository.topics.length > 0) {
            value = value.replace(/\{\{topics\}\}/g, `[${repository.topics.map(t => `"${t}"`).join(', ')}]`);
        } else {
            value = value.replace(/\{\{topics\}\}/g, '[]');
        }
        
        // 用户增强信息变量
        // 提前格式化，避免影响 user_tags
        value = this.formatYamlValue(value);

        if (enhancements) {
            value = value.replace(/\{\{notes\}\}/g, enhancements.notes || '');
            // 处理用户标签 - 遍历每个标签，生成YAML列表格式
            if (enhancements.tags && enhancements.tags.length > 0) {
                // 将用户标签数组转换为YAML列表格式，每个标签单独一行，不带引号
                const userTagsYaml = enhancements.tags.map(tag => `  - ${tag}`).join('\n');
                value = value.replace(/\{\{user_tags\}\}/g, `\n${userTagsYaml}`);
            } else {
                value = value.replace(/\{\{user_tags\}\}/g, '[]');
            }
            value = value.replace(/\{\{linked_note\}\}/g, enhancements.linked_note || '');
        } else {
            value = value.replace(/\{\{notes\}\}/g, '');
            value = value.replace(/\{\{user_tags\}\}/g, '[]');
            value = value.replace(/\{\{linked_note\}\}/g, '');
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
    private resolve: (value: boolean) => void;

    constructor(app: App, filePath: string, resolve: (value: boolean) => void) {
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
        const buttonContainer = contentEl.createDiv('overwrite-confirm-buttons');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'flex-end';
        buttonContainer.style.gap = '10px';
        buttonContainer.style.marginTop = '20px';

        // 取消按钮
        const cancelButton = buttonContainer.createEl('button', { text: '取消' });
        cancelButton.style.padding = '8px 16px';
        cancelButton.addEventListener('click', () => {
            this.resolve(false);
            this.close();
        });

        // 覆盖按钮
        const overwriteButton = buttonContainer.createEl('button', { text: '覆盖' });
        overwriteButton.style.padding = '8px 16px';
        overwriteButton.style.backgroundColor = 'var(--interactive-accent)';
        overwriteButton.style.color = 'var(--text-on-accent)';
        overwriteButton.addEventListener('click', () => {
            this.resolve(true);
            this.close();
        });

        // 默认焦点在取消按钮上
        cancelButton.focus();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}