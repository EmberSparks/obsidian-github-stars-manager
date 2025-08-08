@echo off
chcp 65001 >nul
echo 设置 Obsidian 插件自动部署环境变量
echo =====================================
echo.

set "OBSIDIAN_PATH=E:\cai的黑曜石\.obsidian\plugins"

echo 当前设置的路径: %OBSIDIAN_PATH%
echo.

choice /C YN /M "是否使用此路径作为 Obsidian 插件目录"

if errorlevel 2 (
    echo.
    set /p "OBSIDIAN_PATH=请输入你的 Obsidian 插件目录路径: "
)

echo.
echo 正在设置环境变量...

:: 设置用户环境变量
setx OBSIDIAN_PLUGIN_DIR "%OBSIDIAN_PATH%"

if %errorlevel% equ 0 (
    echo.
    echo ✅ 环境变量设置成功！
    echo 📁 OBSIDIAN_PLUGIN_DIR = %OBSIDIAN_PATH%
    echo.
    echo 现在你可以运行以下命令来自动部署插件：
    echo   npm run build
    echo.
    echo 注意：你可能需要重启命令行或 VS Code 来使环境变量生效。
) else (
    echo.
    echo ❌ 环境变量设置失败，请检查权限或手动设置。
)

echo.
pause