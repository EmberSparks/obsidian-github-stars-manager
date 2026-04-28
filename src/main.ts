import { Plugin, Notice, WorkspaceLeaf, addIcon } from 'obsidian';
import {
    GithubStarsSettings,
    PluginData,
    CombinedPluginData,
    GithubRepository,
    ExportOptions,
    DEFAULT_EXPORT_OPTIONS,
    InvalidUserEnhancementRecord
} from './types'; // 移除 LocalRepository, 添加 GithubRepository, ExportOptions
import { DEFAULT_SETTINGS, GithubStarsSettingTab } from './settings';
import { GithubService } from './githubService';
import { GithubStarsView, VIEW_TYPE_STARS } from './view';
import { ExportService } from './exportService';
import { I18n, t } from './i18n';
import { GithubStarsCacheService } from './cacheService';
import { countTagAssociations } from './tagAssociation';
import {
    buildEnhancementRepoSnapshot,
    getOrphanEnhancementRecords,
    mergeRepositoriesAfterSync,
    removeEnhancementsByRepoIds,
    syncEnhancementSnapshotsWithRepositories
} from './userEnhancementCleanup';
import { classifyGithubError } from './githubErrorUtils';

// GitHub星标图标 (不变)
const GITHUB_STAR_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-star"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;

// 默认插件数据 (更新结构)
const DEFAULT_PLUGIN_DATA: PluginData = {
    githubRepositories: [], // 重命名
    userEnhancements: {},   // 新增
    allTags: [],            // 新增 (替代旧的 tags)
    tagColors: {},          // 标签颜色映射
    repoReleaseAlerts: {},  // 仓库发布提醒状态
    lastSyncTime: '',
    accountSyncTimes: {},   // 新增：每个账号的同步时间
    exportOptions: undefined // 新增：导出选项（可选）
};

// 默认合并数据 (不变，因为内部引用已更新)
const DEFAULT_COMBINED_DATA: CombinedPluginData = {
    settings: DEFAULT_SETTINGS,
    pluginData: DEFAULT_PLUGIN_DATA
};

const SYNC_INTERVAL_SETTINGS_VERSION = 2;
const MIN_SYNC_INTERVAL_DAYS = 1;
const MAX_SYNC_INTERVAL_DAYS = 30;
const CACHE_PERSIST_DELAY_MS = 600;
const FALLBACK_REPO_RENDER_MODE = 'balanced';

export default class GithubStarsPlugin extends Plugin {
    settings: GithubStarsSettings;
    githubService: GithubService;
    exportService: ExportService;
    data: PluginData; // 引用 PluginData，其内部结构已改变
    syncIntervalId: number | null = null;
    cacheService: GithubStarsCacheService | null = null;
    cachePersistTimerId: number | null = null;
    cacheSnapshotReadCount: number = 0;
    cacheSnapshotWriteCount: number = 0;
    cacheSnapshotRestoreHitCount: number = 0;

    async onload() {
        addIcon('github-star', GITHUB_STAR_ICON);

        // 加载合并后的数据
        await this.loadCombinedData();
        await this.initializeCacheLayer();

        // 初始化i18n系统
        I18n.setLanguage(this.settings.language || 'en');

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
        this.addRibbonIcon('github-star', 'GitHub stars', () => {
            this.activateView().catch(err => console.error('Failed to activate view:', err));
        });

        // 添加插件命令 (不变)
        this.addCommands();
        // 注册自动同步 (不变)
        this.setupAutoSync();

        // 兼容旧版本：清理历史主题类，固定使用默认外观
        document.body.removeClass('github-stars-theme-default');
        document.body.removeClass('github-stars-theme-ios-glass');

        new Notice(t('plugin.loaded'));
    }

    onunload() {
        this.clearSyncInterval();
        if (this.cachePersistTimerId !== null) {
            window.clearTimeout(this.cachePersistTimerId);
            this.cachePersistTimerId = null;
        }
        if (this.cacheService) {
            this.cacheService.close();
            this.cacheService = null;
        }
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
        this._migrateSyncIntervalSettings(loaded);
        this._normalizeRepoRenderPerformanceMode();
        this._migrateExportOptions();
    }

