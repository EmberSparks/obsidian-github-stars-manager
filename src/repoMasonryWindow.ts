import type { MasonryLayoutPosition } from './repoMasonryLayout';

export interface MasonryWindowRange {
    startIndex: number;
    endIndex: number;
}

export interface MasonryWindowSnapshot {
    startIndex: number;
    endIndex: number;
    totalCount: number;
    layoutKey: string;
}

export function shouldUseMasonryWindowing(options: {
    loadedCount: number;
    minimumWindowingCount: number;
}): boolean {
    return Math.max(0, options.loadedCount) >= Math.max(1, options.minimumWindowingCount);
}

export function hasMasonryWindowSnapshotChanged(
    previousSnapshot: MasonryWindowSnapshot | null,
    nextSnapshot: MasonryWindowSnapshot
): boolean {
    if (!previousSnapshot) {
        return true;
    }

    return (
        previousSnapshot.startIndex !== nextSnapshot.startIndex ||
        previousSnapshot.endIndex !== nextSnapshot.endIndex ||
        previousSnapshot.totalCount !== nextSnapshot.totalCount ||
        previousSnapshot.layoutKey !== nextSnapshot.layoutKey
    );
}

export function getMasonryWindowRange(options: {
    positions: MasonryLayoutPosition[];
    itemHeights: number[];
    scrollTop: number;
    clientHeight: number;
    overscanPx: number;
}): MasonryWindowRange {
    const totalCount = Math.min(options.positions.length, options.itemHeights.length);
    if (totalCount === 0) {
        return {
            startIndex: 0,
            endIndex: -1
        };
    }

    const windowTop = Math.max(0, options.scrollTop - Math.max(0, options.overscanPx));
    const windowBottom = Math.max(
        windowTop,
        options.scrollTop + Math.max(0, options.clientHeight) + Math.max(0, options.overscanPx)
    );

    let startIndex = -1;
    let endIndex = -1;

    for (let index = 0; index < totalCount; index += 1) {
        const position = options.positions[index];
        const height = Math.max(0, options.itemHeights[index] || 0);
        const itemTop = position.top;
        const itemBottom = itemTop + height;

        if (itemBottom < windowTop) {
            continue;
        }
        if (itemTop > windowBottom) {
            if (startIndex === -1) {
                return {
                    startIndex: index,
                    endIndex: index
                };
            }
            break;
        }

        if (startIndex === -1) {
            startIndex = index;
        }
        endIndex = index;
    }

    if (startIndex !== -1) {
        return { startIndex, endIndex };
    }

    return {
        startIndex: totalCount - 1,
        endIndex: totalCount - 1
    };
}
