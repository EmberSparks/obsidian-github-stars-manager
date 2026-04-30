import { test } from 'node:test';
import * as assert from 'node:assert/strict';
const {
    appendProjectLink,
    normalizeProjectLinks,
    parseProjectLinksInput,
    replaceProjectLink,
    serializeProjectLinksInput
} = await import(new URL('../src/projectLinks.ts', import.meta.url).href);

test('parseProjectLinksInput 会解析多行名称和 URL，并过滤空行', () => {
    const links = parseProjectLinksInput(`
项目官网 | https://example.com

教程 | https://example.com/guide
视频 | https://example.com/video
    `);

    assert.deepEqual(links, [
        { label: '项目官网', url: 'https://example.com' },
        { label: '教程', url: 'https://example.com/guide' },
        { label: '视频', url: 'https://example.com/video' }
    ]);
});

test('parseProjectLinksInput 会忽略缺少名称的条目，但保留未校验格式的链接', () => {
    const links = parseProjectLinksInput(`
无效链接 | not-a-url
 | https://example.com/missing-label
教程 | https://example.com/guide
    `);

    assert.deepEqual(links, [
        { label: '无效链接', url: 'not-a-url' },
        { label: '教程', url: 'https://example.com/guide' }
    ]);
});

test('serializeProjectLinksInput 会按编辑面板格式回填多条链接', () => {
    const value = serializeProjectLinksInput([
        { label: '项目官网', url: 'https://example.com' },
        { label: '教程', url: 'https://example.com/guide' }
    ]);

    assert.equal(value, '项目官网 | https://example.com\n教程 | https://example.com/guide');
});

test('serializeProjectLinksInput 会在无链接时返回空字符串', () => {
    assert.equal(serializeProjectLinksInput([]), '');
});

test('normalizeProjectLinks 会清洗已有链接数组中的空值，但不校验链接格式', () => {
    const links = normalizeProjectLinks([
        { label: '项目官网', url: 'https://example.com' },
        { label: ' ', url: 'https://example.com/blank-label' },
        { label: '无效协议', url: 'javascript:alert(1)' },
        { label: '教程', url: 'https://example.com/guide' }
    ]);

    assert.deepEqual(links, [
        { label: '项目官网', url: 'https://example.com' },
        { label: '无效协议', url: 'javascript:alert(1)' },
        { label: '教程', url: 'https://example.com/guide' }
    ]);
});

test('appendProjectLink 会在名称和 URL 非空时追加一条链接', () => {
    const result = appendProjectLink(
        [{ label: '项目官网', url: 'https://example.com' }],
        ' 教程 ',
        ' https://example.com/guide '
    );

    assert.equal(result.error, undefined);
    assert.deepEqual(result.links, [
        { label: '项目官网', url: 'https://example.com' },
        { label: '教程', url: 'https://example.com/guide' }
    ]);
});

test('appendProjectLink 会在名称为空时回退使用链接本身作为显示名', () => {
    const result = appendProjectLink([], '', 'custom-link-value');

    assert.equal(result.error, undefined);
    assert.deepEqual(result.links, [
        { label: 'custom-link-value', url: 'custom-link-value' }
    ]);
});

test('appendProjectLink 会拒绝空链接和重复链接，但不校验链接格式', () => {
    const sourceLinks = [{ label: '项目官网', url: 'https://example.com' }];

    assert.equal(appendProjectLink(sourceLinks, '教程', '').error, 'missing_url');
    assert.equal(appendProjectLink(sourceLinks, '教程', 'not-a-url').error, undefined);
    assert.equal(appendProjectLink(sourceLinks, '项目官网', 'https://example.com').error, 'duplicate');
});

test('replaceProjectLink 会更新指定索引的链接内容，并允许名称为空', () => {
    const result = replaceProjectLink(
        [
            { label: '项目官网', url: 'https://example.com' },
            { label: '教程', url: 'https://example.com/guide' }
        ],
        1,
        '',
        'guide-v2'
    );

    assert.equal(result.error, undefined);
    assert.deepEqual(result.links, [
        { label: '项目官网', url: 'https://example.com' },
        { label: 'guide-v2', url: 'guide-v2' }
    ]);
});
