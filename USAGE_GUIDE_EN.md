# GitHub Stars Manager Usage Guide

## Table of Contents

- [Quick Start](#quick-start)
- [Feature Overview](#feature-overview)
- [Advanced Usage](#advanced-usage)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

## Quick Start

### First Time Setup

1. **Install Plugin**
   - Search for "GitHub Stars Manager" in Obsidian Community Plugins
   - Click Install and Enable

2. **Configure GitHub Access Token**
   ```
   Settings → Community Plugins → GitHub Stars Manager → GitHub Personal Access Token (PAT)
   ```
   - Visit [GitHub Settings](https://github.com/settings/tokens)
   - Create new Classic Token
   - Check `repo` permission
   - Copy token to plugin settings

3. **Open Plugin View**
   - Click 🌟 icon in left sidebar
   - Or use Command Palette: "GitHub Stars Manager"

4. **Initial Sync**
   - Click "Sync" button in toolbar
   - Wait for repository data to load

## Feature Overview

### 🔍 Search & Filtering

#### Search Box Features
- **Real-time Search**: Filter repositories as you type
- **Multi-field Matching**: Search repository name, description, language
- **Clear Button**: Hover over search box to show × button for quick clearing

```
Search Examples:
- "react" - Find repositories containing react
- "python machine learning" - Find Python ML projects  
- "typescript" - Find TypeScript projects
```

#### Tag Filtering
- **Click Tags**: Activate tag filter to show only repositories with that tag
- **Multi-tag Filtering**: Select multiple tags simultaneously
- **Tag Highlighting**: Matching tags are highlighted during search
- **Clear Filters**: Click "Clear All" button to remove all tag filters

### 📊 Sorting Options

Toolbar provides four sorting methods:

| Icon | Sort Method | Description |
|------|-------------|-------------|
| 📅 | Recently Added | Sort by starred date (newest first) |
| ⭐ | Star Count | Sort by star count (most stars first) |
| 🍴 | Fork Count | Sort by fork count (most forks first) |
| 🔤 | Alphabetical | Sort by repository name |

**Sort Direction**: Click the active sort button to toggle ascending/descending order

### 🏷️ Tag Management

#### Adding Tags
1. Click "Edit" button on repository card
2. Enter tag names in "Tags" field
3. Separate multiple tags with commas: `frontend, react, typescript`
4. Click "Save"

#### Automatic Tag Coloring
Plugin automatically assigns colors to tags with 12 preset colors:
- Blue, Pink, Cyan, Green, Orange, Purple
- Red, Orange-red, Lime, Sky-blue, Violet, Rose

#### Using Existing Tags
When editing repositories, "Existing Tags" list is shown for quick adding:
```
Existing Tags Example:
[frontend] [backend] [mobile] [ai/ml] [tool] [library]
```

### 📝 Notes Feature

#### Adding Repository Notes
1. Add personal notes in "Notes" field in edit dialog
2. Supports Markdown format
3. Can record:
   - Usage experience
   - Key features
   - Personal rating
   - Learning plan

#### Linking Obsidian Notes
1. Click "Link Note" button
2. Search and select existing note file
3. Creates bidirectional link:
   - Repository card shows linked note
   - Note can jump back to repository

### 🎨 Theme System

#### Default Theme
- Clean card layout
- Consistent with Obsidian native themes
- Responsive design
- Masonry layout

#### Liquid Glass Theme
iOS-style visual experience:

**Visual Effects**
- 🌈 Colorful gradient background
- ✨ Dynamic floating animation
- 🔍 Glass blur effects
- 💫 Card hover shimmer animation

**Interaction Optimization**
- Smooth transition animations
- Enhanced button feedback
- Improved visual hierarchy

**Switching Method**
- Click theme toggle button in toolbar
- Real-time switching, no restart required

### 👥 Multi-Account Management

#### Adding New Account
1. Click "Account" dropdown in toolbar
2. Click "Add Account" button
3. Enter account information:
   - Display name (custom)
   - GitHub username
   - Personal access token

#### Account Management
- **Enable/Disable**: Use toggle switch to control account sync
- **Edit Info**: Modify display name or update token
- **Delete Account**: Remove accounts no longer needed

#### Account Status Display
- Avatar and username
- Last sync time
- Enable/disable status

### 📤 Export Features

#### Export Options
Support multiple formats for exporting starred repositories:
- **JSON**: Complete data export
- **CSV**: Table format for analysis
- **Markdown**: Document format for sharing
- **Plain Text**: Simple list format

#### Export Steps
1. Click "Export" button in toolbar
2. Select repositories to export (supports select all)
3. Choose export format
4. Click "Confirm Export"

#### Export Content
Includes the following information:
- Repository basic info (name, description, URL)
- Statistics (star count, fork count)
- Personal data (tags, notes)
- Time information (created time, updated time)

## Advanced Usage

### 🔄 Sync Strategy

#### Auto Sync
- Automatically sync on plugin startup
- Can be disabled in settings

#### Manual Sync
- Click "Sync" button for immediate update
- Supports parallel multi-account sync
- Shows sync progress and status

#### Incremental Sync
- Only sync changed repositories
- Preserve local tags and notes
- Improve sync efficiency

### 🎯 Advanced Search

#### Search Tips
```
Search Syntax Examples:
- Exact match: Use quotes "exact match"
- Exclude content: Use minus -unwanted
- Language search: language:python
- Combined search: react typescript -vue
```

#### Filter Combinations
- Search + tag filtering work together
- Sort + filter results are linked
- Real-time preview of filtered result count

### 📊 Data Management

#### Data Storage
- Locally stored in Obsidian configuration files
- Supports cross-device sync (via Obsidian Sync)
- Data format: JSON

#### Data Backup
Regular backup recommended:
```
Path: .obsidian/plugins/github-stars-manager/data.json
```

#### Data Migration
- Export all data as JSON
- Import configuration in new environment
- Maintain tag and note integrity

## Troubleshooting

### ❓ Token Issues

**Q: Token invalid error?**
A: Check the following:
- Token copied completely
- `repo` permission selected
- Token not expired
- Using Classic Token (not Fine-grained)

**Q: Sync failed?**
A: Possible causes:
- Network connection issues
- GitHub API limits
- Insufficient token permissions
- Too many repositories

### 🔧 Interface Issues

**Q: Repository cards not displaying properly?**
A: Try these solutions:
- Resize Obsidian window
- Switch themes to check effect
- Ensure plugin is latest version

**Q: Search results inaccurate?**
A: Search scope includes:
- Repository name
- Repository description
- Primary language
- Custom tags

### 💾 Data Issues

**Q: Tags lost?**
A: Possible causes:
- Accidental deletion
- Overwrite during sync
- Data file corruption

Solutions:
- Restore from backup
- Re-add tags
- Export existing data for backup

**Q: Repository count incorrect after sync?**
A: Check:
- Private repositories (need additional permissions)
- Token has sufficient permissions
- Multi-account enabled

## Best Practices

### 🏷️ Tag Naming Suggestions

#### By Technology
```
Frontend: frontend, react, vue, angular
Backend: backend, nodejs, python, java
Mobile: mobile, ios, android, flutter
```

#### By Purpose
```
Tools: tool, utility, cli, devtool
Learning: learning, tutorial, example
Work: work, project, production
Personal: personal, hobby, experiment
```

#### By Status
```
Status: active, archived, todo, done
Priority: high, medium, low
Quality: excellent, good, average
```

### 📋 Repository Management Tips

#### Regular Cleanup
- Monthly cleanup of uninteresting repositories
- Update tag categories
- Improve repository notes

#### Note Taking
Recommended to record:
- **First Impression**: Why you starred this project
- **Core Features**: Main characteristics of the project
- **Use Cases**: When you would use it
- **Learning Value**: What technologies you can learn
- **Related Projects**: Similar alternatives

#### Export Backup
- Export complete data monthly
- Export different tagged repositories by category
- Regularly check backup file integrity

### 🎯 Workflow Suggestions

#### Daily Usage
1. Check newly starred repositories in the morning
2. Add appropriate tags to new repositories
3. Record notes for important repositories
4. Regularly organize and clean up unused repositories

#### Learning Plans
1. Use "learning" tag for learning resources
2. Organize by technology stack
3. Create learning plans and track progress
4. Link to learning notes

#### Project Management
1. Create specific tags for work projects
2. Record used open source libraries and tools
3. Build technology stack knowledge base
4. Share excellent projects with team

---

🎉 **Congratulations!** You now master all features of GitHub Stars Manager. Start enjoying better starred repository management!

Have other questions? Feel free to ask in [GitHub Issues](https://github.com/EmberSparks/obsidian-github-stars-manager/issues).