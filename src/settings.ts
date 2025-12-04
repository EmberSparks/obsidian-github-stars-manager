import { App, PluginSettingTab, Setting, Notice, Modal, requestUrl } from 'obsidian';
import GithubStarsPlugin from './main';
import { GithubStarsSettings, GithubAccount, PropertyTemplate, DEFAULT_PROPERTIES_TEMPLATE } from './types';

/**
 * 通用确认对话框
 */
class ConfirmModal extends Modal {
    private message: string;
    private onConfirm: () => void;
    private confirmText: string;
    private cancelText: string;

    constructor(app: App, message: string, onConfirm: () => void, confirmText = 'Confirm', cancelText = 'Cancel') {
        super(app);
        this.message = message;
        this.onConfirm = onConfirm;
        this.confirmText = confirmText;
        this.cancelText = cancelText;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: 'Confirm action' });
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
    syncInterval: 60, // 默认60分钟
    theme: 'default', // 默认主题
    language: 'en', // 默认语言
    enableExport: true, // 默认启用导出功能
    includeProperties: true, // 默认启用Properties
    propertiesTemplate: DEFAULT_PROPERTIES_TEMPLATE, // 默认Properties模板
};

export class GithubStarsSettingTab extends PluginSettingTab {
    plugin: GithubStarsPlugin;

