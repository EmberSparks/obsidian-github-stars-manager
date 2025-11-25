import { App, Modal, Setting, Notice, TFile } from 'obsidian';
import { GithubRepository, UserRepoEnhancements } from './types'; // Updated imports
import GithubStarsPlugin from './main';
import { EmojiUtils } from './emojiUtils';

/**
 * 编辑仓库信息的模态框
 */
export class EditRepoModal extends Modal {
    plugin: GithubStarsPlugin;
    githubRepo: GithubRepository; // Store the base GitHub data
    // User editable fields
    tags: string;
    notes: string;
    linkedNote: string;

    constructor(app: App, plugin: GithubStarsPlugin, githubRepo: GithubRepository) {
        super(app);
        this.plugin = plugin;
        this.githubRepo = githubRepo; // Store the passed GitHub repo data

        // Load existing user enhancements or defaults
        const existingEnhancement = plugin.data.userEnhancements[githubRepo.id];
        this.tags = existingEnhancement?.tags?.join(', ') || '';
        this.notes = existingEnhancement?.notes || '';
        this.linkedNote = existingEnhancement?.linked_note || '';
    }

    onOpen() {
        const { contentEl } = this;
this.modalEl.addClass('github-stars-edit-modal'); // Add specific class for styling

        // Title (using githubRepo)
        contentEl.createEl('h2', {
            text: `编辑仓库信息: ${this.githubRepo.name}`
        });

        // Basic Repo Info (from githubRepo)
        const infoDiv = contentEl.createDiv('edit-repo-info');
        infoDiv.createEl('p', {
            text: `${this.githubRepo.full_name}`,
            cls: 'edit-repo-fullname'
        });
        if (this.githubRepo.description) {
            const descEl = infoDiv.createEl('p', { cls: 'edit-repo-description' });
            EmojiUtils.setEmojiText(descEl, this.githubRepo.description);
        }

        // --- User Editable Fields ---

        // Tags Setting
        const tagSetting = new Setting(contentEl)
            .setName('标签')
            .setDesc('用逗号分隔多个标签');

        let tagInputEl: HTMLInputElement;
        const tagButtons = new Map<string, HTMLButtonElement>(); // Map to store tag buttons

        // Function to update button states based on input value
        const updateTagButtonsState = () => {
            const currentTags = (tagInputEl?.value || '')
                .split(',')
                .map(t => t.trim().toLowerCase())
                .filter(t => t.length > 0);
            tagButtons.forEach((button, tagName) => {
                button.toggleClass('active', currentTags.includes(tagName.toLowerCase()));
            });
        };

        tagSetting.addText(text => {
            tagInputEl = text.inputEl;
            text.setPlaceholder('For example: react, typescript, learning')
               .setValue(this.tags)
               .onChange(value => {
                   this.tags = value;
                   updateTagButtonsState(); // Update buttons when input changes
               });
        });

        // Add Existing Tags Selector
        const allTags = this.plugin.getAllTags();
        if (allTags.length > 0) {
            const existingTagsContainer = contentEl.createDiv('existing-tags-container');
            existingTagsContainer.createSpan({ text: 'Select existing tags: ', cls: 'existing-tags-label' });

            allTags.forEach(tag => {
                const tagButton = existingTagsContainer.createEl('button', {
                    text: tag,
                    cls: 'existing-tag-button'
                });
                tagButton.type = 'button';
                tagButtons.set(tag, tagButton); // Store button reference

                tagButton.addEventListener('click', () => {
                    const currentTagsArray = this.tags.split(',')
                                             .map(t => t.trim())
                                             .filter(t => t.length > 0);
                    const tagLower = tag.toLowerCase();
                    const index = currentTagsArray.findIndex(existingTag => existingTag.toLowerCase() === tagLower);

                    if (index > -1) {
                        // Tag exists, remove it
                        currentTagsArray.splice(index, 1);
                    } else {
                        // Tag doesn't exist, add it
                        currentTagsArray.push(tag);
                    }

                    // Update input and state
                    this.tags = currentTagsArray.join(', ');
                    tagInputEl.value = this.tags; // Update input visually
                    updateTagButtonsState(); // Update button states
                });
            });

            // Set initial button states after creating them
            updateTagButtonsState();
        }


        // Notes Setting
        new Setting(contentEl)
            .setName('笔记')
            // .setDesc('关于此仓库的个人笔记') // Removed description
            .addTextArea(text => {
                text.inputEl.addClass('edit-repo-notes-textarea'); // Add specific class
                text.setPlaceholder('在这里添加笔记...')
                   .setValue(this.notes) // Populated from constructor
                   .onChange(value => {
                       this.notes = value;
                   });
            });

        // Linked Note Setting
        new Setting(contentEl)
            .setName('链接到笔记')
            .setDesc('链接到Obsidian中的笔记')
            .addText(text => text
                .setPlaceholder('笔记路径')
                .setValue(this.linkedNote) // Populated from constructor
                .onChange(value => {
                    this.linkedNote = value;
                })
            )
            .addButton(button => button
                .setButtonText('浏览')
                .onClick(() => {
                    this.openNoteBrowser();
                })
            );

        // Buttons (unchanged structure)
        const buttonDiv = contentEl.createDiv('edit-repo-buttons');
        const cancelButton = buttonDiv.createEl('button', { text: '取消' });
        cancelButton.addEventListener('click', () => this.close());
        const saveButton = buttonDiv.createEl('button', { text: '保存', cls: 'mod-cta' });
        saveButton.addEventListener('click', () => void this.saveChanges());
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }

