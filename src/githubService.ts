import { Octokit } from '@octokit/rest';
import { Notice } from 'obsidian';
import { GithubRepository, GithubAccount } from './types';

// 添加GitHub API响应类型
interface StarredRepoItem {
    repo?: GithubRepository;
    starred_at?: string;
    id?: number;
    [key: string]: any;
}

/**
 * 单个账号的GitHub服务实例
 */
class SingleAccountGithubService {
    private octokit: Octokit | null = null;
    
    constructor(private account: GithubAccount) {
        this.setToken(account.token);
    }
    
    /**
     * 设置GitHub令牌
     */
    public setToken(token: string): void {
        if (!token) {
            this.octokit = null;
            return;
        }
        
        try {
            this.octokit = new Octokit({
                auth: token
            });
        } catch (error) {
            console.error(`初始化Octokit失败 (${this.account.username}):`, error);
            this.octokit = null;
        }
    }
    
    /**
     * 检查服务是否已经初始化
     */
    private checkInitialized(): boolean {
        return this.octokit !== null;
    }
    
    /**
     * 获取用户星标的所有仓库
     */
    public async fetchStarredRepositories(): Promise<GithubRepository[]> {
        if (!this.checkInitialized()) {
            return [];
        }
        
        try {
            const repositories: GithubRepository[] = [];
            let page = 1;
            const per_page = 100;
            
            while (true) {
                
                const response = await this.octokit!.activity.listReposStarredByAuthenticatedUser({
                    per_page,
                    page,
                    headers: {
                        Accept: 'application/vnd.github.star+json'
                    }
                });
                
                
                if (response.data.length === 0) {
                    break;
                }
                
                const starredReposData = response.data.map((item: StarredRepoItem) => {
                    // 使用正确的API格式，item本身就包含repo和starred_at
                    if (item && item.repo) {
                        return {
                            ...item.repo,
                            starred_at: item.starred_at || new Date().toISOString(),
                            account_id: this.account.id // 标记来源账号
                        };
                    } else if (item && item.id) {
                        // 如果直接返回仓库对象（向后兼容）
                        return {
                            ...item,
                            starred_at: new Date().toISOString(),
                            account_id: this.account.id
                        };
                    }
                    console.warn(`Skipping malformed starred repo item (${this.account.username}):`, item);
                    return null;
                }).filter(repo => repo !== null);

                repositories.push(...starredReposData as GithubRepository[]);
                
                if (response.data.length < per_page) {
                    break;
                }
                
                page++;
            }
            
            return repositories;
        } catch (error) {
            console.error(`获取星标仓库失败 (${this.account.username}):`, error);
            return [];
        }
    }
    
    /**
     * 获取用户信息
     */
    public async getCurrentUser(): Promise<{login: string, name: string, avatar_url: string} | null> {
        if (!this.checkInitialized()) {
            return null;
        }
        
        try {
            const { data } = await this.octokit!.users.getAuthenticated();
            return {
                login: data.login,
                name: data.name || data.login,
                avatar_url: data.avatar_url
            };
        } catch (error) {
            console.error(`获取用户信息失败 (${this.account.username}):`, error);
            return null;
        }
    }
}

/**
 * 多账号GitHub服务类：负责管理多个GitHub账号的API交互
 */
export class GithubService {
    private services: Map<string, SingleAccountGithubService> = new Map();
    
    /**
     * 初始化多账号GitHub服务
     */
    constructor(private accounts: GithubAccount[] = []) {
        this.updateAccounts(accounts);
    }
    
    /**
     * 更新账号列表
     */
    public updateAccounts(accounts: GithubAccount[]): void {
        this.accounts = accounts;
        this.services.clear();
        
        // 为每个启用的账号创建服务实例
        const enabledAccounts = accounts.filter(account => account.enabled);
        
        enabledAccounts.forEach(account => {
            this.services.set(account.id, new SingleAccountGithubService(account));
        });
    }
    
