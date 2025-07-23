import { Octokit } from '@octokit/rest';
import { Notice } from 'obsidian';
import { GithubRepository } from './types'; // Removed LocalRepository import

/**
 * GitHub服务类：负责与GitHub API交互
 */
export class GithubService {
    private octokit: Octokit | null = null;
    
    /**
     * 初始化GitHub服务
     * @param token GitHub个人访问令牌
     */
    constructor(private token: string) {
        this.setToken(token);
    }
    
    /**
     * 设置GitHub令牌
     * @param token GitHub个人访问令牌
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
            console.error('初始化Octokit失败:', error);
            new Notice('GitHub Stars Manager: 初始化Octokit失败，请检查令牌');
            this.octokit = null;
        }
    }
    
    /**
     * 检查服务是否已经初始化
     */
    private checkInitialized(): boolean {
        if (!this.octokit) {
            new Notice('GitHub Stars Manager: 请先设置有效的GitHub令牌');
            return false;
        }
        return true;
    }
    
    /**
     * 获取用户星标的所有仓库 (包含 starred_at)
     * @returns 星标仓库列表 (GithubRepository[])
     */
    public async fetchStarredRepositories(): Promise<GithubRepository[]> {
        if (!this.checkInitialized()) {
            return [];
        }
        
        try {
            // 获取所有星标仓库（处理分页）
            const repositories: GithubRepository[] = [];
            let page = 1;
            const per_page = 100; // GitHub API允许的最大每页数量
            
            while (true) {
                // 使用非空断言，因为之前已经通过checkInitialized()检查
                // Add the 'star' media type header to get starred_at field
                const response = await this.octokit!.activity.listReposStarredByAuthenticatedUser({
                    per_page,
                    page,
                    headers: {
                        Accept: 'application/vnd.github.star+json' // This header is crucial
                    }
                });
                
                if (response.data.length === 0) {
                    break;
                }
                
                // The response.data here should be an array of objects like:
                // { starred_at: "...", repo: { ... actual repo data ... } }
                // We need to extract the 'repo' and add 'starred_at' to it.
                const starredReposData = response.data.map((item: any) => {
                    if (item && item.repo && item.starred_at) {
                        return {
                            ...item.repo, // Spread the actual repository data
                            starred_at: item.starred_at // Add the starred_at field
                        };
                    }
                    console.warn("Skipping malformed starred repo item:", item);
                    return null; // Skip malformed items
                }).filter(repo => repo !== null); // Filter out nulls

                repositories.push(...starredReposData as GithubRepository[]);
                
                if (response.data.length < per_page) {
                    break;
                }
                
                page++;
            }
            
            return repositories;
        } catch (error) {
            console.error('获取星标仓库失败:', error);
            new Notice('GitHub Stars Manager: 获取星标仓库失败');
            return [];
        }
    }
    
    /**
     * 获取用户信息
     * @returns 用户信息或null
     */
    public async getCurrentUser(): Promise<{login: string, name: string} | null> {
        if (!this.checkInitialized()) {
            return null;
        }
        
        try {
            // 使用非空断言，因为之前已经通过checkInitialized()检查
            const { data } = await this.octokit!.users.getAuthenticated();
            return {
                login: data.login,
                name: data.name || data.login
            };
        } catch (error) {
            console.error('获取用户信息失败:', error);
            new Notice('GitHub Stars Manager: 获取用户信息失败，请检查令牌');
            return null;
        }
    }

    // Removed the convertToLocalRepositories method as it's no longer needed
    // The fetchStarredRepositories method now directly returns GithubRepository[]
    // including the starred_at field. User enhancements are handled separately.
}