import type {
    GithubRepository,
    InvalidUserEnhancementRecord,
    UserEnhancementRepoSnapshot,
    UserRepoEnhancements
} from './types';

type UserEnhancementsMap = Record<number | string, UserRepoEnhancements>;
type NumericUserEnhancementsMap = { [repoId: number]: UserRepoEnhancements };

export function buildEnhancementRepoSnapshot(
    repository: GithubRepository,
    lastSeenAt: string
): UserEnhancementRepoSnapshot {
    return {
        full_name: repository.full_name,
        html_url: repository.html_url,
        owner_login: repository.owner?.login || '',
        description: repository.description || '',
        last_seen_at: lastSeenAt,
        account_id: repository.account_id
    };
}

export function deduplicateRepositoriesById(repositories: GithubRepository[]): GithubRepository[] {
    const repoMap = new Map<number, GithubRepository>();

    repositories.forEach((repo) => {
        const existing = repoMap.get(repo.id);
        if (!existing) {
            repoMap.set(repo.id, repo);
            return;
        }

        const existingTime = existing.starred_at ? Date.parse(existing.starred_at) : 0;
        const currentTime = repo.starred_at ? Date.parse(repo.starred_at) : 0;
        if (currentTime > existingTime) {
            repoMap.set(repo.id, repo);
        }
    });

    return Array.from(repoMap.values());
}

export function mergeRepositoriesAfterSync(options: {
    previousRepositories: GithubRepository[];
    syncedRepositories: GithubRepository[];
    failedAccountIds: string[];
}): GithubRepository[] {
    if (options.failedAccountIds.length === 0) {
        return deduplicateRepositoriesById(options.syncedRepositories);
    }

    const failedAccountIdSet = new Set(options.failedAccountIds);
    const preservedRepositories = options.previousRepositories.filter((repo) => {
        const accountId = repo.account_id;
        return Boolean(accountId && failedAccountIdSet.has(accountId));
    });

    return deduplicateRepositoriesById([
        ...options.syncedRepositories,
        ...preservedRepositories
    ]);
}

export function getOrphanEnhancementRecords(
    userEnhancements: UserEnhancementsMap | null | undefined,
    repositories: GithubRepository[]
): InvalidUserEnhancementRecord[] {
    const validRepoIdSet = new Set(repositories.map((repo) => repo.id));
    const orphanRecords: InvalidUserEnhancementRecord[] = [];

    Object.entries(userEnhancements || {}).forEach(([repoId, enhancement]) => {
        const numericRepoId = Number(repoId);
        if (!Number.isFinite(numericRepoId) || validRepoIdSet.has(numericRepoId)) {
            return;
        }

        orphanRecords.push({
            repoId: numericRepoId,
            tags: Array.isArray(enhancement?.tags) ? [...enhancement.tags] : [],
            notes: enhancement?.notes || '',
            linked_note: enhancement?.linked_note,
            repoSnapshot: enhancement?.repoSnapshot
        });
    });

    orphanRecords.sort((left, right) => left.repoId - right.repoId);
    return orphanRecords;
}

export function syncEnhancementSnapshotsWithRepositories(
    userEnhancements: UserEnhancementsMap | null | undefined,
    repositories: GithubRepository[],
    lastSeenAt: string
): NumericUserEnhancementsMap {
    const repositoryMap = new Map(repositories.map((repository) => [repository.id, repository] as const));
    const nextUserEnhancements: NumericUserEnhancementsMap = {};

    Object.entries(userEnhancements || {}).forEach(([repoId, enhancement]) => {
        const numericRepoId = Number(repoId);
        if (!Number.isFinite(numericRepoId)) {
            return;
        }

        const repository = repositoryMap.get(numericRepoId);
        nextUserEnhancements[numericRepoId] = repository
            ? {
                ...enhancement,
                repoSnapshot: buildEnhancementRepoSnapshot(repository, lastSeenAt)
            }
            : { ...enhancement };
    });

    return nextUserEnhancements;
}

export function removeEnhancementsByRepoIds(
    userEnhancements: UserEnhancementsMap | null | undefined,
    repoIds: number[]
): {
    userEnhancements: NumericUserEnhancementsMap;
    removedRepoIds: number[];
} {
    const nextUserEnhancements: NumericUserEnhancementsMap = {};
    const removedRepoIds: number[] = [];
    const repoIdSet = new Set(repoIds);

    Object.entries(userEnhancements || {}).forEach(([repoId, enhancement]) => {
        const numericRepoId = Number(repoId);
        if (!Number.isFinite(numericRepoId)) {
            return;
        }

        if (repoIdSet.has(numericRepoId)) {
            removedRepoIds.push(numericRepoId);
            return;
        }

        nextUserEnhancements[numericRepoId] = enhancement;
    });

    return {
        userEnhancements: nextUserEnhancements,
        removedRepoIds
    };
}
