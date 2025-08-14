/**
 * GitHub Stars Manager类型定义文件
 */

// GitHub账号配置接口
export interface GithubAccount {
    id: string; // 唯一标识符
    name: string; // 账号显示名称
    username: string; // GitHub用户名
    token: string; // GitHub个人访问令牌
    enabled: boolean; // 是否启用同步
    avatar_url?: string; // 用户头像URL
}

// 插件设置接口 (修改为支持多账号)
export interface GithubStarsSettings {
    githubToken: string; // 保留向后兼容
    accounts: GithubAccount[]; // 多个GitHub账号
    autoSync: boolean;
    syncInterval: number; // 单位：分钟
    theme: 'default' | 'ios-glass'; // 新增主题设置
}

// GitHub仓库接口（来自GitHub API, 包含 starred_at）
// 保留 GithubRepository 定义，确保包含所有需要的字段，包括 starred_at
export interface GithubRepository {
    id: number;
    node_id: string;
    name: string;
    full_name: string;
    private: boolean;
    owner: {
        login: string;
        avatar_url: string;
    };
    html_url: string;
    description: string | null;
    fork: boolean;
    url: string;
    stargazers_count: number;
    watchers_count: number;
    language: string | null;
    forks_count: number;
    open_issues_count: number;
    topics: string[];
    created_at: string;
    updated_at: string;
    pushed_at: string;
    starred_at?: string; // GitHub API v3 uses this field for starred repos
    account_id?: string; // 标识来源账号
}

// 新增：用户为仓库添加的增强信息接口
export interface UserRepoEnhancements {
    notes: string;
    tags: string[];
    linked_note?: string;
}

// 插件核心数据接口 (修改后)
export interface PluginData {
    // 存储从 GitHub 获取的仓库列表 (包含 starred_at 和 account_id)
    githubRepositories: GithubRepository[];
    // 存储用户为每个仓库添加的笔记、标签等信息，以 repo ID 为 key
    userEnhancements: {
        [repoId: number]: UserRepoEnhancements;
    };
    // 全局标签列表 (从 userEnhancements 动态生成或单独存储)
    // 为了简单起见，暂时可以每次渲染时从 userEnhancements 动态生成
    // 或者在保存 userEnhancements 时更新一个单独的 allTags 列表
    allTags: string[]; // 存储所有用户定义的标签
    lastSyncTime: string;
    // 每个账号的最后同步时间
    accountSyncTimes: {
        [accountId: string]: string;
    };
}

// 合并设置和插件数据的接口 (修改后)
export interface CombinedPluginData {
    settings: GithubStarsSettings;
    pluginData: PluginData;
}

// 移除 LocalRepository 接口，因为它被 githubRepositories 和 userEnhancements 替代了