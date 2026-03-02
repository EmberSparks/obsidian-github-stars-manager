import { App, PluginSettingTab, Setting, Notice, Modal, requestUrl } from 'obsidian';
import GithubStarsPlugin from './main';
import { GithubStarsSettings, GithubAccount, PropertyTemplate, DEFAULT_PROPERTIES_TEMPLATE } from './types';
import { t } from './i18n';

const MIN_SYNC_INTERVAL_DAYS = 1;
const MAX_SYNC_INTERVAL_DAYS = 30;

/**
 * 通用确认对话框
 */
class ConfirmModal extends Modal {
    private message: string;
    private onConfirm: () => void;
    private confirmText: string;
    private cancelText: string;

    constructor(app: App, message: string, onConfirm: () => void, confirmText = t('common.confirm'), cancelText = t('common.cancel')) {
        super(app);
        this.message = message;
        this.onConfirm = onConfirm;
        this.confirmText = confirmText;
        this.cancelText = cancelText;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: t('settings.confirmActionTitle') });
        contentEl.createEl('p', { text: this.message });

        const buttonContainer = contentEl.createDiv('modal-button-container');

        const cancelButton = buttonContainer.createEl('button', { text: this.cancelText });
        cancelButton.addEventListener('click', () => this.close());

        const confirmButton = buttonContainer.createEl('button', {
            text: this.confirmText,
            cls: 'mod-warning'
        });
        confirmButton.addEventListener('click', () => {
            this.onConfirm();
            this.close();
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// 默认设置
export const DEFAULT_SETTINGS: GithubStarsSettings = {
    githubToken: '',
    accounts: [], // 默认无账号
    autoSync: true,
    syncInterval: 1, // 默认1天
    syncIntervalVersion: 2, // 同步间隔版本（天）
    language: 'en', // 默认语言
    enableExport: true, // 默认启用导出功能
    includeProperties: true, // 默认启用Properties
    propertiesTemplate: DEFAULT_PROPERTIES_TEMPLATE, // 默认Properties模板
};

export class GithubStarsSettingTab extends PluginSettingTab {
    plugin: GithubStarsPlugin;

    private normalizeSyncIntervalDays(rawDays: number): number {
        if (!Number.isFinite(rawDays)) {
            return MIN_SYNC_INTERVAL_DAYS;
        }
        return Math.min(MAX_SYNC_INTERVAL_DAYS, Math.max(MIN_SYNC_INTERVAL_DAYS, Math.round(rawDays)));
    }

    private async setSyncIntervalDays(days: number, rerender = false): Promise<void> {
        const normalizedDays = this.normalizeSyncIntervalDays(days);
        if (normalizedDays === this.plugin.settings.syncInterval) {
            return;
        }
        this.plugin.settings.syncInterval = normalizedDays;
        await this.plugin.saveSettings();
        if (rerender) {
            this.display();
        }
    }

    constructor(app: App, plugin: GithubStarsPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();
        containerEl.addClass('github-stars-settings-root');

        // 多账号管理区域
        const accountsSection = this.createSettingsSection(containerEl);
        this.displayAccountsSection(accountsSection);

        // 向后兼容的单一令牌设置（如果没有配置多账号）
        if (this.plugin.settings.accounts.length === 0) {
            new Setting(accountsSection)
                .setName(t('settings.githubToken'))
                .setDesc(t('settings.githubTokenDesc'))
                .addText(text => text
                    .setPlaceholder(t('settings.githubTokenPlaceholder'))
                    .setValue(this.plugin.settings.githubToken)
                    .onChange(async (value) => {
                        this.plugin.settings.githubToken = value;
                        await this.plugin.saveSettings();
                    })
                );
        }

        const syncSection = this.createSettingsSection(containerEl);

        // 自动同步设置
        new Setting(syncSection)
            .setName(t('settings.enableAutoSync'))
            .setDesc(t('settings.enableAutoSyncDesc'))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoSync)
                .onChange(async (value) => {
                    this.plugin.settings.autoSync = value;
                    await this.plugin.saveSettings();
                    this.display();

                    // saveSettings() 会自动处理同步间隔的更新
                })
            );

        // 同步间隔设置（仅在启用自动同步时显示）
        if (this.plugin.settings.autoSync) {
            const syncIntervalSetting = new Setting(syncSection)
                .setName(t('settings.syncIntervalName'))
                .setDesc(t('settings.syncIntervalDesc'))
                .addText(text => {
                    const inputEl = text.inputEl;
                    inputEl.type = 'number';
                    inputEl.min = String(MIN_SYNC_INTERVAL_DAYS);
                    inputEl.max = String(MAX_SYNC_INTERVAL_DAYS);
                    inputEl.step = '1';
                    inputEl.addClass('github-stars-sync-days-input');
                    text.setPlaceholder(String(MIN_SYNC_INTERVAL_DAYS))
                        .setValue(String(this.normalizeSyncIntervalDays(this.plugin.settings.syncInterval)));

                    const commitInputValue = async () => {
                        const parsedValue = Number.parseInt(inputEl.value, 10);
                        if (Number.isNaN(parsedValue)) {
                            inputEl.value = String(this.normalizeSyncIntervalDays(this.plugin.settings.syncInterval));
                            return;
                        }
                        const normalizedDays = this.normalizeSyncIntervalDays(parsedValue);
                        inputEl.value = String(normalizedDays);
                        await this.setSyncIntervalDays(normalizedDays);
                    };

                    inputEl.addEventListener('change', () => {
                        void commitInputValue();
                    });
                    inputEl.addEventListener('blur', () => {
                        void commitInputValue();
                    });
                    inputEl.addEventListener('keydown', (event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            void commitInputValue();
                        }
                    });
                })
                .addButton(button => button
                    .setButtonText(t('settings.syncIntervalDecreaseDay'))
                    .onClick(() => {
                        void this.setSyncIntervalDays(this.plugin.settings.syncInterval - 1, true);
                    })
                )
                .addButton(button => button
                    .setButtonText(t('settings.syncIntervalIncreaseDay'))
                    .onClick(() => {
                        void this.setSyncIntervalDays(this.plugin.settings.syncInterval + 1, true);
                    })
                );
            syncIntervalSetting.settingEl.addClass('github-stars-settings-child-item');
            syncIntervalSetting.settingEl.addClass('github-stars-sync-interval-setting');
        }

        // 立即同步按钮（并入同步设置区域）
        new Setting(syncSection)
            .setName(t('settings.syncNow'))
            .setDesc(t('settings.syncNowDesc'))
            .addButton(button => button
                .setButtonText(t('settings.syncButton'))
                .setCta()
                .onClick(async () => {
                    button.setDisabled(true);
                    button.setButtonText(t('settings.syncing'));

                    try {
                        await this.plugin.syncStars();
                        button.setButtonText(t('settings.syncSuccess'));
                        setTimeout(() => {
                            button.setButtonText(t('settings.syncButton'));
                            button.setDisabled(false);
                        }, 2000);
                    } catch (error) {
                        console.error('Sync failed:', error);
                        button.setButtonText(t('settings.syncFailed'));
                        new Notice(t('settings.syncFailedNotice'), 5000);
                        setTimeout(() => {
                            button.setButtonText(t('settings.syncButton'));
                            button.setDisabled(false);
                        }, 2000);
                    }
                })
            );

        // 语言设置
        new Setting(syncSection)
            .setName(t('settings.language'))
            .setDesc(t('settings.languageDesc'))
            .addDropdown(dropdown => dropdown
                .addOption('en', t('settings.languageEn'))
                .addOption('zh', t('settings.languageZh'))
                .setValue(this.plugin.settings.language)
                .onChange(async (value: 'en' | 'zh') => {
                    this.plugin.settings.language = value;
                    await this.plugin.saveSettings();
                    new Notice(t('settings.languageReloadNotice'));
                })
            );

        const exportSection = this.createSettingsSection(containerEl);

        // 导出功能开关
        new Setting(exportSection)
            .setName(t('settings.enableExport'))
            .setDesc(t('settings.enableExportDesc'))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableExport)
                .onChange(async (value) => {
                    this.plugin.settings.enableExport = value;
                    await this.plugin.saveSettings({ refreshViews: true });
                    // 重新渲染设置页面以显示/隐藏Properties配置
                    this.display();
                })
            );

        // Properties模板配置（仅在启用导出功能时显示）
        if (this.plugin.settings.enableExport) {
            this.displayPropertiesSection(exportSection);
        }
    }

    /**
     * 创建设置分组区域
     */
    private createSettingsSection(containerEl: HTMLElement): HTMLElement {
        return containerEl.createDiv('github-stars-settings-section');
    }

    /**
     * 显示多账号管理区域
     */
    private displayAccountsSection(containerEl: HTMLElement): void {
        // 添加账号按钮
        new Setting(containerEl)
            .setName(t('settings.addAccountButton'))
            .setDesc(t('settings.addAccountDesc'))
            .addButton(button => button
                .setButtonText(t('settings.addAccountButton'))
                .setCta()
                .onClick(() => {
                    this.showAddAccountModal().catch(err => console.error('Failed to show add account modal:', err));
                })
            );

        // 显示现有账号列表
        const accountsContainer = containerEl.createDiv('github-accounts-container');
        this.displayAccountsList(accountsContainer);
    }

    /**
     * 显示账号列表
     */
    private displayAccountsList(container: HTMLElement): void {
        container.empty();

        if (this.plugin.settings.accounts.length === 0) {
            container.createEl('p', {
                text: t('settings.noAccountsMessage'),
                cls: 'github-accounts-empty'
            });
            return;
        }

        this.plugin.settings.accounts.forEach((account, index) => {
            const accountEl = container.createDiv('github-account-item');

            // 账号信息区域
            const infoEl = accountEl.createDiv('github-account-info');

            // 头像
            if (account.avatar_url) {
                const avatarEl = infoEl.createEl('img', {
                    cls: 'github-account-avatar',
                    attr: {
                        src: account.avatar_url,
                        alt: `${account.username} avatar`,
                        loading: 'lazy'
                    }
                });
                avatarEl.addEventListener('error', () => {
                    avatarEl.addClass('display-none');
                });
            }

            // 账号详情
            const detailsEl = infoEl.createDiv('github-account-details');
            detailsEl.createEl('div', {
                text: account.name || account.username,
                cls: 'github-account-name'
            });
            detailsEl.createEl('div', {
                text: `@${account.username}`,
                cls: 'github-account-username'
            });

            // 启用状态
            const statusEl = infoEl.createDiv('github-account-status');
            const toggle = statusEl.createEl('input', {
                type: 'checkbox',
                cls: 'github-account-toggle'
            });
            toggle.checked = account.enabled;
            toggle.addEventListener('change', () => {
                void (async () => {
                    account.enabled = toggle.checked;
                    await this.plugin.saveSettings({ refreshViews: true });
                    const status = account.enabled ? t('settings.enabled') : t('settings.disabled');
                    new Notice(t('settings.accountToggled', { username: account.username, status }));
                })();
            });
            statusEl.createEl('label', {
                text: account.enabled ? t('settings.accountEnabled') : t('settings.accountDisabled'),
                cls: account.enabled ? 'enabled' : 'disabled'
            });

            // 操作按钮
            const actionsEl = accountEl.createDiv('github-account-actions');

            // 测试令牌按钮
            const testBtn = actionsEl.createEl('button', {
                text: '测试',
                cls: 'github-account-btn test'
            });
            testBtn.addEventListener('click', () => {
                void (async () => {
                    testBtn.textContent = '测试中...';
                    testBtn.disabled = true;

                    try {
                        const response = await requestUrl({
                            url: 'https://api.github.com/user',
                            method: 'GET',
                            headers: {
                                'Authorization': `token ${account.token}`,
                                'User-Agent': 'Obsidian-GitHub-Stars-Manager'
                            }
                        });

                        if (response.status === 200) {
                            // 检查令牌过期时间
                            const rateResponse = await requestUrl({
                                url: 'https://api.github.com/rate_limit',
                                method: 'GET',
                                headers: {
                                    'Authorization': `token ${account.token}`,
                                    'User-Agent': 'Obsidian-GitHub-Stars-Manager'
                                }
                            });

                            let expiryInfo = '';
                            const expiresHeader = response.headers['github-authentication-token-expiration'];
                            if (expiresHeader) {
                                const expiryDate = new Date(expiresHeader);
                                const now = new Date();
                                const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

                                if (daysLeft > 0) {
                                    expiryInfo = `\n过期时间: ${expiryDate.toLocaleDateString()} (剩余${daysLeft}天)`;
                                } else {
                                    expiryInfo = '\n令牌已过期';
                                }
                            } else {
                                expiryInfo = '\n无过期时间 (经典令牌)';
                            }

                            const rateData = rateResponse.json;
                            const rateLimitInfo = `\nAPI限额: ${rateData.rate.remaining}/${rateData.rate.limit}`;

                            new Notice(`✅ 令牌有效${expiryInfo}${rateLimitInfo}`, 8000);
                            testBtn.textContent = '✓ 有效';
                            testBtn.addClass('test-success');
                            setTimeout(() => {
                                testBtn.textContent = '测试';
                                testBtn.removeClass('test-success');
                            }, 3000);
                        } else {
                            new Notice('❌ 令牌无效或已过期', 5000);
                            testBtn.textContent = '✗ 无效';
                            testBtn.addClass('test-error');
                            setTimeout(() => {
                                testBtn.textContent = '测试';
                                testBtn.removeClass('test-error');
                            }, 3000);
                        }
                    } catch (error) {
                        console.error('Token test failed:', error);
                        new Notice('❌ 令牌测试失败: ' + (error instanceof Error ? error.message : '未知错误'), 5000);
                        testBtn.textContent = '✗ 错误';
                        testBtn.addClass('test-error');
                        setTimeout(() => {
                            testBtn.textContent = '测试';
                            testBtn.removeClass('test-error');
                        }, 3000);
                    } finally {
                        testBtn.disabled = false;
                    }
                })();
            });

            // 编辑按钮
            const editBtn = actionsEl.createEl('button', {
                text: t('common.edit'),
                cls: 'github-account-btn edit'
            });
            editBtn.addEventListener('click', () => {
                this.showEditAccountModal(account, index).catch(err => console.error('Failed to show edit account modal:', err));
            });

            // 删除按钮
            const deleteBtn = actionsEl.createEl('button', {
                text: t('common.delete'),
                cls: 'github-account-btn delete'
            });
            deleteBtn.addEventListener('click', () => {
                new ConfirmModal(
                    this.app,
                    t('settings.confirmDeleteAccount', { username: account.username }),
                    () => {
                        void (async () => {
                            this.plugin.settings.accounts.splice(index, 1);
                            await this.plugin.saveSettings({ refreshViews: true });
                            this.displayAccountsList(container);
                            new Notice(t('settings.accountDeleted', { username: account.username }));
                        })();
                    },
                    t('common.delete')
                ).open();
            });
        });
    }

    /**
     * 显示添加账号模态框
     */
    private async showAddAccountModal(): Promise<void> {
        const account: Partial<GithubAccount> = {
            name: '',
            username: '',
            token: '',
            enabled: true
        };

        const result = await this.showAccountModal(t('settings.addAccountTitle'), account);
        if (result) {
            // 生成唯一ID
            const id = Date.now().toString() + Math.random().toString(36).substring(2, 11);
            const newAccount: GithubAccount = {
                id,
                name: result.name,
                username: result.username,
                token: result.token,
                enabled: result.enabled,
                avatar_url: result.avatar_url
            };

            this.plugin.settings.accounts.push(newAccount);
            await this.plugin.saveSettings({ refreshViews: true });
            this.display(); // 重新渲染设置页面
            new Notice(t('settings.accountAdded', { username: newAccount.username }));
        }
    }

    /**
     * 显示编辑账号模态框
     */
    private async showEditAccountModal(account: GithubAccount, index: number): Promise<void> {
        const result = await this.showAccountModal(t('settings.editAccountTitle'), account);
        if (result) {
            // 更新账号信息
            this.plugin.settings.accounts[index] = {
                ...account,
                name: result.name,
                username: result.username,
                token: result.token,
                enabled: result.enabled,
                avatar_url: result.avatar_url
            };

            await this.plugin.saveSettings({ refreshViews: true });
            this.display(); // 重新渲染设置页面
            new Notice(t('settings.accountUpdated', { username: result.username }));
        }
    }

    /**
     * 通用账号模态框
     */
    private showAccountModal(title: string, account: Partial<GithubAccount>): Promise<GithubAccount | null> {
        return new Promise((resolve) => {
            const modal = new AccountModal(this.app, title, account, resolve);
            modal.open();
        });
    }

    /**
     * 创建表单字段
     */
    private createFormField(
        container: HTMLElement,
        name: string,
        description: string,
        value: string,
        type: string = 'text'
    ): HTMLInputElement {
        const fieldContainer = container.createDiv('setting-item');
        
        const infoDiv = fieldContainer.createDiv('setting-item-info');
        infoDiv.createDiv('setting-item-name').textContent = name;
        infoDiv.createDiv('setting-item-description').textContent = description;
        
        const controlDiv = fieldContainer.createDiv('setting-item-control');
        const input = controlDiv.createEl('input', {
            type: type,
            value: value
        });
        
        // 确保输入框可以正常获得焦点和输入
        input.addClass('form-input-full');
        input.tabIndex = 0;
        
        // 阻止点击事件冒泡
        input.addEventListener('click', (e) => {
            e.stopPropagation();
            input.focus();
        });
        
        // 阻止鼠标按下事件冒泡
        input.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        });
        
        // 添加焦点样式处理
        input.addEventListener('focus', (e) => {
            e.stopPropagation();
        });
        
        // 键盘事件处理
        input.addEventListener('keydown', (e) => {
            e.stopPropagation();
        });
        
        input.addEventListener('keyup', (e) => {
            e.stopPropagation();
        });
        
        return input;
    }

    /**
     * 显示Properties模板配置区域
     */
    private displayPropertiesSection(containerEl: HTMLElement): void {
        // 启用Properties开关
        const includePropertiesSetting = new Setting(containerEl)
            .setName(t('settings.enableProperties'))
            .setDesc(t('settings.enablePropertiesDesc'))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.includeProperties ?? true) // 默认启用Properties
                .onChange(async (value) => {
                    this.plugin.settings.includeProperties = value;
                    await this.plugin.saveSettings();
                    this.display(); // 重新渲染以显示/隐藏模板配置
                })
            );
        includePropertiesSetting.settingEl.addClass('github-stars-properties-toggle-setting');

        // 只有启用Properties时才显示模板配置
        if (this.plugin.settings.includeProperties) {
            // Properties模板列表
            this.plugin.settings.propertiesTemplate.forEach((property, index) => {
                this.createPropertySetting(containerEl, property, index);
            });

            // 添加新属性按钮
            const addPropertySetting = new Setting(containerEl)
                .setName(t('settings.addNewProperty'))
                .setDesc(t('settings.addNewPropertyDesc'))
                .addButton(button => button
                    .setButtonText(t('settings.addPropertyButton'))
                    .setCta()
                    .onClick(() => {
                        this.addNewProperty();
                    })
                );
            addPropertySetting.settingEl.addClass('github-stars-properties-action-setting');
            addPropertySetting.settingEl.addClass('github-stars-settings-child-item');

            // 重置为默认模板按钮
            const resetTemplateSetting = new Setting(containerEl)
                .setName(t('settings.resetTemplate'))
                .setDesc(t('settings.resetTemplateDesc'))
                .addButton(button => button
                    .setButtonText(t('settings.resetButton'))
                    .setWarning()
                    .onClick(() => {
                        void (async () => {
                            this.plugin.settings.propertiesTemplate = [...DEFAULT_PROPERTIES_TEMPLATE];
                            await this.plugin.saveSettings();
                            this.display();
                            new Notice(t('settings.resetSuccess'));
                        })();
                    })
                );
            resetTemplateSetting.settingEl.addClass('github-stars-properties-action-setting');
            resetTemplateSetting.settingEl.addClass('github-stars-settings-child-item');
        }
    }

    /**
     * 创建单个属性设置项
     */
    private createPropertySetting(containerEl: HTMLElement, property: PropertyTemplate, index: number): void {
        const propertySetting = new Setting(containerEl)
            .setName(`${property.key} (${property.description})`)
            .setDesc(`Type: ${property.type} | Value: ${property.value}`)
            .addToggle(toggle => toggle
                .setValue(property.enabled)
                .onChange(async (value) => {
                    // 更新属性的启用状态
                    this.plugin.settings.propertiesTemplate[index].enabled = value;
                    await this.plugin.saveSettings();
                    const status = value ? t('settings.enabled') : t('settings.disabled');
                    new Notice(t('settings.propertyToggled', { key: property.key, status }));
                })
            )
            .addButton(button => button
                .setButtonText(t('settings.editProperty'))
                .onClick(() => {
                    this.editProperty(index);
                })
            )
            .addButton(button => button
                .setButtonText(t('settings.deleteProperty'))
                .setWarning()
                .onClick(() => {
                    new ConfirmModal(
                        this.app,
                        t('settings.confirmDeleteProperty', { key: property.key }),
                        () => {
                            void (async () => {
                                this.plugin.settings.propertiesTemplate.splice(index, 1);
                                await this.plugin.saveSettings();
                                this.display();
                                new Notice(t('settings.propertyDeleted', { key: property.key }));
                            })();
                        },
                        t('common.delete')
                    ).open();
                })
            );
        propertySetting.settingEl.addClass('github-stars-properties-item');
        propertySetting.settingEl.addClass('github-stars-settings-child-item');
        propertySetting.controlEl.querySelectorAll('button').forEach(buttonEl => {
            buttonEl.addClass('github-stars-properties-action-btn');
            if (buttonEl.hasClass('mod-warning')) {
                buttonEl.addClass('github-stars-properties-action-btn-danger');
            }
        });
    }

    /**
     * 添加新属性（暂时禁用）
     */
    private addNewProperty(): void {
        new Notice(t('settings.comingSoon'));
    }

    /**
     * 编辑属性（暂时禁用）
     */
    private editProperty(_index: number): void {
        new Notice(t('settings.comingSoon'));
    }
}

