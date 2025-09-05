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