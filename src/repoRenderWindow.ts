import type { RepoQueryInput } from './repoQueryEngine';

function normalizeToken(value: string): string {
    return String(value || '').trim().toLowerCase();
}

export function buildRepoRenderQueryKey(input: RepoQueryInput): string {
    const normalizedTags = (input.activeTagFilters || [])
        .map((tag) => normalizeToken(tag))
        .filter((tag) => tag.length > 0)
        .sort();
    const normalizedAccountIds = (input.enabledAccountIds || [])
        .map((accountId) => normalizeToken(accountId))
        .filter((accountId) => accountId.length > 0)
        .sort();

    return [
        normalizeToken(input.textFilter || ''),
        normalizedTags.join('\u0001'),
        normalizedAccountIds.join('\u0001'),
        input.sortBy,
        input.sortOrder
    ].join('\u0002');
}

export function getRepoIncrementCount(options: {
    containerWidth: number;
    columnWidth: number;
    columnGap: number;
    rowsPerChunk: number;
    minimumCount: number;
}): number {
    const safeContainerWidth = Math.max(0, options.containerWidth);
    const safeColumnWidth = Math.max(1, options.columnWidth);
    const safeColumnGap = Math.max(0, options.columnGap);
    const safeRowsPerChunk = Math.max(1, options.rowsPerChunk);
    const safeMinimumCount = Math.max(1, options.minimumCount);

    const columnCount = Math.max(
        1,
        Math.floor((safeContainerWidth + safeColumnGap) / (safeColumnWidth + safeColumnGap))
    );

    return Math.max(safeMinimumCount, columnCount * safeRowsPerChunk);
}

export function shouldLoadMoreRepositories(options: {
    scrollTop: number;
    clientHeight: number;
    scrollHeight: number;
    thresholdPx: number;
}): boolean {
    if (options.clientHeight <= 0 || options.scrollHeight <= 0) {
        return false;
    }

    const thresholdPx = Math.max(0, options.thresholdPx);
    return (options.scrollTop + options.clientHeight) >= (options.scrollHeight - thresholdPx);
}

export function getNextRepoVisibleLimit(options: {
    currentLimit: number;
    totalCount: number;
    incrementCount: number;
}): number {
    const safeTotalCount = Math.max(0, options.totalCount);
    if (safeTotalCount === 0) {
        return 0;
    }

    const safeIncrementCount = Math.max(1, options.incrementCount);
    const safeCurrentLimit = Math.max(0, options.currentLimit);
    if (safeCurrentLimit === 0) {
        return Math.min(safeTotalCount, safeIncrementCount);
    }

    return Math.min(safeTotalCount, safeCurrentLimit + safeIncrementCount);
}
