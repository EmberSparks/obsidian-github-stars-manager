import { Plugin, Notice, WorkspaceLeaf, addIcon } from 'obsidian';
import { GithubStarsSettings, PluginData, CombinedPluginData, GithubRepository, ExportOptions, DEFAULT_EXPORT_OPTIONS } from './types'; // 移除 LocalRepository, 添加 GithubRepository, ExportOptions
import { DEFAULT_SETTINGS, GithubStarsSettingTab } from './settings';
import { GithubService } from './githubService';
import { GithubStarsView, VIEW_TYPE_STARS } from './view';
import { ExportService } from './exportService';

// GitHub星标图标 (不变)
const GITHUB_STAR_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-star"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;

// 默认插件数据 (更新结构)
const DEFAULT_PLUGIN_DATA: PluginData = {
    githubRepositories: [], // 重命名
    userEnhancements: {},   // 新增
    allTags: [],            // 新增 (替代旧的 tags)
    lastSyncTime: '',
    accountSyncTimes: {},   // 新增：每个账号的同步时间
    exportOptions: undefined // 新增：导出选项（可选）
};

// 默认合并数据 (不变，因为内部引用已更新)
const DEFAULT_COMBINED_DATA: CombinedPluginData = {
    settings: DEFAULT_SETTINGS,
    pluginData: DEFAULT_PLUGIN_DATA
};

export default class GithubStarsPlugin extends Plugin {
    settings: GithubStarsSettings;
    githubService: GithubService;
    exportService: ExportService;
    data: PluginData; // 引用 PluginData，其内部结构已改变
    syncIntervalId: number | null = null;

    async onload() {
        addIcon('github-star', GITHUB_STAR_ICON);

        // 加载合并后的数据
        await this.loadCombinedData();

        // 初始化GitHub服务 (支持多账号)
        this.githubService = new GithubService(this.settings.accounts || []);
        
        // 初始化导出服务
        this.exportService = new ExportService(this.app);
        // 添加设置标签 (不变)
        this.addSettingTab(new GithubStarsSettingTab(this.app, this));

        // 注册视图 (不变)
        this.registerView(
            VIEW_TYPE_STARS,
            (leaf) => new GithubStarsView(leaf, this)
        );
        // 添加功能区图标 (不变)
        this.addRibbonIcon('github-star', 'GitHub Stars', () => {
            this.activateView();
        });

        // 添加插件命令 (不变)
        this.addCommands();
        // 注册自动同步 (不变)
        this.setupAutoSync();

        // 应用主题
        this.applyTheme(this.settings.theme);

        new Notice('GitHub Stars Manager 已加载');
    }

