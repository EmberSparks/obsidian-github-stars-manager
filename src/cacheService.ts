import Dexie, { Table } from 'dexie';
import { PluginData, GithubRepository, UserRepoEnhancements } from './types';

interface CacheSnapshotRecord {
    id: 'snapshot';
    githubRepositories: GithubRepository[];
    userEnhancements: { [repoId: number]: UserRepoEnhancements };
    allTags: string[];
    tagColors: { [tagNameLower: string]: string };
    lastSyncTime: string;
    accountSyncTimes: { [accountId: string]: string };
    updatedAt: string;
}

type CacheSnapshotData = Pick<
    PluginData,
    'githubRepositories' | 'userEnhancements' | 'allTags' | 'tagColors' | 'lastSyncTime' | 'accountSyncTimes'
>;

class GithubStarsCacheDatabase extends Dexie {
    snapshots!: Table<CacheSnapshotRecord, 'snapshot'>;

    constructor() {
        super('github-stars-manager-cache-v1');
        this.version(1).stores({
            snapshots: '&id, updatedAt'
        });
    }
}

export class GithubStarsCacheService {
    private db: GithubStarsCacheDatabase;

    constructor() {
        this.db = new GithubStarsCacheDatabase();
    }

    async loadSnapshot(): Promise<CacheSnapshotData | null> {
        const snapshot = await this.db.snapshots.get('snapshot');
        if (!snapshot) return null;
        return {
            githubRepositories: snapshot.githubRepositories || [],
            userEnhancements: snapshot.userEnhancements || {},
            allTags: snapshot.allTags || [],
            tagColors: snapshot.tagColors || {},
            lastSyncTime: snapshot.lastSyncTime || '',
            accountSyncTimes: snapshot.accountSyncTimes || {}
        };
    }

    async saveSnapshot(data: PluginData): Promise<void> {
        const snapshot: CacheSnapshotRecord = {
            id: 'snapshot',
            githubRepositories: data.githubRepositories || [],
            userEnhancements: data.userEnhancements || {},
            allTags: data.allTags || [],
            tagColors: data.tagColors || {},
            lastSyncTime: data.lastSyncTime || '',
            accountSyncTimes: data.accountSyncTimes || {},
            updatedAt: new Date().toISOString()
        };
        await this.db.snapshots.put(snapshot);
    }

    close(): void {
        this.db.close();
    }
}
