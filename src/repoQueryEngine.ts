export type RepoSortBy = 'starred_at' | 'stars' | 'forks' | 'updated';
export type RepoSortOrder = 'asc' | 'desc';

export interface RepoQueryDataItem {
    id: number;
    name?: string;
    full_name?: string;
    description?: string | null;
    owner?: { login?: string };
    notes?: string;
    language?: string | null;
    tags?: string[];
    account_id?: string;
    stargazers_count?: number;
    forks_count?: number;
    updated_at?: string;
    starred_at?: string;
}

export interface RepoQueryInput {
    textFilter: string;
    activeTagFilters: string[];
    enabledAccountIds: string[];
    sortBy: RepoSortBy;
    sortOrder: RepoSortOrder;
}

export interface RepoQueryOutput {
    orderedIds: number[];
    total: number;
}

export interface RepoQueryDataPatch {
    upserts: RepoQueryDataItem[];
    removedIds: number[];
}

type WorkerRequestType = 'setData' | 'patchData' | 'query';
type WorkerResponseType = 'setData:ok' | 'patchData:ok' | 'query:result' | 'error';

interface WorkerRequestMessage {
    requestId: number;
    type: WorkerRequestType;
    payload: {
        repositories?: RepoQueryDataItem[];
        upserts?: RepoQueryDataItem[];
        removedIds?: number[];
        input?: RepoQueryInput;
    };
}

interface WorkerResponseMessage {
    requestId: number;
    type: WorkerResponseType;
    payload?: RepoQueryOutput;
    error?: string;
}

interface PendingRequest {
    resolve: (value: unknown) => void;
    reject: (reason?: unknown) => void;
}

interface RepoQueryPreparedItem {
    id: number;
    accountId: string;
    searchableText: string;
    normalizedTagSet: Set<string>;
    stargazersCount: number;
    forksCount: number;
    updatedAtTimestamp: number;
    starredAtTimestamp: number;
}

function prepareRepoForQuery(repo: RepoQueryDataItem): RepoQueryPreparedItem {
    const normalizeTag = (tag: string): string => tag.trim().toLowerCase();
    const parseDate = (rawDate?: string): number => {
        if (!rawDate) return 0;
        const timestamp = Date.parse(rawDate);
        return Number.isFinite(timestamp) ? timestamp : 0;
    };

    const normalizedTags = Array.isArray(repo.tags)
        ? repo.tags
            .map((tag) => normalizeTag(String(tag)))
            .filter((tag) => tag.length > 0)
        : [];
    const searchableTextParts = [
        repo.name || '',
        repo.full_name || '',
        repo.description || '',
        repo.owner?.login || '',
        repo.notes || '',
        repo.language || '',
        ...normalizedTags
    ];

    return {
        id: repo.id,
        accountId: repo.account_id ? String(repo.account_id) : '',
        searchableText: searchableTextParts.join('\n').toLowerCase(),
        normalizedTagSet: new Set(normalizedTags),
        stargazersCount: Number(repo.stargazers_count) || 0,
        forksCount: Number(repo.forks_count) || 0,
        updatedAtTimestamp: parseDate(repo.updated_at),
        starredAtTimestamp: parseDate(repo.starred_at)
    };
}

function runRepoQuery(repositories: RepoQueryPreparedItem[], input: RepoQueryInput): number[] {
    const normalizeTag = (tag: string): string => tag.trim().toLowerCase();
    const keyword = (input.textFilter || '').trim().toLowerCase();
    const enabledAccountIds = new Set((input.enabledAccountIds || []).map((accountId) => String(accountId)));
    const activeTagFilters = (input.activeTagFilters || [])
        .map((tag) => normalizeTag(String(tag)))
        .filter((tag) => tag.length > 0);
    const needTagFilter = activeTagFilters.length > 0;
    const isDesc = input.sortOrder === 'desc';

    if (enabledAccountIds.size === 0) {
        return [];
    }

    const filtered = repositories.filter((repo) => {
        if (repo.accountId && !enabledAccountIds.has(repo.accountId)) {
            return false;
        }
        if (keyword && !repo.searchableText.includes(keyword)) {
            return false;
        }
        if (!needTagFilter) {
            return true;
        }
        return activeTagFilters.some((tag) => repo.normalizedTagSet.has(tag));
    });

    filtered.sort((left, right) => {
        switch (input.sortBy) {
            case 'stars': {
                const leftValue = left.stargazersCount;
                const rightValue = right.stargazersCount;
                return isDesc ? rightValue - leftValue : leftValue - rightValue;
            }
            case 'forks': {
                const leftValue = left.forksCount;
                const rightValue = right.forksCount;
                return isDesc ? rightValue - leftValue : leftValue - rightValue;
            }
            case 'updated': {
                const leftValue = left.updatedAtTimestamp;
                const rightValue = right.updatedAtTimestamp;
                return isDesc ? rightValue - leftValue : leftValue - rightValue;
            }
            case 'starred_at':
            default: {
                const leftValue = left.starredAtTimestamp;
                const rightValue = right.starredAtTimestamp;
                return isDesc ? rightValue - leftValue : leftValue - rightValue;
            }
        }
    });

    return filtered.map((repo) => repo.id);
}

