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

type WorkerRequestType = 'setData' | 'query';
type WorkerResponseType = 'setData:ok' | 'query:result' | 'error';

interface WorkerRequestMessage {
    requestId: number;
    type: WorkerRequestType;
    payload: {
        repositories?: RepoQueryDataItem[];
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

function runRepoQuery(repositories: RepoQueryDataItem[], input: RepoQueryInput): number[] {
    const normalizeTag = (tag: string): string => tag.trim().toLowerCase();
    const parseDate = (rawDate?: string): number => {
        if (!rawDate) return 0;
        const timestamp = Date.parse(rawDate);
        return Number.isFinite(timestamp) ? timestamp : 0;
    };
    const includesKeyword = (repo: RepoQueryDataItem, keyword: string): boolean => {
        if (!keyword) return true;
        const tags = Array.isArray(repo.tags) ? repo.tags : [];
        return (
            (repo.name || '').toLowerCase().includes(keyword) ||
            (repo.full_name || '').toLowerCase().includes(keyword) ||
            (repo.description || '').toLowerCase().includes(keyword) ||
            (repo.owner?.login || '').toLowerCase().includes(keyword) ||
            (repo.notes || '').toLowerCase().includes(keyword) ||
            (repo.language || '').toLowerCase().includes(keyword) ||
            tags.some((tag) => tag.toLowerCase().includes(keyword))
        );
    };

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
        if (repo.account_id && !enabledAccountIds.has(repo.account_id)) {
            return false;
        }
        if (!includesKeyword(repo, keyword)) {
            return false;
        }
        if (!needTagFilter) {
            return true;
        }
        const repoTagSet = new Set((repo.tags || []).map((tag) => normalizeTag(tag)));
        return activeTagFilters.some((tag) => repoTagSet.has(tag));
    });

    filtered.sort((left, right) => {
        switch (input.sortBy) {
            case 'stars': {
                const leftValue = left.stargazers_count || 0;
                const rightValue = right.stargazers_count || 0;
                return isDesc ? rightValue - leftValue : leftValue - rightValue;
            }
            case 'forks': {
                const leftValue = left.forks_count || 0;
                const rightValue = right.forks_count || 0;
                return isDesc ? rightValue - leftValue : leftValue - rightValue;
            }
            case 'updated': {
                const leftValue = parseDate(left.updated_at);
                const rightValue = parseDate(right.updated_at);
                return isDesc ? rightValue - leftValue : leftValue - rightValue;
            }
            case 'starred_at':
            default: {
                const leftValue = parseDate(left.starred_at);
                const rightValue = parseDate(right.starred_at);
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
    private fallbackRepositories: RepoQueryDataItem[] = [];
    private workerEnabled = false;

    constructor() {
        this.initializeWorker();
    }

    async setData(repositories: RepoQueryDataItem[]): Promise<void> {
        this.fallbackRepositories = repositories;
        if (!this.workerEnabled || !this.worker) {
            return;
        }

        await this.postRequest<void>('setData', { repositories });
    }

    async query(input: RepoQueryInput): Promise<RepoQueryOutput> {
        if (!this.workerEnabled || !this.worker) {
            const orderedIds = runRepoQuery(this.fallbackRepositories, input);
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

    private buildWorkerScript(): string {
        return `
const runRepoQuery = ${runRepoQuery.toString()};
let repositories = [];
self.onmessage = (event) => {
    const data = event.data || {};
    const requestId = Number(data.requestId || 0);
    const type = data.type;
    const payload = data.payload || {};
    try {
        if (type === 'setData') {
            repositories = Array.isArray(payload.repositories) ? payload.repositories : [];
            self.postMessage({ requestId, type: 'setData:ok' });
            return;
        }
        if (type === 'query') {
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
