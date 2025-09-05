# PowerShell 版本的环境变量设置脚本
Write-Host "设置 Obsidian 插件自动部署环境变量" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""

$defaultPath = "E:\cai的黑曜石\.obsidian\plugins"
Write-Host "当前设置的路径: $defaultPath" -ForegroundColor Yellow
Write-Host ""

$choice = Read-Host "是否使用此路径作为 Obsidian 插件目录? (Y/N)"

if ($choice -eq "N" -or $choice -eq "n") {
    $obsidianPath = Read-Host "请输入你的 Obsidian 插件目录路径"
} else {
    $obsidianPath = $defaultPath
}

Write-Host ""
Write-Host "正在设置环境变量..." -ForegroundColor Blue

try {
    # 设置用户环境变量
    [Environment]::SetEnvironmentVariable("OBSIDIAN_PLUGIN_DIR", $obsidianPath, "User")
    
    Write-Host ""
    Write-Host "✅ 环境变量设置成功！" -ForegroundColor Green
    Write-Host "📁 OBSIDIAN_PLUGIN_DIR = $obsidianPath" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "现在你可以运行以下命令来自动部署插件：" -ForegroundColor Yellow
    Write-Host "  npm run build" -ForegroundColor White
    Write-Host ""
    Write-Host "注意：你可能需要重启命令行或 VS Code 来使环境变量生效。" -ForegroundColor Magenta
} catch {
    Write-Host ""
    Write-Host "❌ 环境变量设置失败: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "请尝试以管理员身份运行此脚本。" -ForegroundColor Yellow
}

Write-Host ""
Read-Host "按 Enter 键退出"