import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { shouldCaptureTextareaWheel } from '../src/textareaWheelScroll';

test('向下滚动且 textarea 还有可滚动内容时应截留滚轮事件', () => {
    const result = shouldCaptureTextareaWheel({
        scrollTop: 24,
        clientHeight: 120,
        scrollHeight: 360,
        deltaY: 40
    });

    assert.equal(result, true);
});

test('向上滚动且 textarea 还未到顶部时应截留滚轮事件', () => {
    const result = shouldCaptureTextareaWheel({
        scrollTop: 18,
        clientHeight: 120,
        scrollHeight: 360,
        deltaY: -32
    });

    assert.equal(result, true);
});

test('已经滚到底部时向下滚动不应截留滚轮事件', () => {
    const result = shouldCaptureTextareaWheel({
        scrollTop: 240,
        clientHeight: 120,
        scrollHeight: 360,
        deltaY: 24
    });

    assert.equal(result, false);
});

test('内容未溢出时不应截留滚轮事件', () => {
    const result = shouldCaptureTextareaWheel({
        scrollTop: 0,
        clientHeight: 120,
        scrollHeight: 120,
        deltaY: 24
    });

    assert.equal(result, false);
});
