#!/bin/bash

# 部署 Obsidian GitHub Stars Manager 插件到 WSL 环境
echo "部署 Obsidian GitHub Stars Manager 插件 (WSL)"
echo "=========================================="
echo

# 设置目标路径
TARGET_DIR="/mnt/e/cai的黑曜石/.obsidian/plugins/obsidian-github-stars-manager"
BACKUP_DIR="$TARGET_DIR/backup"

echo "目标目录: $TARGET_DIR"
echo "备份目录: $BACKUP_DIR"
echo

# 检查目标目录是否存在
if [ ! -d "$TARGET_DIR" ]; then
    echo "创建目标目录..."
    mkdir -p "$TARGET_DIR"
fi

# 检查备份目录是否存在
if [ ! -d "$BACKUP_DIR" ]; then
    echo "创建备份目录..."
    mkdir -p "$BACKUP_DIR"
fi

# 获取当前时间戳
timestamp=$(date +"%Y-%m-%d_%H-%M-%S")

echo "开始部署..."
echo

# 备份并复制 main.js
if [ -f "$TARGET_DIR/main.js" ]; then
    echo "备份 main.js..."
    cp "$TARGET_DIR/main.js" "$BACKUP_DIR/main.js.$timestamp.backup"
    if [ $? -eq 0 ]; then
        echo "✅ main.js 备份成功"
    else
        echo "❌ main.js 备份失败"
    fi
fi

if [ -f "main.js" ]; then
    cp "main.js" "$TARGET_DIR/main.js"
    if [ $? -eq 0 ]; then
        echo "✅ main.js 复制成功"
    else
        echo "❌ main.js 复制失败"
    fi
else
    echo "⚠️  main.js 不存在，请先运行 npm run build"
fi

# 备份并复制 styles.css
if [ -f "$TARGET_DIR/styles.css" ]; then
    echo "备份 styles.css..."
    cp "$TARGET_DIR/styles.css" "$BACKUP_DIR/styles.css.$timestamp.backup"
    if [ $? -eq 0 ]; then
        echo "✅ styles.css 备份成功"
    else
        echo "❌ styles.css 备份失败"
    fi
fi

if [ -f "styles.css" ]; then
    cp "styles.css" "$TARGET_DIR/styles.css"
    if [ $? -eq 0 ]; then
        echo "✅ styles.css 复制成功"
    else
        echo "❌ styles.css 复制失败"
    fi
else
    echo "⚠️  styles.css 不存在"
fi

# 备份并复制 themes.css
if [ -f "$TARGET_DIR/themes.css" ]; then
    echo "备份 themes.css..."
    cp "$TARGET_DIR/themes.css" "$BACKUP_DIR/themes.css.$timestamp.backup"
    if [ $? -eq 0 ]; then
        echo "✅ themes.css 备份成功"
    else
        echo "❌ themes.css 备份失败"
    fi
fi

if [ -f "themes.css" ]; then
    cp "themes.css" "$TARGET_DIR/themes.css"
    if [ $? -eq 0 ]; then
        echo "✅ themes.css 复制成功"
    else
        echo "❌ themes.css 复制失败"
    fi
else
    echo "⚠️  themes.css 不存在"
fi

# 备份并复制 manifest.json
if [ -f "$TARGET_DIR/manifest.json" ]; then
    echo "备份 manifest.json..."
    cp "$TARGET_DIR/manifest.json" "$BACKUP_DIR/manifest.json.$timestamp.backup"
    if [ $? -eq 0 ]; then
        echo "✅ manifest.json 备份成功"
    else
        echo "❌ manifest.json 备份失败"
    fi
fi

if [ -f "manifest.json" ]; then
    cp "manifest.json" "$TARGET_DIR/manifest.json"
    if [ $? -eq 0 ]; then
        echo "✅ manifest.json 复制成功"
    else
        echo "❌ manifest.json 复制失败"
    fi
else
    echo "⚠️  manifest.json 不存在"
fi

echo
echo "🎉 部署完成！"
echo "📁 插件文件已复制到: $TARGET_DIR"
echo "📦 备份文件保存在: $BACKUP_DIR"
echo
echo "现在你可以在 Obsidian 中重新加载插件来查看更改。"
echo

# 设置正确的权限
chmod 644 "$TARGET_DIR"/*.js "$TARGET_DIR"/*.css "$TARGET_DIR"/*.json 2>/dev/null

echo "权限设置完成。"
echo