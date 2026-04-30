export interface MasonryLayoutPosition {
    left: number;
    top: number;
    width: number;
}

export interface MasonryItemSize {
    width: number;
    height: number;
}

export interface MasonryLayoutResult {
    columnCount: number;
    columnWidth: number;
    containerHeight: number;
    positions: MasonryLayoutPosition[];
}

export function hasMasonryItemSizeChanges(options: {
    previousSizes: MasonryItemSize[];
    nextSizes: MasonryItemSize[];
    tolerance?: number;
}): boolean {
    const tolerance = Math.max(0, options.tolerance ?? 0.75);
    if (options.previousSizes.length !== options.nextSizes.length) {
        return true;
    }

    return options.previousSizes.some((previousSize, index) => {
        const nextSize = options.nextSizes[index];
        if (!nextSize) {
            return true;
        }
        return (
            Math.abs(previousSize.width - nextSize.width) > tolerance ||
            Math.abs(previousSize.height - nextSize.height) > tolerance
        );
    });
}

export function calculateMasonryLayout(options: {
    containerWidth: number;
    minimumColumnWidth: number;
    columnGap: number;
    itemHeights: number[];
}): MasonryLayoutResult {
    const safeContainerWidth = Math.max(0, options.containerWidth);
    const minimumColumnWidth = Math.max(1, options.minimumColumnWidth);
    const columnGap = Math.max(0, options.columnGap);
    const itemHeights = options.itemHeights.map((height) => Math.max(0, height));

    const columnCount = Math.max(
        1,
        Math.floor((safeContainerWidth + columnGap) / (minimumColumnWidth + columnGap))
    );
    const columnWidth = columnCount === 1
        ? (safeContainerWidth > 0 ? safeContainerWidth : minimumColumnWidth)
        : ((safeContainerWidth - (columnGap * (columnCount - 1))) / columnCount);

    const columnHeights = Array.from({ length: columnCount }, () => 0);
    const positions: MasonryLayoutPosition[] = [];

    itemHeights.forEach((itemHeight) => {
        let targetColumnIndex = 0;
        let shortestColumnHeight = columnHeights[0];
        for (let index = 1; index < columnHeights.length; index += 1) {
            if (columnHeights[index] < shortestColumnHeight) {
                shortestColumnHeight = columnHeights[index];
                targetColumnIndex = index;
            }
        }

        positions.push({
            left: targetColumnIndex * (columnWidth + columnGap),
            top: shortestColumnHeight,
            width: columnWidth
        });

        columnHeights[targetColumnIndex] += itemHeight + columnGap;
    });

    const maxColumnHeight = columnHeights.length > 0 ? Math.max(...columnHeights) : 0;
    return {
        columnCount,
        columnWidth,
        containerHeight: Math.max(0, maxColumnHeight - columnGap),
        positions
    };
}
