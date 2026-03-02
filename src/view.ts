import { ItemView, WorkspaceLeaf, setIcon, Notice } from 'obsidian';
import GithubStarsPlugin from './main';
import { GithubRepository, UserRepoEnhancements, GithubAccount, RepoRenderPerformanceMode } from './types';
import { EditRepoModal } from './modal';
import { EmojiUtils } from './emojiUtils';
import { t } from './i18n';

export const VIEW_TYPE_STARS = 'github-stars-view';

const TAG_COLOR_PALETTE = [
    '#b7dbff', '#c3e4ff', '#c8f0ff', '#c6f4f0', '#c9f7e6', '#d8f7cf',
    '#e4f8c8', '#f0f7c9', '#fff3c7', '#ffe8c5', '#ffd8c5', '#ffd0d8',
    '#f7d0e8', '#ead7ff', '#dcd7ff', '#d2ddff', '#cde8ff', '#c8efe8',
    '#d7f0e6', '#e0efda', '#f2e4cf', '#f6dcd4', '#e8def7', '#d5e2ef'
];

const FALLBACK_TAG_TEXT_COLOR = '#ffffff';
const FALLBACK_TAG_DARK_TEXT_COLOR = '#111827';
const REPO_VIRTUALIZATION_THRESHOLD = 120;
const REPO_VIRTUALIZATION_OVERSCAN = 8;
const REPO_ESTIMATED_ITEM_HEIGHT = 250;
const REPO_VIRTUAL_MIN_CARD_WIDTH = 280;
const REPO_VIRTUAL_GRID_GAP = 16;

type RenderRepository = GithubRepository & {
    notes?: string;
    tags?: string[];
    linked_note?: string;
};

function hexToRgb(hexColor: string): { r: number; g: number; b: number } | null {
    const normalized = hexColor.trim().replace('#', '');
    if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
        return null;
    }
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    return { r, g, b };
}

export class GithubStarsView extends ItemView {
    plugin: GithubStarsPlugin;
    githubRepositories: GithubRepository[] = []; // Renamed and typed
    userEnhancements: { [repoId: number]: UserRepoEnhancements } = {}; // Added
    allTags: string[] = []; // Added
    searchInput: HTMLInputElement;
    repoContainer: HTMLElement;
    repoRenderStatusEl: HTMLElement | null = null;
    filterByTags: Map<string, boolean> = new Map();
    tagsContainer: HTMLElement;
    currentFilter: string = '';
    sortBy: 'starred_at' | 'stars' | 'forks' | 'updated' = 'starred_at';
    sortOrder: 'asc' | 'desc' = 'desc'; // 新增排序方向状态
    showAllTags: boolean = false; // Add state for showing all tags
    showAllTagsBeforeManageMode: boolean | null = null;
    selectedRepos: Set<number> = new Set(); // 选中的仓库ID集合
    isExportMode: boolean = false; // 是否处于导出模式
    totalStarsNumberEl: HTMLElement | null = null; // star总数显示元素
    isTagManageMode: boolean = false; // 标签管理模式
    tagManageToggleButton: HTMLButtonElement | null = null;
    tagPopoverEl: HTMLElement | null = null;
    tagPopoverAnchorEl: HTMLElement | null = null;
    tagPopoverOutsideClickHandler?: (event: MouseEvent) => void;
    tagPopoverEscHandler?: (event: KeyboardEvent) => void;
    editingTagName: string | null = null;
    editingTagDraft: string = '';
    editingTagColorDraft: string = '';
    editingTagColorDirty: boolean = false;
    isCreatingTag: boolean = false;
    pendingMergeTargetTag: string | null = null;
    repoRenderFrameId: number | null = null;
    tagsFilterFrameId: number | null = null;
    virtualizedRepos: RenderRepository[] = [];
    isRepoListVirtualized: boolean = false;
    virtualStartIndex: number = 0;
    virtualEndIndex: number = 0;
    virtualColumnCount: number = 1;
    virtualItemEstimate: number = REPO_ESTIMATED_ITEM_HEIGHT;
    virtualTopSpacerEl: HTMLElement | null = null;
    virtualItemsEl: HTMLElement | null = null;
    virtualBottomSpacerEl: HTMLElement | null = null;
    virtualMeasureFrameId: number | null = null;
    repoRenderVersion: number = 0;

    constructor(leaf: WorkspaceLeaf, plugin: GithubStarsPlugin) {
        super(leaf);
        this.plugin = plugin;
        // Initialize with data from plugin
        this.githubRepositories = plugin.data.githubRepositories || [];
        this.userEnhancements = plugin.data.userEnhancements || {};
        this.allTags = plugin.data.allTags || [];
    }

    getViewType(): string {
        return VIEW_TYPE_STARS;
    }

    getDisplayText(): string {
        return t('view.title');
    }

    getIcon(): string {
        return 'star';
    }

    onOpen(): Promise<void> {
        const container = this.containerEl.children[1];
        container.empty();
        container.classList.add('github-stars-container');

        // Header (unchanged)
        const headerDiv = container.createDiv('github-stars-header');
        headerDiv.createEl('h2', { text: t('view.title') });

        // Toolbar (unchanged structure, button logic remains)
        const toolbarDiv = container.createDiv('github-stars-toolbar');
        this.createToolbar(toolbarDiv);

        // Tags Filter Area
        const tagsDiv = container.createDiv('github-stars-tags');
        this.tagsContainer = tagsDiv.createDiv('github-stars-tags-container');
        this.updateTagsFilter(this.tagsContainer);

        // 渲染状态提示（仅在大批量排序/筛选重绘时显示）
        this.repoRenderStatusEl = container.createDiv('github-stars-render-status');
        this.repoRenderStatusEl.addClass('hidden');

        // Repositories Container
        this.repoContainer = container.createDiv('github-stars-repos');
        this.repoContainer.removeEventListener('scroll', this.handleRepoContainerScroll);
        this.repoContainer.addEventListener('scroll', this.handleRepoContainerScroll, { passive: true });

        // Initial rendering of repositories
        this.renderRepositories();

        return Promise.resolve();
    }

    /**
     * 生成标签颜色索引 (基于标签名称的哈希)
     */
    private getTagColorIndex(tagName: string): number {
        let hash = 0;
        for (let i = 0; i < tagName.length; i++) {
            const char = tagName.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash) % TAG_COLOR_PALETTE.length;
    }

    /**
     * 获取标签最终颜色（自定义优先，默认哈希色回退）
     */
    private getTagColor(tagName: string): string {
        const customColor = this.plugin.getTagColor(tagName);
        if (customColor && /^#[0-9a-fA-F]{6}$/.test(customColor)) {
            return customColor;
        }
        return TAG_COLOR_PALETTE[this.getTagColorIndex(tagName)];
    }

    /**
     * 根据背景色计算高对比文字颜色
     */
    private getTagTextColor(backgroundHexColor: string): string {
        const rgb = hexToRgb(backgroundHexColor);
        if (!rgb) return FALLBACK_TAG_TEXT_COLOR;
        const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
        return luminance > 0.65 ? FALLBACK_TAG_DARK_TEXT_COLOR : FALLBACK_TAG_TEXT_COLOR;
    }

