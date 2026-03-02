import { App, Modal, Setting, Notice, TFile } from 'obsidian';
import { GithubRepository, UserRepoEnhancements } from './types';
import GithubStarsPlugin from './main';
import { EmojiUtils } from './emojiUtils';
import { t } from './i18n';
import { TagChipsInput } from './components/TagChipsInput';

/**
 * 编辑仓库信息的模态框
 */
export class EditRepoModal extends Modal {
    plugin: GithubStarsPlugin;
    githubRepo: GithubRepository;
    tags: string;
    notes: string;
    linkedNote: string;
    linkedNoteInputEl?: HTMLInputElement;
    tagChipsContainer?: HTMLElement;
    tagChipsInput?: TagChipsInput;

    constructor(app: App, plugin: GithubStarsPlugin, githubRepo: GithubRepository) {
        super(app);
        this.plugin = plugin;
        this.githubRepo = githubRepo;

        const existingEnhancement = plugin.data.userEnhancements[githubRepo.id];
        this.tags = existingEnhancement?.tags?.join(', ') || '';
        this.notes = existingEnhancement?.notes || '';
        this.linkedNote = existingEnhancement?.linked_note || '';
    }

    onOpen() {
        const { contentEl } = this;
        this.modalEl.addClass('github-stars-edit-modal');

        contentEl.createEl('h2', {
            text: `${t('modal.editRepo')}: ${this.githubRepo.name}`
        });

        const infoDiv = contentEl.createDiv('edit-repo-info');
        infoDiv.createEl('p', {
            text: `${this.githubRepo.full_name}`,
            cls: 'edit-repo-fullname'
        });
        if (this.githubRepo.description) {
            const descEl = infoDiv.createEl('p', { cls: 'edit-repo-description' });
            EmojiUtils.setEmojiText(descEl, this.githubRepo.description);
        }

        new Setting(contentEl)
            .setName(t('modal.tags'))
            .setDesc(t('modal.tagsDesc'));

        this.tagChipsContainer = contentEl.createDiv('tag-chips-input-wrapper');
        this.renderTagChipsInput();

        const notesSetting = new Setting(contentEl)
            .setName(t('modal.notes'))
            .addTextArea(text => {
                const notesTextareaEl = text.inputEl;
                notesTextareaEl.addClass('edit-repo-notes-textarea');
                notesTextareaEl.setAttribute('rows', '1');
                text.setPlaceholder(t('modal.notesPlaceholder'))
                    .setValue(this.notes)
                    .onChange(value => {
                        this.notes = value;
                    });
                notesTextareaEl.addEventListener('input', () => {
                    this.resizeNotesTextarea(notesTextareaEl);
                });
                window.setTimeout(() => {
                    this.resizeNotesTextarea(notesTextareaEl);
                }, 0);
            });
        notesSetting.settingEl.addClass('edit-repo-notes-setting');

        new Setting(contentEl)
            .setName(t('modal.linkedNote'))
            .setDesc(t('modal.linkedNoteDesc'))
            .addText(text => {
                text.setPlaceholder(t('modal.notePath'))
                    .setValue(this.linkedNote)
                    .onChange(value => {
                        this.linkedNote = value;
                    });
                this.linkedNoteInputEl = text.inputEl;
            })
            .addButton(button => button
                .setButtonText(t('modal.browse'))
                .onClick(() => {
                    this.openNoteBrowser();
                })
            );

        const buttonDiv = contentEl.createDiv('edit-repo-buttons');
        const cancelButton = buttonDiv.createEl('button', { text: t('modal.cancel') });
        cancelButton.addEventListener('click', () => this.close());
        const saveButton = buttonDiv.createEl('button', { text: t('modal.save'), cls: 'mod-cta' });
        saveButton.addEventListener('click', () => {
            void this.saveChanges();
        });
    }

    onClose() {
        if (this.tagChipsInput) {
            this.tagChipsInput.destroy();
            this.tagChipsInput = undefined;
        }
        const { contentEl } = this;
        contentEl.empty();
    }

    /**
     * 渲染标签芯片输入组件
     */
    private renderTagChipsInput() {
        if (!this.tagChipsContainer) return;

        if (this.tagChipsInput) {
            this.tagChipsInput.destroy();
            this.tagChipsInput = undefined;
        }

        const initialTags = this.tags
            .split(',')
            .map(tag => tag.trim())
            .filter(tag => tag.length > 0);
        const allTags = this.plugin.getAllTags();

        this.tagChipsInput = new TagChipsInput(
            this.tagChipsContainer,
            initialTags,
            allTags,
            (tags: string[]) => {
                this.tags = tags.join(', ');
            }
        );
    }

    /**
     * 自适应调整笔记输入框高度
     */
    private resizeNotesTextarea(textareaEl: HTMLTextAreaElement): void {
        textareaEl.setCssProps({ height: 'auto' });
        const nextHeight = textareaEl.scrollHeight;
        const maxHeight = Number.parseFloat(window.getComputedStyle(textareaEl).maxHeight);

        if (!Number.isNaN(maxHeight) && nextHeight > maxHeight) {
            textareaEl.setCssProps({
                height: `${maxHeight}px`,
                overflowY: 'auto'
            });
            return;
        }

        textareaEl.setCssProps({
            height: `${nextHeight}px`,
            overflowY: 'hidden'
        });
    }

    /**
     * 打开笔记浏览器
     */
    openNoteBrowser() {
        const files = this.app.vault.getMarkdownFiles();
        const modal = new NoteSelectorModal(this.app, files, (file) => {
            this.linkedNote = file.path;
            if (this.linkedNoteInputEl) {
                this.linkedNoteInputEl.value = file.path;
            }
        });
        modal.open();
    }

    /**
     * 保存仓库信息变更
     */
    async saveChanges() {
        const repoId = this.githubRepo.id;

        const updatedEnhancement: UserRepoEnhancements = {
            notes: this.notes.trim(),
            tags: this.tags
                .split(',')
                .map(tag => tag.trim())
                .filter(tag => tag.length > 0),
            linked_note: this.linkedNote.trim() || undefined
        };

        this.plugin.data.userEnhancements[repoId] = updatedEnhancement;
        await this.plugin.savePluginData();

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

        const searchDiv = contentEl.createDiv('note-selector-search');
        this.searchInput = searchDiv.createEl('input', {
            type: 'text',
            placeholder: t('modal.searchNotes')
        });

        this.searchInput.addEventListener('input', () => {
            this.renderFiles();
        });

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
