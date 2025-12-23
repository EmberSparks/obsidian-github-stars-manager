import { App, Modal, Setting, Notice, TFile } from 'obsidian';
import { GithubRepository, UserRepoEnhancements } from './types'; // Updated imports
import GithubStarsPlugin from './main';
import { EmojiUtils } from './emojiUtils';
import { t } from './i18n';
import { TagChipsInput } from './components/TagChipsInput';

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
    linkedNoteInputEl?: HTMLInputElement; // Store reference to input element

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
            text: `${t('modal.editRepo')}: ${this.githubRepo.name}`
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
        new Setting(contentEl)
            .setName(t('modal.tags'))
            .setDesc(t('modal.tagsDesc'));

        // 创建标签芯片输入容器
        const tagChipsContainer = contentEl.createDiv('tag-chips-input-wrapper');

        // 初始化标签数组
        const initialTags = this.tags
            .split(',')
            .map(t => t.trim())
            .filter(t => t.length > 0);

        // 获取所有已有标签
        const allTags = this.plugin.getAllTags();

        // 创建标签芯片输入组件
        new TagChipsInput(
            tagChipsContainer,
            initialTags,
            allTags,
            (tags: string[]) => {
                // 更新 this.tags 为逗号分隔的字符串
                this.tags = tags.join(', ');
            }
        );


        // Notes Setting
        new Setting(contentEl)
            .setName(t('modal.notes'))
            .addTextArea(text => {
                text.inputEl.addClass('edit-repo-notes-textarea'); // Add specific class
                text.setPlaceholder(t('modal.notesPlaceholder'))
                   .setValue(this.notes) // Populated from constructor
                   .onChange(value => {
                       this.notes = value;
                   });
            });

        // Linked Note Setting
        new Setting(contentEl)
            .setName(t('modal.linkedNote'))
            .setDesc(t('modal.linkedNoteDesc'))
            .addText(text => {
                text.setPlaceholder(t('modal.notePath'))
                    .setValue(this.linkedNote) // Populated from constructor
                    .onChange(value => {
                        this.linkedNote = value;
                    });
                // Store reference to input element for later use
                this.linkedNoteInputEl = text.inputEl;
            })
            .addButton(button => button
                .setButtonText(t('modal.browse'))
                .onClick(() => {
                    this.openNoteBrowser();
                })
            );

        // Buttons (unchanged structure)
        const buttonDiv = contentEl.createDiv('edit-repo-buttons');
        const cancelButton = buttonDiv.createEl('button', { text: t('modal.cancel') });
        cancelButton.addEventListener('click', () => this.close());
        const saveButton = buttonDiv.createEl('button', { text: t('modal.save'), cls: 'mod-cta' });
        saveButton.addEventListener('click', () => {
            void this.saveChanges();
        });
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
            // Update the input field using stored reference
            if (this.linkedNoteInputEl) {
                this.linkedNoteInputEl.value = file.path;
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

        new Notice(t('notices.repoUpdated'));
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

        contentEl.createEl('h2', { text: t('modal.selectNote') });

        // 搜索框
        const searchDiv = contentEl.createDiv('note-selector-search');
        this.searchInput = searchDiv.createEl('input', {
            type: 'text',
            placeholder: t('modal.searchNotes')
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
                text: t('modal.noMatchingNotes'),
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