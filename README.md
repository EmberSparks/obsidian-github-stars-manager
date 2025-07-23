# Obsidian GitHub Stars Manager

[English README](README_en.md)

本插件允许您直接在 Obsidian 中管理和查看您已加星标的 GitHub 仓库。

## 功能特性

- 📋 在 Obsidian 中查看所有已加星标的 GitHub 仓库
- 🏷️ 为仓库添加自定义标签和笔记
- 🔗 关联仓库到 Obsidian 笔记
- 🔄 自动或手动同步星标仓库
- 🔍 通过名称、语言、标签进行搜索和筛选
- 📊 按星标时间、名称、语言等多种方式排序
- 🎨 简洁的用户界面，与 Obsidian 主题完美融合

## 配置

要使用此插件，您需要提供一个具有必要权限的 GitHub 个人访问令牌 (PAT)，以便读取您已加星标的仓库。

**如何获取 GitHub 个人访问令牌 (PAT):**

1.  **登录 GitHub:** 访问 [github.com](https://github.com) 并登录您的账户。
2.  **访问设置:** 点击页面右上角的个人头像，然后选择 "Settings"。
3.  **开发者设置:** 在左侧菜单栏中，滚动到底部，点击 "Developer settings"。
4.  **个人访问令牌:** 在左侧菜单中，选择 "Personal access tokens"，然后选择 "Tokens (classic)"。 *(注意：请选择 Classic Token，Fine-grained tokens 可能需要更复杂的权限设置)*
5.  **生成新令牌:** 点击 "Generate new token" 按钮，然后选择 "Generate new token (classic)"。
6.  **令牌描述:** 在 "Note" 字段中，为您的令牌添加一个描述性的名称，例如 "Obsidian Stars Manager"。
7.  **设置过期时间:** 选择一个合适的过期时间 (Expiration)。为了安全起见，建议不要选择 "No expiration"。
8.  **选择范围 (Scopes):** 这是最关键的一步。您需要授予此令牌访问您的仓库的权限。勾选 `repo` 这个顶级复选框。这将自动选中其下的所有子权限，这是插件读取您的星标仓库所必需的。
9.  **生成令牌:** 点击页面底部的 "Generate token" 按钮。
10. **复制令牌:** **重要！** GitHub 只会显示一次完整的令牌。请立即点击复制按钮将其复制下来，并妥善保管。**离开此页面后将无法再次看到完整的令牌。**
11. **在插件中使用:** 将复制的令牌粘贴到 Obsidian 中 "GitHub Stars Manager" 插件设置选项卡里的 "GitHub 个人访问令牌 (PAT)" 字段中。

## 使用说明

1. 安装并启用插件后，在左侧面板会出现一个 GitHub 星标图标
2. 点击图标打开星标仓库视图
3. 首次使用需要在设置中配置您的 GitHub PAT
4. 点击"同步"按钮获取您的星标仓库
5. 您可以为每个仓库添加个人笔记、标签，或关联到现有的 Obsidian 笔记

## 安装

### 从 Obsidian 社区插件安装（推荐）

1. 打开 Obsidian 设置
2. 转到"社区插件"选项卡
3. 搜索 "GitHub Stars Manager"
4. 点击安装并启用插件

### 手动安装

1. 下载最新版本的 `main.js`、`manifest.json` 和 `styles.css`
2. 将这些文件复制到您的保险库文件夹：`VaultFolder/.obsidian/plugins/obsidian-github-stars-manager/`
3. 重启 Obsidian
4. 在设置中启用插件

## 开发

### 环境要求

- Node.js 16+
- npm

### 开发命令

```bash
# 安装依赖
npm install

# 开发模式（监听文件变化）
npm run dev

# 生产构建
npm run build

# 代码检查
npm run lint

# 版本升级
npm run version
```

### 项目结构

```
├── src/
│   ├── main.ts          # 主插件类
│   ├── view.ts          # 星标仓库视图
│   ├── settings.ts      # 插件设置
│   ├── modal.ts         # 编辑对话框
│   ├── githubService.ts # GitHub API 服务
│   └── types.ts         # TypeScript 类型定义
├── main.ts              # 插件入口点
├── manifest.json        # 插件清单
├── styles.css          # 样式文件
└── README.md           # 说明文档
```

## 许可证

MIT

## 贡献

欢迎提交 Issues 和 Pull Requests！

## 支持

如果您觉得这个插件对您有帮助，可以考虑：

- ⭐ 给项目点个星标
- 🐛 报告 Bug 或提出改进建议
- 💡 分享给其他 Obsidian 用户