    /**
     * 获取所有启用账号的星标仓库
     */
    public async fetchAllStarredRepositories(): Promise<{
        repositories: GithubRepository[];
        accountSyncTimes: { [accountId: string]: string };
        errors: { [accountId: string]: string };
    }> {
        const accountSyncTimes: { [accountId: string]: string } = {};
        const errors: { [accountId: string]: string } = {};
        
        if (this.services.size === 0) {
            new Notice('GitHub Stars Manager: 没有启用的GitHub账号');
            return { repositories: [], accountSyncTimes, errors };
        }
        
        // 并行获取所有账号的星标仓库
        const promises = Array.from(this.services.entries()).map(async ([accountId, service]) => {
            const account = this.accounts.find(acc => acc.id === accountId);
            if (!account) return { repos: [], accountId, error: null };
            
            try {
                const repos = await service.fetchStarredRepositories();
                accountSyncTimes[accountId] = new Date().toISOString();
                
                return { repos, accountId, error: null };
            } catch (error) {
                const errorMsg = `同步失败: ${error instanceof Error ? error.message : '未知错误'}`;
                errors[accountId] = errorMsg;
                console.error(`账号 ${account.username} 同步失败:`, error);
                return { repos: [], accountId, error: errorMsg };
            }
        });
        
        const results = await Promise.all(promises);
        
        // 收集所有仓库数据
        const allRepositories: GithubRepository[] = [];
        results.forEach(result => {
            if (result && result.repos.length > 0) {
                allRepositories.push(...result.repos);
            }
        });
        
        // 去重处理（基于仓库ID，保留最新的starred_at时间）
        const uniqueRepos = this.deduplicateRepositories(allRepositories);
        
        // 显示同步结果通知
        const successCount = Object.keys(accountSyncTimes).length;
        const errorCount = Object.keys(errors).length;
        const totalRepos = uniqueRepos.length;
        
        if (errorCount === 0) {
            new Notice(`GitHub Stars Manager: 成功同步 ${successCount} 个账号，共 ${totalRepos} 个仓库`);
        } else {
            new Notice(`GitHub Stars Manager: 同步完成，${successCount} 个成功，${errorCount} 个失败，共 ${totalRepos} 个仓库`);
        }
        
        return {
            repositories: uniqueRepos,
            accountSyncTimes,
            errors
        };
    }
    
    /**
     * 去重仓库（基于仓库ID）
     */
    private deduplicateRepositories(repositories: GithubRepository[]): GithubRepository[] {
        const repoMap = new Map<number, GithubRepository>();
        
        repositories.forEach(repo => {
            const existing = repoMap.get(repo.id);
            if (!existing) {
                repoMap.set(repo.id, repo);
            } else {
                // 如果仓库已存在，保留最新的starred_at时间
                const existingTime = existing.starred_at ? new Date(existing.starred_at).getTime() : 0;
                const currentTime = repo.starred_at ? new Date(repo.starred_at).getTime() : 0;
                
                if (currentTime > existingTime) {
                    repoMap.set(repo.id, repo);
                }
            }
        });
        
        return Array.from(repoMap.values());
    }
    
    /**
     * 验证单个账号的令牌
     */
    public async validateAccount(account: GithubAccount): Promise<{
        valid: boolean;
        userInfo?: { login: string; name: string; avatar_url: string };
        error?: string;
    }> {
        const service = new SingleAccountGithubService(account);
        
        try {
            const userInfo = await service.getCurrentUser();
            if (userInfo) {
                return { valid: true, userInfo };
            } else {
                return { valid: false, error: '无法获取用户信息' };
            }
        } catch (error) {
            return { 
                valid: false, 
                error: error instanceof Error ? error.message : '验证失败' 
            };
        }
    }
    
    /**
     * 获取指定账号的用户信息
     */
    public async getAccountUserInfo(accountId: string): Promise<{
        login: string; 
        name: string; 
        avatar_url: string;
    } | null> {
        const service = this.services.get(accountId);
        if (!service) {
            return null;
        }
        
        return await service.getCurrentUser();
    }

    // 向后兼容的方法
    /**
     * @deprecated 使用 fetchAllStarredRepositories 替代
     */
    public async fetchStarredRepositories(): Promise<GithubRepository[]> {
        const result = await this.fetchAllStarredRepositories();
        return result.repositories;
    }
    
    /**
     * @deprecated 多账号模式下不再使用单一令牌
     */
    public setToken(token: string): void {
        console.warn('setToken is deprecated in multi-account mode');
    }
    
    /**
     * @deprecated 多账号模式下使用 getAccountUserInfo
     */
    public async getCurrentUser(): Promise<{login: string, name: string} | null> {
        console.warn('getCurrentUser is deprecated in multi-account mode');
        return null;
    }
}