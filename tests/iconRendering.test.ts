import { readFileSync } from 'node:fs';
import * as assert from 'node:assert/strict';
import { test } from 'node:test';

test('自定义外链图标不应复用 Obsidian 内置 external-link 图标 ID', () => {
    const mainSource = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');

    assert.doesNotMatch(
        mainSource,
        /addIcon\(\s*'external-link'\s*,\s*EXTERNAL_LINK_ICON\s*\)/,
        '自定义 SVG 不应注册到 external-link，避免与 Obsidian 内置图标冲突'
    );
});

test('仓库卡片不应直接请求 external-link 作为自定义图标', () => {
    const viewSource = readFileSync(new URL('../src/view.ts', import.meta.url), 'utf8');

    assert.doesNotMatch(
        viewSource,
        /setIcon\(\s*(?:prefixEl|linkedNoteEl)\s*,\s*'external-link'\s*\)/,
        '仓库卡片应使用插件私有图标 ID，避免重复渲染'
    );
});
