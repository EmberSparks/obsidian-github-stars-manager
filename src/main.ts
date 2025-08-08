import { Plugin, Notice, WorkspaceLeaf, addIcon } from 'obsidian';
import { GithubStarsSettings, PluginData, CombinedPluginData, GithubRepository, UserRepoEnhancements } from './types'; // 移除 LocalRepository, 添加 GithubRepository, UserRepoEnhancements
import { DEFAULT_SETTINGS, GithubStarsSettingTab } from './settings';
import { GithubService } from './githubService';
import { GithubStarsView, VIEW_TYPE_STARS } from './view';

// GitHub星标图标 (不变)
const GITHUB_STAR_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-star"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;

// 默认插件数据 (更新结构)
const DEFAULT_PLUGIN_DATA: PluginData = {
    githubRepositories: [], // 重命名
    userEnhancements: {},   // 新增
    allTags: [],            // 新增 (替代旧的 tags)
    lastSyncTime: ''
};

// 默认合并数据 (不变，因为内部引用已更新)
const DEFAULT_COMBINED_DATA: CombinedPluginData = {
    settings: DEFAULT_SETTINGS,
    pluginData: DEFAULT_PLUGIN_DATA
};

export default class GithubStarsPlugin extends Plugin {
    settings: GithubStarsSettings;
    githubService: GithubService;
    data: PluginData; // 引用 PluginData，其内部结构已改变
    syncIntervalId: number | null = null;

    async onload() {
        addIcon('github-star', GITHUB_STAR_ICON);

        // 加载合并后的数据
        await this.loadCombinedData();

        // 初始化GitHub服务 (不变)
        this.githubService = new GithubService(this.settings.githubToken);
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
        this.settings = combinedData.settings;
        this.data = combinedData.pluginData;

        // 确保深层结构也正确合并
        this.settings = Object.assign({}, DEFAULT_SETTINGS, this.settings);
        this.data = Object.assign({}, DEFAULT_PLUGIN_DATA, this.data);

        // 确保新结构的类型正确
        if (!Array.isArray(this.data.githubRepositories)) {
            this.data.githubRepositories = [];
        }
        if (typeof this.data.userEnhancements !== 'object' || this.data.userEnhancements === null || Array.isArray(this.data.userEnhancements)) {
            this.data.userEnhancements = {};
        }
        if (!Array.isArray(this.data.allTags)) {
            this.data.allTags = [];
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
        this.githubService.setToken(this.settings.githubToken);
        this.setupAutoSync();
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
    }

    // --- 核心逻辑 (重构) ---
    async syncStars(): Promise<void> {
        if (!this.settings.githubToken) {
            new Notice('请先在设置中配置GitHub个人访问令牌');
            return;
        }
        new Notice('正在同步GitHub星标...');
        try {
            // 1. 获取最新的 GitHub 仓库列表
            const fetchedRepositories = await this.githubService.fetchStarredRepositories();
            console.log('Fetched repositories from GitHub:', fetchedRepositories);
            if (!fetchedRepositories) {
                 new Notice('获取星标仓库失败，请检查令牌权限或网络');
                 console.error('fetchStarredRepositories returned null or undefined');
                 return;
            }

            // 2. 直接替换旧的 GitHub 数据
            this.data.githubRepositories = fetchedRepositories;

            // 3. 更新同步时间
            this.data.lastSyncTime = new Date().toISOString();

            // 4. 保存数据 (注意：用户增强数据 userEnhancements 不在此处修改)
            // savePluginData 内部会调用 saveCombinedData, 进而调用 updateAllTags
            await this.savePluginData();
            console.log('Plugin data saved after sync. GitHub Repos count:', this.data.githubRepositories.length);

            new Notice(`成功同步 ${fetchedRepositories.length} 个星标仓库`);
            // 5. 更新视图
            this.updateViews();
        } catch (error) {
            console.error('同步GitHub星标失败:', error);
            new Notice('同步GitHub星标失败，请查看控制台了解详情');
        }
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
                leaf.view.updateData(this.data.githubRepositories, this.data.userEnhancements, this.data.allTags);
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
}