import { test } from 'node:test';
import * as assert from 'node:assert/strict';
const {
    calculateMasonryLayout,
    hasMasonryItemSizeChanges
} = await import(new URL('../src/repoMasonryLayout.ts', import.meta.url).href);

test('calculateMasonryLayout 会把后续卡片放到当前最短列，而不是按整行最高高度对齐', () => {
    const layout = calculateMasonryLayout({
        containerWidth: 900,
        minimumColumnWidth: 280,
        columnGap: 16,
        itemHeights: [300, 180, 220, 160]
    });

    assert.equal(layout.columnCount, 3);
    assert.equal(layout.positions[0].top, 0);
    assert.equal(layout.positions[1].top, 0);
    assert.equal(layout.positions[2].top, 0);

    assert.equal(layout.positions[3].top, 196);
    assert.equal(layout.positions[3].left, layout.positions[1].left);
});

test('calculateMasonryLayout 会在单列场景下保持纵向堆叠', () => {
    const layout = calculateMasonryLayout({
        containerWidth: 260,
        minimumColumnWidth: 280,
        columnGap: 16,
        itemHeights: [100, 120, 80]
    });

    assert.equal(layout.columnCount, 1);
    assert.equal(layout.positions[1].top, 116);
    assert.equal(layout.positions[2].top, 252);
    assert.equal(layout.containerHeight, 332);
});

test('hasMasonryItemSizeChanges 会在卡片异步增高时要求重新布局', () => {
    assert.equal(hasMasonryItemSizeChanges({
        previousSizes: [
            { width: 280, height: 220 },
            { width: 280, height: 260 }
        ],
        nextSizes: [
            { width: 280, height: 220 },
            { width: 280, height: 318 }
        ]
    }), true);
});

test('hasMasonryItemSizeChanges 会忽略极小的浮点抖动', () => {
    assert.equal(hasMasonryItemSizeChanges({
        previousSizes: [
            { width: 278.5, height: 220.2 }
        ],
        nextSizes: [
            { width: 278.8, height: 220.5 }
        ]
    }), false);
});
