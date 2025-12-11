# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2025-12-11

### Fixed
- Remove decorative symbols from UI text for Obsidian plugin store compliance
- Apply sentence case formatting to all UI text strings
- Fix Promise handling in event listeners using void keyword
- Replace unreliable CSS nth-child selector with direct element references
- Resolve all ObsidianReviewBot review feedback from PR #7700

### Added
- ESLint configuration for local code quality checking (eslint.config.mjs)

### Changed
- Improve UI text consistency and readability across all components
- Enhance code quality and maintainability

## [0.1.0] - 2024-12-XX

### Added
- Initial release of GitHub Stars Manager
- Multi-account GitHub Stars management with token-based authentication
- iOS glass theme support with dynamic glass effects
- Responsive waterfall layout for repository display
- Advanced search and filtering by name, description, language, and tags
- Custom tags and notes functionality for each repository
- Link repositories to Obsidian notes
- Auto-sync and manual sync capabilities
- Sort repositories by starred time, stars count, forks count, or update time
- Export repositories as Markdown files with customizable properties template
- i18n support (English and Simplified Chinese)
- Theme switcher (Default and iOS Glass themes)
- Account management with enable/disable per account
- Total repository count display
- Comprehensive documentation (README, USAGE_GUIDE)

[0.1.1]: https://github.com/EmberSparks/obsidian-github-stars-manager/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/EmberSparks/obsidian-github-stars-manager/releases/tag/v0.1.0
