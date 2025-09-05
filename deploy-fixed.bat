@echo off
chcp 65001 >nul
echo 手动部署 Obsidian GitHub Stars Manager 插件
echo ==========================================
echo.

:: 设置目标路径
set "TARGET_DIR=E:\cai的黑曜石\.obsidian\plugins\obsidian-github-stars-manager"
set "BACKUP_DIR=%TARGET_DIR%\backup"

echo 目标目录: %TARGET_DIR%
echo 备份目录: %BACKUP_DIR%
echo.

:: 检查目标目录是否存在
if not exist "%TARGET_DIR%" (
    echo 创建目标目录...
    mkdir "%TARGET_DIR%"
)

:: 检查备份目录是否存在
if not exist "%BACKUP_DIR%" (
    echo 创建备份目录...
    mkdir "%BACKUP_DIR%"
)

:: 获取当前时间戳
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
set "timestamp=%dt:~0,4%-%dt:~4,2%-%dt:~6,2%_%dt:~8,2%-%dt:~10,2%-%dt:~12,2%"

echo 开始部署...
echo.

:: 备份并复制 main.js
if exist "%TARGET_DIR%\main.js" (
    echo 备份 main.js...
    copy "%TARGET_DIR%\main.js" "%BACKUP_DIR%\main.js.%timestamp%.backup" >nul
    if %errorlevel% equ 0 (
        echo ✅ main.js 备份成功
    ) else (
        echo ❌ main.js 备份失败
    )
)

if exist "main.js" (
    copy "main.js" "%TARGET_DIR%\main.js" >nul
    if %errorlevel% equ 0 (
        echo ✅ main.js 复制成功
    ) else (
        echo ❌ main.js 复制失败
    )
) else (
    echo ⚠️  main.js 不存在，请先运行 npm run build
)

:: 备份并复制 styles.css
if exist "%TARGET_DIR%\styles.css" (
    echo 备份 styles.css...
    copy "%TARGET_DIR%\styles.css" "%BACKUP_DIR%\styles.css.%timestamp%.backup" >nul
    if %errorlevel% equ 0 (
        echo ✅ styles.css 备份成功
    ) else (
        echo ❌ styles.css 备份失败
    )
)

if exist "styles.css" (
    copy "styles.css" "%TARGET_DIR%\styles.css" >nul
    if %errorlevel% equ 0 (
        echo ✅ styles.css 复制成功
    ) else (
        echo ❌ styles.css 复制失败
    )
) else (
    echo ⚠️  styles.css 不存在
)

:: 备份并复制 manifest.json
if exist "%TARGET_DIR%\manifest.json" (
    echo 备份 manifest.json...
    copy "%TARGET_DIR%\manifest.json" "%BACKUP_DIR%\manifest.json.%timestamp%.backup" >nul
    if %errorlevel% equ 0 (
        echo ✅ manifest.json 备份成功
    ) else (
        echo ❌ manifest.json 备份失败
    )
)

if exist "manifest.json" (
    copy "manifest.json" "%TARGET_DIR%\manifest.json" >nul
    if %errorlevel% equ 0 (
        echo ✅ manifest.json 复制成功
    ) else (
        echo ❌ manifest.json 复制失败
    )
) else (
    echo ⚠️  manifest.json 不存在
)

echo.
echo 🎉 部署完成！
echo 📁 插件文件已复制到: %TARGET_DIR%
echo 📦 备份文件保存在: %BACKUP_DIR%
echo.
echo 现在你可以在 Obsidian 中重新加载插件来查看更改。
echo.
pause