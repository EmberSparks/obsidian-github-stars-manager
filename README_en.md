[简体中文 README](README.md)

# GitHub Stars Manager

[![GitHub release](https://img.shields.io/github/release/EmberSparks/obsidian-github-stars-manager.svg)](https://github.com/EmberSparks/obsidian-github-stars-manager/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

This plugin allows you to manage and view your starred GitHub repositories directly within Obsidian, with multi-account support and custom themes.

## Features

- 📋 View all your starred GitHub repositories within Obsidian
- 👥 **Multi-account support**: Add multiple GitHub accounts and sync stars from all accounts simultaneously
- 🏷️ Add custom tags and notes to repositories
- 🔗 Link repositories to Obsidian notes
- 🔄 Automatic or manual synchronization of starred repositories
- 🔍 Search and filter by name, language, tags
- 📊 Sort by starred time, name, language, and more
- 🎨 Multiple theme support: Default theme and Liquid Glass theme
- 🔄 **Account management**: Enable/disable sync for specific accounts individually
- 🌊 **Liquid Glass Theme**: iOS-style frosted glass effect with dynamic backgrounds and shimmer animations
- 📱 Waterfall layout: Instagram-style card display
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

📖 **[View Detailed Usage Guide](USAGE_GUIDE_EN.md)** | [中文指南](USAGE_GUIDE.md)

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
- npm or yarn

### Development Commands

```bash
# Install dependencies
npm install

# Development mode (watch for changes)
npm run dev

# Production build
npm run build

# Version bump
npm run version
```

### Tech Stack

- **TypeScript**: Type-safe JavaScript superset
- **Obsidian API**: Plugin development framework
- **GitHub REST API**: Access GitHub data via @octokit/rest
- **CSS3**: Modern styling and animation effects
- **esbuild**: Fast JavaScript bundler

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

## Changelog

### v0.1.0 (Current Version)
- ✨ Initial release
- 🎯 Multi-account GitHub Stars management
- 🎨 Liquid Glass theme support
- 📱 Responsive waterfall layout
- 🔍 Advanced search and filtering
- 🏷️ Custom tags and notes functionality

## License

MIT License - see [LICENSE](LICENSE) file for details

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Support

If you find this plugin helpful, consider:

- ⭐ Starring the project
- 🐛 Reporting bugs or suggesting improvements
- 💡 Sharing it with other Obsidian users
- 💖 [Sponsor the developer](https://github.com/sponsors/EmberSparks)

## Related Links

- [Obsidian Official Website](https://obsidian.md)
- [GitHub API Documentation](https://docs.github.com/en/rest)
- [Plugin Development Documentation](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
