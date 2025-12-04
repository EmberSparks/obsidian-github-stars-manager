export const en = {
    // Common
    common: {
        confirm: 'Confirm',
        cancel: 'Cancel',
        save: 'Save',
        delete: 'Delete',
        edit: 'Edit',
        close: 'Close',
        selectAll: 'Select all',
        deselectAll: 'Deselect all',
        loading: 'Loading...',
        success: 'Success',
        error: 'Error',
        warning: 'Warning',
    },

    // View
    view: {
        title: 'GitHub Stars',
        syncButton: 'Sync repositories',
        searchPlaceholder: 'Search repositories...',
        clearSearch: 'Clear search',
        addAccount: '+ Add account',
        accountsLabel: 'Accounts',
        exportMode: 'Export mode',
        exitExportMode: 'Exit export mode',
        exportSelected: 'Export selected',
        noRepos: 'No repositories found',
        sortBy: {
            starred: 'Sort by starred time',
            stars: 'Sort by stars',
            forks: 'Sort by forks',
            updated: 'Sort by last update',
            asc: 'Ascending',
            desc: 'Descending',
        },
        theme: {
            toggle: 'Toggle theme',
            default: 'Default theme',
            iosGlass: 'iOS Glass theme',
        },
    },

    // Sync
    sync: {
        syncing: 'Syncing GitHub stars...',
        success: 'GitHub Stars Manager: Successfully synced {count} accounts, {repos} repositories',
        partialSuccess: 'Sync partially completed: {success} accounts succeeded, {repos} repositories\nFailed accounts: {failed}',
        failed: 'Sync failed: All accounts unable to sync\nFailed accounts: {failed}\nPlease check if access tokens are valid',
        error: 'Sync failed, please check settings and network connection',
        noAccounts: 'Please configure GitHub account or personal access token in settings first',
    },

    // Repository
    repo: {
        stars: 'stars',
        forks: 'forks',
        updated: 'Updated',
        language: 'Language',
        addNote: 'Add note',
        editNote: 'Edit note',
        addTags: 'Add tags',
        linkNote: 'Link to note',
        openInGithub: 'Open in GitHub',
        copyUrl: 'Copy URL',
        export: 'Export',
    },

    // Modal
    modal: {
        editRepo: 'Edit Repository',
        notes: 'Notes',
        notesPlaceholder: 'Add your notes here...',
        tags: 'Tags',
        tagsPlaceholder: 'web development, api, tutorial',
        selectExistingTags: 'Select existing tags:',
        linkedNote: 'Linked note',
        searchNote: 'Search and select a note...',
        noNoteSelected: 'No note selected',
        removeLink: 'Remove link',
    },

    // Export
    export: {
        title: 'Batch export repositories',
        selectRepos: 'Select repositories to export as Markdown files:',
        exportButton: 'Export selected repositories',
        selectFirst: 'Please select repositories to export first',
        success: 'Export completed! Successfully exported {count} repositories',
        partialSuccess: 'Export completed with errors. Successfully exported {success} repositories, {failed} failed',
        failed: 'Export failed, please check path and permission settings',
        error: 'Export failed, please check console for details',
        fileExists: 'File already exists',
        overwrite: 'Overwrite',
        skip: 'Skip',
        fileExistsDesc: 'Do you want to overwrite the existing file?',
    },

    // Settings
    settings: {
        // Accounts section
        accountsHeading: 'GitHub accounts',
        accountsDesc: 'Manage multiple GitHub accounts. Each account requires a personal access token.',
        addAccountButton: 'Add account',
        noAccounts: 'No GitHub accounts configured yet',

        // Account item
        accountEnabled: 'Enabled',
        accountDisabled: 'Disabled',
        lastSync: 'Last sync:',
        validate: 'Validate',
        remove: 'Remove',
        validating: 'Validating...',
        valid: 'Token valid',
        invalid: 'Token invalid',

        // Add account modal
        addAccountTitle: 'Add GitHub account',
        editAccountTitle: 'Edit GitHub account',
        tokenLabel: 'Personal access token',
        tokenPlaceholder: 'ghp_xxxxxxxxxxxx',
        tokenDesc: 'GitHub personal access token with read:user and public_repo scopes',
        howToGetToken: 'How to get a token?',
        validateAndSave: 'Validate and save',
        accountAdded: 'Account {username} added successfully',
        accountUpdated: 'Account {username} updated successfully',
        accountRemoved: 'Account {username} removed',
        accountEnabled_: 'Account {username} enabled',
        accountDisabled_: 'Account {username} disabled',

        // Sync settings
        autoSyncHeading: 'Auto sync',
        autoSync: 'Enable auto sync',
        autoSyncDesc: 'Automatically sync starred repositories',
        syncInterval: 'Sync interval',
        syncIntervalDesc: 'How often to sync (in minutes)',

        // Export settings
        exportHeading: 'Export',
        enableExport: 'Enable export',
        enableExportDesc: 'Enable bulk export of repositories to Markdown files',
        exportPath: 'Export path',
        exportPathDesc: 'Directory where exported files will be saved',
        exportPathPlaceholder: 'Notes/GitHub',

        // Theme settings
        themeHeading: 'Theme',
        themeDesc: 'Choose the visual theme',
        themeDefault: 'Default',
        themeIosGlass: 'iOS Glass',

        // Language settings
        languageHeading: 'Language',
        languageDesc: 'Choose display language',
        languageEn: 'English',
        languageZh: '简体中文',

        // Properties template
        propertiesHeading: 'Properties template',
        propertiesDesc: 'Customize YAML frontmatter template for exported Markdown files',
        propertiesPlaceholder: 'tags:\n  - github\n  - {{language}}\nstars: {{stars}}\nurl: {{url}}',
        propertiesHelp: 'Available variables: {{name}}, {{language}}, {{stars}}, {{forks}}, {{description}}, {{url}}, {{topics}}',
    },

    // Time
    time: {
        justNow: 'Just now',
        minutesAgo: '{n} minutes ago',
        hoursAgo: '{n} hours ago',
        daysAgo: '{n} days ago',
        monthsAgo: '{n} months ago',
        yearsAgo: '{n} years ago',
    },

    // Notices
    notices: {
        enterExportMode: 'Entered export mode, please select repositories to export',
        exitExportMode: 'Exited export mode',
        urlCopied: 'URL copied to clipboard',
        repoUpdated: 'Repository information updated',
    },
};

export type TranslationKeys = typeof en;
