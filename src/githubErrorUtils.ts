export type GithubErrorKind = 'network' | 'auth' | 'rate_limit' | 'unknown';

export interface GithubErrorInfo {
    kind: GithubErrorKind;
    status?: number;
    message: string;
}

const NETWORK_ERROR_PATTERNS = [
    /ECONNRESET/i,
    /ETIMEDOUT/i,
    /ENOTFOUND/i,
    /ECONNREFUSED/i,
    /EAI_AGAIN/i,
    /fetch failed/i,
    /network/i,
    /socket/i,
    /timeout/i,
    /getaddrinfo/i
];

const AUTH_ERROR_PATTERNS = [
    /Bad credentials/i,
    /Requires authentication/i,
    /Unauthorized/i,
    /authentication failed/i
];

const RATE_LIMIT_ERROR_PATTERNS = [
    /rate limit/i,
    /secondary rate limit/i,
    /abuse detection/i
];

function normalizeMessage(message: string): string {
    return message.replace(/\s+/g, ' ').trim();
}

function extractErrorStatus(error: unknown): number | undefined {
    if (!error || typeof error !== 'object') {
        return undefined;
    }

    const status = 'status' in error ? (error as { status?: unknown }).status : undefined;
    if (typeof status === 'number' && Number.isFinite(status)) {
        return status;
    }
    if (typeof status === 'string') {
        const parsedStatus = Number.parseInt(status, 10);
        return Number.isFinite(parsedStatus) ? parsedStatus : undefined;
    }

    const response = 'response' in error ? (error as { response?: { status?: unknown } }).response : undefined;
    const responseStatus = response?.status;
    if (typeof responseStatus === 'number' && Number.isFinite(responseStatus)) {
        return responseStatus;
    }
    if (typeof responseStatus === 'string') {
        const parsedStatus = Number.parseInt(responseStatus, 10);
        return Number.isFinite(parsedStatus) ? parsedStatus : undefined;
    }

    return undefined;
}

function extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return normalizeMessage(error.message || error.name || 'Unknown error');
    }
    if (typeof error === 'string') {
        return normalizeMessage(error);
    }
    if (error && typeof error === 'object' && 'message' in error) {
        const message = (error as { message?: unknown }).message;
        if (typeof message === 'string') {
            return normalizeMessage(message);
        }
    }

    return 'Unknown error';
}

export function createGithubHttpError(status: number, message?: string): Error & { status: number } {
    const error = new Error(message?.trim() || `GitHub request failed with status ${status}`) as Error & { status: number };
    error.status = status;
    return error;
}

export function classifyGithubError(error: unknown): GithubErrorInfo {
    const status = extractErrorStatus(error);
    const message = extractErrorMessage(error);

    if (status === 401 || AUTH_ERROR_PATTERNS.some((pattern) => pattern.test(message))) {
        return { kind: 'auth', status, message };
    }

    if (
        status === 403 &&
        RATE_LIMIT_ERROR_PATTERNS.some((pattern) => pattern.test(message))
    ) {
        return { kind: 'rate_limit', status, message };
    }

    if (RATE_LIMIT_ERROR_PATTERNS.some((pattern) => pattern.test(message))) {
        return { kind: 'rate_limit', status, message };
    }

    if (NETWORK_ERROR_PATTERNS.some((pattern) => pattern.test(message))) {
        return { kind: 'network', status, message };
    }

    return { kind: 'unknown', status, message };
}

export function summarizeGithubErrorKinds(errors: unknown[]): GithubErrorKind {
    const kinds = Array.from(new Set(errors.map((error) => classifyGithubError(error).kind)));
    if (kinds.length === 1) {
        return kinds[0];
    }
    return 'unknown';
}