    constructor(app: App, plugin: GithubStarsPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        // 多账号管理区域
        this.displayAccountsSection(containerEl);

        // 向后兼容的单一令牌设置（如果没有配置多账号）
        if (this.plugin.settings.accounts.length === 0) {
            new Setting(containerEl)
                .setName('GitHub personal access token')
                .setDesc('Token for accessing your GitHub starred repositories. Requires repo scope permission. It is recommended to use the multi-account management feature above.')
                .addText(text => text
                    .setPlaceholder('Enter your GitHub personal access token')
                    .setValue(this.plugin.settings.githubToken)
                    .onChange(async (value) => {
                        this.plugin.settings.githubToken = value;
                        await this.plugin.saveSettings();
                    })
                );
        }

        // 自动同步设置
        new Setting(containerEl)
            .setName('Enable auto sync')
            .setDesc('Automatically sync your GitHub stars periodically')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoSync)
                .onChange(async (value) => {
                    this.plugin.settings.autoSync = value;
                    await this.plugin.saveSettings();

                    // saveSettings() 会自动处理同步间隔的更新
                })
            );

        // 同步间隔设置
        new Setting(containerEl)
            .setName('Sync interval (minutes)')
            .setDesc('Set the time interval for automatic synchronization')
            .addSlider(slider => slider
                .setLimits(15, 1440, 15)
                .setValue(this.plugin.settings.syncInterval)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.syncInterval = value;
                    await this.plugin.saveSettings();

                    // saveSettings() 会自动处理同步间隔的更新
                })
            );

        // 主题设置
        new Setting(containerEl)
            .setName('Theme')
            .setDesc('Select the plugin interface theme')
            .addDropdown(dropdown => dropdown
                .addOption('default', '默认主题')
                .addOption('ios-glass', 'iOS液态玻璃')
                .setValue(this.plugin.settings.theme)
                .onChange(async (value: 'default' | 'ios-glass') => {
                    this.plugin.settings.theme = value;
                    await this.plugin.saveSettings();
                    // 应用主题
                    this.plugin.applyTheme(value);
                })
            );

        // 语言设置
        new Setting(containerEl)
            .setName('Language')
            .setDesc('Select display language (requires reload)')
            .addDropdown(dropdown => dropdown
                .addOption('en', 'English')
                .addOption('zh', '简体中文')
                .setValue(this.plugin.settings.language)
                .onChange(async (value: 'en' | 'zh') => {
                    this.plugin.settings.language = value;
                    await this.plugin.saveSettings();
                    new Notice('Language will be applied after reloading the plugin');
                })
            );

        // 导出功能开关
        new Setting(containerEl)
            .setName('Enable export')
            .setDesc('Enable exporting starred repositories as Markdown files')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableExport)
                .onChange(async (value) => {
                    this.plugin.settings.enableExport = value;
                    await this.plugin.saveSettings();
                    // 重新渲染设置页面以显示/隐藏Properties配置
                    this.display();
                })
            );

        // Properties模板配置（仅在启用导出功能时显示）
        if (this.plugin.settings.enableExport) {
            this.displayPropertiesSection(containerEl);
        }

        // 立即同步按钮
        new Setting(containerEl)
            .setName('Sync now')
            .setDesc('Immediately fetch your starred repositories from GitHub')
            .addButton(button => button
                .setButtonText('Sync')
                .setCta()
                .onClick(async () => {
                    button.setDisabled(true);
                    button.setButtonText('Syncing...');

                    try {
                        await this.plugin.syncStars();
                        button.setButtonText('Sync successful');
                        setTimeout(() => {
                            button.setButtonText('Sync');
                            button.setDisabled(false);
                        }, 2000);
                    } catch (error) {
                        console.error('Sync failed:', error);
                        button.setButtonText('Sync failed');
                        new Notice('Sync failed, please check your network connection or token settings', 5000);
                        setTimeout(() => {
                            button.setButtonText('Sync');
                            button.setDisabled(false);
                        }, 2000);
                    }
                })
            );
    }

    /**
     * 显示多账号管理区域
     */
    private displayAccountsSection(containerEl: HTMLElement): void {
        // 账号管理标题
        new Setting(containerEl)
            .setName('GitHub accounts')
            .setHeading();

        // 添加账号按钮
        new Setting(containerEl)
            .setName('Add GitHub account')
            .setDesc('Add a new GitHub account to sync starred repositories from multiple accounts')
            .addButton(button => button
                .setButtonText('Add account')
                .setCta()
                .onClick(() => {
                    void this.showAddAccountModal();
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
                text: 'No GitHub accounts configured. Click the button above to add an account.',
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
                    await this.plugin.saveSettings();
                    new Notice(`Account ${account.username} ${account.enabled ? 'enabled' : 'disabled'}`);
                })();
            });
            statusEl.createEl('label', {
                text: account.enabled ? 'Enabled' : 'Disabled',
                cls: account.enabled ? 'enabled' : 'disabled'
            });
            
            // 操作按钮
            const actionsEl = accountEl.createDiv('github-account-actions');
            
            // 编辑按钮
            const editBtn = actionsEl.createEl('button', {
                text: 'Edit',
                cls: 'github-account-btn edit'
            });
            editBtn.addEventListener('click', () => {
                void this.showEditAccountModal(account, index);
            });
            
            // 删除按钮
            const deleteBtn = actionsEl.createEl('button', {
                text: 'Delete',
                cls: 'github-account-btn delete'
            });
            deleteBtn.addEventListener('click', () => {
                new ConfirmModal(
                    this.app,
                    `Are you sure you want to delete account ${account.username}?`,
                    () => {
                        void (async () => {
                            this.plugin.settings.accounts.splice(index, 1);
                            await this.plugin.saveSettings();
                            this.displayAccountsList(container);
                            new Notice(`Account ${account.username} deleted`);
                        })();
                    },
                    'Delete'
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

        const result = await this.showAccountModal('Add GitHub account', account);
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
            await this.plugin.saveSettings();
            this.display(); // 重新渲染设置页面
            new Notice(`Account ${newAccount.username} added`);
        }
    }

    /**
     * 显示编辑账号模态框
     */
    private async showEditAccountModal(account: GithubAccount, index: number): Promise<void> {
        const result = await this.showAccountModal('Edit GitHub account', account);
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

            await this.plugin.saveSettings();
            this.display(); // 重新渲染设置页面
            new Notice(`Account ${result.username} updated`);
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
        // Properties配置标题
        new Setting(containerEl)
            .setName('Properties template configuration')
            .setHeading();

        // 说明文字
        const descEl = containerEl.createDiv('setting-item-description description-margin');
        const p = descEl.createEl('p');
        p.textContent = 'Configure the properties (note attributes) template for exporting Markdown files. Supported variables:';

        const ul = descEl.createEl('ul', { cls: 'setting-item-description-list' });

        const variables = [
            { code: '{{full_name}}', desc: 'Repository full name' },
            { code: '{{name}}', desc: 'Repository name' },
            { code: '{{owner.login}}', desc: 'Repository owner' },
            { code: '{{html_url}}', desc: 'Repository URL' },
            { code: '{{description}}', desc: 'Repository description' },
            { code: '{{created_at}}', desc: 'Creation time' },
            { code: '{{starred_at}}', desc: 'Starred time' },
            { code: '{{topics}}', desc: 'Topic tags' },
            { code: '{{stargazers_count}}', desc: 'Star count' },
            { code: '{{language}}', desc: 'Primary language' }
        ];
        
        variables.forEach(variable => {
            const li = ul.createEl('li');
            const code = li.createEl('code');
            code.textContent = variable.code;
            li.appendText(' - ' + variable.desc);
        });

        // 启用Properties开关
        new Setting(containerEl)
            .setName('Enable properties')
            .setDesc('Add properties (YAML frontmatter) to the beginning of exported Markdown files')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.includeProperties ?? true) // 默认启用Properties
                .onChange(async (value) => {
                    this.plugin.settings.includeProperties = value;
                    await this.plugin.saveSettings();
                    this.display(); // 重新渲染以显示/隐藏模板配置
                })
            );

        // 只有启用Properties时才显示模板配置
        if (this.plugin.settings.includeProperties) {
            // Properties模板列表
            this.plugin.settings.propertiesTemplate.forEach((property, index) => {
                this.createPropertySetting(containerEl, property, index);
            });

            // 添加新属性按钮
            new Setting(containerEl)
                .setName('Add new property')
                .setDesc('Add custom properties attribute')
                .addButton(button => button
                    .setButtonText('Add property')
                    .setCta()
                    .onClick(() => {
                        this.addNewProperty();
                    })
                );

            // 重置为默认模板按钮
            new Setting(containerEl)
                .setName('Reset template')
                .setDesc('Restore to default properties template configuration')
                .addButton(button => button
                    .setButtonText('Reset to default')
                    .setWarning()
                    .onClick(() => {
                        void (async () => {
                            this.plugin.settings.propertiesTemplate = [...DEFAULT_PROPERTIES_TEMPLATE];
                            await this.plugin.saveSettings();
                            this.display();
                            new Notice('Properties template has been reset to default');
                        })();
                    })
                );
        }
    }

    /**
     * 创建单个属性设置项
     */
    private createPropertySetting(containerEl: HTMLElement, property: PropertyTemplate, index: number): void {
        new Setting(containerEl)
            .setName(`${property.key} (${property.description})`)
            .setDesc(`Type: ${property.type} | Value: ${property.value}`)
            .addToggle(toggle => toggle
                .setValue(property.enabled)
                .onChange(async (value) => {
                    // 更新属性的启用状态
                    this.plugin.settings.propertiesTemplate[index].enabled = value;
                    await this.plugin.saveSettings();
                    new Notice(`Property ${property.key} ${value ? 'enabled' : 'disabled'}`);
                })
            )
            .addButton(button => button
                .setButtonText('Edit')
                .onClick(() => {
                    this.editProperty(index);
                })
            )
            .addButton(button => button
                .setButtonText('Delete')
                .setWarning()
                .onClick(() => {
                    new ConfirmModal(
                        this.app,
                        `Are you sure you want to delete property ${property.key}?`,
                        () => {
                            void (async () => {
                                this.plugin.settings.propertiesTemplate.splice(index, 1);
                                await this.plugin.saveSettings();
                                this.display();
                                new Notice(`Property ${property.key} deleted`);
                            })();
                        },
                        'Delete'
                    ).open();
                })
            );
    }

    /**
     * 添加新属性（暂时禁用）
     */
    private addNewProperty(): void {
        new Notice('Properties template editing feature coming soon');
    }

    /**
     * 编辑属性（暂时禁用）
     */
    private editProperty(_index: number): void {
        new Notice('Properties template editing feature coming soon');
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
        nameContainer.createEl('label', { text: 'Account name' });
        nameContainer.createEl('div', { text: 'Set a display name for this account', cls: 'form-field-desc' });
        this.nameInput = nameContainer.createEl('input', {
            type: 'text',
            value: this.account.name || '',
            placeholder: 'Enter account name'
        });

        // GitHub用户名字段
        const usernameContainer = form.createDiv('form-field');
        usernameContainer.createEl('label', { text: 'GitHub username' });
        usernameContainer.createEl('div', { text: 'GitHub username (automatically retrieved after entering token)', cls: 'form-field-desc' });
        this.usernameInput = usernameContainer.createEl('input', {
            type: 'text',
            value: this.account.username || '',
            placeholder: 'Auto fetch',
            attr: { readonly: 'true' }
        });
        this.usernameInput.addClass('form-input-disabled');

        // 个人访问令牌字段
        const tokenContainer = form.createDiv('form-field');
        tokenContainer.createEl('label', { text: 'Personal access token' });
        tokenContainer.createEl('div', { text: 'GitHub personal access token with repo scope permission required', cls: 'form-field-desc' });
        this.tokenInput = tokenContainer.createEl('input', {
            type: 'password',
            value: this.account.token || '',
            placeholder: 'Enter your GitHub personal access token'
        });

        // 添加令牌验证功能
        let validationTimeout: NodeJS.Timeout;
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

        const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
        const saveBtn = buttonContainer.createEl('button', {
            text: 'Save',
            cls: 'mod-cta'
        });

        // 事件处理
        cancelBtn.addEventListener('click', () => {
            this.close();
            this.resolve(null);
        });

        saveBtn.addEventListener('click', () => {
            void this.saveAccount(saveBtn);
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
            new Notice('Please enter personal access token');
            return;
        }

        if (!username) {
            new Notice('Username not auto-fetched, please check if token is correct');
            return;
        }

        try {
            saveBtn.textContent = 'Saving...';
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
            new Notice('Token validation failed, please check if token is correct');
            saveBtn.textContent = 'Save';
            saveBtn.disabled = false;
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}