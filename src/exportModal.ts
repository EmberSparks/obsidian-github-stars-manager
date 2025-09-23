import { App, Modal, Setting, Notice } from 'obsidian';
import GithubStarsPlugin from './main';
import { GithubRepository } from './types';

export class ExportModal extends Modal {
    plugin: GithubStarsPlugin;
    repositories: GithubRepository[];
    selectedRepos: Set<number> = new Set();
    overwriteAll = false;

    constructor(app: App, plugin: GithubStarsPlugin, repositories: GithubRepository[]) {
        super(app);
        this.plugin = plugin;
        this.repositories = repositories;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        // 标题
        contentEl.createEl('h2', { text: '批量导出仓库' });

        // 描述
        contentEl.createEl('p', { 
            text: '选择要导出为Markdown文件的仓库：',
            cls: 'export-modal-description'
        });

        // 全选/取消全选按钮
        const selectAllContainer = contentEl.createDiv('export-modal-select-all');
        const selectAllButton = selectAllContainer.createEl('button', {
            text: '全选',
            cls: 'mod-cta export-modal-select-all-btn'
        });
        selectAllButton.addEventListener('click', () => {
            this.toggleSelectAll();
            this.updateSelectAllButton();
            this.updateExportButton();
        });

        // 仓库列表容器
        const repoListContainer = contentEl.createDiv('export-modal-repo-list');

        // 渲染仓库列表
        this.repositories.forEach(repo => {
            const repoItem = repoListContainer.createDiv('export-modal-repo-item');
            
            // 复选框
            const checkbox = repoItem.createEl('input', {
                type: 'checkbox',
                cls: 'export-modal-checkbox'
            });
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    this.selectedRepos.add(repo.id);
                } else {
                    this.selectedRepos.delete(repo.id);
                }
                this.updateSelectAllButton();
                this.updateExportButton();
            });

            // 仓库信息
            const repoInfo = repoItem.createDiv('export-modal-repo-info');
            
            // 仓库名称
            const repoName = repoInfo.createEl('div', {
                text: repo.full_name,
                cls: 'export-modal-repo-name'
            });

            // 仓库描述
            if (repo.description) {
                repoInfo.createEl('div', {
                    text: repo.description,
                    cls: 'export-modal-repo-description'
                });
            }

            // 仓库统计信息
            const repoStats = repoInfo.createDiv('export-modal-repo-stats');
            repoStats.createEl('span', { text: `⭐ ${repo.stargazers_count}` });
            if (repo.language) {
                repoStats.createEl('span', { text: `📝 ${repo.language}` });
            }
        });

        // 底部按钮
        const buttonContainer = contentEl.createDiv('export-modal-buttons');
        
        // 导出按钮
        const exportButton = buttonContainer.createEl('button', {
            text: '导出选中的仓库',
            cls: 'mod-cta export-modal-export-btn'
        });
        exportButton.disabled = true;
        exportButton.addEventListener('click', async () => {
            await this.exportSelected();
        });

        // 取消按钮
        const cancelButton = buttonContainer.createEl('button', {
            text: '取消',
            cls: 'export-modal-cancel-btn'
        });
        cancelButton.addEventListener('click', () => {
            this.close();
        });

        // 保存按钮引用以便更新
        this.selectAllButton = selectAllButton;
        this.exportButton = exportButton;
    }

    private selectAllButton: HTMLButtonElement;
    private exportButton: HTMLButtonElement;

    toggleSelectAll() {
        const allSelected = this.selectedRepos.size === this.repositories.length;
        
        if (allSelected) {
            // 取消全选
            this.selectedRepos.clear();
            this.contentEl.querySelectorAll('.export-modal-checkbox').forEach((checkbox: HTMLInputElement) => {
                checkbox.checked = false;
            });
        } else {
            // 全选
            this.repositories.forEach(repo => this.selectedRepos.add(repo.id));
            this.contentEl.querySelectorAll('.export-modal-checkbox').forEach((checkbox: HTMLInputElement) => {
                checkbox.checked = true;
            });
        }
    }

    updateSelectAllButton() {
        if (!this.selectAllButton) return;
        
        const allSelected = this.selectedRepos.size === this.repositories.length;
        this.selectAllButton.textContent = allSelected ? '取消全选' : '全选';
    }

    updateExportButton() {
        if (!this.exportButton) return;
        
        const selectedCount = this.selectedRepos.size;
        this.exportButton.disabled = selectedCount === 0;
        this.exportButton.textContent = selectedCount > 0 ? `导出 ${selectedCount} 个仓库` : '导出选中的仓库';
    }

    async exportSelected() {
        if (this.selectedRepos.size === 0) {
            new Notice('请先选择要导出的仓库');
            return;
        }

        const selectedRepositories = this.repositories.filter(repo => 
            this.selectedRepos.has(repo.id)
        );

        // 禁用导出按钮，显示进度
        this.exportButton.disabled = true;
        this.exportButton.textContent = '导出中...';

        try {
            const exportOptions = {
                ...this.plugin.data.exportOptions,
                overwriteExisting: this.overwriteAll
            };

            const result = await this.plugin.exportService.exportAllRepositories(
                selectedRepositories,
                this.plugin.data.userEnhancements,
                exportOptions
            );

            if (result.success) {
                new Notice(`导出完成！成功导出 ${result.exportedCount} 个仓库`);
            } else {
                new Notice(`导出完成，但有错误。成功导出 ${result.exportedCount} 个仓库，失败 ${result.errors.length} 个`);
                // 导出错误信息已在Notice中显示
            }

            this.close();
        } catch (error) {
            new Notice('导出失败，请检查路径和权限设置', 5000);
            new Notice('导出失败，请查看控制台了解详情');
            
            // 恢复按钮状态
            this.exportButton.disabled = false;
            this.updateExportButton();
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}