export class RepoQueryEngine {
    private worker: Worker | null = null;
    private workerUrl: string | null = null;
    private nextRequestId = 1;
    private pendingRequests = new Map<number, PendingRequest>();
    private fallbackPreparedRepositories: RepoQueryPreparedItem[] = [];
    private fallbackPreparedRepositoryMap = new Map<number, RepoQueryPreparedItem>();
    private fallbackPreparedRepositoriesDirty = false;
    private workerEnabled = false;

    constructor() {
        this.initializeWorker();
    }

    async setData(repositories: RepoQueryDataItem[]): Promise<void> {
        this.setFallbackRepositories(repositories);
        if (!this.workerEnabled || !this.worker) {
            return;
        }

        await this.postRequest<void>('setData', { repositories });
    }

    async patchData(patch: RepoQueryDataPatch): Promise<void> {
        this.applyFallbackPatch(patch);
        if (!this.workerEnabled || !this.worker) {
            return;
        }

        await this.postRequest<void>('patchData', {
            upserts: patch.upserts,
            removedIds: patch.removedIds
        });
    }

    async query(input: RepoQueryInput): Promise<RepoQueryOutput> {
        if (!this.workerEnabled || !this.worker) {
            this.ensureFallbackRepositoriesReady();
            const orderedIds = runRepoQuery(this.fallbackPreparedRepositories, input);
            return { orderedIds, total: orderedIds.length };
        }

        return this.postRequest<RepoQueryOutput>('query', { input });
    }

    isWorkerEnabled(): boolean {
        return this.workerEnabled;
    }

    destroy(): void {
        this.teardownWorker('RepoQueryEngine destroyed');
    }

    private initializeWorker(): void {
        if (typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined') {
            return;
        }

        try {
            const workerScript = this.buildWorkerScript();
            const workerBlob = new Blob([workerScript], { type: 'application/javascript' });
            this.workerUrl = URL.createObjectURL(workerBlob);
            this.worker = new Worker(this.workerUrl);
            this.worker.onmessage = (event: MessageEvent<WorkerResponseMessage>) => {
                this.handleWorkerResponse(event.data);
            };
            this.worker.onerror = (event: ErrorEvent) => {
                console.warn('Repo query worker crashed, fallback to main thread.', event.message);
                this.teardownWorker('Repo query worker crashed');
            };
            this.workerEnabled = true;
        } catch (error) {
            console.warn('Failed to initialize repo query worker, fallback to main thread:', error);
            this.teardownWorker('Repo query worker initialization failed');
        }
    }

    private teardownWorker(reason: string): void {
        this.workerEnabled = false;
        this.pendingRequests.forEach(({ reject }) => {
            reject(new Error(reason));
        });
        this.pendingRequests.clear();

        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        if (this.workerUrl) {
            URL.revokeObjectURL(this.workerUrl);
            this.workerUrl = null;
        }
    }

    private handleWorkerResponse(response: WorkerResponseMessage): void {
        const request = this.pendingRequests.get(response.requestId);
        if (!request) return;
        this.pendingRequests.delete(response.requestId);

        if (response.type === 'error') {
            request.reject(new Error(response.error || 'Repo query worker unknown error'));
            return;
        }

        if (response.type === 'setData:ok') {
            request.resolve(undefined);
            return;
        }
        if (response.type === 'patchData:ok') {
            request.resolve(undefined);
            return;
        }

        request.resolve(response.payload || { orderedIds: [], total: 0 });
    }

