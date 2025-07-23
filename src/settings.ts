import { App, PluginSettingTab, Setting } from 'obsidian';
import GithubStarsPlugin from './main'; // Reverted to extensionless import
import { GithubStarsSettings } from './types';

// 默认设置
export const DEFAULT_SETTINGS: GithubStarsSettings = {
    githubToken: '',
    autoSync: true,
    syncInterval: 60, // 默认60分钟
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

        // GitHub 令牌设置
        new Setting(containerEl)
            .setName('GitHub 个人访问令牌 (PAT)')
            .setDesc('用于访问你的GitHub星标仓库的令牌。需要repo范围权限。')
            .addText(text => text
                .setPlaceholder('输入你的GitHub PAT')
                .setValue(this.plugin.settings.githubToken)
                .onChange(async (value) => {
                    this.plugin.settings.githubToken = value;
                    await this.plugin.saveSettings();
                })
            );

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
                        console.error('同步失败:', error);
                        setTimeout(() => {
                            button.setButtonText('同步');
                            button.setDisabled(false);
                        }, 2000);
                    }
                })
            );
    }
}