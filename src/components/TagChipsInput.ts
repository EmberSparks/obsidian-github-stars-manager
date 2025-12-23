/**
 * TagChipsInput - 标签芯片输入组件
 * 提供标签芯片显示、自动完成和键盘导航功能
 */
export class TagChipsInput {
    private container: HTMLElement;
    private tags: string[] = [];
    private allTags: string[] = [];
    private inputEl: HTMLInputElement;
    private chipsContainer: HTMLElement;
    private suggestionsEl: HTMLElement | null = null;
    private selectedSuggestionIndex: number = -1;
    private availableTagsContainer: HTMLElement | null = null;
    private onChange: (tags: string[]) => void;

    constructor(
        container: HTMLElement,
        initialTags: string[],
        allTags: string[],
        onChange: (tags: string[]) => void
    ) {
        this.container = container;
        this.tags = [...initialTags];
        this.allTags = allTags;
        this.onChange = onChange;
        this.render();
    }

    /**
     * 渲染组件
     */
    render(): void {
        this.container.empty();

        // 创建标签芯片容器
        this.chipsContainer = this.container.createDiv('tag-chips-container');

        // 渲染已有标签
        this.renderTags();

        // 创建输入框
        this.inputEl = this.chipsContainer.createEl('input', {
            cls: 'tag-input',
            attr: {
                type: 'text',
                placeholder: 'Add tag...'
            }
        });

        // 绑定事件
        this.bindEvents();

        // 渲染可用标签选择器
        this.renderAvailableTags();
    }

    /**
     * 渲染标签芯片
     */
    private renderTags(): void {
        // 清除现有标签芯片（保留输入框）
        const chips = this.chipsContainer.querySelectorAll('.tag-chip');
        chips.forEach(chip => chip.remove());

        // 渲染每个标签
        this.tags.forEach(tag => {
            const chipEl = this.chipsContainer.createDiv('tag-chip');

            chipEl.createSpan({ text: tag });

            const removeBtn = chipEl.createSpan({
                cls: 'tag-chip-remove',
                text: '×'
            });

            removeBtn.addEventListener('click', () => {
                this.removeTag(tag);
            });

            // 将芯片插入到输入框之前
            if (this.inputEl) {
                this.chipsContainer.insertBefore(chipEl, this.inputEl);
            }
        });
    }

