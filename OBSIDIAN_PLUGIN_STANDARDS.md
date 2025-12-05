# Obsidian Plugin Development Standards

这是基于 Obsidian 官方插件商店审核反馈总结的开发规范。所有对代码的修改都必须遵守这些规范。

## 1. 代码质量规范 (Code Quality Standards)

### 1.1 Console 方法限制
**规则**: 只允许使用 `console.warn()`, `console.error()`, 和 `console.debug()`

**禁止**: `console.log()`, `console.info()`, `console.trace()`

**原因**: 避免在生产环境中污染控制台

```typescript
// ❌ 错误
console.log('Debug info');
console.info('Information');

// ✅ 正确
console.debug('Debug info');
console.warn('Warning message');
console.error('Error occurred');
```

### 1.2 类型安全
**规则**: 避免使用 `any` 类型，为所有变量、参数和返回值指定明确的类型

```typescript
// ❌ 错误
function process(data: any): any {
    return data.value;
}

// ✅ 正确 - 使用具体类型
function process(data: { value: string }): string {
    return data.value;
}

// ✅ 正确 - 必须使用动态类型时，使用 unknown + 类型守卫
function process(data: unknown): string {
    if (typeof data === 'object' && data !== null && 'value' in data) {
        return (data as { value: string }).value;
    }
    return '';
}
```

**特殊说明**: 如果确实需要动态类型，使用 `unknown` 类型并配合类型守卫，不要使用 `eslint-disable` 注释

### 1.3 Promise 处理
**规则**: 所有 Promise 必须被正确处理

处理方式：
1. 在 async 函数中使用 `await`
2. 添加 `.catch()` 错误处理器
3. 添加 `.then()` 和 rejection 处理器
4. 使用 `void` 操作符显式标记为忽略

```typescript
// ❌ 错误 - 浮动的 Promise
async function example() {
    fetchData(); // 未处理的 Promise
}

// ✅ 正确 - 使用 await
async function example() {
    await fetchData();
}

// ✅ 正确 - 使用 void（适用于事件处理器）
button.addEventListener('click', () => {
    void fetchData();
});

// ✅ 正确 - 使用 catch
async function example() {
    fetchData().catch(err => console.error(err));
}
```

### 1.4 Async/Await 使用
**规则**: 只有在函数包含 `await` 表达式时才使用 `async` 关键字

```typescript
// ❌ 错误 - 不必要的 async
async onOpen(): Promise<void> {
    this.render();
}

// ✅ 正确 - 移除不必要的 async
onOpen(): void {
    this.render();
}
```

### 1.5 TypeScript 注解禁用
**规则**: 避免使用 `eslint-disable` 或 `@ts-ignore` 等禁用类型检查的注释

```typescript
// ❌ 错误
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let value: any = data;

// @ts-ignore
value.property = 'test';

// ✅ 正确 - 使用适当的类型
let value: unknown = data;
if (typeof value === 'object' && value !== null) {
    (value as Record<string, string>).property = 'test';
}
```

## 2. UI 文本规范 (UI Text Standards)

### 2.1 句式大小写 (Sentence Case)
**规则**: 所有 UI 文本必须使用句式大小写（首字母大写，其余小写，专有名词除外）

```typescript
// ❌ 错误
.setName('SYNC INTERVAL')      // 全部大写
.setName('sync interval')       // 全部小写
.setName('Sync Interval')       // 标题式大小写

// ✅ 正确
.setName('Sync interval')       // 句式大小写
.setName('Personal access token')
.setName('GitHub username')     // GitHub 是专有名词
```

### 2.2 设置标题规范
**规则**:
- 不要在设置标题中包含插件名称
- 不要在设置标签标题中使用"settings"一词

```typescript
// ❌ 错误
.setName('GitHub Stars Manager Settings')  // 包含插件名 + "Settings"
.setName('Plugin Settings')                // 包含 "Settings"

// ✅ 正确
.setName('Sync interval')
.setName('Personal access token')
```

### 2.3 设置 UI 一致性
**规则**: 使用 Obsidian 的 Setting API 创建标题，不要直接创建 HTML 标题元素

```typescript
// ❌ 错误
containerEl.createEl('h2', { text: 'My Settings' });

// ✅ 正确
new Setting(containerEl)
    .setName('My settings')
    .setHeading();
```

### 2.4 占位符文本
**规则**: 占位符文本也必须使用句式大小写，使用有意义的示例

