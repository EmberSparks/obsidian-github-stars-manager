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
    enableExport: boolean; // 导出功能开关
    includeProperties: boolean; // 是否包含Properties
    propertiesTemplate: PropertyTemplate[]; // Properties模板配置
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
    // 导出选项
    exportOptions?: ExportOptions;
}

// 合并设置和插件数据的接口 (修改后)
export interface CombinedPluginData {
    settings: GithubStarsSettings;
    pluginData: PluginData;
}

// 移除 LocalRepository 接口，因为它被 githubRepositories 和 userEnhancements 替代了

// Properties模板项接口
export interface PropertyTemplate {
    key: string; // 属性键名
    value: string; // 属性值模板（支持变量）
    type: 'text' | 'number' | 'date' | 'checkbox' | 'tags'; // 属性类型
    description: string; // 中文描述
    enabled: boolean; // 是否启用该属性
}

// 导出功能相关类型定义
export interface ExportOptions {
    // 导出格式
    format: 'markdown';
    // 导出目标目录（相对于vault根目录）
    targetFolder: string;
    // 是否包含用户增强信息（笔记、标签）
    includeEnhancements: boolean;
    // 是否包含仓库统计信息
    includeStats: boolean;
    // 是否包含仓库主题标签
    includeTopics: boolean;
    // 文件名模板
    filenameTemplate: string;
    // 是否覆盖已存在的文件
    overwriteExisting: boolean;
    // 是否包含Properties前置内容
    includeProperties: boolean;
    // Properties模板配置
    propertiesTemplate: PropertyTemplate[];
}

// 导出结果接口
export interface ExportResult {
    success: boolean;
    exportedCount: number;
    skippedCount: number;
    errors: string[];
    exportedFiles: string[];
}

// 单个仓库导出数据接口
export interface RepoExportData {
    repository: GithubRepository;
    enhancements?: UserRepoEnhancements;
    filename: string;
    content: string;
}

// 默认Properties模板
export const DEFAULT_PROPERTIES_TEMPLATE: PropertyTemplate[] = [
    {
        key: 'GSM-title',
        value: '{{full_name}}',
        type: 'text',
        description: '仓库标题（完整名称）',
        enabled: true
    },
    {
        key: 'GSM-name',
        value: '{{name}}',
        type: 'text',
        description: '仓库名称',
        enabled: true
    },
    {
        key: 'GSM-owner',
        value: '{{owner}}',
        type: 'text',
        description: '仓库所有者',
        enabled: true
    },
    {
        key: 'GSM-url',
        value: '{{url}}',
        type: 'text',
        description: '仓库链接',
        enabled: true
    },
    {
        key: 'GSM-description',
        value: '{{description}}',
        type: 'text',
        description: '仓库描述',
        enabled: true
    },
    {
        key: 'GSM-language',
        value: '{{language}}',
        type: 'text',
        description: '主要编程语言',
        enabled: true
    },
    {
        key: 'GSM-stars',
        value: '{{stars}}',
        type: 'number',
        description: 'Star数量',
        enabled: true
    },
    {
        key: 'GSM-forks',
        value: '{{forks}}',
        type: 'number',
        description: 'Fork数量',
        enabled: true
    },
    {
        key: 'GSM-watchers',
        value: '{{watchers}}',
        type: 'number',
        description: 'Watcher数量',
        enabled: false
    },
    {
        key: 'GSM-issues',
        value: '{{issues}}',
        type: 'number',
        description: '开放Issue数量',
        enabled: false
    },
    {
        key: 'GSM-topics',
        value: '{{topics}}',
        type: 'tags',
        description: '主题标签',
        enabled: false
    },
    {
        key: 'GSM-created-at',
        value: '{{created_at}}',
        type: 'date',
        description: '仓库创建时间',
        enabled: true
    },
    {
        key: 'GSM-updated-at',
        value: '{{updated_at}}',
        type: 'date',
        description: '最后更新时间',
        enabled: false
    },
    {
        key: 'GSM-pushed-at',
        value: '{{pushed_at}}',
        type: 'date',
        description: '最后推送时间',
        enabled: false
    },
    {
        key: 'GSM-starred-at',
        value: '{{starred_at}}',
        type: 'date',
        description: '加星时间',
        enabled: true
    },
    {
        key: 'GSM-is-private',
        value: '{{is_private}}',
        type: 'checkbox',
        description: '是否为私有仓库',
        enabled: false
    },
    {
        key: 'GSM-is-fork',
        value: '{{is_fork}}',
        type: 'checkbox',
        description: '是否为Fork仓库',
        enabled: false
    },
    {
        key: 'GSM-repo-id',
        value: '{{id}}',
        type: 'number',
        description: '仓库ID',
        enabled: false
    },
    {
        key: 'GSM-user-notes',
        value: '{{notes}}',
        type: 'text',
        description: '用户笔记',
        enabled: true
    },
    {
        key: 'GSM-user-tags',
        value: '{{user_tags}}',
        type: 'tags',
        description: '用户标签',
        enabled: true
    },
    {
        key: 'GSM-linked-note',
        value: '{{linked_note}}',
        type: 'text',
        description: '关联笔记',
        enabled: false
    }
];

// 默认导出选项
export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
    format: 'markdown',
    targetFolder: 'GitHub Stars',
    includeEnhancements: true,
    includeStats: true,
    includeTopics: true,
    filenameTemplate: '{{owner}}-{{name}}',
    overwriteExisting: false,
    includeProperties: true,
    propertiesTemplate: DEFAULT_PROPERTIES_TEMPLATE
};