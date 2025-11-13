import { App, PluginSettingTab, Setting, Notice, Modal } from 'obsidian';
import GithubStarsPlugin from './main'; // Reverted to extensionless import
import { GithubStarsSettings, GithubAccount, PropertyTemplate, DEFAULT_PROPERTIES_TEMPLATE, DEFAULT_EXPORT_OPTIONS } from './types';

// 默认设置
export const DEFAULT_SETTINGS: GithubStarsSettings = {
    githubToken: '',
    accounts: [], // 默认无账号
    autoSync: true,
    syncInterval: 60, // 默认60分钟
    theme: 'default', // 默认主题
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

        containerEl.createEl('h2', { text: 'GitHub Stars Manager 设置' });

        // 多账号管理区域
        this.displayAccountsSection(containerEl);

        // 向后兼容的单一令牌设置（如果没有配置多账号）
        if (this.plugin.settings.accounts.length === 0) {
            new Setting(containerEl)
                .setName('GitHub 个人访问令牌 (PAT)')
                .setDesc('用于访问你的GitHub星标仓库的令牌。需要repo范围权限。建议使用上方的多账号管理功能。')
                .addText(text => text
                    .setPlaceholder('输入你的GitHub PAT')
                    .setValue(this.plugin.settings.githubToken)
                    .onChange(async (value) => {
                        this.plugin.settings.githubToken = value;
                        await this.plugin.saveSettings();
                    })
                );
        }

        // 自动同步设置
        new Setting(containerEl)
            .setName('启用自动同步')
            .setDesc('定期自动同步你的GitHub星标')
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
            .setName('同步间隔（分钟）')
            .setDesc('设置自动同步的时间间隔')
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
            .setName('主题')
            .setDesc('选择插件界面主题')
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

        // 导出功能开关
        new Setting(containerEl)
            .setName('启用导出功能')
            .setDesc('启用后可以将星标仓库导出为Markdown文件')
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
            .setName('立即同步')
            .setDesc('立即从GitHub获取你的星标仓库')
            .addButton(button => button
                .setButtonText('同步')
                .setCta()
                .onClick(async () => {
                    button.setDisabled(true);
                    button.setButtonText('同步中...');
                    
                    try {
                        await this.plugin.syncStars();
                        button.setButtonText('同步成功');
                        setTimeout(() => {
                            button.setButtonText('同步');
                            button.setDisabled(false);
                        }, 2000);
                    } catch (error) {
                        button.setButtonText('同步失败');
                        new Notice('同步失败，请检查网络连接或令牌设置', 5000);
                        setTimeout(() => {
                            button.setButtonText('同步');
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
        containerEl.createEl('h3', { text: 'GitHub 账号管理' });
        
        // 添加账号按钮
        new Setting(containerEl)
            .setName('添加 GitHub 账号')
            .setDesc('添加新的 GitHub 账号以同步多个账号的星标仓库')
            .addButton(button => button
                .setButtonText('添加账号')
                .setCta()
                .onClick(() => {
                    this.showAddAccountModal();
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
                text: '暂无配置的 GitHub 账号。点击上方按钮添加账号。',
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
            toggle.addEventListener('change', async () => {
                account.enabled = toggle.checked;
                await this.plugin.saveSettings();
                new Notice(`账号 ${account.username} ${account.enabled ? '已启用' : '已禁用'}`);
            });
            statusEl.createEl('label', { 
                text: account.enabled ? '已启用' : '已禁用',
                cls: account.enabled ? 'enabled' : 'disabled'
            });
            
            // 操作按钮
            const actionsEl = accountEl.createDiv('github-account-actions');
            
            // 编辑按钮
            const editBtn = actionsEl.createEl('button', {
                text: '编辑',
                cls: 'github-account-btn edit'
            });
            editBtn.addEventListener('click', () => {
                this.showEditAccountModal(account, index);
            });
            
            // 删除按钮
            const deleteBtn = actionsEl.createEl('button', {
                text: '删除',
                cls: 'github-account-btn delete'
            });
            deleteBtn.addEventListener('click', async () => {
                if (confirm(`确定要删除账号 ${account.username} 吗？`)) {
                    this.plugin.settings.accounts.splice(index, 1);
                    await this.plugin.saveSettings();
                    this.displayAccountsList(container);
                    new Notice(`已删除账号 ${account.username}`);
                }
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

        const result = await this.showAccountModal('添加 GitHub 账号', account);
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
            new Notice(`已添加账号 ${newAccount.username}`);
        }
    }

    /**
     * 显示编辑账号模态框
     */
    private async showEditAccountModal(account: GithubAccount, index: number): Promise<void> {
        const result = await this.showAccountModal('编辑 GitHub 账号', account);
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
            new Notice(`已更新账号 ${result.username}`);
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
        }) as HTMLInputElement;
        
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
        containerEl.createEl('h3', { text: 'Properties 模板配置' });
        
        // 说明文字
        const descEl = containerEl.createDiv('setting-item-description description-margin');
        const p = descEl.createEl('p');
        p.textContent = '配置导出Markdown文件时的Properties（笔记属性）模板。支持以下变量：';
        
        const ul = descEl.createEl('ul', { cls: 'setting-item-description-list' });
        
        const variables = [
            { code: '{{full_name}}', desc: '仓库完整名称' },
            { code: '{{name}}', desc: '仓库名称' },
            { code: '{{owner.login}}', desc: '仓库作者' },
            { code: '{{html_url}}', desc: '仓库链接' },
            { code: '{{description}}', desc: '仓库描述' },
            { code: '{{created_at}}', desc: '创建时间' },
            { code: '{{starred_at}}', desc: '加星时间' },
            { code: '{{topics}}', desc: '主题标签' },
            { code: '{{stargazers_count}}', desc: 'Star数量' },
            { code: '{{language}}', desc: '主要语言' }
        ];
        
        variables.forEach(variable => {
            const li = ul.createEl('li');
            const code = li.createEl('code');
            code.textContent = variable.code;
            li.appendText(' - ' + variable.desc);
        });

        // 启用Properties开关
        new Setting(containerEl)
            .setName('启用 Properties')
            .setDesc('在导出的Markdown文件开头添加Properties（YAML前置内容）')
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
                .setName('添加新属性')
                .setDesc('添加自定义的Properties属性')
                .addButton(button => button
                    .setButtonText('添加属性')
                    .setCta()
                    .onClick(() => {
                        this.addNewProperty();
                    })
                );

            // 重置为默认模板按钮
            new Setting(containerEl)
                .setName('重置模板')
                .setDesc('恢复为默认的Properties模板配置')
                .addButton(button => button
                    .setButtonText('重置为默认')
                    .setWarning()
                    .onClick(async () => {
                        this.plugin.settings.propertiesTemplate = [...DEFAULT_PROPERTIES_TEMPLATE];
                        await this.plugin.saveSettings();
                        this.display();
                        new Notice('已重置为默认Properties模板');
                    })
                );
        }
    }

    /**
     * 创建单个属性设置项
     */
    private createPropertySetting(containerEl: HTMLElement, property: PropertyTemplate, index: number): void {
        const setting = new Setting(containerEl)
            .setName(`${property.key} (${property.description})`)
            .setDesc(`类型: ${property.type} | 值: ${property.value}`)
            .addToggle(toggle => toggle
                .setValue(property.enabled)
                .onChange(async (value) => {
                    // 更新属性的启用状态
                    this.plugin.settings.propertiesTemplate[index].enabled = value;
                    await this.plugin.saveSettings();
                    new Notice(`属性 ${property.key} ${value ? '已启用' : '已禁用'}`);
                })
            )
            .addButton(button => button
                .setButtonText('编辑')
                .onClick(() => {
                    this.editProperty(index);
                })
            )
            .addButton(button => button
                .setButtonText('删除')
                .setWarning()
                .onClick(async () => {
                    if (confirm(`确定要删除属性 ${property.key} 吗？`)) {
                        this.plugin.settings.propertiesTemplate.splice(index, 1);
                        await this.plugin.saveSettings();
                        this.display();
                        new Notice(`已删除属性 ${property.key}`);
                    }
                    this.display();
                    new Notice(`已删除属性 ${property.key}`);
                })
            );
    }

    /**
     * 添加新属性（暂时禁用）
     */
    private async addNewProperty(): Promise<void> {
        new Notice('Properties模板编辑功能即将推出');
    }

    /**
     * 编辑属性（暂时禁用）
     */
    private async editProperty(index: number): Promise<void> {
        new Notice('Properties模板编辑功能即将推出');
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
        nameContainer.createEl('label', { text: '账号名称' });
        nameContainer.createEl('div', { text: '为此账号设置一个显示名称', cls: 'form-field-desc' });
        this.nameInput = nameContainer.createEl('input', {
            type: 'text',
            value: this.account.name || '',
            placeholder: '输入账号名称'
        });

        // GitHub用户名字段
        const usernameContainer = form.createDiv('form-field');
        usernameContainer.createEl('label', { text: 'GitHub 用户名' });
        usernameContainer.createEl('div', { text: 'GitHub 用户名（输入令牌后自动获取）', cls: 'form-field-desc' });
        this.usernameInput = usernameContainer.createEl('input', {
            type: 'text',
            value: this.account.username || '',
            placeholder: '自动获取',
            attr: { readonly: 'true' }
        });
        this.usernameInput.addClass('form-input-disabled');

        // 个人访问令牌字段
        const tokenContainer = form.createDiv('form-field');
        tokenContainer.createEl('label', { text: '个人访问令牌 (PAT)' });
        tokenContainer.createEl('div', { text: '需要 repo 范围权限的 GitHub PAT', cls: 'form-field-desc' });
        this.tokenInput = tokenContainer.createEl('input', {
            type: 'password',
            value: this.account.token || '',
            placeholder: '输入你的GitHub PAT'
        });

        // 添加令牌验证功能
        let validationTimeout: NodeJS.Timeout;
        this.tokenInput.addEventListener('input', () => {
            clearTimeout(validationTimeout);
            const token = this.tokenInput.value.trim();
            
            if (token.length > 10) {
                validationTimeout = setTimeout(async () => {
                    try {
                        const response = await (this.app as any).requestUrl({
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
                    } catch (error) {
                        this.tokenInput.addClass('border-color-error');
                        this.usernameInput.value = '';
                    }
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

        const cancelBtn = buttonContainer.createEl('button', { text: '取消' });
        const saveBtn = buttonContainer.createEl('button', { 
            text: '保存',
            cls: 'mod-cta'
        });

        // 事件处理
        cancelBtn.addEventListener('click', () => {
            this.close();
            this.resolve(null);
        });

        saveBtn.addEventListener('click', async () => {
            await this.saveAccount(saveBtn);
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
            new Notice('请填写个人访问令牌');
            return;
        }

        if (!username) {
            new Notice('用户名未自动获取，请检查令牌是否正确');
            return;
        }

        try {
            saveBtn.textContent = '保存中...';
            saveBtn.disabled = true;

            const response = await (this.app as any).requestUrl({
                url: 'https://api.github.com/user',
                method: 'GET',
                headers: {
                    'Authorization': `token ${token}`,
                    'User-Agent': 'Obsidian-GitHub-Stars-Manager'
                }
            });

            if (response.status !== 200) {
                throw new Error('令牌验证失败');
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
            new Notice('令牌验证失败，请检查令牌是否正确');
            saveBtn.textContent = '保存';
            saveBtn.disabled = false;
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}