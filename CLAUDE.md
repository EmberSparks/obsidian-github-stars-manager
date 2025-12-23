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

## Obsidian Plugin Coding Standards

These standards are enforced by ObsidianReviewBot during plugin submission review. All code must comply with these rules to pass the review process.

### 🚫 Required Fixes (Must Fix Before Approval)

#### 1. Console Methods
- **Rule**: Only `console.warn()`, `console.error()`, and `console.debug()` are allowed
- **Forbidden**: `console.log()`, `console.info()`, `console.trace()`
- **Reason**: Prevents console pollution in production
- **Example**:
  ```typescript
  // ❌ Wrong
  console.log('Debug info');

  // ✅ Correct
  console.debug('Debug info');
  ```

#### 2. Type Safety
- **Rule**: Avoid using `any` type
- **Requirement**: Specify explicit types for all variables, parameters, and return values
- **Example**:
  ```typescript
  // ❌ Wrong
  function process(data: any): any {
    return data.value;
  }

  // ✅ Correct
  function process(data: { value: string }): string {
    return data.value;
  }
  ```

#### 3. Promise Handling
- **Rule**: All Promises must be properly handled
- **Options**:
  1. Use `await` in async functions
  2. Add `.catch()` error handler
  3. Add `.then()` with rejection handler
  4. Explicitly mark as ignored with `void` operator
- **Example**:
  ```typescript
  // ❌ Wrong
  async function example() {
    fetchData(); // Floating promise
  }

  // ✅ Correct - Option 1: await
  async function example() {
    await fetchData();
  }

  // ✅ Correct - Option 2: void (for event handlers)
  button.addEventListener('click', () => {
    void fetchData();
  });

  // ✅ Correct - Option 3: catch
  async function example() {
    fetchData().catch(err => console.error(err));
  }
  ```

#### 4. Async/Await Usage
- **Rule**: Only use `async` keyword if the function contains `await` expressions
- **Reason**: Unnecessary async wrappers add overhead
- **Example**:
  ```typescript
  // ❌ Wrong - async without await
  async onOpen(): Promise<void> {
    this.render();
  }

  // ✅ Correct - remove async if no await
  onOpen(): void {
    this.render();
  }
  ```

#### 5. UI Text Standards
- **Rule**: All UI text must use sentence case
- **Rule**: Avoid including plugin name in settings headings
- **Rule**: Don't use the word "settings" in settings tab headings
- **Example**:
  ```typescript
  // ❌ Wrong
  .setName('GitHub Stars Manager Settings')  // Has plugin name + "Settings"
  .setName('SYNC INTERVAL')  // All caps
  .setName('sync interval')  // All lowercase

  // ✅ Correct
  .setName('Sync interval')  // Sentence case, no plugin name
  .setName('Personal access token')
  ```

#### 6. Settings UI Consistency
- **Rule**: Use Obsidian's Setting API for headings
- **Forbidden**: Creating HTML heading elements directly (e.g., `containerEl.createEl('h2')`)
- **Example**:
  ```typescript
  // ❌ Wrong
  containerEl.createEl('h2', { text: 'My Settings' });

  // ✅ Correct
  new Setting(containerEl)
    .setName('My settings')
    .setHeading();
  ```

#### 7. Deprecated Methods
- **Rule**: Don't use deprecated JavaScript methods
- **Examples**:
  - Use `substring()` instead of `substr()`
  - Use modern APIs instead of legacy browser compatibility features
- **Example**:
  ```typescript
  // ❌ Wrong
  const result = text.substr(0, 10);

  // ✅ Correct
  const result = text.substring(0, 10);
  ```

#### 8. Browser APIs
- **Rule**: Avoid native browser confirmation dialogs
- **Forbidden**: `confirm()`, `alert()`, `prompt()`
- **Use Instead**: Obsidian's Modal API
- **Example**:
  ```typescript
  // ❌ Wrong
  if (confirm('Delete this item?')) {
    deleteItem();
  }

  // ✅ Correct
  new ConfirmModal(
    this.app,
    'Are you sure you want to delete this item?',
    () => deleteItem()
  ).open();
  ```

#### 9. Lifecycle Management
- **Rule**: Don't detach leaves in `onunload()`
- **Reason**: This will reset the leaf to its default location
- **Example**:
  ```typescript
  // ❌ Wrong
  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }

  // ✅ Correct
  onunload() {
    // Clean up resources but don't detach leaves
    this.clearTimers();
  }
  ```

#### 10. Network Requests
- **Rule**: Use Obsidian's `requestUrl()` instead of `fetch()`
- **Reason**: Security and compatibility with Obsidian's request handling
- **Example**:
  ```typescript
  // ❌ Wrong
  const response = await fetch('https://api.github.com/user');

  // ✅ Correct
  import { requestUrl } from 'obsidian';
  const response = await requestUrl({
    url: 'https://api.github.com/user',
    method: 'GET',
    headers: { 'Authorization': `token ${token}` }
  });
  ```

#### 11. DOM Manipulation
- **Rule**: Avoid unsafe DOM operations
- **Forbidden**: `innerHTML`, `document.write`, `eval()`
- **Use Instead**: Obsidian's element creation APIs
- **Example**:
  ```typescript
  // ❌ Wrong
  element.innerHTML = `<div>${userInput}</div>`;

  // ✅ Correct
  const div = element.createDiv();
  div.textContent = userInput;
  ```

### ⚠️ Optional Issues (Should Fix)

#### 1. Unused Variables
- Remove unused imports, variables, and parameters
- Prefix intentionally unused variables with underscore: `_error`

#### 2. Code Cleanliness
- Remove unnecessary try/catch wrappers
- Eliminate redundant type assertions
- Clean up commented-out code

### 📝 Best Practices Summary

| Category | Rule | Priority |
|----------|------|----------|
| Console | Only warn/error/debug | Required |
| Types | No `any` types | Required |
| Promises | Must be awaited or handled | Required |
| Async | Remove if no await | Required |
| UI Text | Sentence case, no plugin name | Required |
| Settings | Use Setting API for headings | Required |
| Deprecated | No substr, legacy APIs | Required |
| Browser | No confirm/alert/prompt | Required |
| Lifecycle | No detachLeaves in onunload | Required |
| Network | Use requestUrl not fetch | Required |
| DOM | No innerHTML, eval | Required |
| Cleanup | Remove unused code | Optional |

### 🔍 Review Process

1. **Automated Review**: ObsidianReviewBot scans code automatically
2. **Human Review**: Obsidian team manually reviews after bot approval
3. **Fix Required Issues**: All required issues must be fixed
4. **Address Optional Issues**: Strongly recommended to fix
5. **Resubmit**: Push fixes and wait for re-review

### 🛠️ Development Workflow

1. Write code following standards above
2. Run TypeScript compiler: `npx tsc --noEmit`
3. Build plugin: `npm run build`
4. Test in Obsidian
5. Commit and push to GitHub
6. Submit to plugin store
7. Address review feedback
8. Repeat until approved