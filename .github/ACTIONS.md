# GitHub Actions 工作流说明

本仓库配置了多个 GitHub Actions 工作流，用于自动化构建、测试和部署。

## 工作流概览

### 1. 构建和发布 (build.yml)
**触发条件：**
- 推送到 `main`、`master` 或 `feature/*` 分支
- 针对 `main` 或 `master` 分支的 Pull Request
- 发布 Release 时

**包含的任务：**
- ✅ 多 Node.js 版本构建测试 (18.x, 20.x)
- ✅ TypeScript 类型检查
- ✅ 插件构建
- ✅ 构建产物上传
- ✅ 发布时自动创建 Release 资产

### 2. 代码质量检查 (code-quality.yml)
**触发条件：**
- 推送到 `main`、`master` 或 `feature/*` 分支
- 针对 `main` 或 `master` 分支的 Pull Request

**包含的任务：**
- ✅ ESLint 检查（如果配置了）
- ✅ Prettier 格式检查（如果配置了）
- ✅ 安全漏洞扫描
- ✅ 依赖项检查
- ✅ 代码质量检查（console.log、TODO 等）

### 3. 文档部署 (deploy-docs.yml)
**触发条件：**
- 推送到 `main` 或 `master` 分支
- 针对 `main` 或 `master` 分支的 Pull Request

**功能：**
- ✅ 自动构建文档站点
- ✅ 部署到 GitHub Pages
- ✅ 创建美观的项目展示页面

## 功能特性

### 自动化构建
- 每次推送代码时自动编译 TypeScript
- 验证构建产物完整性
- 支持多 Node.js 版本测试

### 代码质量保障
- 自动检查代码格式
- 扫描安全漏洞
- 检查依赖项更新

### 自动发布
- 创建 GitHub Release 时自动构建
- 自动上传构建产物
- 生成 ZIP 压缩包供下载

### 文档站点
- 自动生成项目文档页面
- 部署到 GitHub Pages
- 包含项目介绍、下载链接等

## 使用方法

### 本地测试工作流
```bash
# 安装 act 工具（可选）
brew install act

# 本地运行工作流
act -W .github/workflows/build.yml
```

### 查看工作流状态
1. 进入 GitHub 仓库的 Actions 页面
2. 查看各个工作流的运行状态
3. 点击具体工作流查看详细日志

### 手动触发工作流
1. 进入 Actions 页面
2. 选择左侧的工作流
3. 点击 "Run workflow" 按钮

## 构建产物

### 主要文件
- `main.js` - 编译后的插件主文件
- `manifest.json` - 插件配置文件
- `styles.css` - 样式文件
- `themes.css` - 主题文件

### Release 产物
- `obsidian-github-stars-manager.zip` - 完整插件包
- 各个独立文件的下载链接

## 故障排除

### 常见问题
1. **构建失败**：检查 TypeScript 错误和依赖项
2. **权限问题**：确保仓库有足够的 Actions 权限
3. **依赖问题**：检查 `package.json` 中的依赖项版本

### 调试技巧
- 查看 Actions 日志中的详细错误信息
- 在本地重现构建过程
- 检查 Node.js 版本兼容性

## 配置说明

### 环境变量
工作流使用以下环境变量：
- `GITHUB_TOKEN` - GitHub 自动提供的访问令牌
- `NODE_VERSION` - Node.js 版本配置

### 权限要求
- `contents: read` - 读取代码库内容
- `pages: write` - 写入 GitHub Pages
- `id-token: write` - 身份验证

## 更新日志

### v1.0.0 (2024-01-01)
- 初始工作流配置
- 支持自动化构建和测试
- 添加文档部署功能
- 配置代码质量检查

---

💡 **提示**：如果你需要修改工作流配置，请编辑 `.github/workflows/` 目录下的相应文件。