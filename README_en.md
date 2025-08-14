[简体中文 README](README.md)

# Obsidian GitHub Stars Manager

This plugin allows you to manage and view your starred GitHub repositories directly within Obsidian.

## Features

- 📋 View all your starred GitHub repositories within Obsidian
- 🏷️ Add custom tags and notes to repositories
- 🔗 Link repositories to Obsidian notes
- 🔄 Automatic or manual synchronization of starred repositories
- 🔍 Search and filter by name, language, tags
- 📊 Sort by starred time, name, language, and more
- 🎨 Multiple theme support: Default theme and iOS Glass theme
- 🌊 **iOS Glass Theme**: iOS-style frosted glass effect with dynamic backgrounds and shimmer animations
- 📱 Waterfall layout: Xiaohongshu-style card display
- ✨ Responsive design that integrates seamlessly with Obsidian themes

## Configuration

To use this plugin, you need to provide a GitHub Personal Access Token (PAT) with the necessary permissions to read your starred repositories.

**How to get a GitHub Personal Access Token (PAT):**

1.  **Login to GitHub:** Visit [github.com](https://github.com) and log in to your account.
2.  **Access Settings:** Click your profile picture in the top-right corner, then select "Settings".
3.  **Developer Settings:** In the left sidebar, scroll down and click "Developer settings".
4.  **Personal Access Tokens:** In the left sidebar, select "Personal access tokens", then choose "Tokens (classic)". *(Note: Please select Classic Token, as Fine-grained tokens might require more complex permission setup).*
5.  **Generate New Token:** Click the "Generate new token" button, then select "Generate new token (classic)".
6.  **Token Description:** In the "Note" field, give your token a descriptive name, e.g., "Obsidian Stars Manager".
7.  **Set Expiration:** Choose an appropriate expiration duration. For security, "No expiration" is not recommended.
8.  **Select Scopes:** This is crucial. You need to grant permission to access your repositories. Check the top-level `repo` scope checkbox. This automatically selects all necessary sub-permissions for the plugin to read your starred repositories.
9.  **Generate Token:** Click the "Generate token" button at the bottom of the page.
10. **Copy Token:** **Important!** GitHub will only show the full token once. Click the copy icon immediately to copy it and store it securely. **You won't be able to see the full token again after leaving this page.**
11. **Use in Plugin:** Paste the copied token into the "GitHub Personal Access Token (PAT)" field in the "GitHub Stars Manager" settings tab within Obsidian.

## Usage

1. After installing and enabling the plugin, a GitHub star icon will appear in the left panel
2. Click the icon to open the starred repositories view
3. Configure your GitHub PAT in the plugin settings on first use
4. Click the "Sync" button to fetch your starred repositories
5. You can add personal notes, tags, or link repositories to existing Obsidian notes

### Theme Switching

The plugin provides two visual themes:

- **Default Theme**: Clean card layout that maintains consistency with Obsidian's native themes
- **iOS Glass Theme**: iOS-style frosted glass effect with the following features:
  - 🌈 Colorful gradient backgrounds for better visual contrast
  - ✨ Dynamic floating animation background effects
  - 🔍 Enhanced frosted glass blur effects
  - 💫 Shimmer sweep animation on card hover
  - 📱 Waterfall layout similar to Xiaohongshu's card display
  - 🎯 Optimized font rendering to avoid blur issues on hover

You can quickly switch themes using the theme button at the top of the plugin interface.

## Installation

### From Obsidian Community Plugins (Recommended)

1. Open Obsidian Settings
2. Go to "Community plugins" tab
3. Search for "GitHub Stars Manager"
4. Click Install and enable the plugin

### Manual Installation

1. Download the latest `main.js`, `manifest.json`, and `styles.css`
2. Copy these files to your vault: `VaultFolder/.obsidian/plugins/obsidian-github-stars-manager/`
3. Restart Obsidian
4. Enable the plugin in settings

## Development

### Requirements

- Node.js 16+
- npm

### Development Commands

```bash
# Install dependencies
npm install

# Development mode (watch for changes)
npm run dev

# Production build
npm run build

# Code linting
npm run lint

# Version bump
npm run version
```

### Project Structure

```
├── src/
│   ├── main.ts          # Main plugin class
│   ├── view.ts          # Starred repositories view
│   ├── settings.ts      # Plugin settings
│   ├── modal.ts         # Edit modal dialogs
│   ├── githubService.ts # GitHub API service
│   └── types.ts         # TypeScript type definitions
├── main.ts              # Plugin entry point
├── manifest.json        # Plugin manifest
├── styles.css          # Stylesheet
└── README.md           # Documentation
```

## License

MIT

## Contributing

Issues and Pull Requests are welcome!

## Support

If you find this plugin helpful, consider:

- ⭐ Starring the project
- 🐛 Reporting bugs or suggesting improvements
- 💡 Sharing it with other Obsidian users
