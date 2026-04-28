import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { classifyGithubError, summarizeGithubErrorKinds } from '../src/githubErrorUtils';

test('classifyGithubError 能识别网络错误', () => {
    const result = classifyGithubError(new Error('connect ETIMEDOUT api.github.com'));

    assert.equal(result.kind, 'network');
});

test('classifyGithubError 能识别鉴权错误', () => {
    const result = classifyGithubError({
        status: 401,
        message: 'Bad credentials'
    });

    assert.equal(result.kind, 'auth');
});

test('classifyGithubError 能识别限流错误', () => {
    const result = classifyGithubError({
        status: 403,
        message: 'API rate limit exceeded for 1.2.3.4.'
    });

    assert.equal(result.kind, 'rate_limit');
});

test('summarizeGithubErrorKinds 会在错误类型一致时返回该类型', () => {
    const result = summarizeGithubErrorKinds([
        new Error('socket hang up'),
        { message: 'fetch failed: getaddrinfo ENOTFOUND api.github.com' }
    ]);

    assert.equal(result, 'network');
});

test('summarizeGithubErrorKinds 会在错误类型混合时返回 unknown', () => {
    const result = summarizeGithubErrorKinds([
        { status: 401, message: 'Bad credentials' },
        new Error('socket hang up')
    ]);

    assert.equal(result, 'unknown');
});
