import type { UserRepoEnhancements } from './types';

type UserEnhancementsMap = Record<number | string, UserRepoEnhancements>;

export function normalizeAssociatedTagName(tagName: string): string {
    return tagName.trim().toLowerCase();
}

export function countTagAssociations(
    userEnhancements: UserEnhancementsMap | null | undefined,
    tagName: string
): number {
    const normalizedTagName = normalizeAssociatedTagName(tagName);
    if (!normalizedTagName || !userEnhancements) return 0;

    let associatedRepositoryCount = 0;
    Object.values(userEnhancements).forEach((enhancement) => {
        if (!Array.isArray(enhancement?.tags) || enhancement.tags.length === 0) {
            return;
        }

        const hasAssociatedTag = enhancement.tags.some(
            (tag) => normalizeAssociatedTagName(tag) === normalizedTagName
        );
        if (hasAssociatedTag) {
            associatedRepositoryCount += 1;
        }
    });

    return associatedRepositoryCount;
}

export function getTagDisplayCount(options: {
    tagName: string;
    visibleCount: number;
    isTagManageMode: boolean;
    userEnhancements: UserEnhancementsMap | null | undefined;
}): number {
    if (!options.isTagManageMode) {
        return options.visibleCount;
    }

    return countTagAssociations(options.userEnhancements, options.tagName);
}
