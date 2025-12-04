import { TranslationKeys } from './en';

export const zh: TranslationKeys = {
    // 通用
    common: {
        confirm: '确认',
        cancel: '取消',
        save: '保存',
        delete: '删除',
        edit: '编辑',
        close: '关闭',
        selectAll: '全选',
        deselectAll: '取消全选',
        loading: '加载中...',
        success: '成功',
        error: '错误',
        warning: '警告',
    },

    // 视图
    view: {
        title: 'GitHub 星标仓库',
        syncButton: '同步仓库',
        searchPlaceholder: '搜索仓库...',
        clearSearch: '清除搜索',
        addAccount: '+ 添加账号',
        accountsLabel: '账号',
        exportMode: '导出模式',
        exitExportMode: '退出导出模式',
        exportSelected: '确认导出',
        exporting: '导出中...',
        confirmExport: '确认导出',
        cancelExport: '取消导出',
        noRepos: '没有星标仓库。点击同步按钮从GitHub获取。',
        noMatchingRepos: '没有匹配的仓库。',
        noTags: '无标签',
        showMore: '更多',
        showLess: '收起',
        editRepo: '编辑',
        cannotEditRepo: '无法编辑此仓库信息',
        sortBy: {
            starred: '最近添加',
            stars: 'Star数量',
            forks: 'Fork数量',
            updated: '最近更新',
            asc: '升序',
            desc: '降序',
        },
        theme: {
            toggle: '切换主题',
            switchToDefault: '切换到默认主题',
            switchToIosGlass: '切换到iOS液态玻璃主题',
            default: '默认',
            iosGlass: 'iOS液态玻璃',
        },
    },

    // 同步
    sync: {
        syncing: '正在同步GitHub星标...',
        success: 'GitHub 星标同步成功',
        partialSuccess: '同步部分完成：{success} 个账号成功，共 {repos} 个仓库\n失败账号: {failed}',
        failed: '同步失败：所有账号都无法同步\n失败账号: {failed}\n请检查访问令牌是否有效',
        error: '同步失败，请检查设置和网络连接',
        noAccounts: '请先在设置中配置GitHub账号或个人访问令牌',
    },

    // 仓库
    repo: {
        stars: '星标',
        forks: 'Fork',
        updated: '更新于',
        language: '语言',
        addNote: '添加笔记',
        editNote: '编辑笔记',
        addTags: '添加标签',
        linkNote: '关联笔记',
        openInGithub: '在GitHub中打开',
        copyUrl: '复制链接',
        export: '导出',
    },

    // 弹窗
    modal: {
        editRepo: '编辑仓库',
        notes: '笔记',
        notesPlaceholder: '在这里添加你的笔记...',
        tags: '标签',
        tagsDesc: '用逗号分隔标签',
        tagsPlaceholder: 'web development, api, tutorial',
        selectExistingTags: '选择已有标签：',
        linkedNote: '关联笔记',
        linkedNoteDesc: '关联到Obsidian中的笔记',
        notePath: '笔记路径',
        browse: '浏览',
        searchNote: '搜索并选择笔记...',
        noNoteSelected: '未选择笔记',
        removeLink: '移除关联',
        selectNote: '选择笔记',
        searchNotes: '搜索笔记...',
        noMatchingNotes: '没有匹配的笔记',
        cancel: '取消',
        save: '保存',
    },

    // 导出
    export: {
        title: '批量导出仓库',
        selectRepos: '选择要导出为Markdown文件的仓库：',
        exportButton: '导出选中的仓库',
        selectFirst: '请先选择要导出的仓库',
        success: '导出完成！成功导出 {count} 个仓库',
        partialSuccess: '导出完成，但有错误。成功导出 {success} 个仓库，失败 {failed} 个',
        failed: '导出失败，请检查路径和权限设置',
        error: '导出失败，请查看控制台了解详情',
        fileExists: '文件已存在',
        overwrite: '覆盖',
        skip: '跳过',
        fileExistsDesc: '是否要覆盖已存在的文件？',
    },

    // 设置
    settings: {
        // 账号部分
        accountsHeading: 'GitHub 账号',
        accountsDesc: '管理多个GitHub账号。每个账号需要一个个人访问令牌。',
        addAccountButton: '添加账号',
        noAccounts: '还未配置GitHub账号',

        // 账号项
        accountEnabled: '已启用',
        accountDisabled: '已禁用',
        lastSync: '上次同步：',
        validate: '验证',
        remove: '删除',
        validating: '验证中...',
        valid: '令牌有效',
        invalid: '令牌无效',

        // 添加账号弹窗
        addAccountTitle: '添加GitHub账号',
        editAccountTitle: '编辑GitHub账号',
        tokenLabel: '个人访问令牌',
        tokenPlaceholder: 'ghp_xxxxxxxxxxxx',
        tokenDesc: '需要read:user和public_repo权限的GitHub个人访问令牌',
        howToGetToken: '如何获取令牌？',
        validateAndSave: '验证并保存',
        accountAdded: '账号 {username} 添加成功',
        accountUpdated: '账号 {username} 更新成功',
        accountRemoved: '账号 {username} 已删除',
        accountEnabled_: '账号 {username} 已启用',
        accountDisabled_: '账号 {username} 已禁用',

        // 同步设置
        autoSyncHeading: '自动同步',
        autoSync: '启用自动同步',
        autoSyncDesc: '自动同步星标仓库',
        syncInterval: '同步间隔',
        syncIntervalDesc: '同步频率（分钟）',

        // 导出设置
        exportHeading: '导出',
        enableExport: '启用导出',
        enableExportDesc: '启用批量导出仓库到Markdown文件',
        exportPath: '导出路径',
        exportPathDesc: '导出文件保存的目录',
        exportPathPlaceholder: '笔记/GitHub',

        // 主题设置
        themeHeading: '主题',
        themeDesc: '选择视觉主题',
        themeDefault: '默认',
        themeIosGlass: 'iOS液态玻璃',

        // 语言设置
        languageHeading: '语言',
        languageDesc: '选择显示语言',
        languageEn: 'English',
        languageZh: '简体中文',

        // Properties模板
        propertiesHeading: 'Properties 模板',
        propertiesDesc: '自定义导出Markdown文件的YAML frontmatter模板',
        propertiesPlaceholder: 'tags:\n  - github\n  - {{language}}\nstars: {{stars}}\nurl: {{url}}',
        propertiesHelp: '可用变量：{{name}}, {{language}}, {{stars}}, {{forks}}, {{description}}, {{url}}, {{topics}}',
    },

    // 时间
    time: {
        justNow: '刚刚',
        minutesAgo: '{n} 分钟前',
        hoursAgo: '{n} 小时前',
        daysAgo: '{n} 天前',
        monthsAgo: '{n} 个月前',
        yearsAgo: '{n} 年前',
        unknown: '未知',
    },

    // 通知
    notices: {
        enterExportMode: '已进入导出模式，请选择要导出的仓库',
        exitExportMode: '已退出导出模式',
        urlCopied: 'URL已复制到剪贴板',
        repoUpdated: '仓库信息已更新',
        selectReposFirst: '请先选择要导出的仓库',
        exportSuccess: '导出完成！成功导出 {exportedCount} 个仓库，跳过 {skippedCount} 个',
        exportPartialSuccess: '导出完成，但有错误。成功导出 {exportedCount} 个仓库，失败 {errorCount} 个',
        exportFailed: '导出失败，请查看控制台了解详情',
        accountEnabled: '账号 {username} 已启用',
        accountDisabled: '账号 {username} 已禁用',
        sortByNotice: '按{sortBy}{order}排序',
        themeSwitch: '已切换到{theme}主题',
    },
};