    /**
     * 绑定事件处理
     */
    private bindEvents(): void {
        // 输入事件 - 显示自动完成
        this.inputEl.addEventListener('input', () => {
            const query = this.inputEl.value.trim();
            if (query.length > 0) {
                this.showSuggestions(query);
            } else {
                this.hideSuggestions();
            }
        });

        // 键盘事件
        this.inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (this.selectedSuggestionIndex >= 0 && this.suggestionsEl) {
                    // 选择建议的标签
                    const items = this.suggestionsEl.querySelectorAll('.tag-suggestion-item');
                    const selectedItem = items[this.selectedSuggestionIndex] as HTMLElement;
                    if (selectedItem) {
                        this.addTag(selectedItem.textContent || '');
                    }
                } else {
                    // 添加输入的标签
                    const tag = this.inputEl.value.trim();
                    if (tag) {
                        this.addTag(tag);
                    }
                }
            } else if (e.key === ',' || e.key === 'Tab') {
                e.preventDefault();
                const tag = this.inputEl.value.trim();
                if (tag) {
                    this.addTag(tag);
                }
            } else if (e.key === 'Backspace' && this.inputEl.value === '') {
                // 删除最后一个标签
                if (this.tags.length > 0) {
                    this.removeTag(this.tags[this.tags.length - 1]);
                }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.navigateSuggestions(1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.navigateSuggestions(-1);
            } else if (e.key === 'Escape') {
                this.hideSuggestions();
            }
        });

        // 失去焦点时隐藏建议
        this.inputEl.addEventListener('blur', () => {
            // 延迟隐藏，以便点击建议项时能触发
            setTimeout(() => this.hideSuggestions(), 200);
        });
    }

    /**
     * 添加标签
     */
    addTag(tag: string): void {
        const trimmedTag = tag.trim();
        if (!trimmedTag) return;

        // 检查是否已存在（不区分大小写）
        const exists = this.tags.some(t => t.toLowerCase() === trimmedTag.toLowerCase());
        if (exists) {
            this.inputEl.value = '';
            this.hideSuggestions();
            return;
        }

        // 添加标签
        this.tags.push(trimmedTag);
        this.inputEl.value = '';
        this.hideSuggestions();
        this.renderTags();
        this.onChange(this.tags);

        // 重新聚焦输入框
        this.inputEl.focus();

        // 更新可用标签按钮状态
        this.updateAvailableTagsState();
    }

    /**
     * 删除标签
     */
    removeTag(tag: string): void {
        const index = this.tags.indexOf(tag);
        if (index > -1) {
            this.tags.splice(index, 1);
            this.renderTags();
            this.onChange(this.tags);

            // 更新可用标签按钮状态
            this.updateAvailableTagsState();
        }
    }

    /**
     * 显示自动完成建议
     */
    showSuggestions(query: string): void {
        const lowerQuery = query.toLowerCase();

        // 过滤匹配的标签（排除已添加的）
        const suggestions = this.allTags.filter(tag => {
            const isMatch = tag.toLowerCase().includes(lowerQuery);
            const isNotAdded = !this.tags.some(t => t.toLowerCase() === tag.toLowerCase());
            return isMatch && isNotAdded;
        });

        if (suggestions.length === 0) {
            this.hideSuggestions();
            return;
        }

        // 创建或更新建议列表
        if (!this.suggestionsEl) {
            this.suggestionsEl = this.container.createDiv('tag-suggestions');

            // 定位建议列表
            const rect = this.chipsContainer.getBoundingClientRect();
            this.suggestionsEl.style.top = `${rect.bottom}px`;
            this.suggestionsEl.style.left = `${rect.left}px`;
            this.suggestionsEl.style.width = `${rect.width}px`;
        }

        // 清空并重新填充
        this.suggestionsEl.empty();
        this.selectedSuggestionIndex = -1;

        suggestions.forEach((tag, index) => {
            const item = this.suggestionsEl!.createDiv('tag-suggestion-item');
            item.textContent = tag;

            item.addEventListener('click', () => {
                this.addTag(tag);
            });

            item.addEventListener('mouseenter', () => {
                this.selectedSuggestionIndex = index;
                this.updateSuggestionSelection();
            });
        });
    }

    /**
     * 隐藏自动完成建议
     */
    hideSuggestions(): void {
        if (this.suggestionsEl) {
            this.suggestionsEl.remove();
            this.suggestionsEl = null;
        }
        this.selectedSuggestionIndex = -1;
    }

    /**
     * 导航建议列表
     */
    private navigateSuggestions(direction: number): void {
        if (!this.suggestionsEl) return;

        const items = this.suggestionsEl.querySelectorAll('.tag-suggestion-item');
        if (items.length === 0) return;

        this.selectedSuggestionIndex += direction;

        // 循环导航
        if (this.selectedSuggestionIndex < 0) {
            this.selectedSuggestionIndex = items.length - 1;
        } else if (this.selectedSuggestionIndex >= items.length) {
            this.selectedSuggestionIndex = 0;
        }

        this.updateSuggestionSelection();
    }

    /**
     * 更新建议项的选中状态
     */
    private updateSuggestionSelection(): void {
        if (!this.suggestionsEl) return;

        const items = this.suggestionsEl.querySelectorAll('.tag-suggestion-item');
        items.forEach((item, index) => {
            if (index === this.selectedSuggestionIndex) {
                item.addClass('selected');
            } else {
                item.removeClass('selected');
            }
        });
    }

    /**
     * 获取当前标签列表
     */
    getTags(): string[] {
        return [...this.tags];
    }

    /**
     * 渲染可用标签选择器
     */
    private renderAvailableTags(): void {
        if (this.allTags.length === 0) return;

        // 创建容器（如果不存在）
        if (!this.availableTagsContainer) {
            this.availableTagsContainer = this.container.createDiv('available-tags-container');
            this.availableTagsContainer.createSpan({
                text: 'Available tags:',
                cls: 'available-tags-label'
            });
        }

        // 清空现有按钮
        const buttons = this.availableTagsContainer.querySelectorAll('.available-tag-button');
        buttons.forEach(btn => btn.remove());

        // 渲染每个可用标签
        this.allTags.forEach(tag => {
            const button = this.availableTagsContainer!.createEl('button', {
                text: tag,
                cls: 'available-tag-button'
            });
            button.type = 'button';

            // 检查是否已添加
            const isAdded = this.tags.some(t => t.toLowerCase() === tag.toLowerCase());
            if (isAdded) {
                button.addClass('active');
            }

            // 点击切换添加/删除
            button.addEventListener('click', () => {
                const currentlyAdded = this.tags.some(t => t.toLowerCase() === tag.toLowerCase());
                if (currentlyAdded) {
                    this.removeTag(tag);
                } else {
                    this.addTag(tag);
                }
            });
        });
    }

    /**
     * 更新可用标签按钮状态
     */
    private updateAvailableTagsState(): void {
        if (!this.availableTagsContainer) return;

        const buttons = this.availableTagsContainer.querySelectorAll('.available-tag-button');
        buttons.forEach((button) => {
            const buttonEl = button as HTMLElement;
            const tagName = buttonEl.textContent || '';
            const isAdded = this.tags.some(t => t.toLowerCase() === tagName.toLowerCase());

            if (isAdded) {
                buttonEl.addClass('active');
            } else {
                buttonEl.removeClass('active');
            }
        });
    }

    /**
     * 销毁组件
     */
    destroy(): void {
        this.hideSuggestions();
        this.container.empty();
    }
}
