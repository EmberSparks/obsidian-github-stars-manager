import { ItemView, WorkspaceLeaf, setIcon, Notice } from 'obsidian';
import GithubStarsPlugin from './main';
import { GithubRepository, UserRepoEnhancements, GithubAccount } from './types';
import { EditRepoModal } from './modal';
import { EmojiUtils } from './emojiUtils';
import { t } from './i18n';

export const VIEW_TYPE_STARS = 'github-stars-view';

export class GithubStarsView extends ItemView {
    plugin: GithubStarsPlugin;
    githubRepositories: GithubRepository[] = []; // Renamed and typed
    userEnhancements: { [repoId: number]: UserRepoEnhancements } = {}; // Added
    allTags: string[] = []; // Added
    searchInput: HTMLInputElement;
    repoContainer: HTMLElement;
    filterByTags: Map<string, boolean> = new Map();
    tagsContainer: HTMLElement;
    currentFilter: string = '';
    sortBy: 'starred_at' | 'stars' | 'forks' | 'updated' = 'starred_at';
    sortOrder: 'asc' | 'desc' = 'desc'; // 新增排序方向状态
    showAllTags: boolean = false; // Add state for showing all tags
    selectedRepos: Set<number> = new Set(); // 选中的仓库ID集合
    isExportMode: boolean = false; // 是否处于导出模式
    totalStarsNumberEl: HTMLElement | null = null; // star总数显示元素

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
        // Initial population of tags filter
        this.updateTagsFilter(this.tagsContainer);

