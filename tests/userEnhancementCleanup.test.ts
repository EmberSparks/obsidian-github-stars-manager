import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
    buildEnhancementRepoSnapshot,
    getOrphanEnhancementRecords,
    mergeRepositoriesAfterSync,
    removeEnhancementsByRepoIds,
    syncEnhancementSnapshotsWithRepositories
} from '../src/userEnhancementCleanup';
import type { GithubRepository, UserRepoEnhancements } from '../src/types';

const repositories = [
    { id: 1 },
    { id: 3 }
] as GithubRepository[];

const userEnhancements: Record<number, UserRepoEnhancements> = {
    1: { notes: 'keep', tags: ['A'] },
    2: {
        notes: 'remove',
        tags: ['B'],
        repoSnapshot: {
            full_name: 'old-owner/old-repo',
            html_url: 'https://github.com/old-owner/old-repo',
            owner_login: 'old-owner',
            description: 'old desc',
            last_seen_at: '2026-04-20T00:00:00.000Z',
            account_id: 'old'
        }
    },
    3: { notes: '', tags: ['C'] }
};

test('getOrphanEnhancementRecords 会列出所有失效增强数据', () => {
    const result = getOrphanEnhancementRecords(userEnhancements, repositories);

    assert.deepEqual(result, [{
        repoId: 2,
        tags: ['B'],
        notes: 'remove',
        linked_note: undefined,
        repoSnapshot: {
            full_name: 'old-owner/old-repo',
            html_url: 'https://github.com/old-owner/old-repo',
            owner_login: 'old-owner',
            description: 'old desc',
            last_seen_at: '2026-04-20T00:00:00.000Z',
            account_id: 'old'
        }
    }]);
});

test('buildEnhancementRepoSnapshot 会提取失效记录展示需要的最小仓库信息', () => {
    const snapshot = buildEnhancementRepoSnapshot({
        id: 9,
        node_id: 'R_kgDOA',
        name: 'repo',
        full_name: 'owner/repo',
        html_url: 'https://github.com/owner/repo',
        description: 'hello',
        owner: {
            login: 'owner',
            avatar_url: 'https://example.com/avatar.png'
        },
        private: false,
        fork: false,
        url: 'https://api.github.com/repos/owner/repo',
        stargazers_count: 1,
        watchers_count: 1,
        language: 'TypeScript',
        forks_count: 0,
        open_issues_count: 0,
        topics: [],
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
        pushed_at: '2026-01-03T00:00:00.000Z',
        account_id: 'main'
    } as GithubRepository, '2026-04-27T08:30:00.000Z');

    assert.deepEqual(snapshot, {
        full_name: 'owner/repo',
        html_url: 'https://github.com/owner/repo',
        owner_login: 'owner',
        description: 'hello',
        last_seen_at: '2026-04-27T08:30:00.000Z',
        account_id: 'main'
    });
});

test('syncEnhancementSnapshotsWithRepositories 会为当前仍存在的增强记录刷新快照，同时保留失效记录旧快照', () => {
    const result = syncEnhancementSnapshotsWithRepositories(
        userEnhancements,
        [{
            id: 1,
            node_id: 'R_kgDOB',
            name: 'keep',
            full_name: 'owner/keep',
            html_url: 'https://github.com/owner/keep',
            description: 'active repo',
            owner: {
                login: 'owner',
                avatar_url: 'https://example.com/owner.png'
            },
            private: false,
            fork: false,
            url: 'https://api.github.com/repos/owner/keep',
            stargazers_count: 1,
            watchers_count: 1,
            language: 'TypeScript',
            forks_count: 0,
            open_issues_count: 0,
            topics: [],
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-02T00:00:00.000Z',
            pushed_at: '2026-01-03T00:00:00.000Z',
            account_id: 'main'
        } as GithubRepository],
        '2026-04-27T08:30:00.000Z'
    );

    assert.deepEqual(result[1].repoSnapshot, {
        full_name: 'owner/keep',
        html_url: 'https://github.com/owner/keep',
        owner_login: 'owner',
        description: 'active repo',
        last_seen_at: '2026-04-27T08:30:00.000Z',
        account_id: 'main'
    });
    assert.deepEqual(result[2].repoSnapshot, {
        full_name: 'old-owner/old-repo',
        html_url: 'https://github.com/old-owner/old-repo',
        owner_login: 'old-owner',
        description: 'old desc',
        last_seen_at: '2026-04-20T00:00:00.000Z',
        account_id: 'old'
    });
});

test('removeEnhancementsByRepoIds 会删除指定增强记录', () => {
    const result = removeEnhancementsByRepoIds(userEnhancements, [2]);

    assert.deepEqual(result.removedRepoIds, [2]);
    assert.deepEqual(result.userEnhancements, {
        1: { notes: 'keep', tags: ['A'] },
        3: { notes: '', tags: ['C'] }
    });
});

test('部分失败时保留失败账号上一次同步的仓库数据', () => {
    const previousRepositories = [
        { id: 1, account_id: 'ok' },
        { id: 2, account_id: 'failed' }
    ] as GithubRepository[];
    const syncedRepositories = [
        { id: 1, account_id: 'ok' },
        { id: 3, account_id: 'ok' }
    ] as GithubRepository[];

    const result = mergeRepositoriesAfterSync({
        previousRepositories,
        syncedRepositories,
        failedAccountIds: ['failed']
    });

    assert.deepEqual(result.map((repo) => repo.id).sort((left, right) => left - right), [1, 2, 3]);
});