    private normalizeSyncIntervalDays(rawDays: number): number {
        if (!Number.isFinite(rawDays)) {
            return MIN_SYNC_INTERVAL_DAYS;
        }
        return Math.min(MAX_SYNC_INTERVAL_DAYS, Math.max(MIN_SYNC_INTERVAL_DAYS, Math.round(rawDays)));
    }

    private convertLegacySyncIntervalMinutesToDays(rawMinutes: number): number {
        if (!Number.isFinite(rawMinutes) || rawMinutes <= 0) {
            return MIN_SYNC_INTERVAL_DAYS;
        }
        const convertedDays = Math.ceil(rawMinutes / (24 * 60));
        return this.normalizeSyncIntervalDays(convertedDays);
    }

    private _migrateSyncIntervalSettings(rawLoadedData: unknown): void {
        const loadedCombinedData = rawLoadedData as Partial<CombinedPluginData> | undefined;
        const loadedSettings = loadedCombinedData?.settings as Partial<typeof this.settings> | undefined;
        const loadedVersion = loadedSettings?.syncIntervalVersion;

        if (typeof loadedVersion === 'number' && loadedVersion >= SYNC_INTERVAL_SETTINGS_VERSION) {
            this.settings.syncInterval = this.normalizeSyncIntervalDays(this.settings.syncInterval);
            this.settings.syncIntervalVersion = SYNC_INTERVAL_SETTINGS_VERSION;
            return;
        }

        // 旧版本按分钟存储，这里迁移为按天存储
        this.settings.syncInterval = this.convertLegacySyncIntervalMinutesToDays(this.settings.syncInterval);
        this.settings.syncIntervalVersion = SYNC_INTERVAL_SETTINGS_VERSION;
    }

