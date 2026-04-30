import { test } from 'node:test';
import * as assert from 'node:assert/strict';
const {
    buildRepoRenderQueryKey,
    getNextRepoVisibleLimit,
    getRepoIncrementCount,
    shouldLoadMoreRepositories
} = await import(new URL('../src/repoRenderWindow.ts', import.meta.url).href);

test('buildRepoRenderQueryKey 会忽略标签和账号顺序差异', () => {
    const firstKey = buildRepoRenderQueryKey({
        textFilter: '  React Query  ',
        activeTagFilters: ['Tool', 'AI'],
        enabledAccountIds: ['b', 'a'],
        sortBy: 'stars',
        sortOrder: 'desc'
    });
    const secondKey = buildRepoRenderQueryKey({
        textFilter: 'react query',
        activeTagFilters: ['ai', 'tool'],
        enabledAccountIds: ['a', 'b'],
        sortBy: 'stars',
        sortOrder: 'desc'
    });

    assert.equal(firstKey, secondKey);
});

test('getRepoIncrementCount 会按行优先网格估算每次增量加载数量', () => {
    assert.equal(getRepoIncrementCount({
        containerWidth: 920,
        columnWidth: 280,
        columnGap: 16,
        rowsPerChunk: 4,
        minimumCount: 12
    }), 12);

    assert.equal(getRepoIncrementCount({
        containerWidth: 1280,
        columnWidth: 280,
        columnGap: 16,
        rowsPerChunk: 4,
        minimumCount: 10
    }), 16);
});

test('shouldLoadMoreRepositories 会在接近底部时触发增量加载', () => {
    assert.equal(shouldLoadMoreRepositories({
        scrollTop: 1200,
        clientHeight: 700,
        scrollHeight: 2000,
        thresholdPx: 180
    }), true);

    assert.equal(shouldLoadMoreRepositories({
        scrollTop: 600,
        clientHeight: 700,
        scrollHeight: 2000,
        thresholdPx: 180
    }), false);
});

test('getNextRepoVisibleLimit 不会超过总量，并支持从 0 开始增长', () => {
    assert.equal(getNextRepoVisibleLimit({
        currentLimit: 0,
        totalCount: 100,
        incrementCount: 24
    }), 24);

    assert.equal(getNextRepoVisibleLimit({
        currentLimit: 88,
        totalCount: 100,
        incrementCount: 24
    }), 100);
});