    /**
     * 为标签元素应用颜色样式
     */
    private applyTagColorStyle(tagEl: HTMLElement, tagName: string): void {
        const color = this.getTagColor(tagName);
        const textColor = this.getTagTextColor(color);
        const rgb = hexToRgb(color);
        const shadowColor = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)` : 'rgba(0, 0, 0, 0.2)';

        tagEl.style.backgroundColor = color;
        tagEl.style.borderColor = color;
        tagEl.style.color = textColor;
        tagEl.style.setProperty('--github-tag-shadow-color', shadowColor);
    }

    /**
     * 格式化数字显示 (如 1234 -> 1.2k, 1234567 -> 1.2M)
     */
    private formatNumber(num: number): string {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
        }
        return num.toString();
    }

    /**
     * 格式化相对时间显示 (如 "2天前", "1个月前")
     */
    private formatRelativeTime(dateString: string): string {
        if (!dateString) return t('time.unknown');

        const now = new Date();
        const date = new Date(dateString);
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            if (diffHours === 0) {
                const diffMinutes = Math.floor(diffMs / (1000 * 60));
                return diffMinutes <= 1 ? t('time.justNow') : t('time.minutesAgo', { n: diffMinutes });
            }
            return t('time.hoursAgo', { n: diffHours });
        } else if (diffDays === 1) {
            return t('time.daysAgo', { n: 1 });
        } else if (diffDays < 30) {
            return t('time.daysAgo', { n: diffDays });
        } else if (diffDays < 365) {
            const diffMonths = Math.floor(diffDays / 30);
            return t('time.monthsAgo', { n: diffMonths });
        } else {
            const diffYears = Math.floor(diffDays / 365);
            return t('time.yearsAgo', { n: diffYears });
        }
    }

    /**
     * 更新标签管理模式切换按钮状态
     */
    private updateTagManageToggleButton() {
        if (!this.tagManageToggleButton) return;

        this.tagManageToggleButton.textContent = this.isTagManageMode
            ? t('view.tagManageExit')
            : t('view.tagManageEnter');
        this.tagManageToggleButton.toggleClass('active', this.isTagManageMode);
        this.tagManageToggleButton.setAttribute(
            'title',
            this.isTagManageMode ? t('view.tagManageHint') : t('view.tagManageEnter')
        );
    }

    /**
     * 在标签容器前置渲染“管理标签”按钮
     */
    private renderTagManageToggleButton(container: HTMLElement): void {
        const manageButton = container.createEl('button', {
            cls: 'github-stars-tag-manage-toggle'
        });
        manageButton.type = 'button';
        manageButton.addEventListener('click', () => {
            this.toggleTagManageMode();
        });
        this.tagManageToggleButton = manageButton;
        this.updateTagManageToggleButton();
    }

    /**
     * 管理模式下渲染“新增标签”按钮
     */
    private renderTagAddButton(container: HTMLElement): void {
        const addButton = container.createEl('button', {
            cls: 'github-stars-tag-manage-add',
            text: t('view.tagAddButton')
        });
        addButton.type = 'button';
        addButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.startTagCreation(addButton);
        });
    }

    /**
     * 切换标签管理模式
     */
    private toggleTagManageMode() {
        const nextManageMode = !this.isTagManageMode;
        if (nextManageMode) {
            this.showAllTagsBeforeManageMode = this.showAllTags;
            this.showAllTags = true;
        } else {
            this.cancelTagEditing();
            if (this.showAllTagsBeforeManageMode !== null) {
                this.showAllTags = this.showAllTagsBeforeManageMode;
            }
            this.showAllTagsBeforeManageMode = null;
        }
        this.isTagManageMode = nextManageMode;

        this.updateTagManageToggleButton();
        this.updateTagsFilter(this.tagsContainer);
        new Notice(this.isTagManageMode ? t('view.tagManageModeOn') : t('view.tagManageModeOff'));
    }

    /**
     * 归一化标签名称（用于大小写不敏感匹配）
     */
    private normalizeTagName(tag: string): string {
        return tag.trim().toLowerCase();
    }

    /**
     * 获取当前启用账号ID集合
     */
    private getEnabledAccountIdSet(): Set<string> {
        const enabledAccounts = (this.plugin.settings.accounts || []).filter(account => account.enabled);
        return new Set(enabledAccounts.map(account => account.id));
    }

    /**
     * 仓库是否满足账号过滤条件
     */
    private isRepoVisibleByAccount(repo: GithubRepository): boolean {
        const enabledAccountIds = this.getEnabledAccountIdSet();
        if (enabledAccountIds.size === 0) return false;
        if (repo.account_id && !enabledAccountIds.has(repo.account_id)) {
            return false;
        }
        return true;
    }

    /**
     * 仓库是否满足当前文本过滤条件
     */
    private matchesCurrentTextFilter(repo: {
        name?: string;
        full_name?: string;
        description?: string | null;
        owner?: { login?: string };
        notes?: string;
        language?: string | null;
        tags?: string[];
    }): boolean {
        if (!this.currentFilter) return true;

        const normalizedFilter = this.currentFilter.toLowerCase();
        const name = repo.name || '';
        const fullName = repo.full_name || '';
        const description = repo.description || '';
        const ownerLogin = repo.owner?.login || '';
        const notes = repo.notes || '';
        const language = repo.language || '';
        const tags = Array.isArray(repo.tags) ? repo.tags : [];

        return (
            name.toLowerCase().includes(normalizedFilter) ||
            fullName.toLowerCase().includes(normalizedFilter) ||
            description.toLowerCase().includes(normalizedFilter) ||
            ownerLogin.toLowerCase().includes(normalizedFilter) ||
            notes.toLowerCase().includes(normalizedFilter) ||
            language.toLowerCase().includes(normalizedFilter) ||
            tags.some(tag => tag.toLowerCase().includes(normalizedFilter))
        );
    }

    /**
     * 获取当前激活的标签过滤集合（标准化后）
     */
    private getActiveTagFiltersNormalized(): string[] {
        return Array.from(this.filterByTags.entries())
            .filter(([_, active]) => active)
            .map(([tag, _]) => this.normalizeTagName(tag));
    }

    /**
     * 合并同一帧内的仓库列表重渲染请求，避免按钮连点导致主线程阻塞
     */
    private requestRepositoriesRender(): void {
        if (this.repoRenderFrameId !== null) return;
        this.repoRenderFrameId = window.requestAnimationFrame(() => {
            this.repoRenderFrameId = null;
            this.renderRepositories();
        });
    }

    /**
     * 合并同一帧内的标签区域重渲染请求
     */
    private requestTagsFilterUpdate(): void {
        if (!this.tagsContainer) return;
        if (this.tagsFilterFrameId !== null) return;
        this.tagsFilterFrameId = window.requestAnimationFrame(() => {
            this.tagsFilterFrameId = null;
            this.updateTagsFilter(this.tagsContainer);
        });
    }

    /**
     * 仓库列表滚动事件（虚拟列表模式下更新可视窗口）
     */
    private handleRepoContainerScroll = (): void => {
        if (!this.isRepoListVirtualized) return;
        this.renderVirtualizedWindow();
    };

    /**
     * 等待下一帧，避免一次性大批量 DOM 插入导致主线程长时间阻塞
     */
    private waitForNextFrame(): Promise<void> {
        return new Promise((resolve) => {
            window.requestAnimationFrame(() => resolve());
        });
    }

    /**
     * 根据仓库数量动态选择分批渲染尺寸
     */
    private getRepoRenderBatchSize(totalCount: number): number {
        const mode = this.getRepoRenderPerformanceMode();
        if (mode === 'visual') {
            if (totalCount > 1400) return 14;
            if (totalCount > 900) return 18;
            if (totalCount > 500) return 24;
            if (totalCount > 220) return 32;
            return 42;
        }
        if (mode === 'extreme') {
            if (totalCount > 1400) return 8;
            if (totalCount > 900) return 12;
            if (totalCount > 500) return 16;
            if (totalCount > 220) return 22;
            return 30;
        }

        if (totalCount > 1400) return 10;
        if (totalCount > 900) return 14;
        if (totalCount > 500) return 20;
        if (totalCount > 220) return 28;
        return 36;
    }

    /**
     * 获取仓库列表渲染性能模式
     */
    private getRepoRenderPerformanceMode(): RepoRenderPerformanceMode {
        return this.plugin.settings.repoRenderPerformanceMode || 'balanced';
    }

    /**
     * 当前模式下是否启用虚拟化
     */
    private shouldUseVirtualizedRender(totalCount: number): boolean {
        return this.getRepoRenderPerformanceMode() === 'extreme' && totalCount >= REPO_VIRTUALIZATION_THRESHOLD;
    }

    /**
     * 显示仓库列表渲染状态（轻量提示）
     */
    private showRepoRenderStatus(message: string): void {
        if (!this.repoRenderStatusEl) return;
        this.repoRenderStatusEl.setText(message);
        this.repoRenderStatusEl.removeClass('hidden');
    }

    /**
     * 隐藏仓库列表渲染状态
     */
    private hideRepoRenderStatus(): void {
        if (!this.repoRenderStatusEl) return;
        this.repoRenderStatusEl.addClass('hidden');
        this.repoRenderStatusEl.setText('');
    }

    /**
     * 开始编辑标签
     */
    private startTagEditing(tag: string, anchorEl: HTMLElement) {
        this.isCreatingTag = false;
        this.editingTagName = tag;
        this.editingTagDraft = tag;
        this.editingTagColorDraft = this.getTagColor(tag);
        this.editingTagColorDirty = false;
        this.pendingMergeTargetTag = null;
        this.tagPopoverAnchorEl = anchorEl;
        this.openTagEditPopover();
    }

    /**
     * 开始创建新标签
     */
    private startTagCreation(anchorEl: HTMLElement) {
        this.isCreatingTag = true;
        this.editingTagName = null;
        this.editingTagDraft = '';
        this.editingTagColorDraft = '';
        this.editingTagColorDirty = false;
        this.pendingMergeTargetTag = null;
        this.tagPopoverAnchorEl = anchorEl;
        this.openTagEditPopover();
    }

    /**
     * 取消编辑标签
     */
    private cancelTagEditing() {
        this.isCreatingTag = false;
        this.editingTagName = null;
        this.editingTagDraft = '';
        this.editingTagColorDraft = '';
        this.editingTagColorDirty = false;
        this.pendingMergeTargetTag = null;
        if (this.tagsContainer) {
            this.tagsContainer.querySelectorAll('.github-stars-tag.editing').forEach((el) => {
                el.removeClass('editing');
            });
        }
        this.closeTagEditPopover();
    }

    /**
     * 在标签筛选区域查找可用锚点（用于弹出面板定位恢复）
     */
    private findTagAnchorElement(tagName: string): HTMLElement | null {
        if (!this.tagsContainer) return null;
        const normalizedTag = tagName.toLowerCase();
        const tagElements = Array.from(this.tagsContainer.querySelectorAll('.github-stars-tag'));
        const matched = tagElements.find((el) => el.getAttribute('data-tag-name') === normalizedTag);
        return matched instanceof HTMLElement ? matched : null;
    }

    /**
     * 打开标签编辑弹出面板
     */
    private openTagEditPopover() {
        if (!this.isTagManageMode || (!this.isCreatingTag && !this.editingTagName) || !this.tagPopoverAnchorEl) {
            return;
        }

        if (!this.tagPopoverEl) {
            this.tagPopoverEl = document.body.createDiv('github-stars-tag-popover');
            this.tagPopoverEl.addEventListener('mousedown', (event) => {
                event.stopPropagation();
            });
        }

        this.renderTagEditPopoverContent();
        this.positionTagEditPopover();
        this.ensureTagPopoverGlobalHandlers();

        window.setTimeout(() => {
            const inputEl = this.tagPopoverEl?.querySelector('.github-stars-tag-popover-input') as HTMLInputElement | null;
            if (inputEl) {
                inputEl.focus();
                inputEl.select();
            }
        }, 0);
    }

    /**
     * 渲染弹出面板内容
     */
    private renderTagEditPopoverContent() {
        if (!this.tagPopoverEl || (!this.isCreatingTag && !this.editingTagName)) return;

        this.tagPopoverEl.empty();
        const sourceTag = this.editingTagName?.trim() || '';
        const isCreateMode = this.isCreatingTag;

        this.tagPopoverEl.createEl('div', {
            cls: 'github-stars-tag-popover-title',
            text: isCreateMode
                ? t('view.tagCreateTitle')
                : t('view.tagInlineEditName', { tag: sourceTag })
        });
        this.tagPopoverEl.createEl('div', {
            cls: 'github-stars-tag-popover-desc',
            text: isCreateMode
                ? t('view.tagCreateDesc')
                : t('view.tagInlineEditDesc')
        });

        const inputEl = this.tagPopoverEl.createEl('input', {
            cls: 'github-stars-tag-popover-input',
            attr: {
                type: 'text',
                placeholder: isCreateMode ? t('view.tagCreatePlaceholder') : t('view.tagRenamePlaceholder')
            }
        });
        inputEl.value = this.editingTagDraft;
        inputEl.addEventListener('input', () => {
            this.editingTagDraft = inputEl.value;
            if (!isCreateMode && this.pendingMergeTargetTag) {
                this.pendingMergeTargetTag = null;
                this.renderTagEditPopoverContent();
                this.positionTagEditPopover();
            }
        });
        inputEl.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                void this.applyTagRename(false);
            } else if (event.key === 'Escape') {
                event.preventDefault();
                this.cancelTagEditing();
            }
        });

        const paletteTitle = this.tagPopoverEl.createEl('div', {
            cls: 'github-stars-tag-popover-palette-title',
            text: t('view.tagColorLabel')
        });
        paletteTitle.setAttribute('title', t('view.tagColorDesc'));

        const palette = this.tagPopoverEl.createDiv('github-stars-tag-popover-palette');
        TAG_COLOR_PALETTE.forEach((color) => {
            const swatchButton = palette.createEl('button', {
                cls: 'github-stars-tag-color-swatch' + (this.editingTagColorDraft.toLowerCase() === color.toLowerCase() ? ' selected' : '')
            });
            swatchButton.type = 'button';
            swatchButton.style.backgroundColor = color;
            swatchButton.style.borderColor = color;
            swatchButton.setAttribute('aria-label', `${t('view.tagColorLabel')}: ${color}`);
            swatchButton.setAttribute('title', color);
            swatchButton.addEventListener('click', () => {
                this.editingTagColorDraft = color;
                this.editingTagColorDirty = true;
                if (this.pendingMergeTargetTag) {
                    this.pendingMergeTargetTag = null;
                }
                this.renderTagEditPopoverContent();
                this.positionTagEditPopover();
            });
        });

        if (!isCreateMode && this.pendingMergeTargetTag) {
            this.tagPopoverEl.createEl('div', {
                cls: 'github-stars-tag-popover-warning',
                text: t('view.tagRenameMergeWarning', { newTag: this.pendingMergeTargetTag })
            });
        }

        const actions = this.tagPopoverEl.createDiv('github-stars-tag-popover-actions');
        const saveButton = actions.createEl('button', {
            text: isCreateMode
                ? t('view.tagAddAction')
                : (this.pendingMergeTargetTag ? t('view.tagMergeConfirm') : t('common.save'))
        });
        saveButton.addClass(!isCreateMode && this.pendingMergeTargetTag ? 'mod-warning' : 'mod-cta');
        saveButton.addEventListener('click', () => {
            void this.applyTagRename(Boolean(this.pendingMergeTargetTag));
        });

        const cancelButton = actions.createEl('button', { text: t('common.cancel') });
        cancelButton.addEventListener('click', () => {
            if (!isCreateMode && this.pendingMergeTargetTag) {
                this.pendingMergeTargetTag = null;
                this.renderTagEditPopoverContent();
                this.positionTagEditPopover();
                return;
            }
            this.cancelTagEditing();
        });

        if (!isCreateMode) {
            const deleteButton = actions.createEl('button', { text: t('common.delete') });
            deleteButton.addClass('mod-warning');
            deleteButton.addEventListener('click', () => {
                void this.tryDeleteEditingTag();
            });
        }
    }

    /**
     * 定位弹出面板
     */
    private positionTagEditPopover() {
        if (!this.tagPopoverEl) return;

        let anchorEl = this.tagPopoverAnchorEl;
        if ((!anchorEl || !anchorEl.isConnected) && this.editingTagName) {
            anchorEl = this.findTagAnchorElement(this.editingTagName);
            if (!anchorEl) {
                return;
            }
            this.tagPopoverAnchorEl = anchorEl;
        }
        if (!anchorEl || !anchorEl.isConnected) return;

        const rect = anchorEl.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) {
            if (!this.editingTagName) return;
            const recoveredAnchor = this.findTagAnchorElement(this.editingTagName);
            if (!recoveredAnchor) return;
            this.tagPopoverAnchorEl = recoveredAnchor;
            const recoveredRect = recoveredAnchor.getBoundingClientRect();
            if (recoveredRect.width === 0 && recoveredRect.height === 0) return;
            anchorEl = recoveredAnchor;
        }

        const finalRect = anchorEl.getBoundingClientRect();
        const panelRect = this.tagPopoverEl.getBoundingClientRect();

        const desiredLeft = finalRect.left + (finalRect.width / 2) - (panelRect.width / 2);
        const maxLeft = window.innerWidth - panelRect.width - 8;
        const left = Math.max(8, Math.min(desiredLeft, maxLeft));
        const top = Math.min(finalRect.bottom + 8, window.innerHeight - panelRect.height - 8);

        this.tagPopoverEl.style.left = `${left}px`;
        this.tagPopoverEl.style.top = `${Math.max(8, top)}px`;
    }

    /**
     * 注册弹出面板全局事件
     */
    private ensureTagPopoverGlobalHandlers() {
        if (!this.tagPopoverOutsideClickHandler) {
            this.tagPopoverOutsideClickHandler = (event: MouseEvent) => {
                if (!this.tagPopoverEl) return;
                const target = event.target as Node | null;
                if (target && this.tagPopoverEl.contains(target)) return;
                if (target && this.tagPopoverAnchorEl?.contains(target)) return;
                this.cancelTagEditing();
            };
            window.addEventListener('mousedown', this.tagPopoverOutsideClickHandler);
        }

        if (!this.tagPopoverEscHandler) {
            this.tagPopoverEscHandler = (event: KeyboardEvent) => {
                if (event.key === 'Escape') {
                    this.cancelTagEditing();
                }
            };
            window.addEventListener('keydown', this.tagPopoverEscHandler);
        }
    }

    /**
     * 注销弹出面板全局事件
     */
    private teardownTagPopoverGlobalHandlers() {
        if (this.tagPopoverOutsideClickHandler) {
            window.removeEventListener('mousedown', this.tagPopoverOutsideClickHandler);
            this.tagPopoverOutsideClickHandler = undefined;
        }
        if (this.tagPopoverEscHandler) {
            window.removeEventListener('keydown', this.tagPopoverEscHandler);
            this.tagPopoverEscHandler = undefined;
        }
    }

    /**
     * 关闭标签编辑弹出面板
     */
    private closeTagEditPopover() {
        if (this.tagPopoverEl) {
            this.tagPopoverEl.remove();
            this.tagPopoverEl = null;
        }
        this.tagPopoverAnchorEl = null;
        this.teardownTagPopoverGlobalHandlers();
    }

    /**
     * 删除当前编辑中的标签（仅允许删除未关联仓库的标签）
     */
    private async tryDeleteEditingTag() {
        if (!this.editingTagName) return;

        const tagName = this.editingTagName.trim();
        if (!tagName) return;

        const deleteResult = this.plugin.removeTagIfUnused(tagName);
        if (!deleteResult.removed) {
            if (deleteResult.associatedRepositoryCount > 0) {
                new Notice(t('view.tagDeleteBlocked', {
                    tag: tagName,
                    count: String(deleteResult.associatedRepositoryCount)
                }));
            } else {
                new Notice(t('view.tagDeleteNotFound', { tag: tagName }));
            }
            return;
        }

        this.filterByTags.delete(this.normalizeTagName(tagName));
        this.cancelTagEditing();
        await this.plugin.savePluginData();
        new Notice(t('view.tagDeleteSuccess', { tag: tagName }));
    }

    /**
     * 应用标签重命名
     */
    private async applyTagRename(forceMerge: boolean) {
        if (!this.isCreatingTag && !this.editingTagName) return;

        const sourceTag = this.editingTagName?.trim() || '';
        const targetTag = this.editingTagDraft.trim();
        const selectedColor = this.editingTagColorDraft || (sourceTag ? this.getTagColor(sourceTag) : '');
        const isNameChanged = sourceTag !== targetTag;
        const isColorChanged = this.editingTagColorDirty;

        if (!targetTag) {
            new Notice(this.isCreatingTag ? t('view.tagCreateEmpty') : t('view.tagRenameEmpty'));
            return;
        }

        if (this.isCreatingTag) {
            const isAdded = this.plugin.addTag(targetTag);
            if (!isAdded) {
                new Notice(t('view.tagCreateExists', { tag: targetTag }));
                return;
            }

            if (isColorChanged && selectedColor) {
                this.plugin.setTagColor(targetTag, selectedColor);
            }

            this.cancelTagEditing();
            await this.plugin.savePluginData();
            new Notice(t('view.tagCreateSuccess', { tag: targetTag }));
            return;
        }

        if (!isNameChanged && !isColorChanged) {
            new Notice(t('view.tagRenameUnchanged'));
            this.cancelTagEditing();
            return;
        }

        if (!isNameChanged && isColorChanged) {
            this.plugin.setTagColor(sourceTag, selectedColor);
            this.cancelTagEditing();
            await this.plugin.savePluginData();
            new Notice(t('view.tagColorUpdated', { tag: sourceTag }));
            return;
        }

        const sourceNormalized = sourceTag.toLowerCase();
        const targetNormalized = targetTag.toLowerCase();
        const existingTagSet = new Set((this.allTags || []).map(tag => tag.toLowerCase()));
        const willMerge = sourceNormalized !== targetNormalized && existingTagSet.has(targetNormalized);
        if (willMerge && !forceMerge) {
            this.pendingMergeTargetTag = targetTag;
            this.renderTagEditPopoverContent();
            this.positionTagEditPopover();
            return;
        }

        const affectedCount = this.plugin.renameTagAcrossEnhancements(sourceTag, targetTag);
        const sourceTagStillExists = (this.allTags || []).some(
            (existingTag) => this.normalizeTagName(existingTag) === sourceNormalized
        );
        const isDefinitionOnlyRename = affectedCount === 0 && sourceTagStillExists;

        if (affectedCount === 0 && !isDefinitionOnlyRename) {
            new Notice(t('view.tagRenameNotFound', { tag: sourceTag }));
            return;
        }

        if (isDefinitionOnlyRename) {
            this.plugin.addTag(targetTag);
            this.plugin.removeTagIfUnused(sourceTag);
        }

        this.migrateTagFilterState(sourceTag, targetTag);
        this.editingTagName = targetTag;
        this.editingTagDraft = targetTag;
        this.editingTagColorDraft = selectedColor;
        this.editingTagColorDirty = false;
        this.pendingMergeTargetTag = null;

        if (isColorChanged) {
            this.plugin.setTagColor(targetTag, selectedColor);
        }

        this.cancelTagEditing();
        await this.plugin.savePluginData();
        new Notice(t('view.tagRenameSuccess', {
            oldTag: sourceTag,
            newTag: targetTag,
            count: String(affectedCount)
        }));
    }

    /**
     * 在标签重命名后迁移筛选状态
     */
    private migrateTagFilterState(oldTag: string, newTag: string) {
        const oldNormalized = this.normalizeTagName(oldTag);
        const newNormalized = this.normalizeTagName(newTag);
        const oldActive = this.filterByTags.get(oldNormalized) || false;
        this.filterByTags.delete(oldNormalized);
        if (!oldActive) return;
        this.filterByTags.set(newNormalized, true);
    }

    /**
     * 更新标签筛选区域 (Uses this.allTags)
     */
    updateTagsFilter(container: HTMLElement) {
        container.empty();
        this.renderTagManageToggleButton(container);
        if (this.isTagManageMode) {
            this.renderTagAddButton(container);
        }

        const currentTags = this.allTags || [];
        if (currentTags.length === 0) {
            this.editingTagName = null;
            this.editingTagDraft = '';
            this.editingTagColorDraft = '';
            this.editingTagColorDirty = false;
            this.isCreatingTag = false;
            this.pendingMergeTargetTag = null;
            this.closeTagEditPopover();
            container.createSpan({
                cls: 'github-stars-tags-empty',
                text: this.isTagManageMode ? t('view.tagManageNoTags') : t('view.noTags')
            });
            return;
        }

        // 1. 计算每个标签的数量（按当前可见仓库范围：账号过滤 + 文本过滤）
        const tagCounts = new Map<string, number>();
        const canonicalTagNameMap = new Map<string, string>(
            currentTags.map((tag) => [this.normalizeTagName(tag), tag] as const)
        );
        const repoById = new Map(this.githubRepositories.map(repo => [repo.id, repo] as const));
        const visibleRepoIdSet = new Set(
            this.githubRepositories
                .filter((repo) => this.isRepoVisibleByAccount(repo))
                .map((repo) => repo.id)
        );

        Object.entries(this.userEnhancements).forEach(([repoId, enhancement]) => {
            const numericRepoId = Number(repoId);
            if (!visibleRepoIdSet.has(numericRepoId)) {
                return;
            }

            const baseRepo = repoById.get(numericRepoId);
            if (!baseRepo) return;

            const repoForSearch = {
                ...baseRepo,
                notes: enhancement.notes || '',
                tags: enhancement.tags || []
            };

            if (!this.matchesCurrentTextFilter(repoForSearch)) {
                return;
            }

            if (Array.isArray(enhancement.tags)) {
                enhancement.tags.forEach((tag) => {
                    const existingTagKey = canonicalTagNameMap.get(this.normalizeTagName(tag)) || tag;
                    tagCounts.set(existingTagKey, (tagCounts.get(existingTagKey) || 0) + 1);
                });
            }
        });

        // 2. 决定显示多少标签
        const maxVisibleTags = 5;
        const tagsToShow = this.showAllTags ? currentTags : currentTags.slice(0, maxVisibleTags);
        
        // 3. 创建标签按钮
        tagsToShow.forEach(tag => {
            const count = tagCounts.get(tag) || 0;
            const normalizedTag = this.normalizeTagName(tag);
            const isActive = this.filterByTags.get(normalizedTag) || false;
            const isHighlighted = this.currentFilter && tag.toLowerCase().includes(this.currentFilter);
            const isEditing = this.editingTagName?.toLowerCase() === tag.toLowerCase();
            
            const tagEl = container.createEl('span', {
                cls: 'github-stars-tag' + 
                     (isActive ? ' active' : '') + 
                     (isHighlighted ? ' highlighted' : '') +
                     (this.isTagManageMode ? ' managing' : '') +
                     (isEditing ? ' editing' : ''),
                attr: { 'data-tag-name': tag.toLowerCase() },
                text: `${tag} (${count})`
            });
            this.applyTagColorStyle(tagEl, tag);

            if (this.isTagManageMode) {
                tagEl.setAttribute('title', t('view.tagManageClickToEdit'));
            }

            tagEl.addEventListener('click', () => {
                if (this.isTagManageMode) {
                    container.querySelectorAll('.github-stars-tag.editing').forEach((el) => {
                        el.removeClass('editing');
                    });
                    tagEl.addClass('editing');
                    this.startTagEditing(tag, tagEl);
                    return;
                }

                const currentState = this.filterByTags.get(normalizedTag) || false;
                this.filterByTags.set(normalizedTag, !currentState);
                tagEl.toggleClass('active', !currentState);
                
                // 清除不可见仓库的选择状态
                this.clearInvisibleSelections();
                this.requestRepositoriesRender();
            });
        });

        // 4. 添加"更多"按钮
        if (!this.isTagManageMode && currentTags.length > maxVisibleTags) {
            const moreButton = container.createEl('span', {
                cls: 'github-stars-tag-more',
                text: this.showAllTags ? t('view.showLess') : t('view.showMore') + ` (+${currentTags.length - maxVisibleTags})`
            });

            moreButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showAllTags = !this.showAllTags;
                
                // Add smooth transition effect
                moreButton.removeClass('transition-button');
                moreButton.removeClass('transform-scale-down');
                moreButton.addClass('transition-button');
                this.requestTagsFilterUpdate();
            });
        }
    }

    /**
     * 渲染仓库列表 (Major Refactor)
     */
    renderRepositories() {
        if (!this.repoContainer) {
            console.warn('repoContainer not initialized');
            return;
        }
        const renderVersion = ++this.repoRenderVersion;

        if (!this.githubRepositories || this.githubRepositories.length === 0) {
            this.disableRepoVirtualization();
            this.repoContainer.empty();
            this.repoContainer.createEl('div', { cls: 'github-stars-empty', text: t('view.noRepos') });
            this.hideRepoRenderStatus();
            this.updateTotalStarsCount(0);
            return;
        }

        const sortedRepos = this.getSortedFilteredRepositories();

        if (sortedRepos.length === 0) {
            this.disableRepoVirtualization();
            this.repoContainer.empty();
            this.repoContainer.createEl('div', { cls: 'github-stars-empty', text: t('view.noMatchingRepos') });
            this.hideRepoRenderStatus();
            this.updateTotalStarsCount(0);
            return;
        }

        this.updateTotalStarsCount(sortedRepos.length);

        if (!this.shouldUseVirtualizedRender(sortedRepos.length)) {
            void this.renderFullRepositories(sortedRepos, renderVersion);
            return;
        }

        this.renderVirtualizedRepositories(sortedRepos, renderVersion);
    }

    /**
     * 合并 GitHub 仓库与用户增强字段
     */
    private buildCombinedRepositories(): RenderRepository[] {
        return this.githubRepositories.map((githubRepo) => {
            const enhancement = this.userEnhancements[githubRepo.id] || { notes: '', tags: [], linked_note: undefined };
            return { ...githubRepo, ...enhancement };
        });
    }

    /**
     * 过滤仓库数据（账号 + 搜索 + 标签）
     */
    private filterRepositories(repositories: RenderRepository[]): RenderRepository[] {
        const activeTags = this.getActiveTagFiltersNormalized();

        return repositories.filter((repo) => {
            if (!this.isRepoVisibleByAccount(repo)) {
                return false;
            }
            if (!this.matchesCurrentTextFilter(repo)) {
                return false;
            }
            if (activeTags.length === 0) {
                return true;
            }

            const normalizedRepoTags = new Set((repo.tags || []).map((tag) => this.normalizeTagName(tag)));
            return activeTags.some((tag) => normalizedRepoTags.has(tag));
        });
    }

    /**
     * 对仓库数据排序
     */
    private sortRepositories(repositories: RenderRepository[]): RenderRepository[] {
        const sortedRepos = [...repositories];
        const isDesc = this.sortOrder === 'desc';

        switch (this.sortBy) {
            case 'starred_at':
                sortedRepos.sort((a, b) => {
                    const dateA = a.starred_at ? Date.parse(a.starred_at) : 0;
                    const dateB = b.starred_at ? Date.parse(b.starred_at) : 0;
                    return isDesc ? dateB - dateA : dateA - dateB;
                });
                break;
            case 'stars':
                sortedRepos.sort((a, b) => {
                    const countA = a.stargazers_count || 0;
                    const countB = b.stargazers_count || 0;
                    return isDesc ? countB - countA : countA - countB;
                });
                break;
            case 'forks':
                sortedRepos.sort((a, b) => {
                    const countA = a.forks_count || 0;
                    const countB = b.forks_count || 0;
                    return isDesc ? countB - countA : countA - countB;
                });
                break;
            case 'updated':
                sortedRepos.sort((a, b) => {
                    const dateA = a.updated_at ? Date.parse(a.updated_at) : 0;
                    const dateB = b.updated_at ? Date.parse(b.updated_at) : 0;
                    return isDesc ? dateB - dateA : dateA - dateB;
                });
                break;
        }

        return sortedRepos;
    }

    /**
     * 获取排序后仓库列表（用于渲染）
     */
    private getSortedFilteredRepositories(): RenderRepository[] {
        const combinedRepos = this.buildCombinedRepositories();
        const filteredRepos = this.filterRepositories(combinedRepos);
        return this.sortRepositories(filteredRepos);
    }

    /**
     * 常规渲染（非虚拟化）
     */
    private async renderFullRepositories(repositories: RenderRepository[], renderVersion: number): Promise<void> {
        if (!this.repoContainer) return;
        this.disableRepoVirtualization();
        this.repoContainer.empty();
        const totalCount = repositories.length;
        const batchSize = this.getRepoRenderBatchSize(totalCount);
        const mode = this.getRepoRenderPerformanceMode();
        const firstScreenMinimum = mode === 'visual' ? 96 : mode === 'extreme' ? 48 : 64;
        const firstScreenCount = Math.min(totalCount, Math.max(batchSize * 2, firstScreenMinimum));
        const shouldShowStatus = totalCount > firstScreenCount;

        if (shouldShowStatus) {
            this.showRepoRenderStatus('正在更新列表…');
        } else {
            this.hideRepoRenderStatus();
        }

        for (let index = 0; index < firstScreenCount; index++) {
            if (renderVersion !== this.repoRenderVersion || !this.repoContainer) {
                return;
            }
            this.renderRepositoryCard(repositories[index], this.repoContainer);
        }

        if (firstScreenCount >= totalCount) {
            if (renderVersion === this.repoRenderVersion) {
                this.hideRepoRenderStatus();
            }
            return;
        }

        await this.waitForNextFrame();

        for (let start = firstScreenCount; start < totalCount; start += batchSize) {
            if (renderVersion !== this.repoRenderVersion || !this.repoContainer) {
                return;
            }

            const end = Math.min(totalCount, start + batchSize);
            for (let index = start; index < end; index++) {
                if (renderVersion !== this.repoRenderVersion || !this.repoContainer) {
                    return;
                }
                this.renderRepositoryCard(repositories[index], this.repoContainer);
            }

            if (shouldShowStatus) {
                const percent = Math.min(100, Math.round((end / totalCount) * 100));
                this.showRepoRenderStatus(`正在更新列表… ${percent}%`);
            }

            if (end < totalCount) {
                await this.waitForNextFrame();
            }
        }

        if (renderVersion === this.repoRenderVersion) {
            this.hideRepoRenderStatus();
        }
    }

    /**
     * 虚拟列表渲染（仅渲染可视区域）
     */
    private renderVirtualizedRepositories(repositories: RenderRepository[], renderVersion: number): void {
        if (!this.repoContainer) return;
        if (renderVersion !== this.repoRenderVersion) return;
        this.hideRepoRenderStatus();

        this.virtualizedRepos = repositories;
        if (!this.isRepoListVirtualized || !this.virtualItemsEl || !this.virtualTopSpacerEl || !this.virtualBottomSpacerEl) {
            this.enableRepoVirtualization();
        }

        this.virtualStartIndex = -1;
        this.virtualEndIndex = -1;
        this.virtualColumnCount = 1;
        this.renderVirtualizedWindow(true);
    }

    /**
     * 启用仓库列表虚拟化容器
     */
    private enableRepoVirtualization(): void {
        if (!this.repoContainer) return;
        this.isRepoListVirtualized = true;
        this.repoContainer.addClass('virtualized');
        this.repoContainer.empty();

        this.virtualTopSpacerEl = this.repoContainer.createDiv('github-stars-virtual-spacer');
        this.virtualTopSpacerEl.addClass('github-stars-virtual-spacer-top');
        this.virtualItemsEl = this.repoContainer.createDiv('github-stars-virtual-items');
        this.virtualBottomSpacerEl = this.repoContainer.createDiv('github-stars-virtual-spacer');
        this.virtualBottomSpacerEl.addClass('github-stars-virtual-spacer-bottom');
    }

    /**
     * 关闭仓库列表虚拟化状态
     */
    private disableRepoVirtualization(): void {
        if (this.virtualMeasureFrameId !== null) {
            window.cancelAnimationFrame(this.virtualMeasureFrameId);
            this.virtualMeasureFrameId = null;
        }
        if (this.repoContainer) {
            this.repoContainer.removeClass('virtualized');
        }
        this.isRepoListVirtualized = false;
        this.virtualizedRepos = [];
        this.virtualStartIndex = 0;
        this.virtualEndIndex = 0;
        this.virtualColumnCount = 1;
        this.virtualTopSpacerEl = null;
        this.virtualItemsEl = null;
        this.virtualBottomSpacerEl = null;
    }

    /**
     * 渲染当前可视窗口内的仓库卡片
     */
    private renderVirtualizedWindow(force = false): void {
        if (!this.repoContainer || !this.isRepoListVirtualized || !this.virtualItemsEl || !this.virtualTopSpacerEl || !this.virtualBottomSpacerEl) {
            return;
        }

        const total = this.virtualizedRepos.length;
        if (total === 0) {
            this.virtualTopSpacerEl.setCssProps({ height: '0px' });
            this.virtualBottomSpacerEl.setCssProps({ height: '0px' });
            this.virtualItemsEl.empty();
            return;
        }

        const viewportHeight = Math.max(this.repoContainer.clientHeight, this.virtualItemEstimate);
        const containerWidth = Math.max(this.repoContainer.clientWidth, REPO_VIRTUAL_MIN_CARD_WIDTH);
        const columns = Math.max(1, Math.floor((containerWidth + REPO_VIRTUAL_GRID_GAP) / (REPO_VIRTUAL_MIN_CARD_WIDTH + REPO_VIRTUAL_GRID_GAP)));
        const totalRows = Math.max(1, Math.ceil(total / columns));
        const visibleRows = Math.max(1, Math.ceil(viewportHeight / this.virtualItemEstimate));
        const startRow = Math.max(0, Math.floor(this.repoContainer.scrollTop / this.virtualItemEstimate) - REPO_VIRTUALIZATION_OVERSCAN);
        const endRow = Math.min(totalRows, startRow + visibleRows + (REPO_VIRTUALIZATION_OVERSCAN * 2));
        const start = startRow * columns;
        const end = Math.min(total, endRow * columns);

        if (!force && columns === this.virtualColumnCount && start === this.virtualStartIndex && end === this.virtualEndIndex) {
            return;
        }

        this.virtualColumnCount = columns;
        this.virtualStartIndex = start;
        this.virtualEndIndex = end;
        this.virtualItemsEl.setCssProps({ '--github-virtual-columns': String(columns) });
        this.virtualTopSpacerEl.setCssProps({ height: `${startRow * this.virtualItemEstimate}px` });
        this.virtualBottomSpacerEl.setCssProps({ height: `${Math.max(0, (totalRows - endRow) * this.virtualItemEstimate)}px` });

        this.virtualItemsEl.empty();
        for (let index = start; index < end; index++) {
            this.renderRepositoryCard(this.virtualizedRepos[index], this.virtualItemsEl);
        }

        this.scheduleVirtualItemMeasure();
    }

    /**
     * 依据可视区已渲染卡片高度修正估算值，降低跳动
     */
    private scheduleVirtualItemMeasure(): void {
        if (!this.virtualItemsEl) return;
        if (this.virtualMeasureFrameId !== null) return;

        this.virtualMeasureFrameId = window.requestAnimationFrame(() => {
            this.virtualMeasureFrameId = null;
            if (!this.virtualItemsEl) return;

            const cards = Array.from(this.virtualItemsEl.querySelectorAll('.github-stars-repo')) as HTMLElement[];
            if (cards.length === 0) return;

            const averageHeight = cards.reduce((sum, card) => sum + Math.max(160, card.offsetHeight), 0) / cards.length;
            const nextEstimate = Math.max(180, Math.min(460, Math.round(averageHeight)));
            const mergedEstimate = Math.round((this.virtualItemEstimate * 3 + nextEstimate) / 4);

            if (Math.abs(mergedEstimate - this.virtualItemEstimate) >= 8) {
                this.virtualItemEstimate = mergedEstimate;
                this.renderVirtualizedWindow(true);
            }
        });
    }

    /**
     * 渲染单个仓库卡片
     */
    private renderRepositoryCard(repo: RenderRepository, parent: HTMLElement): void {
        const repoEl = parent.createEl('div', { cls: 'github-stars-repo' });

        const headerEl = repoEl.createEl('div', { cls: 'github-stars-repo-header' });

        if (this.plugin.settings.enableExport && this.isExportMode) {
            const checkboxContainer = headerEl.createEl('div', { cls: 'github-stars-repo-checkbox-container' });
            const checkbox = checkboxContainer.createEl('input', {
                type: 'checkbox',
                cls: 'github-stars-repo-checkbox'
            });
            checkbox.checked = this.selectedRepos.has(repo.id);
            checkbox.addEventListener('change', () => {
                this.toggleRepoSelection(repo.id);
            });
        }

        if (repo.owner && repo.owner.avatar_url) {
            const avatarImg = headerEl.createEl('img', {
                cls: 'github-stars-repo-avatar',
                attr: {
                    src: repo.owner.avatar_url,
                    alt: `${repo.owner.login} avatar`,
                    loading: 'lazy'
                }
            });

            avatarImg.addEventListener('error', () => {
                avatarImg.addClass('display-none');
            });
        }

        const titleGroupEl = headerEl.createEl('div', { cls: 'github-stars-repo-title-group' });
        const titleEl = titleGroupEl.createEl('div', { cls: 'github-stars-repo-title' });

        const linkEl = titleEl.createEl('div', {
            cls: 'github-stars-repo-link'
        });
        linkEl.textContent = repo.full_name || repo.name || 'Unnamed repo';
        linkEl.onclick = () => {
            if (repo.html_url) {
                window.open(repo.html_url, '_blank');
            }
            return false;
        };

        if (Array.isArray(repo.tags) && repo.tags.length > 0) {
            const titleTagsEl = titleGroupEl.createEl('div', { cls: 'github-stars-repo-title-tags' });
            repo.tags.forEach((tag) => {
                const tagEl = titleTagsEl.createEl('span', {
                    cls: 'github-stars-repo-tag',
                    text: tag
                });
                this.applyTagColorStyle(tagEl, tag);

                tagEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const normalizedTag = this.normalizeTagName(tag);
                    const currentState = this.filterByTags.get(normalizedTag) || false;
                    this.filterByTags.set(normalizedTag, !currentState);
                    this.requestTagsFilterUpdate();
                    this.clearInvisibleSelections();
                    this.requestRepositoriesRender();
                });
            });
        }

        if (repo.description) {
            const descEl = repoEl.createEl('div', { cls: 'github-stars-repo-desc' });
            EmojiUtils.setEmojiText(descEl, repo.description);

            if (repo.description.length > 100) {
                const tooltip = repoEl.createEl('div', {
                    cls: 'github-stars-repo-desc-tooltip',
                    text: repo.description
                });

                descEl.addEventListener('mouseenter', () => {
                    tooltip.addClass('display-block');
                });

                descEl.addEventListener('mouseleave', () => {
                    tooltip.removeClass('display-block');
                });
            }
        }

        const footerEl = repoEl.createEl('div', { cls: 'github-stars-repo-footer' });
        const infoRow = footerEl.createEl('div', { cls: 'github-stars-repo-info' });
        if (repo.language) {
            infoRow.createEl('span', { cls: 'github-stars-repo-language', text: repo.language });
        }

        const starsSpan = infoRow.createEl('span', { cls: 'github-stars-repo-stars' });
        const starIcon = starsSpan.createEl('span', { cls: 'github-stars-icon star-icon' });
        setIcon(starIcon, 'star');
        starsSpan.createEl('span', { text: ` ${this.formatNumber(repo.stargazers_count ?? 0)}` });

        const forksSpan = infoRow.createEl('span', { cls: 'github-stars-repo-forks' });
        const forkIcon = forksSpan.createEl('span', { cls: 'github-stars-icon fork-icon' });
        setIcon(forkIcon, 'git-fork');
        forksSpan.createEl('span', { text: ` ${this.formatNumber(repo.forks_count ?? 0)}` });

        const updatedSpan = infoRow.createEl('span', { cls: 'github-stars-repo-updated' });
        const calendarIcon = updatedSpan.createEl('span', { cls: 'github-stars-icon calendar-icon' });
        setIcon(calendarIcon, 'calendar');
        updatedSpan.createEl('span', { text: ` ${this.formatRelativeTime(repo.updated_at)}` });

        const editButton = footerEl.createEl('button', {
            cls: 'github-stars-repo-edit',
            text: t('view.editRepo')
        });
        editButton.addEventListener('click', () => {
            const originalGithubRepo = this.githubRepositories.find((item) => item.id === repo.id);
            if (originalGithubRepo) {
                this.openEditModal(originalGithubRepo);
            } else {
                console.error('Could not find original GitHub repo data for ID:', repo.id);
                new Notice(t('view.cannotEditRepo'));
            }
        });

        if (repo.notes) {
            const notesContainer = repoEl.createEl('div', { cls: 'github-stars-repo-notes' });
            notesContainer.createEl('span', {
                cls: 'github-stars-repo-notes-icon',
                text: '📝'
            });

            const contentEl = notesContainer.createEl('div', { cls: 'github-stars-repo-notes-content' });
            EmojiUtils.setEmojiText(contentEl, repo.notes);
        }

        if (repo.linked_note) {
            const linkedNoteEl = repoEl.createEl('div', { cls: 'github-stars-repo-linked-note' });
            setIcon(linkedNoteEl, 'link');
            const link = linkedNoteEl.createEl('a', {
                text: repo.linked_note,
                href: '#',
                cls: 'internal-link'
            });
            link.addEventListener('click', (ev) => {
                ev.preventDefault();
                this.app.workspace.openLinkText(repo.linked_note!, '', false).catch((err) =>
                    console.error('Failed to open linked note:', err)
                );
            });
        }
    }

    /**
     * 创建工具栏内容
     */
    private createToolbar(toolbarDiv: HTMLElement) {
        // Sync Button (logic unchanged)
        const syncButton = toolbarDiv.createEl('button', { cls: 'github-stars-sync-button' });
        setIcon(syncButton, 'refresh-cw');
        syncButton.setAttribute('aria-label', t('view.syncButton'));
        syncButton.addEventListener('click', () => {
            void (async () => {
                syncButton.setAttribute('disabled', 'true');
                setIcon(syncButton, 'loader');
                try {
                    await this.plugin.syncStars(); // Sync logic is now in main.ts
                    // 移除了重复的成功通知，githubService已经会显示详细的同步结果
                } catch (error) {
                    new Notice(t('sync.error'));
                    console.error('同步失败:', error);
                } finally {
                    syncButton.removeAttribute('disabled');
                    setIcon(syncButton, 'refresh-cw');
                }
            })();
        });

        // Search Input with Clear Button
        const searchContainer = toolbarDiv.createDiv('github-stars-search-container');
        
        this.searchInput = searchContainer.createEl('input', {
            cls: 'github-stars-search',
            attr: { type: 'text', placeholder: t('view.searchPlaceholder') }
        });

        const clearButton = searchContainer.createEl('button', {
            cls: 'github-stars-search-clear'
        });
        clearButton.setAttribute('aria-label', t('view.clearSearch'));
        clearButton.setAttribute('title', t('view.clearSearch'));
        
        // 初始状态隐藏清除按钮
        clearButton.addClass('hidden');
        
        this.searchInput.addEventListener('input', () => {
            this.currentFilter = this.searchInput.value.toLowerCase();
            
            // 根据输入内容显示/隐藏清除按钮
            if (this.searchInput.value.length > 0) {
                clearButton.removeClass('hidden');
            } else {
                clearButton.addClass('hidden');
            }
            
            // Update tags display to highlight matching tags (but don't activate them)
            this.requestTagsFilterUpdate();
            
            // 如果处于导出模式，清除不可见仓库的选择状态
            if (this.isExportMode) {
                this.clearInvisibleSelections();
            }
            
            this.requestRepositoriesRender();
        });
        
        // 清除按钮功能
        clearButton.addEventListener('click', () => {
            this.searchInput.value = '';
            this.currentFilter = '';
            clearButton.addClass('hidden');
            
            // 更新显示
            this.requestTagsFilterUpdate();
            if (this.isExportMode) {
                this.clearInvisibleSelections();
            }
            this.requestRepositoriesRender();
        });

        // Sort Button Group - Four individual radio-style buttons
        const sortButtonGroup = toolbarDiv.createDiv('github-stars-sort-group');

        const sortOptions = [
            { key: 'starred_at', icon: 'calendar-clock', title: t('view.sortBy.starred') },
            { key: 'stars', icon: 'star', title: t('view.sortBy.stars') },
            { key: 'forks', icon: 'git-fork', title: t('view.sortBy.forks') },
            { key: 'updated', icon: 'clock', title: t('view.sortBy.updated') }
        ] as const;
        
        sortOptions.forEach(option => {
            const isActive = this.sortBy === option.key;
            const sortButton = sortButtonGroup.createEl('button', {
                cls: 'github-stars-sort-option' + (isActive ? ' active' : '')
            });
            
            // 创建按钮内容容器
            const buttonContent = sortButton.createDiv('sort-button-content');
            const iconSpan = buttonContent.createSpan('sort-icon');
            setIcon(iconSpan, option.icon);
            
            // 添加��序方向指示器
            const directionSpan = buttonContent.createSpan('sort-direction');
            if (isActive) {
                setIcon(directionSpan, this.sortOrder === 'desc' ? 'chevron-down' : 'chevron-up');
            }

            const orderText = this.sortOrder === 'desc' ? t('view.sortBy.desc') : t('view.sortBy.asc');
            sortButton.setAttribute('aria-label', `${option.title} ${orderText}`);
            sortButton.setAttribute('title', `${option.title} ${orderText}`);
            
            sortButton.addEventListener('click', () => {
                if (this.sortBy === option.key) {
                    // 如果点击的是当前激活的按钮，切换排序方向
                    this.sortOrder = this.sortOrder === 'desc' ? 'asc' : 'desc';
                } else {
                    // 如果点击的是其他按钮，切换排序类型并设为降序
                    this.sortBy = option.key;
                    this.sortOrder = 'desc';
                    
                    // Remove active class from all buttons
                    sortButtonGroup.querySelectorAll('.github-stars-sort-option').forEach(btn => {
                        btn.removeClass('active');
                    });
                    
                    // Add active class to clicked button
                    sortButton.addClass('active');
                }
                
                // 更新所有按钮的方向指示器
                sortOptions.forEach((opt, index) => {
                    const btn = sortButtonGroup.children[index] as HTMLElement;
                    const dirSpan = btn.querySelector('.sort-direction') as HTMLElement;
                    if (this.sortBy === opt.key) {
                        dirSpan.empty();
                        setIcon(dirSpan, this.sortOrder === 'desc' ? 'chevron-down' : 'chevron-up');
                        btn.addClass('active');
                        btn.setAttribute('title', `按${opt.title}${this.sortOrder === 'desc' ? t('view.sortBy.desc') : t('view.sortBy.asc')}排序`);
                    } else {
                        dirSpan.empty();
                        btn.removeClass('active');
                        btn.setAttribute('title', `按${opt.title}排序`);
                    }
                });
                
                this.requestRepositoriesRender();
            });
        });

        // 在工具栏中添加账户选择器
        this.addAccountSelector(toolbarDiv);

        // 创建右侧按钮容器
        const rightButtonsContainer = toolbarDiv.createDiv('github-stars-toolbar-right');

        // Export Button - 批量导出按钮（仅在启用导出功能时显示，放在右上角）
        if (this.plugin.settings.enableExport) {
            if (this.isExportMode) {
                // 导出模式下显示全选/反选和确认导出按钮
                const selectAllButton = rightButtonsContainer.createEl('button', { cls: 'github-stars-select-all-button' });
                setIcon(selectAllButton, 'check-square');
                selectAllButton.setAttribute('aria-label', t('common.selectAll'));
                selectAllButton.setAttribute('title', t('common.selectAll'));
                selectAllButton.addEventListener('click', () => {
                    this.toggleSelectAll();
                });

                const exportConfirmButton = rightButtonsContainer.createEl('button', { cls: 'github-stars-export-confirm-button' });
                setIcon(exportConfirmButton, 'download');
                exportConfirmButton.setAttribute('aria-label', t('view.confirmExport'));
                exportConfirmButton.setAttribute('title', t('view.exportSelected'));
                exportConfirmButton.addEventListener('click', () => {
                    this.exportSelectedRepos().catch(err => console.error('Failed to export selected repos:', err));
                });

                const cancelButton = rightButtonsContainer.createEl('button', { cls: 'github-stars-cancel-button' });
                setIcon(cancelButton, 'x');
                cancelButton.setAttribute('aria-label', t('view.cancelExport'));
                cancelButton.setAttribute('title', t('view.exitExportMode'));
                cancelButton.addEventListener('click', () => {
                    this.exitExportMode();
                });

                // 初始化按钮状态
                this.updateSelectAllButton();
                this.updateExportConfirmButton();
            } else {
                // 正常模式下显示导出按钮 (如果启用)
                if (this.plugin.settings.enableExport) {
                    const exportButton = rightButtonsContainer.createEl('button', { cls: 'github-stars-export-button' });
                    setIcon(exportButton, 'share');
                    exportButton.setAttribute('aria-label', t('view.exportMode'));
                    exportButton.setAttribute('title', t('view.exportMode'));
                    exportButton.addEventListener('click', () => {
                        this.enterExportMode();
                    });
                }
            }
        }
    }

    /**
     * 打开编辑仓库信息的模态框 (Pass GithubRepository)
     */
    openEditModal(repo: GithubRepository) { // Changed parameter type
        // Modal will use repo.id to find/create enhancement in plugin.data.userEnhancements
        new EditRepoModal(this.app, this.plugin, repo).open();
    }

    /**
     * 清理已经失效的标签过滤条件
     */
    private pruneInvalidTagFilters(): void {
        const validTagSet = new Set((this.allTags || []).map(tag => this.normalizeTagName(tag)));
        const normalizedFilters = new Map<string, boolean>();

        Array.from(this.filterByTags.entries()).forEach(([tag, active]) => {
            const normalized = this.normalizeTagName(tag);
            if (!validTagSet.has(normalized)) {
                return;
            }
            normalizedFilters.set(normalized, (normalizedFilters.get(normalized) || false) || active);
        });

        this.filterByTags = normalizedFilters;
    }

    /**
     * 清理已经失效的标签编辑状态
     */
    private pruneInvalidTagEditingState(): void {
        if (!this.editingTagName) return;
        const validTagSet = new Set((this.allTags || []).map(tag => tag.toLowerCase()));
        if (!validTagSet.has(this.editingTagName.toLowerCase())) {
            this.cancelTagEditing();
        }
    }

    /**
     * 更新视图数据并重新渲染 (Updated Signature)
     * @param githubRepositories 最新的 GitHub 仓库列表
     * @param userEnhancements 最新的用户增强数据
     * @param allTags 最新的全局标签列表
     */
    updateData(githubRepositories: GithubRepository[], userEnhancements: { [repoId: number]: UserRepoEnhancements }, allTags: string[]) {
        this.githubRepositories = githubRepositories || [];
        this.userEnhancements = userEnhancements || {};
        this.allTags = allTags || [];
        this.pruneInvalidTagFilters();
        this.pruneInvalidTagEditingState();
        this.updateTagManageToggleButton();
        this.closeTagEditPopover();

        // Ensure UI elements exist before updating/rendering
        if (this.tagsContainer) {
             this.updateTagsFilter(this.tagsContainer);
        } else {
             console.warn('tagsContainer not initialized when updateData called');
        }
        if (this.repoContainer) {
            this.renderRepositories();
        } else {
            console.warn('repoContainer not initialized when updateData called');
        }
    }

    /**
     * 在工具栏中添加账户选择器
     */
    private addAccountSelector(toolbarDiv: HTMLElement): void {
        const accounts = this.plugin.settings.accounts || [];
        
        // 创建账户选择器容器
        const accountSelectorContainer = toolbarDiv.createDiv('github-account-selector');
        
        if (accounts.length === 0) {
            // 没有配置账号时显示添加按钮
            const addAccountBtn = accountSelectorContainer.createEl('button', {
                cls: 'github-account-add-btn',
                text: t('view.addAccount')
            });
            
            addAccountBtn.addEventListener('click', () => {
                // 打开插件设置页面
                // @ts-ignore - Obsidian API
                this.app.setting.open();
                // @ts-ignore - Obsidian API
                this.app.setting.openTabById(this.plugin.manifest.id);
            });
            
            return;
        }

        // 创建折叠按钮
        const toggleBtn = accountSelectorContainer.createEl('button', {
            cls: 'github-account-toggle-btn',
            text: `${t('view.accountsLabel')} (${accounts.filter((a: GithubAccount) => a.enabled).length})`
        });

        // 创建star总数显示元素
        const totalStarsEl = accountSelectorContainer.createDiv('github-stars-total-count');
        totalStarsEl.createEl('span', {
            cls: 'total-stars-icon',
            text: '⭐'
        });
        const totalStarsNumber = totalStarsEl.createEl('span', {
            cls: 'total-stars-number',
            text: `${this.getVisibleRepoCount()}`
        });

        // 保存引用以便更新
        this.totalStarsNumberEl = totalStarsNumber;

        // 创建折叠内容容器
        const collapsibleContent = accountSelectorContainer.createDiv('github-account-collapsible');
        collapsibleContent.addClass('display-none'); // 初始状态为折叠
        
        let isExpanded = false;

        const closePopover = () => {
            collapsibleContent.removeClass('display-block');
            collapsibleContent.addClass('display-none');
            // 将元素移回原位置
            accountSelectorContainer.appendChild(collapsibleContent);
            // 重置样式
            collapsibleContent.removeClass('position-fixed');
            collapsibleContent.removeClass('z-index-9999');
            collapsibleContent.removeAttribute('style');
            toggleBtn.removeClass('expanded');
            isExpanded = false;
            document.removeEventListener('mousedown', handleOutsideClick);
        };

        const handleOutsideClick = (event: MouseEvent) => {
            if (!collapsibleContent.contains(event.target as Node) && !toggleBtn.contains(event.target as Node)) {
                closePopover();
            }
        };

        toggleBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            if (isExpanded) {
                // 如果已经展开，则关闭
                closePopover();
            } else {
                // 如果未展开，则打开
                isExpanded = true;
                // 将弹出控件添加到 body，避免被父容器限制
                document.body.appendChild(collapsibleContent);
                collapsibleContent.removeClass('display-none');
                collapsibleContent.addClass('display-block');
                collapsibleContent.addClass('position-fixed');
                collapsibleContent.addClass('z-index-9999');
                
                // 计算位置并设置到元素的data属性
                const toggleRect = toggleBtn.getBoundingClientRect();
                collapsibleContent.setAttribute('data-top', `${toggleRect.bottom + 4}px`);
                collapsibleContent.setAttribute('data-right', `${window.innerWidth - toggleRect.right}px`);
                
                // 通过CSS变量设置位置
                collapsibleContent.style.setProperty('--popup-top', `${toggleRect.bottom + 4}px`);
                collapsibleContent.style.setProperty('--popup-right', `${window.innerWidth - toggleRect.right}px`);
                
                toggleBtn.addClass('expanded');
                // 延迟添加事件监听器，避免立即触发关闭
                setTimeout(() => {
                    document.addEventListener('mousedown', handleOutsideClick);
                }, 10);
            }
        });

        // 添加账号列表
        accounts.forEach((account: GithubAccount) => {
            const accountEl = collapsibleContent.createDiv('github-account-item-compact');
            
            // 头像
            if (account.avatar_url) {
                const avatarEl = accountEl.createEl('img', {
                    cls: 'account-avatar-small',
                    attr: {
                        src: account.avatar_url,
                        alt: `${account.username} avatar`,
                        loading: 'lazy'
                    }
                });
                avatarEl.addEventListener('error', () => {
                    avatarEl.addClass('avatar-hidden');
                });
            }
            
            // 账号信息
            const infoEl = accountEl.createDiv('account-info-compact');
            infoEl.createEl('span', {
                cls: 'account-name-compact',
                text: account.name || account.username
            });
            infoEl.createEl('span', {
                cls: 'account-username-compact',
                text: `@${account.username}`
            });
            
            // 同步时间
            const syncTime = this.plugin.data.accountSyncTimes?.[account.id];
            if (syncTime) {
                infoEl.createEl('span', {
                    cls: 'account-sync-time-compact',
                    text: this.formatRelativeTime(syncTime)
                });
            }
            
            // 启用状态切换
            const toggleEl = accountEl.createDiv('account-toggle-compact');
            const toggleInput = toggleEl.createEl('input', {
                type: 'checkbox',
                cls: 'account-toggle-input-compact'
            });
            toggleInput.checked = account.enabled;
            
            toggleInput.addEventListener('change', () => {
                void (async () => {
                    account.enabled = toggleInput.checked;
                    await this.plugin.saveSettings({ refreshViews: true });

                    // 更新视觉状态
                    accountEl.toggleClass('disabled', !account.enabled);

                    // 更新按钮文本
                    toggleBtn.textContent = `${t('view.accountsLabel')} (${accounts.filter((a: GithubAccount) => a.enabled).length})`;

                    // 显示通知
                    const noticeKey = account.enabled ? 'notices.accountEnabled' : 'notices.accountDisabled';
                    new Notice(t(noticeKey, { username: account.username }));

                })();
            });
            
            // 设置初始状态
            if (!account.enabled) {
                accountEl.addClass('disabled');
            }
        });
    }

    /**
     * 进入导出模式
     */
    enterExportMode() {
        this.isExportMode = true;
        this.selectedRepos.clear();
        
        // 重新渲染工具栏和仓库列表
        this.renderView();
        
        new Notice('已进入导出模式，请选择要导出的仓库');
    }

    /**
     * 退出导出模式
     */
    exitExportMode() {
        this.isExportMode = false;
        this.selectedRepos.clear();
        
        // 重新渲染工具栏和仓库列表
        this.renderView();
        
        new Notice('已退出导出模式');
    }

    /**
     * 切换导出模式（保留兼容性）
     */
    toggleExportMode() {
        if (this.isExportMode) {
            this.exitExportMode();
        } else {
            this.enterExportMode();
        }
    }

    /**
     * 重新渲染整个视图
     */
    renderView() {
        // 只重新渲染工具栏，保持其他内容不变
        const container = this.containerEl.children[1];
        const toolbar = container.querySelector('.github-stars-toolbar');
        if (toolbar) {
            // 清空工具栏并重新创建
            toolbar.empty();
            this.createToolbar(toolbar as HTMLElement);
        }
        // 重新渲染仓库列表以显示/隐藏复选框
        this.renderRepositories();
    }

    /**
     * 更新导出确认按钮状态
     */
    updateExportConfirmButton() {
        const toolbar = this.containerEl.querySelector('.github-stars-toolbar');
        if (!toolbar) return;

        const confirmButton = toolbar.querySelector('.github-stars-export-confirm-button') as HTMLButtonElement;
        if (confirmButton) {
            const selectedCount = this.selectedRepos.size;
            confirmButton.textContent = selectedCount > 0 ? `导出 (${selectedCount})` : '导出';
            confirmButton.disabled = selectedCount === 0;
        }
    }

    /**
     * 导出选中的仓库
     */
    async exportSelectedRepos() {
        if (this.selectedRepos.size === 0) {
            new Notice('请先选择要导出的仓库');
            return;
        }

        const selectedRepositories = this.githubRepositories.filter(repo =>
            this.selectedRepos.has(repo.id)
        );

        const confirmButton = this.containerEl.querySelector('.github-stars-export-confirm-button') as HTMLButtonElement;
        if (confirmButton) {
            confirmButton.disabled = true;
            confirmButton.textContent = '导出中...';
        }

        try {
            const result = await this.plugin.exportService.exportAllRepositories(
                selectedRepositories,
                this.userEnhancements
            );

            if (result.success) {
                new Notice(`导出完成！成功导出 ${result.exportedCount} 个仓库，跳过 ${result.skippedCount} 个`);
            } else {
                new Notice(`导出完成，但有错误。成功导出 ${result.exportedCount} 个仓库，失败 ${result.errors.length} 个`);
                console.error('导出错误:', result.errors);
            }

            // 退出导出模式
            this.exitExportMode();
        } catch (error) {
            console.error('导出失败:', error);
            new Notice('导出失败，请查看控制台了解详情');
        } finally {
            const confirmBtn = this.containerEl.querySelector('.github-stars-export-confirm-button') as HTMLButtonElement;
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.textContent = '导出';
            }
        }
    }

    /**
     * 切换仓库选中状态
     */
    toggleRepoSelection(repoId: number) {
        if (this.selectedRepos.has(repoId)) {
            this.selectedRepos.delete(repoId);
        } else {
            this.selectedRepos.add(repoId);
        }
        this.updateExportConfirmButton();
        this.updateSelectAllButton();
    }

    /**
     * 全选/取消全选
     */
    toggleSelectAll() {
        const visibleRepos = this.getFilteredRepositories();
        const allSelected = visibleRepos.every(repo => this.selectedRepos.has(repo.id));
        
        if (allSelected) {
            // 取消全选
            visibleRepos.forEach(repo => this.selectedRepos.delete(repo.id));
        } else {
            // 全选
            visibleRepos.forEach(repo => this.selectedRepos.add(repo.id));
        }
        
        this.updateExportConfirmButton();
        this.updateSelectAllButton();
        this.requestRepositoriesRender();
    }

    /**
     * 更新全选按钮状态
     */
    updateSelectAllButton() {
        const toolbar = this.containerEl.querySelector('.github-stars-toolbar');
        if (!toolbar) return;

        const selectAllButton = toolbar.querySelector('.github-stars-select-all-button') as HTMLButtonElement;
        if (selectAllButton) {
            const filteredRepos = this.getFilteredRepositories();
            const allSelected = filteredRepos.length > 0 && filteredRepos.every(repo => this.selectedRepos.has(repo.id));
            
            if (allSelected) {
                selectAllButton.textContent = '取消全选';
                setIcon(selectAllButton, 'square');
            } else {
                selectAllButton.textContent = '全选';
                setIcon(selectAllButton, 'check-square');
            }
        }
    }

    /**
     * 获取过滤后的仓库列表
     */
    getFilteredRepositories() {
        return this.filterRepositories(this.buildCombinedRepositories());
    }

    /**
     * 清除不可见仓库的选择状态
     */
    clearInvisibleSelections() {
        const visibleRepoIdSet = new Set(this.getFilteredRepositories().map(repo => repo.id));
        const invisibleSelections = Array.from(this.selectedRepos).filter(repoId => !visibleRepoIdSet.has(repoId));

        // 移除不可见仓库的选择状态
        invisibleSelections.forEach(repoId => {
            this.selectedRepos.delete(repoId);
        });

        // 更新按钮状态
        if (invisibleSelections.length > 0) {
            this.updateExportConfirmButton();
            this.updateSelectAllButton();
        }
    }

    /**
     * 获取当前可见的仓库数量（考虑过滤）
     */
    getVisibleRepoCount(): number {
        return this.getFilteredRepositories().length;
    }

    /**
     * 更新star总数显示
     */
    updateTotalStarsCount(visibleRepoCount?: number) {
        if (this.totalStarsNumberEl) {
            const count = typeof visibleRepoCount === 'number' ? visibleRepoCount : this.getVisibleRepoCount();
            this.totalStarsNumberEl.textContent = `${count}`;
        }
    }

    onClose(): Promise<void> {
        this.repoRenderVersion += 1;
        this.hideRepoRenderStatus();
        if (this.repoContainer) {
            this.repoContainer.removeEventListener('scroll', this.handleRepoContainerScroll);
        }
        if (this.repoRenderFrameId !== null) {
            window.cancelAnimationFrame(this.repoRenderFrameId);
            this.repoRenderFrameId = null;
        }
        if (this.tagsFilterFrameId !== null) {
            window.cancelAnimationFrame(this.tagsFilterFrameId);
            this.tagsFilterFrameId = null;
        }
        this.disableRepoVirtualization();
        this.closeTagEditPopover();
        return Promise.resolve();
    }
} // End of GithubStarsView class