/**
 * 账号模态框类
 */
class AccountModal extends Modal {
    title: string;
    account: Partial<GithubAccount>;
    resolve: (value: GithubAccount | null) => void;
    nameInput: HTMLInputElement;
    usernameInput: HTMLInputElement;
    tokenInput: HTMLInputElement;

    constructor(app: App, title: string, account: Partial<GithubAccount>, resolve: (value: GithubAccount | null) => void) {
        super(app);
        this.title = title;
        this.account = account;
        this.resolve = resolve;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        // 设置模态框标题
        contentEl.createEl('h2', { text: this.title });

        // 创建表单
        const form = contentEl.createDiv('account-form');

        // 账号名称字段
        const nameContainer = form.createDiv('form-field');
        nameContainer.createEl('label', { text: t('settings.accountName') });
        nameContainer.createEl('div', { text: t('settings.accountNameDesc'), cls: 'form-field-desc' });
        this.nameInput = nameContainer.createEl('input', {
            type: 'text',
            value: this.account.name || '',
            placeholder: t('settings.accountNamePlaceholder')
        });

        // GitHub用户名字段
        const usernameContainer = form.createDiv('form-field');
        usernameContainer.createEl('label', { text: t('settings.githubUsername') });
        usernameContainer.createEl('div', { text: t('settings.githubUsernameDesc'), cls: 'form-field-desc' });
        this.usernameInput = usernameContainer.createEl('input', {
            type: 'text',
            value: this.account.username || '',
            placeholder: t('settings.autoFetch'),
            attr: { readonly: 'true' }
        });
        this.usernameInput.addClass('form-input-disabled');

        // 个人访问令牌字段
        const tokenContainer = form.createDiv('form-field');
        tokenContainer.createEl('label', { text: t('settings.tokenLabel') });
        tokenContainer.createEl('div', { text: t('settings.tokenDescShort'), cls: 'form-field-desc' });
        this.tokenInput = tokenContainer.createEl('input', {
            type: 'password',
            value: this.account.token || '',
            placeholder: t('settings.tokenInputPlaceholder')
        });

        // 添加令牌验证功能
        let validationTimeout: ReturnType<typeof setTimeout>;
        this.tokenInput.addEventListener('input', () => {
            clearTimeout(validationTimeout);
            const token = this.tokenInput.value.trim();
            
            if (token.length > 10) {
                validationTimeout = setTimeout(() => {
                    void (async () => {
                        try {
                            const response = await requestUrl({
                                url: 'https://api.github.com/user',
                                method: 'GET',
                                headers: {
                                    'Authorization': `token ${token}`,
                                    'User-Agent': 'Obsidian-GitHub-Stars-Manager'
                                }
                            });

                            if (response.status === 200) {
                                const userData = response.json;
                                this.usernameInput.value = userData.login;
                                if (!this.nameInput.value) {
                                    this.nameInput.value = userData.name || userData.login;
                                }
                                this.tokenInput.addClass('border-color-success');
                                this.usernameInput.addClass('border-color-success');
                            } else {
                                this.tokenInput.addClass('border-color-error');
                                this.usernameInput.value = '';
                            }
                        } catch {
                            this.tokenInput.addClass('border-color-error');
                            this.usernameInput.value = '';
                        }
                    })();
                }, 1000);
            } else {
                this.usernameInput.value = '';
                this.tokenInput.removeClass('border-color-success');
                this.tokenInput.removeClass('border-color-error');
                this.usernameInput.removeClass('border-color-success');
                this.usernameInput.removeClass('border-color-error');
            }
        });

        // 按钮区域
        const buttonContainer = contentEl.createDiv('modal-button-container button-flex-container');

        const cancelBtn = buttonContainer.createEl('button', { text: t('common.cancel') });
        const saveBtn = buttonContainer.createEl('button', {
            text: t('common.save'),
            cls: 'mod-cta'
        });

        // 事件处理
        cancelBtn.addEventListener('click', () => {
            this.close();
            this.resolve(null);
        });

        saveBtn.addEventListener('click', () => {
            this.saveAccount(saveBtn).catch(err => console.error('Failed to save account:', err));
        });

        // 设置焦点
        setTimeout(() => {
            this.nameInput.focus();
        }, 100);
    }

    async saveAccount(saveBtn: HTMLButtonElement) {
        const name = this.nameInput.value.trim();
        const username = this.usernameInput.value.trim();
        const token = this.tokenInput.value.trim();

        if (!token) {
            new Notice(t('settings.tokenRequired'));
            return;
        }

        if (!username) {
            new Notice(t('settings.usernameNotFetched'));
            return;
        }

        try {
            saveBtn.textContent = t('settings.saving');
            saveBtn.disabled = true;

            const response = await requestUrl({
                url: 'https://api.github.com/user',
                method: 'GET',
                headers: {
                    'Authorization': `token ${token}`,
                    'User-Agent': 'Obsidian-GitHub-Stars-Manager'
                }
            });

            if (response.status !== 200) {
                throw new Error('Token validation failed');
            }

            const userData = response.json;

            this.close();
            this.resolve({
                id: this.account.id || '',
                name: name || userData.name || userData.login,
                username: userData.login,
                token: token,
                enabled: this.account.enabled !== false,
                avatar_url: userData.avatar_url
            });
        } catch (error) {
            console.error('Token validation failed:', error);
            new Notice(t('settings.validationFailed'));
            saveBtn.textContent = t('common.save');
            saveBtn.disabled = false;
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
