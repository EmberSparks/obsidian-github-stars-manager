import { ItemView, WorkspaceLeaf, setIcon, Notice } from 'obsidian';
import GithubStarsPlugin from './main';
import { GithubRepository, UserRepoEnhancements } from './types'; // Updated imports
import { EditRepoModal } from './modal';

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
    sortBy: 'default' | 'starred_at_desc' = 'default';
    showAllTags: boolean = false; // Add state for showing all tags

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
        return 'GitHub Stars';
    }

    getIcon(): string {
        return 'star';
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1];
        container.empty();
        container.classList.add('github-stars-container');

        // Header (unchanged)
        const headerDiv = container.createDiv('github-stars-header');
        headerDiv.createEl('h2', { text: 'GitHub 星标仓库' });

        // Toolbar (unchanged structure, button logic remains)
        const toolbarDiv = container.createDiv('github-stars-toolbar');

        // Sync Button (logic unchanged)
        const syncButton = toolbarDiv.createEl('button', { cls: 'github-stars-sync-button' });
        setIcon(syncButton, 'refresh-cw');
        syncButton.setAttribute('aria-label', '同步仓库');
        syncButton.addEventListener('click', async () => {
            syncButton.setAttribute('disabled', 'true');
            setIcon(syncButton, 'loader');
            try {
                await this.plugin.syncStars(); // Sync logic is now in main.ts
                new Notice('GitHub 星标同步成功');
            } catch (error) {
                new Notice('同步失败，请检查设置和网络连接');
                console.error('同步失败:', error);
            } finally {
                syncButton.removeAttribute('disabled');
                setIcon(syncButton, 'refresh-cw');
            }
        });

        // Search Input (logic unchanged)
        this.searchInput = toolbarDiv.createEl('input', {
            cls: 'github-stars-search',
            attr: { type: 'text', placeholder: '搜索仓库...' }
        });
        this.searchInput.addEventListener('input', () => {
            this.currentFilter = this.searchInput.value.toLowerCase();
            this.renderRepositories();
        });

        // Sort Button (logic unchanged)
        const sortButton = toolbarDiv.createEl('button', { cls: 'github-stars-sort-button' });
        setIcon(sortButton, 'arrow-down-up');
        sortButton.setAttribute('aria-label', '按 Star 时间排序');
        sortButton.addEventListener('click', () => {
            this.sortBy = this.sortBy === 'starred_at_desc' ? 'default' : 'starred_at_desc';
            setIcon(sortButton, this.sortBy === 'starred_at_desc' ? 'calendar-clock' : 'arrow-down-up');
            sortButton.toggleClass('active', this.sortBy === 'starred_at_desc');
            new Notice(this.sortBy === 'starred_at_desc' ? '按最近 Star 时间排序' : '按默认顺序排序');
            this.renderRepositories();
        });

        // Tags Filter Area
        const tagsDiv = container.createDiv('github-stars-tags');
        this.tagsContainer = tagsDiv.createDiv('github-stars-tags-container');
        // Initial population of tags filter
        this.updateTagsFilter(this.tagsContainer);

        // Repositories Container
        this.repoContainer = container.createDiv('github-stars-repos');

        // Initial rendering of repositories
        this.renderRepositories();
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
     * 更新标签筛选区域 (Uses this.allTags)
     */
    updateTagsFilter(container: HTMLElement) {
        container.empty();

        const currentTags = this.allTags || [];
        if (currentTags.length === 0) {
            container.createSpan({ text: '无标签' });
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
            
            const tagEl = container.createEl('span', {
                cls: 'github-stars-tag' + (this.filterByTags.get(tag) ? ' active' : ''),
                text: `${tag} (${count})`
            });

            tagEl.addEventListener('click', () => {
                const currentState = this.filterByTags.get(tag) || false;
                this.filterByTags.set(tag, !currentState);
                tagEl.toggleClass('active', !currentState);
                
                // Add visual feedback
                tagEl.style.transition = 'all 0.15s ease-out';
                tagEl.style.transform = 'scale(0.95)';
                
                setTimeout(() => {
                    tagEl.style.transform = '';
                    this.renderRepositories();
                }, 150);
            });
        });

        // 4. 添加"更多"按钮
        if (currentTags.length > maxVisibleTags) {
            const moreButton = container.createEl('span', {
                cls: 'github-stars-tag-more',
                text: this.showAllTags ? '收起' : `更多 (+${currentTags.length - maxVisibleTags})`
            });

            moreButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showAllTags = !this.showAllTags;
                
                // Add smooth transition effect
                moreButton.style.transition = 'all 0.2s ease';
                moreButton.style.transform = 'scale(0.95)';
                
                setTimeout(() => {
                    moreButton.style.transform = '';
                    this.updateTagsFilter(container);
                }, 100);
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
            this.repoContainer.createEl('div', { cls: 'github-stars-empty', text: '没有星标仓库。点击同步按钮从GitHub获取。' });
            return;
        }

        // 1. Combine GitHub data with User Enhancements for filtering/sorting
        const combinedRepos = this.githubRepositories.map(githubRepo => {
            const enhancement = this.userEnhancements[githubRepo.id] || { notes: '', tags: [], linked_note: undefined };
            return { ...githubRepo, ...enhancement }; // Combine data, enhancement properties overwrite if names clash (e.g., tags)
        });

        // 2. Filter combined data
        const filteredRepos = combinedRepos.filter(repo => {
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
        let sortedRepos = [...filteredRepos]; // Mutable copy
        if (this.sortBy === 'starred_at_desc') {
            sortedRepos.sort((a, b) => {
                const dateA = a.starred_at ? Date.parse(a.starred_at) : 0;
                const dateB = b.starred_at ? Date.parse(b.starred_at) : 0;
                return dateB - dateA; // Descending
            });
        }
        // Add other sort criteria if needed

        // 4. Render the sorted and filtered repositories
        if (sortedRepos.length === 0) {
            this.repoContainer.createEl('div', { cls: 'github-stars-empty', text: '没有匹配的仓库。' });
            return;
        }

        sortedRepos.forEach((repo) => { // repo here is the combined object
            const repoEl = this.repoContainer.createEl('div', { cls: 'github-stars-repo' });

            // --- Render using combined repo data ---

            // Header with avatar and title info
            const headerEl = repoEl.createEl('div', { cls: 'github-stars-repo-header' });
            
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
                    avatarImg.style.display = 'none';
                });
            }
            
            // Title and meta info
            const titleGroupEl = headerEl.createEl('div', { cls: 'github-stars-repo-title-group' });
            
            const titleEl = titleGroupEl.createEl('div', { cls: 'github-stars-repo-title' });
            titleEl.createEl('a', {
                cls: 'github-stars-repo-link',
                text: repo.full_name || repo.name || 'Unnamed Repo',
                attr: { href: repo.html_url || '#', target: '_blank' }
            });

            // Description (from githubRepo)
            if (repo.description) {
                const descEl = repoEl.createEl('div', { cls: 'github-stars-repo-desc', text: repo.description });
                
                // Create tooltip for long descriptions
                if (repo.description.length > 100) {
                    const tooltip = repoEl.createEl('div', { 
                        cls: 'github-stars-repo-desc-tooltip',
                        text: repo.description
                    });
                    
                    descEl.addEventListener('mouseenter', () => {
                        tooltip.style.display = 'block';
                    });
                    
                    descEl.addEventListener('mouseleave', () => {
                        tooltip.style.display = 'none';
                    });
                }
            }

            // Tags (from enhancement)
            if (Array.isArray(repo.tags) && repo.tags.length > 0) {
                const tagsEl = repoEl.createEl('div', { cls: 'github-stars-repo-tags' });
                repo.tags.forEach(tag => {
                    const colorIndex = this.getTagColorIndex(tag);
                    const tagEl = tagsEl.createEl('span', { 
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
                        
                        // Add visual feedback
                        tagEl.style.transition = 'all 0.15s ease-out';
                        tagEl.style.transform = 'scale(0.95)';
                        
                        setTimeout(() => {
                            tagEl.style.transform = '';
                            this.renderRepositories();
                        }, 150);
                    });
                });
            }

            // Footer with info and edit button
            const footerEl = repoEl.createEl('div', { cls: 'github-stars-repo-footer' });
            
            // Info Row (language, stars from githubRepo)
            const infoRow = footerEl.createEl('div', { cls: 'github-stars-repo-info' });
            if (repo.language) {
                infoRow.createEl('span', { cls: 'github-stars-repo-language', text: repo.language });
            }
            infoRow.createEl('span', { cls: 'github-stars-repo-stars', text: `★ ${repo.stargazers_count ?? 0}` });

            // Edit Button (like "安装" button in the image)
            const editButton = footerEl.createEl('button', {
                cls: 'github-stars-repo-edit',
                text: '编辑'
            });
            editButton.addEventListener('click', () => {
                const originalGithubRepo = this.githubRepositories.find(r => r.id === repo.id);
                if (originalGithubRepo) {
                    this.openEditModal(originalGithubRepo);
                } else {
                    console.error("Could not find original GitHub repo data for ID:", repo.id);
                    new Notice("无法编辑此仓库信息");
                }
            });

            // Notes (from enhancement) - show below footer if exists
            if (repo.notes) {
                repoEl.createEl('div', { cls: 'github-stars-repo-notes', text: repo.notes });
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
                    this.app.workspace.openLinkText(repo.linked_note!, '', false);
                });
            }
        });
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
        console.log('GithubStarsView: Updating data...', { githubRepositories, userEnhancements, allTags });
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
        console.log('GithubStarsView: Data updated and view re-rendered.');
    }
} // End of GithubStarsView class