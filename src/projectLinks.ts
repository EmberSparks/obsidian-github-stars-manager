import type { RepoProjectLink } from './types';

const PROJECT_LINK_SEPARATOR = '|';

function normalizeText(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function buildProjectLink(labelInput: string, urlInput: string): {
    link?: RepoProjectLink;
    error?: 'missing_url';
} {
    const url = normalizeText(urlInput);
    if (!url) {
        return { error: 'missing_url' };
    }

    const label = normalizeText(labelInput) || url;
    return {
        link: { label, url }
    };
}

export function normalizeProjectLinks(links: unknown): RepoProjectLink[] {
    if (!Array.isArray(links)) {
        return [];
    }

    return links.flatMap((link): RepoProjectLink[] => {
        const label = normalizeText((link as RepoProjectLink | undefined)?.label);
        const url = normalizeText((link as RepoProjectLink | undefined)?.url);
        if (!label || !url) {
            return [];
        }
        return [{ label, url }];
    });
}

export function parseProjectLinksInput(input: string): RepoProjectLink[] {
    return String(input || '')
        .split(/\r?\n/)
        .flatMap((line): RepoProjectLink[] => {
            const trimmedLine = line.trim();
            if (!trimmedLine) {
                return [];
            }

            const separatorIndex = trimmedLine.indexOf(PROJECT_LINK_SEPARATOR);
            if (separatorIndex === -1) {
                return [];
            }

            const label = trimmedLine.slice(0, separatorIndex).trim();
            const url = trimmedLine.slice(separatorIndex + 1).trim();
            return normalizeProjectLinks([{ label, url }]);
        });
}

export function serializeProjectLinksInput(links: RepoProjectLink[]): string {
    return normalizeProjectLinks(links)
        .map((link) => `${link.label} ${PROJECT_LINK_SEPARATOR} ${link.url}`)
        .join('\n');
}

export function appendProjectLink(
    links: RepoProjectLink[],
    labelInput: string,
    urlInput: string
): {
    links: RepoProjectLink[];
    error?: 'missing_url' | 'duplicate';
} {
    const nextLink = buildProjectLink(labelInput, urlInput);
    if (nextLink.error || !nextLink.link) {
        return {
            links: normalizeProjectLinks(links),
            error: nextLink.error
        };
    }

    const normalizedLinks = normalizeProjectLinks(links);
    const duplicate = normalizedLinks.some((link) =>
        link.label.toLowerCase() === nextLink.link!.label.toLowerCase() && link.url === nextLink.link!.url
    );
    if (duplicate) {
        return {
            links: normalizedLinks,
            error: 'duplicate'
        };
    }

    return {
        links: [...normalizedLinks, nextLink.link]
    };
}

export function replaceProjectLink(
    links: RepoProjectLink[],
    index: number,
    labelInput: string,
    urlInput: string
): {
    links: RepoProjectLink[];
    error?: 'missing_url' | 'duplicate' | 'index_out_of_range';
} {
    const normalizedLinks = normalizeProjectLinks(links);
    if (index < 0 || index >= normalizedLinks.length) {
        return {
            links: normalizedLinks,
            error: 'index_out_of_range'
        };
    }

    const nextLink = buildProjectLink(labelInput, urlInput);
    if (nextLink.error || !nextLink.link) {
        return {
            links: normalizedLinks,
            error: nextLink.error
        };
    }

    const duplicate = normalizedLinks.some((link, currentIndex) =>
        currentIndex !== index &&
        link.label.toLowerCase() === nextLink.link!.label.toLowerCase() &&
        link.url === nextLink.link!.url
    );
    if (duplicate) {
        return {
            links: normalizedLinks,
            error: 'duplicate'
        };
    }

    const nextLinks = [...normalizedLinks];
    nextLinks[index] = nextLink.link;
    return {
        links: nextLinks
    };
}
