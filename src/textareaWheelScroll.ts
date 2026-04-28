export function shouldCaptureTextareaWheel(options: {
    scrollTop: number;
    clientHeight: number;
    scrollHeight: number;
    deltaY: number;
}): boolean {
    const scrollTop = Math.max(0, options.scrollTop);
    const clientHeight = Math.max(0, options.clientHeight);
    const scrollHeight = Math.max(0, options.scrollHeight);

    if (clientHeight <= 0 || scrollHeight <= clientHeight) {
        return false;
    }

    if (options.deltaY < 0) {
        return scrollTop > 0;
    }

    if (options.deltaY > 0) {
        return (scrollTop + clientHeight) < scrollHeight;
    }

    return false;
}
