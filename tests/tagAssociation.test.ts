import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { countTagAssociations, getTagDisplayCount } from '../src/tagAssociation';
import type { UserRepoEnhancements } from '../src/types';

const orphanOnlyEnhancements: Record<number, UserRepoEnhancements> = {
    990016752: {
        notes: '',
        tags: [' linux.do ']
    }
};

test('countTagAssociations 对大小写和空白不敏感', () => {
    assert.equal(countTagAssociations(orphanOnlyEnhancements, 'linux.do'), 1);
    assert.equal(countTagAssociations(orphanOnlyEnhancements, 'LINUX.DO'), 1);
});

test('标签管理模式显示全量关联数，避免与删除校验不一致', () => {
    assert.equal(getTagDisplayCount({
        tagName: 'linux.do',
        visibleCount: 0,
        isTagManageMode: true,
        userEnhancements: orphanOnlyEnhancements
    }), 1);
});

test('普通模式仍然显示当前可见仓库范围内的数量', () => {
    assert.equal(getTagDisplayCount({
        tagName: 'linux.do',
        visibleCount: 0,
        isTagManageMode: false,
        userEnhancements: orphanOnlyEnhancements
    }), 0);
});