    private postRequest<T>(
        type: WorkerRequestType,
        payload: WorkerRequestMessage['payload']
    ): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            if (!this.workerEnabled || !this.worker) {
                reject(new Error('Repo query worker is unavailable'));
                return;
            }

            const requestId = this.nextRequestId++;
            this.pendingRequests.set(requestId, { resolve, reject });

            const message: WorkerRequestMessage = {
                requestId,
                type,
                payload
            };
            this.worker.postMessage(message);
        });
    }

    private setFallbackRepositories(repositories: RepoQueryDataItem[]): void {
        const preparedRepositories = repositories.map((repo) => prepareRepoForQuery(repo));
        this.fallbackPreparedRepositories = preparedRepositories;
        this.fallbackPreparedRepositoryMap = new Map(
            preparedRepositories.map((repo) => [repo.id, repo] as const)
        );
        this.fallbackPreparedRepositoriesDirty = false;
    }

    private applyFallbackPatch(patch: RepoQueryDataPatch): void {
        const upserts = Array.isArray(patch.upserts) ? patch.upserts : [];
        const removedIds = Array.isArray(patch.removedIds) ? patch.removedIds : [];

        removedIds.forEach((repoId) => {
            this.fallbackPreparedRepositoryMap.delete(repoId);
        });
        upserts.forEach((repo) => {
            this.fallbackPreparedRepositoryMap.set(repo.id, prepareRepoForQuery(repo));
        });
        this.fallbackPreparedRepositoriesDirty = true;
    }

    private ensureFallbackRepositoriesReady(): void {
        if (!this.fallbackPreparedRepositoriesDirty) return;
        this.fallbackPreparedRepositories = Array.from(this.fallbackPreparedRepositoryMap.values());
        this.fallbackPreparedRepositoriesDirty = false;
    }

    private buildWorkerScript(): string {
        return `
const prepareRepoForQuery = ${prepareRepoForQuery.toString()};
const runRepoQuery = ${runRepoQuery.toString()};
let repositories = [];
let repositoryMap = new Map();
let repositoriesDirty = false;
self.onmessage = (event) => {
    const data = event.data || {};
    const requestId = Number(data.requestId || 0);
    const type = data.type;
    const payload = data.payload || {};
    try {
        if (type === 'setData') {
            const sourceRepositories = Array.isArray(payload.repositories) ? payload.repositories : [];
            repositories = sourceRepositories
                .filter((repo) => repo && typeof repo.id === 'number')
                .map((repo) => prepareRepoForQuery(repo));
            repositoryMap = new Map(repositories.map((repo) => [repo.id, repo]));
            repositoriesDirty = false;
            self.postMessage({ requestId, type: 'setData:ok' });
            return;
        }
        if (type === 'patchData') {
            const removedIds = Array.isArray(payload.removedIds) ? payload.removedIds : [];
            const upserts = Array.isArray(payload.upserts) ? payload.upserts : [];
            removedIds.forEach((repoId) => {
                repositoryMap.delete(repoId);
            });
            upserts.forEach((repo) => {
                if (repo && typeof repo.id === 'number') {
                    repositoryMap.set(repo.id, prepareRepoForQuery(repo));
                }
            });
            repositoriesDirty = true;
            self.postMessage({ requestId, type: 'patchData:ok' });
            return;
        }
        if (type === 'query') {
            if (repositoriesDirty) {
                repositories = Array.from(repositoryMap.values());
                repositoriesDirty = false;
            }
            const input = payload.input || {
                textFilter: '',
                activeTagFilters: [],
                enabledAccountIds: [],
                sortBy: 'starred_at',
                sortOrder: 'desc'
            };
            const orderedIds = runRepoQuery(repositories, input);
            self.postMessage({
                requestId,
                type: 'query:result',
                payload: {
                    orderedIds,
                    total: orderedIds.length
                }
            });
            return;
        }
        self.postMessage({ requestId, type: 'error', error: 'Unsupported worker message type' });
    } catch (error) {
        const message = error && error.message ? error.message : String(error);
        self.postMessage({ requestId, type: 'error', error: message });
    }
};
`;
    }
}
