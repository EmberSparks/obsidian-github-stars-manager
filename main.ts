import { Plugin, Notice } from 'obsidian';

// Minimal settings interface (can be empty if not needed initially)
interface MyPluginSettings {
  // Add settings properties here later
}

// Minimal default settings
const DEFAULT_SETTINGS: Partial<MyPluginSettings> = {
  // Add default values here later
};

export default class MyPlugin extends Plugin {
  settings: MyPluginSettings;

  async onload() {
    console.log('Loading GitHub Stars Manager plugin...'); // Log to console
    await this.loadSettings();
    new Notice('GitHub Stars Manager: Minimal load successful!'); // Simple notice
    console.log('GitHub Stars Manager plugin loaded successfully.');
  }

  onunload() {
    console.log('Unloading GitHub Stars Manager plugin.');
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