```typescript
// ❌ 错误
placeholder: 'React TypeScript Learning'  // 标题式大小写

// ✅ 正确
placeholder: 'web development, api, tutorial'  // 句式大小写
```

## 3. 命名和文档规范 (Naming and Documentation)

### 3.1 项目命名
**规则**: 不要在项目名称中使用"Obsidian"前缀（该前缀为第一方产品保留）

```markdown
<!-- ❌ 错误 -->
# Obsidian GitHub Stars Manager

<!-- ✅ 正确 -->
# GitHub Stars Manager
```

### 3.2 Manifest 描述
**规则**: 在 manifest.json 的描述中不要包含"in Obsidian"或类似短语

```json
// ❌ 错误
{
    "description": "Manage your GitHub starred repositories in Obsidian"
}

// ✅ 正确
{
    "description": "Manage your GitHub starred repositories"
}
```

### 3.3 版权信息
**规则**: 确保 LICENSE 文件中的版权信息正确，包含实际作者和当前年份

```
// ✅ 正确
MIT License

Copyright (c) 2025 YourName

Permission is hereby granted...
```

## 4. API 使用规范 (API Usage)

### 4.1 网络请求
**规则**: 使用 Obsidian 的 `requestUrl()` 而不是原生的 `fetch()`

**原因**: 安全性和与 Obsidian 请求处理的兼容性

```typescript
// ❌ 错误
const response = await fetch('https://api.github.com/user');

// ✅ 正确
import { requestUrl } from 'obsidian';
const response = await requestUrl({
    url: 'https://api.github.com/user',
    method: 'GET',
    headers: { 'Authorization': `token ${token}` }
});
```

### 4.2 浏览器 API
**规则**: 避免使用原生浏览器确认对话框，使用 Obsidian 的 Modal API

**禁止**: `confirm()`, `alert()`, `prompt()`

```typescript
// ❌ 错误
if (confirm('Delete this item?')) {
    deleteItem();
}

// ✅ 正确
new ConfirmModal(
    this.app,
    'Are you sure you want to delete this item?',
    () => deleteItem()
).open();
```

### 4.3 DOM 操作安全
**规则**: 避免不安全的 DOM 操作

**禁止**: `innerHTML`, `document.write`, `eval()`

```typescript
// ❌ 错误
element.innerHTML = `<div>${userInput}</div>`;

// ✅ 正确
const div = element.createDiv();
div.textContent = userInput;
```

### 4.4 已弃用的方法
**规则**: 不要使用已弃用的 JavaScript 方法

```typescript
// ❌ 错误
const result = text.substr(0, 10);

// ✅ 正确
const result = text.substring(0, 10);
```

## 5. 生命周期管理 (Lifecycle Management)

### 5.1 插件卸载
**规则**: 不要在 `onunload()` 中 detach leaves

**原因**: 这会将 leaf 重置到默认位置

```typescript
// ❌ 错误
onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
}

// ✅ 正确
onunload() {
    // 清理资源但不 detach leaves
    this.clearTimers();
}
```

## 6. CSS 规范 (CSS Standards)

### 6.1 CSS 选择器
**规则**: 避免使用脆弱的 CSS 选择器（如 nth-child），为需要样式的元素添加特定的类名或 ID

```css
/* ❌ 错误 - 脆弱的选择器 */
.setting-item:nth-child(4) input {
    color: red;
}

/* ✅ 正确 - 使用特定的类名 */
.github-stars-token-input {
    color: red;
}
```

```typescript
// 在代码中添加特定的类名
const input = containerEl.createEl('input', {
    cls: 'github-stars-token-input'
});
```

## 7. 国际化规范 (Internationalization)

### 7.1 语言一致性
**规则**:
- 实现 i18n 系统以支持多语言，或
- 保持单一语言（推荐英语）

**不允许**: 在代码中混合使用多种语言的硬编码字符串

```typescript
// ❌ 错误 - 混合中英文
new Notice('同步 GitHub stars...');
button.textContent = 'Sync';

// ✅ 正确 - 使用 i18n
new Notice(t('sync.syncing'));
button.textContent = t('sync.button');
```

### 7.2 i18n 实现建议
如果实现 i18n 系统：
- 使用键值对存储翻译
- 支持变量替换
- 提供语言切换功能
- 确保所有 UI 文本都可翻译

