# Obsidian 插件自动部署指南

本指南将帮助你设置自动部署功能，让每次编译成功后自动将插件文件复制到 Obsidian 插件目录并备份原文件。

## 🚀 快速开始

### 方法1：自动部署（推荐）

1. **设置环境变量**
   
   运行以下任一脚本来设置环境变量：
   
   **Windows 批处理版本：**
   ```bash
   setup-env.bat
   ```
   
   **PowerShell 版本：**
   ```powershell
   .\setup-env.ps1
   ```

2. **构建并自动部署**
   
   设置完环境变量后，每次运行构建命令都会自动部署：
   ```bash
   npm run build
   ```

### 方法2：手动部署

如果环境变量设置有问题，可以使用手动部署脚本：

```bash
deploy.bat
```

## 📁 目录结构

部署后，你的 Obsidian 插件目录结构将如下：

```
E:\cai的黑曜石\.obsidian\plugins\obsidian-github-stars-manager\
├── main.js                    # 主插件文件
├── styles.css                 # 样式文件
├── manifest.json              # 插件清单
└── backup\                    # 备份目录
    ├── main.js.2024-01-01_12-30-45.backup
    ├── styles.css.2024-01-01_12-30-45.backup
    └── manifest.json.2024-01-01_12-30-45.backup
```

## 🔧 工作原理

### 自动部署流程

1. **构建检查**：只有在构建成功（无错误）时才会执行部署
2. **环境变量检查**：检查 `OBSIDIAN_PLUGIN_DIR` 环境变量是否设置
3. **目录创建**：自动创建目标目录和备份目录（如果不存在）
4. **文件备份**：如果目标文件已存在，先创建带时间戳的备份
5. **文件复制**：将新编译的文件复制到目标目录
6. **状态报告**：显示部署结果和备份位置

### 备份命名规则

备份文件使用以下命名格式：
```
原文件名.YYYY-MM-DDTHH-MM-SS.backup
```

例如：`main.js.2024-01-01T12-30-45.backup`

## 🛠️ 环境变量设置

### 自动设置（推荐）

运行 `setup-env.bat` 或 `setup-env.ps1` 脚本，它们会：
- 使用默认路径：`E:\cai的黑曜石\.obsidian\plugins`
- 允许你自定义路径
- 自动设置用户环境变量

### 手动设置

如果需要手动设置环境变量：

**Windows 命令行：**
```cmd
setx OBSIDIAN_PLUGIN_DIR "E:\cai的黑曜石\.obsidian\plugins"
```

**PowerShell：**
```powershell
[Environment]::SetEnvironmentVariable("OBSIDIAN_PLUGIN_DIR", "E:\cai的黑曜石\.obsidian\plugins", "User")
```

## 📝 使用说明

### 开发工作流

1. **初次设置**：
   ```bash
   # 设置环境变量
   setup-env.bat
   
   # 重启 VS Code 或命令行
   ```

2. **日常开发**：
   ```bash
   # 修改代码后，构建并自动部署
   npm run build
   
   # 或者使用开发模式（自动监听文件变化）
   npm run dev
   ```

3. **在 Obsidian 中测试**：
   - 打开 Obsidian
   - 进入设置 → 社区插件
   - 重新加载插件或重启 Obsidian

### 故障排除

**问题：环境变量未生效**
- 解决：重启命令行、VS Code 或整个系统

**问题：权限不足**
- 解决：以管理员身份运行设置脚本

**问题：路径包含特殊字符**
- 解决：确保路径用引号包围，或使用手动部署脚本

**问题：备份文件过多**
- 解决：定期清理 `backup` 目录中的旧备份文件

## 🎯 高级配置

### 自定义插件ID

如果你修改了插件ID，需要同时更新 `esbuild.config.mjs` 中的 `pluginId` 变量：

```javascript
const pluginId = "your-custom-plugin-id"; // 必须与 manifest.json 中的 'id' 匹配
```

### 添加更多文件类型

如果需要复制其他文件，可以修改 `esbuild.config.mjs` 中的 `copyPlugin`：

```javascript
// 例如复制 README.md
if (fs.existsSync("README.md")) {
    backupAndCopy("README.md", path.join(targetDir, "README.md"), "README.md");
}
```

## 📋 文件说明

- `setup-env.bat` - Windows 批处理版本的环境变量设置脚本
- `setup-env.ps1` - PowerShell 版本的环境变量设置脚本  
- `deploy.bat` - 手动部署脚本（不依赖环境变量）
- `esbuild.config.mjs` - 包含自动部署逻辑的构建配置

## 🔄 更新说明

当你更新这些脚本或配置时，记得：
1. 检查路径是否正确
2. 测试备份功能是否正常
3. 验证文件权限设置
4. 更新相关文档

---

现在你可以享受无缝的开发体验了！每次 `npm run build` 都会自动部署到 Obsidian，同时保护你的现有文件。