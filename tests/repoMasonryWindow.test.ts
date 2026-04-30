import { test } from 'node:test';
import * as assert from 'node:assert/strict';

const {
    getMasonryWindowRange,
    hasMasonryWindowSnapshotChanged,
    shouldUseMasonryWindowing
} = await import(new URL('../src/repoMasonryWindow.ts', import.meta.url).href);

test('getMasonryWindowRange 会按视口和 overscan 返回连续渲染区间', () => {
    const range = getMasonryWindowRange({
        positions: [
            { left: 0, top: 0, width: 280 },
            { left: 0, top: 116, width: 280 },
            { left: 0, top: 232, width: 280 },
            { left: 0, top: 348, width: 280 },
            { left: 0, top: 464, width: 280 }
        ],
        itemHeights: [100, 100, 100, 100, 100],
        scrollTop: 240,
        clientHeight: 120,
        overscanPx: 40
    });

    assert.deepEqual(range, {
        startIndex: 1,
        endIndex: 3
    });
});

test('getMasonryWindowRange 在回滚到顶部时会重新纳入前面的卡片', () => {
    const range = getMasonryWindowRange({
        positions: [
            { left: 0, top: 0, width: 280 },
            { left: 0, top: 116, width: 280 },
            { left: 0, top: 232, width: 280 },
            { left: 0, top: 348, width: 280 }
        ],
        itemHeights: [100, 100, 100, 100],
        scrollTop: 0,
        clientHeight: 120,
        overscanPx: 20
    });

    assert.deepEqual(range, {
        startIndex: 0,
        endIndex: 1
    });
});

test('hasMasonryWindowSnapshotChanged 会在窗口区间未变化时跳过重渲染', () => {
    assert.equal(hasMasonryWindowSnapshotChanged(
        {
            startIndex: 12,
            endIndex: 31,
            totalCount: 80,
            layoutKey: '280|80|rev1'
        },
        {
            startIndex: 12,
            endIndex: 31,
            totalCount: 80,
            layoutKey: '280|80|rev1'
        }
    ), false);
});

test('hasMasonryWindowSnapshotChanged 会在布局或窗口跨界时要求重渲染', () => {
    assert.equal(hasMasonryWindowSnapshotChanged(
        {
            startIndex: 12,
            endIndex: 31,
            totalCount: 80,
            layoutKey: '280|80|rev1'
        },
        {
            startIndex: 13,
            endIndex: 32,
            totalCount: 80,
            layoutKey: '280|80|rev1'
        }
    ), true);

    assert.equal(hasMasonryWindowSnapshotChanged(
        {
            startIndex: 12,
            endIndex: 31,
            totalCount: 80,
            layoutKey: '280|80|rev1'
        },
        {
            startIndex: 12,
            endIndex: 31,
            totalCount: 80,
            layoutKey: '280|80|rev2'
        }
    ), true);
});

test('shouldUseMasonryWindowing 只在已加载卡片达到阈值后启用 DOM 回收', () => {
    assert.equal(shouldUseMasonryWindowing({
        loadedCount: 72,
        minimumWindowingCount: 140
    }), false);

    assert.equal(shouldUseMasonryWindowing({
        loadedCount: 140,
        minimumWindowingCount: 140
    }), true);
});