    onunload() {
        this.clearSyncInterval();
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_STARS);
    }

    // --- 数据加载/保存 ---

    async loadCombinedData() {
        const loaded = await this.loadData();
        // 合并加载的数据和默认值
        const combinedData = Object.assign({}, DEFAULT_COMBINED_DATA, loaded);

        // 分配到各自的属性
        this.settings = Object.assign({}, DEFAULT_SETTINGS, combinedData.settings);
        this.data = Object.assign({}, DEFAULT_PLUGIN_DATA, combinedData.pluginData);

        // 运行数据验证和迁移
        this._ensureDataIntegrity();
        this._migrateExportOptions();
    }

    /**
     * 确保加载的数据结构是正确的，防止因数据损坏或版本更新导致的问题。
     */
    private _ensureDataIntegrity() {
        if (!Array.isArray(this.data.githubRepositories)) {
            this.data.githubRepositories = [];
        }
        if (typeof this.data.userEnhancements !== 'object' || this.data.userEnhancements === null || Array.isArray(this.data.userEnhancements)) {
            this.data.userEnhancements = {};
        }
        if (!Array.isArray(this.data.allTags)) {
            this.data.allTags = [];
        }
        if (typeof this.data.accountSyncTimes !== 'object' || this.data.accountSyncTimes === null || Array.isArray(this.data.accountSyncTimes)) {
            this.data.accountSyncTimes = {};
        }
    }

    /**
     * 检查并迁移旧的导出选项到新格式，以确保兼容性。
     */
    private _migrateExportOptions() {
        if (!this.data.exportOptions) {
            this.data.exportOptions = DEFAULT_EXPORT_OPTIONS;
        } else {
            // 检查是否需要更新属性模板（如果属性键名不是以GSM-开头，或者缺少enabled字段，则更新）
            const hasOldTemplate = this.data.exportOptions.propertiesTemplate?.some(prop =>
                !prop.key.startsWith('GSM-') || prop.enabled === undefined
            );
            if (hasOldTemplate) {
                this.data.exportOptions.propertiesTemplate = DEFAULT_EXPORT_OPTIONS.propertiesTemplate;
                console.debug('已更新导出选项的属性模板为新的GSM-格式，并添加了enabled字段');
            }
        }
    }

    async saveCombinedData() {
        // 在保存前确保 allTags 是最新的 (从 userEnhancements 生成)
        this.updateAllTagsFromEnhancements();

        const combinedData: CombinedPluginData = {
            settings: this.settings,
            pluginData: this.data
        };
        await this.saveData(combinedData);
    }

    // --- 设置相关 (不变) ---
    async saveSettings() {
        await this.saveCombinedData();
        // 更新GitHub服务的账号列表
        this.githubService.updateAccounts(this.settings.accounts || []);
        this.setupAutoSync();
        // 同步 settings 中的模板到 data 中，以供导出时使用
        if (this.data.exportOptions) {
            this.data.exportOptions.propertiesTemplate = this.settings.propertiesTemplate;
        }
        this.updateViews(); // 确保每次保存设置都刷新视图
    }

    // --- 插件数据相关 (现在通过 saveCombinedData 保存) ---
    async savePluginData() {
        // saveCombinedData 内部会调用 updateAllTagsFromEnhancements
        await this.saveCombinedData();
        // 数据保存后，通知视图更新 (如果需要立即反映标签变化等)
        this.updateViews();
    }

    // --- 自动同步 (不变) ---
    setupAutoSync() {
        this.clearSyncInterval();
        if (this.settings.autoSync && this.settings.syncInterval > 0) {
            const intervalMillis = this.settings.syncInterval * 60 * 1000;
            this.syncIntervalId = window.setInterval(() => {
                this.syncStars();
            }, intervalMillis);
            this.registerInterval(this.syncIntervalId);
        }
    }

    clearSyncInterval() {
        if (this.syncIntervalId !== null) {
            window.clearInterval(this.syncIntervalId);
            this.syncIntervalId = null;
        }
    }

    // --- 命令 (不变) ---
    addCommands() {
        this.addCommand({
            id: 'sync-github-stars',
            name: '同步 GitHub 星标',
            callback: () => {
                this.syncStars();
            }
        });
        this.addCommand({
            id: 'open-github-stars-view',
            name: '打开 GitHub Stars 视图',
            callback: () => {
                this.activateView();
            }
        });

        this.addCommand({
            id: 'export-all-stars',
            name: '导出所有星标仓库',
            callback: () => {
                this.exportAllStars();
            }
        });
    }

    // --- 核心逻辑 (重构) ---
    async syncStars(): Promise<void> {
        console.debug('开始同步GitHub星标...');
        console.debug('当前设置的账号:', this.settings.accounts);
        
        // 检查是否有启用的账号
        const enabledAccounts = (this.settings.accounts || []).filter(acc => acc.enabled);
        console.debug('启用的账号:', enabledAccounts);
        
        if (enabledAccounts.length === 0) {
            // 向后兼容：如果没有多账号配置，使用单一令牌
            if (!this.settings.githubToken) {
                new Notice('请先在设置中配置GitHub账号或个人访问令牌');
                return;
            }
            console.debug('使用向后兼容模式，创建临时账号');
            // 创建临时账号进行同步
            const tempAccount = {
                id: 'legacy',
                name: '默认账号',
                username: 'unknown',
                token: this.settings.githubToken,
                enabled: true
            };
            this.settings.accounts = [tempAccount];
            this.githubService.updateAccounts([tempAccount]);
        } else {
            // 确保GitHub服务使用最新的账号配置
            console.debug('更新GitHub服务账号配置');
            this.githubService.updateAccounts(this.settings.accounts);
        }

        new Notice('正在同步GitHub星标...');
        try {
            const syncResult = await this.githubService.fetchAllStarredRepositories();
            await this._handleSyncSuccess(syncResult);
        } catch (error) {
            console.error('同步GitHub星标失败:', error);
            new Notice('同步GitHub星标失败，请查看控制台了解详情');
        }
    }

    /**
     * 处理同步成功后的数据更新。
     * @param syncResult 同步结果
     */
    private async _handleSyncSuccess(syncResult: Awaited<ReturnType<typeof this.githubService.fetchAllStarredRepositories>>) {
        console.debug('Sync result:', syncResult);
        console.debug('Repositories received:', syncResult.repositories?.length || 0);
        console.debug('Account sync times:', syncResult.accountSyncTimes);
        console.debug('Errors:', syncResult.errors);

        // 检查是否有有效的仓库数据
        if (!syncResult.repositories || syncResult.repositories.length === 0) {
            console.warn('同步结果中没有仓库数据');
            const errorCount = Object.keys(syncResult.errors).length;
            if (errorCount > 0) {
                console.error('同步错误详情:', syncResult.errors);
                new Notice(`同步失败：${Object.values(syncResult.errors).join(', ')}`);
            } else {
                new Notice('同步完成，但没有找到星标仓库');
            }
            return;
        }

        // 更新仓库数据
        this.data.githubRepositories = syncResult.repositories;
        console.debug('Updated githubRepositories count:', this.data.githubRepositories.length);

        // 更新同步时间
        this.data.lastSyncTime = new Date().toISOString();
        this.data.accountSyncTimes = {
            ...this.data.accountSyncTimes,
            ...syncResult.accountSyncTimes
        };

        // 保存数据
        await this.savePluginData();
        console.debug('Plugin data saved after sync. Final GitHub Repos count:', this.data.githubRepositories.length);

        // 显示同步结果
        const errorCount = Object.keys(syncResult.errors).length;
        if (errorCount > 0) {
            console.error('同步错误:', syncResult.errors);
        }

        // 更新视图
        this.updateViews();
    }

    // --- 视图管理 (activateView 不变, updateViews 更新) ---
    async activateView() {
        const { workspace } = this.app;
        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(VIEW_TYPE_STARS);

        if (leaves.length > 0) {
            leaf = leaves[0];
        } else {
            leaf = workspace.getLeaf('tab');
            await leaf.setViewState({
                type: VIEW_TYPE_STARS,
                active: true,
            });
        }
        if (leaf) {
             workspace.revealLeaf(leaf);
        }
    }

    updateViews() {
        this.app.workspace.getLeavesOfType(VIEW_TYPE_STARS).forEach(leaf => {
            if (leaf.view instanceof GithubStarsView) {
                // 传递更新后的 GitHub 仓库列表和用户增强数据
                leaf.view.updateData(
                    this.data.githubRepositories,
                    this.data.userEnhancements,
                    this.data.allTags
                );
            }
        });
    }

    // --- 辅助方法 (getAllTags 更新, 新增 updateAllTagsFromEnhancements) ---
    getAllTags(): string[] {
        // 直接返回存储的全局标签列表
        return this.data.allTags || [];
    }

    // 新增：从 userEnhancements 更新 allTags 列表
    updateAllTagsFromEnhancements() {
        const allTags = new Set<string>();
        if (this.data.userEnhancements) {
            Object.values(this.data.userEnhancements).forEach(enhancement => {
                if (Array.isArray(enhancement.tags)) {
                    enhancement.tags.forEach(tag => allTags.add(tag));
                }
            });
        }
        this.data.allTags = Array.from(allTags).sort();
    }

    // --- 主题管理 ---
    applyTheme(theme: 'default' | 'ios-glass') {
        const body = document.body;
        
        // 移除所有主题类
        body.removeClass('github-stars-theme-default');
        body.removeClass('github-stars-theme-ios-glass');
        
        // 应用新主题类
        body.addClass(`github-stars-theme-${theme}`);
        
        // 更新视图以应用主题
        this.updateViews();
    }

    // --- 导出功能 ---
    
    /**
     * 导出所有星标仓库
     */
    async exportAllStars(options?: Partial<ExportOptions>): Promise<void> {
        if (this.data.githubRepositories.length === 0) {
            new Notice('没有星标仓库可导出，请先同步数据');
            return;
        }

        new Notice('开始导出星标仓库...');
        
        try {
            // 使用插件数据中的导出选项，如果没有则使用默认选项
            const exportOptions = options ? { ...this.data.exportOptions, ...options } : this.data.exportOptions;
            const result = await this.exportService.exportAllRepositories(
                this.data.githubRepositories,
                this.data.userEnhancements,
                exportOptions
            );

            if (result.success) {
                new Notice(`导出完成！成功导出 ${result.exportedCount} 个仓库，跳过 ${result.skippedCount} 个`);
            } else {
                new Notice(`导出完成，但有错误。成功导出 ${result.exportedCount} 个仓库，失败 ${result.errors.length} 个`);
                console.error('导出错误:', result.errors);
            }
        } catch (error) {
            console.error('导出失败:', error);
            new Notice('导出失败，请查看控制台了解详情');
        }
    }

    /**
     * 导出单个仓库
     */
    async exportSingleRepository(repository: GithubRepository, options?: Partial<ExportOptions>): Promise<void> {
        new Notice(`正在导出 ${repository.full_name}...`);
        
        try {
            // 使用插件数据中的导出选项，如果没有则使用默认选项
            const exportOptions = options ? { ...this.data.exportOptions, ...options } : this.data.exportOptions;
            const success = await this.exportService.exportSingleRepositoryById(
                repository,
                this.data.userEnhancements[repository.id],
                exportOptions
            );

            if (success) {
                new Notice(`${repository.full_name} 导出成功`);
            } else {
                new Notice(`${repository.full_name} 导出跳过（文件已存在）`);
            }
        } catch (error) {
            console.error(`导出 ${repository.full_name} 失败:`, error);
            new Notice(`导出 ${repository.full_name} 失败`);
        }
    }
}