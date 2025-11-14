# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Obsidian plugin for managing GitHub starred repositories. The plugin allows users to view, organize, sort, and export their GitHub stars directly within Obsidian.

## Key Commands

### Development
- `npm run dev` - Start development build with watch mode
- `npm run build` - Build for production
- `npx tsc` - Run TypeScript compiler for type checking

### Deployment (Windows-specific)
- `deploy.bat` - Deploy to Obsidian vault (requires VAULT_PATH environment variable)
- `setup-env.bat` - Set up environment variables for deployment

## Core Architecture

### Main Plugin Structure
- **Main Plugin Class** (`src/main.ts`): Extends Obsidian's Plugin class, handles initialization, settings, and UI registration
- **GitHub Service** (`src/githubService.ts`): Core service for GitHub API interactions, handles authentication and repository fetching
- **View Component** (`src/view.ts`): Main UI view extending ItemView, handles repository display and user interactions
- **Modal Components** (`src/modal.ts`, `src/exportModal.ts`): Handle user interactions for settings and export functionality
- **Export Service** (`src/exportService.ts`): Handles various export formats (JSON, CSV, Markdown, etc.)

### Key Data Flow
1. Plugin initializes and loads settings
2. GitHub service authenticates using personal access token
3. View fetches and displays starred repositories
4. Users can sort, filter, and export data through modal interfaces
5. Export service transforms repository data into various formats

### Settings Management
The plugin uses Obsidian's settings system with the following key configurations:
- GitHub personal access token (stored securely)
- Theme preferences (light/dark/auto)
- Export preferences and formats

### Theme System
- Custom CSS theming with support for light/dark modes
- Theme files: `styles.css`, `themes.css`
- Emoji support utility (`src/emojiUtils.ts`)

### Development Principles
1. **多主题兼容性 (Multi-theme Compatibility)**: 所有对功能的修改都需要适配不同主题，且操作逻辑要相同 (All functionality modifications must be adapted to different themes with identical operation logic)
2. **自动构建部署 (Auto Build & Deploy)**: 添加或者修改功能后自动重新编译，并部署到本地插件目录 (After adding or modifying functionality, automatically recompile and deploy to local plugin directory):
   ```bash
   npm run build && cp main.js manifest.json styles.css themes.css "/mnt/e/cai的黑曜石/.obsidian/plugins/github-stars-manager/"
   ```
3. **代码安全 (Code Security)**: 遵循Obsidian插件商店安全要求，使用requestUrl替代fetch，避免innerHTML等不安全操作 (Follow Obsidian plugin store security requirements, use requestUrl instead of fetch, avoid unsafe operations like innerHTML)
4. **类型安全 (Type Safety)**: 使用严格的TypeScript类型定义，避免any类型，确保代码可维护性 (Use strict TypeScript type definitions, avoid any types, ensure code maintainability)

### Important Technical Notes
- Uses esbuild for bundling (`esbuild.config.mjs`)
- TypeScript configuration optimized for Obsidian plugin development
- GitHub API integration requires proper token management
- Export functionality supports multiple formats: JSON, CSV, Markdown, TXT
- All UI components follow Obsidian's design patterns and accessibility guidelines

### Environment Setup
The plugin requires:
- GITHUB_TOKEN environment variable for GitHub API access
- VAULT_PATH environment variable for deployment (Windows)
- Proper Obsidian plugin development environment