        // Repositories Container
        this.repoContainer = container.createDiv('github-stars-repos');

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
        return Math.abs(hash) % 12 + 1; // 返回1-12的索引
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
     * 更新标签筛选区域 (Uses this.allTags)
     */
    updateTagsFilter(container: HTMLElement) {
        container.empty();

        const currentTags = this.allTags || [];
        if (currentTags.length === 0) {
            container.createSpan({ text: t('view.noTags') });
            return;
        }

        // 1. 计算每个标签的数量
        const tagCounts = new Map<string, number>();
        Object.values(this.userEnhancements).forEach(enhancement => {
            if (enhancement.tags) {
                enhancement.tags.forEach(tag => {
                    tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
                });
            }
        });

        // 2. 决定显示多少标签
        const maxVisibleTags = 5;
        const tagsToShow = this.showAllTags ? currentTags : currentTags.slice(0, maxVisibleTags);
        
        // 3. 创建标签按钮
        tagsToShow.forEach(tag => {
            const count = tagCounts.get(tag) || 0;
            const isActive = this.filterByTags.get(tag) || false;
            const isHighlighted = this.currentFilter && tag.toLowerCase().includes(this.currentFilter);
            
            const tagEl = container.createEl('span', {
                cls: 'github-stars-tag' + 
                     (isActive ? ' active' : '') + 
                     (isHighlighted ? ' highlighted' : ''),
                text: `${tag} (${count})`
            });

            tagEl.addEventListener('click', () => {
                const currentState = this.filterByTags.get(tag) || false;
                this.filterByTags.set(tag, !currentState);
                tagEl.toggleClass('active', !currentState);
                
                // 清除不可见仓库的选择状态
                this.clearInvisibleSelections();
                
                // Add visual feedback
                tagEl.removeClass('transition-scale');
                tagEl.removeClass('transform-scale-down');
                tagEl.addClass('transition-scale');
                
                setTimeout(() => {
                    tagEl.addClass('transform-scale-down');
                    setTimeout(() => {
                        tagEl.removeClass('transform-scale-down');
                        this.renderRepositories();
                    }, 100);
                }, 10);
            });
        });

        // 4. 添加"更多"按钮
        if (currentTags.length > maxVisibleTags) {
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
                
                setTimeout(() => {
                    moreButton.addClass('transform-scale-down');
                    setTimeout(() => {
                        moreButton.removeClass('transform-scale-down');
                        this.updateTagsFilter(container);
                    }, 50);
                }, 10);
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
        this.repoContainer.empty();

        if (!this.githubRepositories || this.githubRepositories.length === 0) {
            this.repoContainer.createEl('div', { cls: 'github-stars-empty', text: t('view.noRepos') });
            return;
        }

        // 1. Combine GitHub data with User Enhancements for filtering/sorting
        const combinedRepos = this.githubRepositories.map(githubRepo => {
            const enhancement = this.userEnhancements[githubRepo.id] || { notes: '', tags: [], linked_note: undefined };
            return { ...githubRepo, ...enhancement }; // Combine data, enhancement properties overwrite if names clash (e.g., tags)
        });

        // 2. Filter combined data
        const filteredRepos = combinedRepos.filter(repo => {
            // Account filter - only show repos from enabled accounts
            const enabledAccounts = this.plugin.settings.accounts?.filter(account => account.enabled) || [];
            const enabledAccountIds = enabledAccounts.map(account => account.id);
            
            // If no accounts are enabled, show nothing
            if (enabledAccountIds.length === 0) {
                return false;
            }
            
            // If repo has account_id, check if it's from an enabled account
            if (repo.account_id && !enabledAccountIds.includes(repo.account_id)) {
                return false;
            }
            
            const name = repo.name || '';
            const description = repo.description || '';
            const ownerLogin = repo.owner?.login || '';
            const notes = repo.notes || ''; // From enhancement
            const tags = Array.isArray(repo.tags) ? repo.tags : []; // From enhancement
            const language = repo.language || ''; // Get language, default to empty string

            // Text filter (checks GitHub, user data, and language)
            const matchesText = this.currentFilter === '' ||
                name.toLowerCase().includes(this.currentFilter) ||
                description.toLowerCase().includes(this.currentFilter) ||
                ownerLogin.toLowerCase().includes(this.currentFilter) ||
                notes.toLowerCase().includes(this.currentFilter) ||
                language.toLowerCase().includes(this.currentFilter); // Add language check

            if (!matchesText) return false;

            // Tag filter (checks user data)
            const activeTags = Array.from(this.filterByTags.entries())
                .filter(([_, active]) => active)
                .map(([tag, _]) => tag);

            if (activeTags.length === 0) return true; // No active tag filter means pass

            return activeTags.some(tag => tags.includes(tag)); // Check if repo has any active tag
        });

        // 3. Sort filtered data
        const sortedRepos = [...filteredRepos]; // Mutable copy
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

        // 4. Render the sorted and filtered repositories
        if (sortedRepos.length === 0) {
            this.repoContainer.createEl('div', { cls: 'github-stars-empty', text: t('view.noMatchingRepos') });
            return;
        }

        sortedRepos.forEach((repo) => { // repo here is the combined object
            const repoEl = this.repoContainer.createEl('div', { cls: 'github-stars-repo' });

            // --- Render using combined repo data ---

            // Header with avatar and title info
            const headerEl = repoEl.createEl('div', { cls: 'github-stars-repo-header' });
            
            // 添加复选框（仅在导出模式下显示）
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
            
            // Add owner avatar/logo (larger size like in the image)
            if (repo.owner && repo.owner.avatar_url) {
                const avatarImg = headerEl.createEl('img', {
                    cls: 'github-stars-repo-avatar',
                    attr: { 
                        src: repo.owner.avatar_url,
                        alt: `${repo.owner.login} avatar`,
                        loading: 'lazy'
                    }
                });
                
                // Add error handling for broken images
                avatarImg.addEventListener('error', () => {
                    avatarImg.addClass('display-none');
                });
            }
            
            // Title and meta info
            const titleGroupEl = headerEl.createEl('div', { cls: 'github-stars-repo-title-group' });
            
            const titleEl = titleGroupEl.createEl('div', { cls: 'github-stars-repo-title' });

            // 创建可点击的项目名称链接
            const linkEl = titleEl.createEl('div', {
                cls: 'github-stars-repo-link'
            });
            linkEl.textContent = repo.full_name || repo.name || 'Unnamed repo';

            // 添加点击事件处理，打开外部链接
            linkEl.onclick = () => {
                if (repo.html_url) {
                    // 使用 window.open 打开外部链接（桌面版和移动版都支持）
                    window.open(repo.html_url, '_blank');
                }
                return false;
            };

            // Tags in title group (moved from below description)
            if (Array.isArray(repo.tags) && repo.tags.length > 0) {
                const titleTagsEl = titleGroupEl.createEl('div', { cls: 'github-stars-repo-title-tags' });
                repo.tags.forEach(tag => {
                    const colorIndex = this.getTagColorIndex(tag);
                    const tagEl = titleTagsEl.createEl('span', {
                        cls: 'github-stars-repo-tag',
                        text: tag,
                        attr: { 'data-tag-color': String(colorIndex) }
                    });
                    
                    // Add click functionality to repo tags
                    tagEl.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const currentState = this.filterByTags.get(tag) || false;
                        this.filterByTags.set(tag, !currentState);
                        
                        // Update all tag filter buttons
                        this.updateTagsFilter(this.tagsContainer);
                        
                        // 清除不可见仓库的选择状态
                        this.clearInvisibleSelections();
                        
                        // Add visual feedback
                        tagEl.removeClass('transition-scale');
                        tagEl.removeClass('transform-scale-down');
                        tagEl.addClass('transition-scale');
                        
                        setTimeout(() => {
                            tagEl.addClass('transform-scale-down');
                            setTimeout(() => {
                                tagEl.removeClass('transform-scale-down');
                                this.renderRepositories();
                            }, 100);
                        }, 10);
                    });
                });
            }

            // Description (from githubRepo)
            if (repo.description) {
                const descEl = repoEl.createEl('div', { cls: 'github-stars-repo-desc' });
                EmojiUtils.setEmojiText(descEl, repo.description); // 使用 EmojiUtils 渲染 emoji
                
                // Create tooltip for long descriptions
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

            // Footer with info and edit button
            const footerEl = repoEl.createEl('div', { cls: 'github-stars-repo-footer' });
            
            // Info Row (language, stars, forks, updated time from githubRepo)
            const infoRow = footerEl.createEl('div', { cls: 'github-stars-repo-info' });
            if (repo.language) {
                infoRow.createEl('span', { cls: 'github-stars-repo-language', text: repo.language });
            }
            
            // Stars with icon
            const starsSpan = infoRow.createEl('span', { cls: 'github-stars-repo-stars' });
            const starIcon = starsSpan.createEl('span', { cls: 'github-stars-icon star-icon' });
            setIcon(starIcon, 'star');
            starsSpan.createEl('span', { text: ` ${this.formatNumber(repo.stargazers_count ?? 0)}` });
            
            // Forks with icon
            const forksSpan = infoRow.createEl('span', { cls: 'github-stars-repo-forks' });
            const forkIcon = forksSpan.createEl('span', { cls: 'github-stars-icon fork-icon' });
            setIcon(forkIcon, 'git-fork');
            forksSpan.createEl('span', { text: ` ${this.formatNumber(repo.forks_count ?? 0)}` });
            
            // Updated time with icon
            const updatedSpan = infoRow.createEl('span', { cls: 'github-stars-repo-updated' });
            const calendarIcon = updatedSpan.createEl('span', { cls: 'github-stars-icon calendar-icon' });
            setIcon(calendarIcon, 'calendar');
            updatedSpan.createEl('span', { text: ` ${this.formatRelativeTime(repo.updated_at)}` });

            // Edit Button (like "安装" button in the image)
            const editButton = footerEl.createEl('button', {
                cls: 'github-stars-repo-edit',
                text: t('view.editRepo')
            });
            editButton.addEventListener('click', () => {
                const originalGithubRepo = this.githubRepositories.find(r => r.id === repo.id);
                if (originalGithubRepo) {
                    this.openEditModal(originalGithubRepo);
                } else {
                    console.error("Could not find original GitHub repo data for ID:", repo.id);
                    new Notice(t('view.cannotEditRepo'));
                }
            });

            // Notes (from enhancement) - show below footer if exists
            if (repo.notes) {
                const notesContainer = repoEl.createEl('div', { cls: 'github-stars-repo-notes' });

                // 添加笔记图标
                notesContainer.createEl('span', {
                    cls: 'github-stars-repo-notes-icon',
                    text: '📝'
                });

                // 添加笔记内容
                const contentEl = notesContainer.createEl('div', { cls: 'github-stars-repo-notes-content' });
                EmojiUtils.setEmojiText(contentEl, repo.notes); // 使用 EmojiUtils 渲染用户笔记中的 emoji
            }

            // Linked Note (from enhancement)
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
                    this.app.workspace.openLinkText(repo.linked_note!, '', false).catch(err =>
                        console.error('Failed to open linked note:', err)
                    );
                });
            }
        });

        // 更新star总数显示
        this.updateTotalStarsCount();
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
            this.updateTagsFilter(this.tagsContainer);
            
            // 如果处于导出模式，清除不可见仓库的选择状态
            if (this.isExportMode) {
                this.clearInvisibleSelections();
            }
            
            this.renderRepositories();
        });
        
        // 清除按钮功能
        clearButton.addEventListener('click', () => {
            this.searchInput.value = '';
            this.currentFilter = '';
            clearButton.addClass('hidden');
            
            // 更新显示
            this.updateTagsFilter(this.tagsContainer);
            if (this.isExportMode) {
                this.clearInvisibleSelections();
            }
            this.renderRepositories();
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
                
                const orderText = this.sortOrder === 'desc' ? t('view.sortBy.desc') : t('view.sortBy.asc');
                new Notice(t('notices.sortByNotice', { sortBy: option.title, order: orderText }));
                this.renderRepositories();
            });
        });

        // Theme Toggle Button
        const themeButton = toolbarDiv.createEl('button', { cls: 'github-stars-theme-button' });
        this.updateThemeButton(themeButton);
        themeButton.setAttribute('aria-label', t('view.theme.toggle'));
        themeButton.addEventListener('click', () => {
            const currentTheme = this.plugin.settings.theme;
            const newTheme = currentTheme === 'default' ? 'ios-glass' : 'default';
            this.plugin.settings.theme = newTheme;
            this.plugin.saveSettings().catch(err => console.error('Failed to save theme settings:', err));
            this.plugin.applyTheme(newTheme);
            this.updateThemeButton(themeButton);
            const themeName = newTheme === 'ios-glass' ? t('view.theme.iosGlass') : t('view.theme.default');
            new Notice(t('notices.themeSwitch', { theme: themeName }));
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
     * 更新视图数据并重新渲染 (Updated Signature)
     * @param githubRepositories 最新的 GitHub 仓库列表
     * @param userEnhancements 最新的用户增强数据
     * @param allTags 最新的全局标签列表
     */
    updateData(githubRepositories: GithubRepository[], userEnhancements: { [repoId: number]: UserRepoEnhancements }, allTags: string[]) {
        this.githubRepositories = githubRepositories || [];
        this.userEnhancements = userEnhancements || {};
        this.allTags = allTags || [];

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
     * 更新主题按钮的图标和样式
     */
    updateThemeButton(button: HTMLElement) {
        const currentTheme = this.plugin.settings.theme;
        button.empty();

        if (currentTheme === 'ios-glass') {
            // iOS液态玻璃主题图标
            setIcon(button, 'sparkles');
            button.setAttribute('aria-label', t('view.theme.switchToDefault'));
            button.addClass('active');
        } else {
            // 默认主题图标
            setIcon(button, 'palette');
            button.setAttribute('aria-label', t('view.theme.switchToIosGlass'));
            button.removeClass('active');
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
                    await this.plugin.saveSettings();

                    // 更新视觉状态
                    accountEl.toggleClass('disabled', !account.enabled);

                    // 更新按钮文本
                    toggleBtn.textContent = `${t('view.accountsLabel')} (${accounts.filter((a: GithubAccount) => a.enabled).length})`;

                    // 显示通知
                    const noticeKey = account.enabled ? 'notices.accountEnabled' : 'notices.accountDisabled';
                    new Notice(t(noticeKey, { username: account.username }));

                    // 重新渲染仓库列表以应用账户过滤
                    this.renderRepositories();
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
        this.renderRepositories();
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
        // 复用现有的过滤逻辑
        const combinedRepos = this.githubRepositories.map(githubRepo => {
            const enhancement = this.userEnhancements[
githubRepo.id] || {};
            return {
                ...githubRepo,
                tags: enhancement.tags || [],
                notes: enhancement.notes || '',
                linked_note: enhancement.linked_note || ''
            };
        });

        return combinedRepos.filter(repo => {
            // 搜索过滤
            if (this.currentFilter) {
                const searchTerm = this.currentFilter.toLowerCase();
                const matchesSearch =
                    (repo.name && repo.name.toLowerCase().includes(searchTerm)) ||
                    (repo.full_name && repo.full_name.toLowerCase().includes(searchTerm)) ||
                    (repo.description && repo.description.toLowerCase().includes(searchTerm)) ||
                    (repo.language && repo.language.toLowerCase().includes(searchTerm)) ||
                    (repo.owner?.login && repo.owner.login.toLowerCase().includes(searchTerm)) ||
                    (repo.tags && repo.tags.some(tag => tag.toLowerCase().includes(searchTerm))) ||
                    (repo.notes && repo.notes.toLowerCase().includes(searchTerm));
                
                if (!matchesSearch) return false;
            }

            // 标签过滤
            const activeTagFilters = Array.from(this.filterByTags.entries())
                .filter(([_, isActive]) => isActive)
                .map(([tag, _]) => tag);

            if (activeTagFilters.length > 0) {
                const hasMatchingTag = activeTagFilters.some(filterTag =>
                    repo.tags.includes(filterTag)
                );
                if (!hasMatchingTag) return false;
            }

            return true;
        });
    }

    /**
     * 清除不可见仓库的选择状态
     */
    clearInvisibleSelections() {
        const visibleRepoIds = this.getFilteredRepositories().map(repo => repo.id);
        const invisibleSelections = Array.from(this.selectedRepos).filter(repoId => !visibleRepoIds.includes(repoId));

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
    updateTotalStarsCount() {
        if (this.totalStarsNumberEl) {
            this.totalStarsNumberEl.textContent = `${this.getVisibleRepoCount()}`;
        }
    }
} // End of GithubStarsView class