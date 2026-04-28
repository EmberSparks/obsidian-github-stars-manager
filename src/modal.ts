import { App, Modal, Setting, Notice, TFile } from 'obsidian';
import { GithubRepository, InvalidUserEnhancementRecord, UserRepoEnhancements } from './types';
import GithubStarsPlugin from './main';
import { EmojiUtils } from './emojiUtils';
import { t } from './i18n';
import { TagChipsInput } from './components/TagChipsInput';
import { buildEnhancementRepoSnapshot } from './userEnhancementCleanup';
import { shouldCaptureTextareaWheel } from './textareaWheelScroll';

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
                notesTextareaEl.addEventListener('wheel', (event) => {
                    if (!shouldCaptureTextareaWheel({
                        scrollTop: notesTextareaEl.scrollTop,
                        clientHeight: notesTextareaEl.clientHeight,
                        scrollHeight: notesTextareaEl.scrollHeight,
                        deltaY: event.deltaY
                    })) {
                        return;
                    }

                    event.preventDefault();
                    event.stopPropagation();
                    notesTextareaEl.scrollTop += event.deltaY;
                }, { passive: false });
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
        const existingEnhancement = this.plugin.data.userEnhancements[repoId];

        const updatedEnhancement: UserRepoEnhancements = {
            ...existingEnhancement,
            notes: this.notes.trim(),
            tags: this.tags
                .split(',')
                .map(tag => tag.trim())
                .filter(tag => tag.length > 0),
            linked_note: this.linkedNote.trim() || undefined,
            repoSnapshot: buildEnhancementRepoSnapshot(this.githubRepo, new Date().toISOString())
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

class ConfirmInvalidDataDeleteAllModal extends Modal {
    private message: string;
    private resolve: (confirmed: boolean) => void;

    constructor(app: App, message: string, resolve: (confirmed: boolean) => void) {
        super(app);
        this.message = message;
        this.resolve = resolve;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: t('settings.confirmActionTitle') });
        contentEl.createEl('p', { text: this.message });

        const buttonContainer = contentEl.createDiv('modal-button-container');
        const cancelButton = buttonContainer.createEl('button', { text: t('common.cancel') });
        cancelButton.addEventListener('click', () => {
            this.resolve(false);
            this.close();
        });

        const confirmButton = buttonContainer.createEl('button', {
            text: t('modal.invalidDataDeleteAllConfirmButton'),
            cls: 'mod-warning'
        });
        confirmButton.addEventListener('click', () => {
            this.resolve(true);
            this.close();
        });

        cancelButton.focus();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

export class InvalidEnhancementRecordsModal extends Modal {
    plugin: GithubStarsPlugin;
    records: InvalidUserEnhancementRecord[] = [];
    listEl?: HTMLElement;
    summaryEl?: HTMLElement;
    deleteAllButton?: HTMLButtonElement;
    refreshSnapshotsButton?: HTMLButtonElement;
    isMutating: boolean = false;
    isRefreshingSnapshots: boolean = false;

    constructor(app: App, plugin: GithubStarsPlugin) {
        super(app);
        this.plugin = plugin;
        this.records = plugin.getInvalidUserEnhancementRecords();
    }

    onOpen() {
        const { contentEl } = this;
        this.modalEl.addClass('github-stars-invalid-data-modal');
        contentEl.createEl('h2', { text: t('modal.invalidDataTitle') });
        this.summaryEl = contentEl.createEl('p', { cls: 'github-stars-invalid-data-summary' });

        const actionsEl = contentEl.createDiv('github-stars-invalid-data-actions');
        const closeButton = actionsEl.createEl('button', { text: t('common.cancel') });
        closeButton.addEventListener('click', () => this.close());

        this.refreshSnapshotsButton = actionsEl.createEl('button', {
            text: t('modal.invalidDataRefreshSnapshots')
        });
        this.refreshSnapshotsButton.addEventListener('click', () => {
            void this.handleRefreshSnapshots();
        });

        this.deleteAllButton = actionsEl.createEl('button', {
            text: t('modal.invalidDataDeleteAll')
        });
        this.deleteAllButton.addClass('mod-warning');
        this.deleteAllButton.addEventListener('click', () => {
            void this.handleDeleteAll();
        });

        this.listEl = contentEl.createDiv('github-stars-invalid-data-list');
        this.renderRecords();
    }

    onClose() {
        this.contentEl.empty();
    }

    private renderRecords(): void {
        if (!this.listEl || !this.summaryEl || !this.deleteAllButton || !this.refreshSnapshotsButton) return;
        this.records = this.plugin.getInvalidUserEnhancementRecords();
        this.summaryEl.setText(t('modal.invalidDataSummary', { count: String(this.records.length) }));
        const isBusy = this.isMutating || this.isRefreshingSnapshots;
        const missingSnapshotCount = this.records.filter(
            (record) => !(record.repoSnapshot?.full_name?.trim() && record.repoSnapshot?.html_url?.trim())
        ).length;
        this.deleteAllButton.disabled = isBusy || this.records.length === 0;
        this.refreshSnapshotsButton.disabled = isBusy || missingSnapshotCount === 0;
        this.refreshSnapshotsButton.textContent = this.isRefreshingSnapshots
            ? t('modal.invalidDataRefreshRunning')
            : t('modal.invalidDataRefreshSnapshots');
        this.listEl.empty();

        if (this.records.length === 0) {
            this.listEl.createEl('div', {
                cls: 'github-stars-invalid-data-empty',
                text: t('modal.invalidDataEmpty')
            });
            return;
        }

        this.records.forEach((record) => {
            const snapshot = record.repoSnapshot;
            const itemEl = this.listEl!.createDiv('github-stars-invalid-data-item');
            const headerEl = itemEl.createDiv('github-stars-invalid-data-item-header');
            headerEl.createEl('div', {
                cls: 'github-stars-invalid-data-item-title',
                text: snapshot?.full_name?.trim() || t('modal.invalidDataRepoId', { repoId: String(record.repoId) })
            });

            const deleteButton = headerEl.createEl('button', {
                cls: 'github-stars-invalid-data-delete-one',
                text: t('common.delete')
            });
            deleteButton.disabled = isBusy;
            deleteButton.addEventListener('click', () => {
                void this.handleDeleteOne(record.repoId);
            });

            itemEl.createEl('div', {
                cls: 'github-stars-invalid-data-item-meta',
                text: t('modal.invalidDataRepoId', { repoId: String(record.repoId) })
            });

            if (snapshot?.html_url?.trim()) {
                const linkRow = itemEl.createDiv('github-stars-invalid-data-item-meta');
                linkRow.createSpan({ text: t('modal.invalidDataRepoLink') });
                const linkEl = linkRow.createEl('a', {
                    cls: 'github-stars-invalid-data-item-link',
                    text: snapshot.html_url.trim()
                });
                linkEl.href = snapshot.html_url.trim();
                linkEl.target = '_blank';
                linkEl.rel = 'noopener noreferrer';
            } else {
                itemEl.createEl('div', {
                    cls: 'github-stars-invalid-data-item-warning',
                    text: t('modal.invalidDataNoSnapshot')
                });
            }

            if (snapshot?.description?.trim()) {
                itemEl.createEl('div', {
                    cls: 'github-stars-invalid-data-item-meta',
                    text: t('modal.invalidDataDescription', { description: snapshot.description.trim() })
                });
            }

            if (snapshot?.last_seen_at?.trim()) {
                itemEl.createEl('div', {
                    cls: 'github-stars-invalid-data-item-meta',
                    text: t('modal.invalidDataSnapshotTime', {
                        time: this.formatSnapshotTime(snapshot.last_seen_at)
                    })
                });
            }

            itemEl.createEl('div', {
                cls: 'github-stars-invalid-data-item-tags',
                text: t('modal.invalidDataTags', {
                    tags: record.tags.length > 0 ? record.tags.join(', ') : t('modal.invalidDataNone')
                })
            });

            const notesText = record.notes.trim();
            itemEl.createEl('div', {
                cls: 'github-stars-invalid-data-item-meta',
                text: notesText
                    ? t('modal.invalidDataNotesPreview', { notes: notesText })
                    : t('modal.invalidDataNoNotes')
            });

            itemEl.createEl('div', {
                cls: 'github-stars-invalid-data-item-meta',
                text: record.linked_note?.trim()
                    ? t('modal.invalidDataLinkedNote', { path: record.linked_note.trim() })
                    : t('modal.invalidDataNoLinkedNote')
            });
        });
    }

    private formatSnapshotTime(timestamp: string): string {
        const parsed = new Date(timestamp);
        if (Number.isNaN(parsed.getTime())) {
            return timestamp;
        }
        return parsed.toLocaleString();
    }

    private async handleRefreshSnapshots(): Promise<void> {
        const repoIdsToRefresh = this.records
            .filter((record) => !(record.repoSnapshot?.full_name?.trim() && record.repoSnapshot?.html_url?.trim()))
            .map((record) => record.repoId);

        if (repoIdsToRefresh.length === 0) {
            new Notice(t('modal.invalidDataRefreshNoop'));
            return;
        }

        this.isRefreshingSnapshots = true;
        this.renderRecords();
        try {
            const result = await this.plugin.refreshInvalidUserEnhancementSnapshots(repoIdsToRefresh);
            if (result.requestedCount === 0) {
                new Notice(t('modal.invalidDataRefreshNoop'));
            } else {
                new Notice(t('modal.invalidDataRefreshDone', {
                    updated: String(result.updatedCount),
                    missing: String(result.unresolvedCount)
                }));
            }
        } finally {
            this.isRefreshingSnapshots = false;
            this.renderRecords();
        }
    }

    private async handleDeleteOne(repoId: number): Promise<void> {
        this.isMutating = true;
        this.renderRecords();
        try {
            const deletedCount = await this.plugin.deleteInvalidUserEnhancements([repoId]);
            if (deletedCount > 0) {
                new Notice(t('modal.invalidDataDeleteDone', { count: String(deletedCount) }));
            } else {
                new Notice(t('modal.invalidDataDeleteMissing'));
            }
        } finally {
            this.isMutating = false;
            this.renderRecords();
        }
    }

    private async handleDeleteAll(): Promise<void> {
        if (this.records.length === 0) return;
        const confirmed = await this.confirmDeleteAll();
        if (!confirmed) {
            return;
        }

        this.isMutating = true;
        this.renderRecords();
        try {
            const deletedCount = await this.plugin.deleteInvalidUserEnhancements(
                this.records.map((record) => record.repoId)
            );
            if (deletedCount > 0) {
                new Notice(t('modal.invalidDataDeleteDone', { count: String(deletedCount) }));
            } else {
                new Notice(t('modal.invalidDataDeleteMissing'));
            }
        } finally {
            this.isMutating = false;
            this.renderRecords();
        }
    }

    private async confirmDeleteAll(): Promise<boolean> {
        const message = t('modal.invalidDataDeleteAllConfirmMessage', {
            count: String(this.records.length)
        });
        return new Promise((resolve) => {
            new ConfirmInvalidDataDeleteAllModal(this.app, message, resolve).open();
        });
    }
}
