import type {
    GithubRepository,
    InvalidUserEnhancementRecord,
    UserEnhancementRepoSnapshot,
    UserRepoEnhancements
} from './types';

type UserEnhancementsMap = Record<number | string, UserRepoEnhancements>;
type NumericUserEnhancementsMap = { [repoId: number]: UserRepoEnhancements };

function pickPreferredText(primary: string | null | undefined, fallback: string | null | undefined): string {
    if (typeof primary === 'string' && primary.trim() !== '') {
        return primary;
    }
    if (typeof fallback === 'string' && fallback.trim() !== '') {
        return fallback;
    }
    return '';
}

function pickPreferredOptionalText(
    primary: string | null | undefined,
    fallback: string | null | undefined
): string | undefined {
    if (typeof primary === 'string' && primary.trim() !== '') {
        return primary;
    }
    if (typeof fallback === 'string' && fallback.trim() !== '') {
        return fallback;
    }
    return undefined;
}

function pickPreferredNullableText(
    primary: string | null | undefined,
    fallback: string | null | undefined
): string | null {
    if (typeof primary === 'string' && primary.trim() !== '') {
        return primary;
    }
    if (typeof fallback === 'string' && fallback.trim() !== '') {
        return fallback;
    }
    return null;
}

function pickPreferredArray<T>(primary: T[] | null | undefined, fallback: T[] | null | undefined): T[] {
    if (Array.isArray(primary) && primary.length > 0) {
        return [...primary];
    }
    if (Array.isArray(fallback) && fallback.length > 0) {
        return [...fallback];
    }
    return [];
}

function pickPreferredValue<T>(primary: T | null | undefined, fallback: T): T {
    return primary ?? fallback;
}

export function mergeRepositoryWithFallback(
    primary: GithubRepository,
    fallback: GithubRepository
): GithubRepository {
    return {
        id: pickPreferredValue(primary.id, fallback.id),
        node_id: pickPreferredText(primary.node_id, fallback.node_id),
        name: pickPreferredText(primary.name, fallback.name),
        full_name: pickPreferredText(primary.full_name, fallback.full_name),
        private: pickPreferredValue(primary.private, fallback.private),
        owner: {
            login: pickPreferredText(primary.owner?.login, fallback.owner?.login),
            avatar_url: pickPreferredText(primary.owner?.avatar_url, fallback.owner?.avatar_url)
        },
        html_url: pickPreferredText(primary.html_url, fallback.html_url),
        description: pickPreferredNullableText(primary.description, fallback.description),
        fork: pickPreferredValue(primary.fork, fallback.fork),
        url: pickPreferredText(primary.url, fallback.url),
        stargazers_count: pickPreferredValue(primary.stargazers_count, fallback.stargazers_count),
        watchers_count: pickPreferredValue(primary.watchers_count, fallback.watchers_count),
        language: primary.language ?? fallback.language,
        forks_count: pickPreferredValue(primary.forks_count, fallback.forks_count),
        open_issues_count: pickPreferredValue(primary.open_issues_count, fallback.open_issues_count),
        topics: pickPreferredArray(primary.topics, fallback.topics),
        created_at: pickPreferredText(primary.created_at, fallback.created_at),
        updated_at: pickPreferredText(primary.updated_at, fallback.updated_at),
        pushed_at: pickPreferredText(primary.pushed_at, fallback.pushed_at),
        starred_at: pickPreferredOptionalText(primary.starred_at, fallback.starred_at),
        account_id: pickPreferredOptionalText(primary.account_id, fallback.account_id)
    };
}

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
            repoMap.set(repo.id, mergeRepositoryWithFallback(repo, existing));
            return;
        }

        repoMap.set(repo.id, mergeRepositoryWithFallback(existing, repo));
    });

    return Array.from(repoMap.values());
}

function mergeSyncedRepositoriesWithPreviousFallback(
    previousRepositories: GithubRepository[],
    syncedRepositories: GithubRepository[]
): GithubRepository[] {
    const previousRepositoryMap = new Map(
        previousRepositories.map((repository) => [repository.id, repository] as const)
    );

    return deduplicateRepositoriesById(syncedRepositories).map((repository) => {
        const previousRepository = previousRepositoryMap.get(repository.id);
        return previousRepository
            ? mergeRepositoryWithFallback(repository, previousRepository)
            : repository;
    });
}

export function mergeRepositoriesAfterSync(options: {
    previousRepositories: GithubRepository[];
    syncedRepositories: GithubRepository[];
    failedAccountIds: string[];
}): GithubRepository[] {
    const mergedSyncedRepositories = mergeSyncedRepositoriesWithPreviousFallback(
        options.previousRepositories,
        options.syncedRepositories
    );

    if (options.failedAccountIds.length === 0) {
        return mergedSyncedRepositories;
    }

    const failedAccountIdSet = new Set(options.failedAccountIds);
    const preservedRepositories = options.previousRepositories.filter((repo) => {
        const accountId = repo.account_id;
        return Boolean(accountId && failedAccountIdSet.has(accountId));
    });

    return deduplicateRepositoriesById([
        ...mergedSyncedRepositories,
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