    /**
     * 打开笔记浏览器 (Unchanged)
     */
    openNoteBrowser() {
        const files = this.app.vault.getMarkdownFiles();
        const modal = new NoteSelectorModal(this.app, files, (file) => {
            this.linkedNote = file.path;
            // Update the input field directly
            const inputEl = this.contentEl.querySelector('.setting-item:nth-child(4) input') as HTMLInputElement; // Adjusted selector if needed
            if (inputEl) {
                inputEl.value = file.path;
            }
        });
        modal.open();
    }

    /**
     * 保存仓库信息变更 (Refactored)
     */
    async saveChanges() {
        const repoId = this.githubRepo.id;

        // Prepare the enhancement data from form inputs
        const updatedEnhancement: UserRepoEnhancements = {
            notes: this.notes.trim(),
            tags: this.tags
                .split(',')
                .map(tag => tag.trim())
                .filter(tag => tag.length > 0),
            linked_note: this.linkedNote.trim() || undefined // Store undefined if empty
        };

        // Update or create the enhancement entry in plugin data
        this.plugin.data.userEnhancements[repoId] = updatedEnhancement;

        // Save the entire plugin data (this will also update allTags)
        await this.plugin.savePluginData(); // savePluginData now calls updateViews internally

        new Notice('仓库信息已更新');
        this.close();
    }
}

/**
 * 笔记选择器模态框
 */
class NoteSelectorModal extends Modal {
    files: TFile[];
    onSelect: (file: TFile) => void;
    searchInput: HTMLInputElement;
    
    constructor(app: App, files: TFile[], onSelect: (file: TFile) => void) {
        super(app);
        this.files = files;
        this.onSelect = onSelect;
    }
    
    onOpen() {
        const { contentEl } = this;
        
        contentEl.createEl('h2', { text: '选择笔记' });
        
        // 搜索框
        const searchDiv = contentEl.createDiv('note-selector-search');
        this.searchInput = searchDiv.createEl('input', {
            type: 'text',
            placeholder: '搜索笔记...'
        });
        
        this.searchInput.addEventListener('input', () => {
            this.renderFiles();
        });
        
        // 文件列表容器
        const fileListDiv = contentEl.createDiv('note-selector-files');
        fileListDiv.addClass('note-selector-files');
        
        this.renderFiles();
    }
    
    /**
     * 渲染文件列表
     */
    renderFiles() {
        const fileListDiv = this.contentEl.querySelector('.note-selector-files');
        if (!fileListDiv) return;
        
        fileListDiv.empty();
        
        const searchTerm = this.searchInput.value.toLowerCase();
        
        const filteredFiles = this.files.filter(file => 
            file.path.toLowerCase().includes(searchTerm));
        
        if (filteredFiles.length === 0) {
            fileListDiv.createEl('div', {
                text: '没有匹配的笔记',
                cls: 'note-selector-empty'
            });
            return;
        }
        
        filteredFiles.forEach(file => {
            const fileDiv = fileListDiv.createEl('div', {
                cls: 'note-selector-file',
                text: file.path
            });
            
            fileDiv.addEventListener('click', () => {
                this.onSelect(file);
                this.close();
            });
        });
    }
    
    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}