```typescript
// i18n 系统示例
export const translations = {
    en: {
        sync: {
            syncing: 'Syncing GitHub stars...',
            success: 'Sync completed with {count} repositories'
        }
    },
    zh: {
        sync: {
            syncing: '正在同步 GitHub 星标...',
            success: '同步完成，共 {count} 个仓库'
        }
    }
};
```

## 8. 安全规范 (Security Standards)

### 8.1 敏感数据处理
**规则**: 不要提交包含敏感信息的文件（.env, credentials.json 等）

```gitignore
# .gitignore
.env
.env.local
credentials.json
secrets.json
*.key
*.pem
```

### 8.2 用户输入验证
**规则**: 始终验证和清理用户输入，特别是在以下情况：
- 插入到 DOM 之前
- 用于网络请求之前
- 存储到文件系统之前

```typescript
// ✅ 正确 - 验证和清理输入
function saveUsername(input: string) {
    const username = input.trim();
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
        throw new Error('Invalid username format');
    }
    // 继续处理...
}
```

## 9. 错误处理规范 (Error Handling)

### 9.1 错误信息
**规则**: 提供清晰、有用的错误消息，避免暴露敏感信息

```typescript
// ❌ 错误 - 暴露内部细节
catch (error) {
    new Notice(`Error: ${error.stack}`);
}

// ✅ 正确 - 用户友好的错误消息
catch (error) {
    console.error('Detailed error:', error);
    new Notice('Failed to sync. Please check your settings and try again.');
}
```

### 9.2 错误日志
**规则**: 使用 `console.error()` 或 `console.warn()` 记录错误详情供调试使用

```typescript
try {
    await riskyOperation();
} catch (error) {
    console.error('Operation failed:', error);
    new Notice('Operation failed. Check console for details.');
}
```

## 10. 测试和质量保证 (Testing and QA)

### 10.1 编译检查
**规则**: 提交前确保代码通过 TypeScript 编译

```bash
# 运行编译检查
npx tsc --noEmit
```

### 10.2 清理代码
**规则**: 在提交前：
- 移除未使用的导入
- 移除未使用的变量
- 移除注释掉的代码
- 移除调试用的 console 语句（除非使用 console.debug）

## 11. Git 提交规范 (Git Commit Standards)

### 11.1 提交消息格式
**规则**: 使用清晰、描述性的提交消息

```bash
# 推荐格式
<type>: <subject>

<body>

# 类型示例
feat: add new feature
fix: fix bug
docs: update documentation
style: format code
refactor: refactor code
test: add tests
chore: update dependencies
```

### 11.2 提交内容
**规则**:
- 每个提交应该是一个逻辑单元
- 避免在一个提交中混合多个不相关的更改
- 确保每个提交都能通过编译

## 12. 审核清单 (Review Checklist)

在提交插件到官方商店前，检查以下项目：

- [ ] 只使用 `console.warn()`, `console.error()`, `console.debug()`
- [ ] 没有使用 `any` 类型（或使用 `unknown` + 类型守卫）
- [ ] 所有 Promise 都被正确处理
- [ ] 移除了不必要的 `async` 关键字
- [ ] 所有 UI 文本使用句式大小写
- [ ] 设置标题中没有插件名称和"settings"字样
- [ ] 使用 Setting API 创建标题
- [ ] 项目名称中不包含"Obsidian"
- [ ] manifest.json 描述中没有"in Obsidian"
- [ ] 使用 `requestUrl()` 而不是 `fetch()`
- [ ] 没有使用 `confirm()`, `alert()`, `prompt()`
- [ ] 没有使用 `innerHTML` 等不安全的 DOM 操作
- [ ] 没有使用已弃用的方法
- [ ] `onunload()` 中没有 detach leaves
- [ ] 没有使用脆弱的 CSS 选择器
- [ ] 语言使用一致（实现了 i18n 或保持单一语言）
- [ ] 没有 eslint-disable 或 @ts-ignore 注释
- [ ] LICENSE 文件版权信息正确
- [ ] 代码通过 TypeScript 编译
- [ ] 移除了所有未使用的代码和注释

## 参考资源

- [Obsidian Plugin Guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines)
- [Obsidian API Documentation](https://docs.obsidian.md/Home)
- [Plugin Review Process](https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin)

---

**最后更新**: 2025-12-05
**基于**: PR #7700 审核反馈