    private _normalizeRepoRenderPerformanceMode(): void {
        if (this.settings.repoRenderPerformanceMode !== 'visual' && this.settings.repoRenderPerformanceMode !== 'balanced') {
            this.settings.repoRenderPerformanceMode = FALLBACK_REPO_RENDER_MODE;
        }
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
        if (typeof this.data.tagColors !== 'object' || this.data.tagColors === null || Array.isArray(this.data.tagColors)) {
            this.data.tagColors = {};
        }
        if (typeof this.data.repoReleaseAlerts !== 'object' || this.data.repoReleaseAlerts === null || Array.isArray(this.data.repoReleaseAlerts)) {
            this.data.repoReleaseAlerts = {};
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
    async saveSettings(options?: { refreshViews?: boolean }) {
        await this.saveCombinedData();
        // 更新GitHub服务的账号列表
        this.githubService.updateAccounts(this.settings.accounts || []);
        this.setupAutoSync();
        // 同步 settings 中的模板到 data 中，以供导出时使用
        if (this.data.exportOptions) {
            this.data.exportOptions.propertiesTemplate = this.settings.propertiesTemplate;
        }
        if (options?.refreshViews) {
            this.updateViews();
        }
    }

    // --- 插件数据相关 (现在通过 saveCombinedData 保存) ---
    async savePluginData() {
        // saveCombinedData 内部会调用 updateAllTagsFromEnhancements
        await this.saveCombinedData();
        this.scheduleCacheSnapshotPersist();
        // 数据保存后，通知视图更新 (如果需要立即反映标签变化等)
        this.updateViews();
    }

    private async initializeCacheLayer(): Promise<void> {
        this.cacheService = new GithubStarsCacheService();
        try {
            this.cacheSnapshotReadCount += 1;
            const snapshot = await this.cacheService.loadSnapshot();
            const shouldHydrateFromCache = this.data.githubRepositories.length === 0;
            if (snapshot && shouldHydrateFromCache && snapshot.githubRepositories.length > 0) {
                this.data.githubRepositories = snapshot.githubRepositories;
                this.data.userEnhancements = snapshot.userEnhancements;
                this.data.allTags = snapshot.allTags;
                this.data.tagColors = snapshot.tagColors;
                this.data.lastSyncTime = snapshot.lastSyncTime;
                this.data.accountSyncTimes = snapshot.accountSyncTimes;
                this._ensureDataIntegrity();
                this.cacheSnapshotRestoreHitCount += 1;
                console.debug('IndexedDB cache restored repositories snapshot.');
            }
            this.scheduleCacheSnapshotPersist();
        } catch (error) {
            console.warn('Failed to initialize IndexedDB cache layer:', error);
            this.cacheService.close();
            this.cacheService = null;
        }
    }

    private scheduleCacheSnapshotPersist(): void {
        if (!this.cacheService) return;
        if (this.cachePersistTimerId !== null) {
            window.clearTimeout(this.cachePersistTimerId);
        }
        this.cachePersistTimerId = window.setTimeout(() => {
            this.cachePersistTimerId = null;
            void this.persistCacheSnapshot();
        }, CACHE_PERSIST_DELAY_MS);
    }

    private async persistCacheSnapshot(): Promise<void> {
        if (!this.cacheService) return;
        try {
            await this.cacheService.saveSnapshot(this.data);
            this.cacheSnapshotWriteCount += 1;
        } catch (error) {
            console.warn('Failed to persist IndexedDB snapshot:', error);
        }
    }

    getCacheStats(): { reads: number; writes: number; restoreHits: number } {
        return {
            reads: this.cacheSnapshotReadCount,
            writes: this.cacheSnapshotWriteCount,
            restoreHits: this.cacheSnapshotRestoreHitCount
        };
    }

    // --- 自动同步 (不变) ---
    setupAutoSync() {
        this.clearSyncInterval();
        if (this.settings.autoSync && this.settings.syncInterval > 0) {
            const normalizedDays = this.normalizeSyncIntervalDays(this.settings.syncInterval);
            this.settings.syncInterval = normalizedDays;
            const intervalMillis = normalizedDays * 24 * 60 * 60 * 1000;
            this.syncIntervalId = window.setInterval(() => {
                this.syncStars().catch(err => console.error('Auto sync failed:', err));
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
            name: t('plugin.syncCommandName'),
            callback: () => {
                this.syncStars().catch(err => console.error('Sync command failed:', err));
            }
        });
        this.addCommand({
            id: 'open-github-stars-view',
            name: t('plugin.openViewCommandName'),
            callback: () => {
                this.activateView().catch(err => console.error('Open view command failed:', err));
            }
        });

        this.addCommand({
            id: 'export-all-stars',
            name: t('plugin.exportAllCommandName'),
            callback: () => {
                this.exportAllStars().catch(err => console.error('Export command failed:', err));
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
                new Notice(t('plugin.configureAccount'));
                return;
            }
            console.debug('使用向后兼容模式，创建临时账号');
            // 创建临时账号进行同步
            const tempAccount = {
                id: 'legacy',
                name: t('plugin.defaultAccount'),
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

        new Notice(t('plugin.syncing'));
        try {
            const syncResult = await this.githubService.fetchAllStarredRepositories();
            await this._handleSyncSuccess(syncResult);
        } catch (error) {
            console.error('同步GitHub星标失败:', error);
            const errorKind = classifyGithubError(error).kind;
            const noticeKey = errorKind === 'network'
                ? 'settings.syncFailedNoticeNetwork'
                : errorKind === 'auth'
                    ? 'settings.syncFailedNoticeAuth'
                    : errorKind === 'rate_limit'
                        ? 'settings.syncFailedNoticeRateLimit'
                        : 'plugin.syncFailed';
            new Notice(t(noticeKey));
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
        const successfulAccountCount = Object.keys(syncResult.accountSyncTimes).length;
        const failedAccountIds = Object.keys(syncResult.errors);
        const errorCount = failedAccountIds.length;

        if (successfulAccountCount === 0) {
            if (errorCount > 0) {
                console.error('同步错误详情:', syncResult.errors);
            } else {
                console.warn('同步结果中没有成功账号，跳过本地数据更新');
            }
            return;
        }

        const snapshotRecordedAt = new Date().toISOString();
        this.data.githubRepositories = mergeRepositoriesAfterSync({
            previousRepositories: this.data.githubRepositories || [],
            syncedRepositories: syncResult.repositories || [],
            failedAccountIds
        });
        console.debug('Updated githubRepositories count:', this.data.githubRepositories.length);
        this.data.userEnhancements = syncEnhancementSnapshotsWithRepositories(
            this.data.userEnhancements,
            syncResult.repositories || [],
            snapshotRecordedAt
        );

        if (errorCount > 0) {
            console.warn('检测到部分账号同步失败，已跳过孤儿增强数据清理');
        }

        this.data.lastSyncTime = snapshotRecordedAt;
        this.data.accountSyncTimes = {
            ...this.data.accountSyncTimes,
            ...syncResult.accountSyncTimes
        };

        await this.savePluginData();
        console.debug('Plugin data saved after sync. Final GitHub Repos count:', this.data.githubRepositories.length);

        if (errorCount > 0) {
            console.error('同步错误:', syncResult.errors);
        }
    }

    getInvalidUserEnhancementRecords(): InvalidUserEnhancementRecord[] {
        return getOrphanEnhancementRecords(
            this.data.userEnhancements,
            this.data.githubRepositories
        );
    }

    async deleteInvalidUserEnhancements(repoIds: number[]): Promise<number> {
        const existingInvalidRepoIdSet = new Set(
            this.getInvalidUserEnhancementRecords().map((record) => record.repoId)
        );
        const targetRepoIds = repoIds.filter((repoId) => existingInvalidRepoIdSet.has(repoId));
        if (targetRepoIds.length === 0) {
            return 0;
        }

        const result = removeEnhancementsByRepoIds(this.data.userEnhancements, targetRepoIds);
        this.data.userEnhancements = result.userEnhancements;
        await this.savePluginData();
        return result.removedRepoIds.length;
    }

    async refreshInvalidUserEnhancementSnapshots(repoIds: number[]): Promise<{
        requestedCount: number;
        updatedCount: number;
        unresolvedCount: number;
    }> {
        const invalidRecordMap = new Map(
            this.getInvalidUserEnhancementRecords().map((record) => [record.repoId, record] as const)
        );
        const targetRepoIds = repoIds.filter((repoId) => invalidRecordMap.has(repoId));
        const repoIdsToRefresh = targetRepoIds.filter((repoId) => {
            const record = invalidRecordMap.get(repoId);
            const snapshot = record?.repoSnapshot;
            return !(snapshot?.full_name?.trim() && snapshot?.html_url?.trim());
        });

        if (repoIdsToRefresh.length === 0) {
            return {
                requestedCount: 0,
                updatedCount: 0,
                unresolvedCount: 0
            };
        }

        const snapshotRecordedAt = new Date().toISOString();
        let updatedCount = 0;
        let unresolvedCount = 0;

        for (const repoId of repoIdsToRefresh) {
            const repository = await this.githubService.fetchRepositoryById(repoId);
            const enhancement = this.data.userEnhancements[repoId];
            if (!repository || !enhancement) {
                unresolvedCount += 1;
                continue;
            }

            this.data.userEnhancements[repoId] = {
                ...enhancement,
                repoSnapshot: buildEnhancementRepoSnapshot(repository, snapshotRecordedAt)
            };
            updatedCount += 1;
        }

        if (updatedCount > 0) {
            await this.savePluginData();
        }

        return {
            requestedCount: repoIdsToRefresh.length,
            updatedCount,
            unresolvedCount
        };
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
            await workspace.revealLeaf(leaf);
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
        const normalizedTagMap = new Map<string, string>();
        const addTagToMap = (tagName: string) => {
            const trimmedTagName = tagName.trim();
            if (!trimmedTagName) return;
            const normalizedTagName = trimmedTagName.toLowerCase();
            if (!normalizedTagMap.has(normalizedTagName)) {
                normalizedTagMap.set(normalizedTagName, trimmedTagName);
            }
        };

        (this.data.allTags || []).forEach((tag) => {
            addTagToMap(tag);
        });

        if (this.data.userEnhancements) {
            Object.values(this.data.userEnhancements).forEach(enhancement => {
                if (Array.isArray(enhancement.tags)) {
                    enhancement.tags.forEach((tag) => {
                        addTagToMap(tag);
                    });
                }
            });
        }
        this.data.allTags = Array.from(normalizedTagMap.values()).sort((left, right) =>
            left.localeCompare(right, undefined, { sensitivity: 'base' })
        );

        // 同步清理标签颜色映射：只保留当前仍存在的标签
        const currentTagColors = this.data.tagColors || {};
        const normalizedEntries = Object.entries(currentTagColors).map(([key, value]) => [key.toLowerCase(), value] as const);
        const syncedTagColors: { [tagNameLower: string]: string } = {};

        this.data.allTags.forEach((tag) => {
            const lowerTag = tag.toLowerCase();
            const matched = normalizedEntries.find(([key]) => key === lowerTag);
            if (matched && typeof matched[1] === 'string' && matched[1].trim().length > 0) {
                syncedTagColors[lowerTag] = matched[1].trim();
            }
        });

        this.data.tagColors = syncedTagColors;
    }

    /**
     * 添加一个全局标签（不绑定具体仓库）
     * @returns 是否成功添加（存在同名标签时返回 false）
     */
    addTag(tagName: string): boolean {
        const trimmedTagName = tagName.trim();
        if (!trimmedTagName) return false;

        if (!Array.isArray(this.data.allTags)) {
            this.data.allTags = [];
        }

        const normalizedTagName = trimmedTagName.toLowerCase();
        const alreadyExists = this.data.allTags.some(
            (existingTag) => existingTag.toLowerCase() === normalizedTagName
        );
        if (alreadyExists) {
            return false;
        }

        this.data.allTags.push(trimmedTagName);
        this.data.allTags.sort((left, right) =>
            left.localeCompare(right, undefined, { sensitivity: 'base' })
        );
        return true;
    }

    /**
     * 获取标签的关联仓库数量
     */
    getTagAssociationCount(tagName: string): number {
        return countTagAssociations(this.data.userEnhancements, tagName);
    }

    /**
     * 删除未关联仓库的全局标签
     */
    removeTagIfUnused(tagName: string): { removed: boolean; associatedRepositoryCount: number } {
        const normalizedTagName = tagName.trim().toLowerCase();
        if (!normalizedTagName) {
            return { removed: false, associatedRepositoryCount: 0 };
        }

        const associatedRepositoryCount = this.getTagAssociationCount(tagName);
        if (associatedRepositoryCount > 0) {
            return { removed: false, associatedRepositoryCount };
        }

        const previousTagCount = (this.data.allTags || []).length;
        this.data.allTags = (this.data.allTags || []).filter(
            (existingTag) => existingTag.toLowerCase() !== normalizedTagName
        );
        this.removeTagColor(tagName);

        return {
            removed: this.data.allTags.length < previousTagCount,
            associatedRepositoryCount: 0
        };
    }

    /**
     * 在所有仓库增强信息中重命名标签。
     * @returns 受影响的仓库数量
     */
    renameTagAcrossEnhancements(oldTag: string, newTag: string): number {
        const sourceTag = oldTag.trim();
        const targetTag = newTag.trim();
        if (!sourceTag || !targetTag) {
            return 0;
        }

        const sourceTagNormalized = sourceTag.toLowerCase();
        let affectedRepositories = 0;

        Object.values(this.data.userEnhancements).forEach((enhancement) => {
            if (!Array.isArray(enhancement.tags) || enhancement.tags.length === 0) {
                return;
            }

            const originalTags = enhancement.tags;
            let hasMatch = false;
            const replacedTags = originalTags.map((tag) => {
                if (tag.toLowerCase() === sourceTagNormalized) {
                    hasMatch = true;
                    return targetTag;
                }
                return tag;
            });

            if (!hasMatch) {
                return;
            }

            const dedupedTags: string[] = [];
            const seen = new Set<string>();

            replacedTags.forEach((tag) => {
                const normalized = tag.toLowerCase();
                if (seen.has(normalized)) {
                    return;
                }
                seen.add(normalized);
                dedupedTags.push(tag);
            });

            enhancement.tags = dedupedTags;
            affectedRepositories += 1;
        });

        // 标签颜色映射迁移：重命名后保持颜色配置
        const sourceTagKey = sourceTag.toLowerCase();
        const targetTagKey = targetTag.toLowerCase();
        const sourceColor = this.data.tagColors?.[sourceTagKey];

        if (sourceColor) {
            if (!this.data.tagColors[targetTagKey]) {
                this.data.tagColors[targetTagKey] = sourceColor;
            }
            if (sourceTagKey !== targetTagKey) {
                delete this.data.tagColors[sourceTagKey];
            }
        }

        return affectedRepositories;
    }

    /**
     * 获取标签自定义颜色
     */
    getTagColor(tagName: string): string | undefined {
        const key = tagName.trim().toLowerCase();
        if (!key) return undefined;
        return this.data.tagColors?.[key];
    }

    /**
     * 设置标签自定义颜色
     */
    setTagColor(tagName: string, color: string): void {
        const key = tagName.trim().toLowerCase();
        const value = color.trim();
        if (!key || !value) return;
        if (!this.data.tagColors) {
            this.data.tagColors = {};
        }
        this.data.tagColors[key] = value;
    }

    /**
     * 删除标签自定义颜色
     */
    removeTagColor(tagName: string): void {
        const key = tagName.trim().toLowerCase();
        if (!key || !this.data.tagColors) return;
        delete this.data.tagColors[key];
    }

    // --- 导出功能 ---
    
    /**
     * 导出所有星标仓库
     */
    async exportAllStars(options?: Partial<ExportOptions>): Promise<void> {
        if (this.data.githubRepositories.length === 0) {
            new Notice(t('plugin.noReposToExport'));
            return;
        }

        new Notice(t('plugin.exportingAll'));

        try {
            // 使用插件数据中的导出选项，如果没有则使用默认选项
            const exportOptions = options ? { ...this.data.exportOptions, ...options } : this.data.exportOptions;
            const result = await this.exportService.exportAllRepositories(
                this.data.githubRepositories,
                this.data.userEnhancements,
                exportOptions
            );

            if (result.success) {
                new Notice(t('plugin.exportAllSuccess', { count: String(result.exportedCount), skipped: String(result.skippedCount) }));
            } else {
                new Notice(t('plugin.exportAllPartial', { count: String(result.exportedCount), failed: String(result.errors.length) }));
                console.error('导出错误:', result.errors);
            }
        } catch (error) {
            console.error('导出失败:', error);
            new Notice(t('plugin.exportAllFailed'));
        }
    }

    /**
     * 导出单个仓库
     */
    async exportSingleRepository(repository: GithubRepository, options?: Partial<ExportOptions>): Promise<void> {
        new Notice(t('plugin.exportingSingle', { name: repository.full_name }));

        try {
            // 使用插件数据中的导出选项，如果没有则使用默认选项
            const exportOptions = options ? { ...this.data.exportOptions, ...options } : this.data.exportOptions;
            const success = await this.exportService.exportSingleRepositoryById(
                repository,
                this.data.userEnhancements[repository.id],
                exportOptions
            );

            if (success) {
                new Notice(t('plugin.exportSingleSuccess', { name: repository.full_name }));
            } else {
                new Notice(t('plugin.exportSingleSkipped', { name: repository.full_name }));
            }
        } catch (error) {
            console.error(`导出 ${repository.full_name} 失败:`, error);
            new Notice(t('plugin.exportSingleFailed', { name: repository.full_name }));
        }
    }
}
