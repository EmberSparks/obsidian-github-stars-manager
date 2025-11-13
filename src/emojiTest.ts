/**
 * Emoji处理功能测试文件
 * 用于验证emoji在显示和导出时的正确处理
 */
import { EmojiUtils } from './emojiUtils';

export class EmojiTest {
    /**
     * 测试emoji短代码转换
     */
    static testEmojiConversion(): void {
        console.debug('=== Emoji转换测试 ===');

        const testCases = [
            ':rocket: 快速部署',
            '这是一个很棒的项目 :fire:',
            ':star: GitHub Stars Manager :sparkles:',
            '🚀 原生emoji测试',
            ':heart: 混合测试 🎉 :thumbsup:',
            '普通文本没有emoji',
            ':rocket::fire::star: 连续emoji',
            'Bug修复 :bug: 和新功能 :sparkles:'
        ];

        testCases.forEach((testCase, index) => {
            const result = EmojiUtils.restoreEmojis(testCase);
            console.debug(`测试 ${index + 1}:`);
            console.debug(`  输入: ${testCase}`);
            console.debug(`  输出: ${result}`);
            console.debug(`  包含短代码: ${EmojiUtils.hasEmojiShortcodes(testCase)}`);
            console.debug('---');
        });
    }

    /**
     * 测试仓库描述中的emoji处理
     */
    static testRepositoryDescription(): void {
        console.debug('=== 仓库描述Emoji测试 ===');

        const mockDescriptions = [
            '🚀 A fast and modern web framework',
            ':fire: Hot reloading development server',
            'Machine Learning toolkit :brain: for beginners',
            '⚡ Lightning fast build tool',
            ':package: Package manager with :heart:',
            'React components library :sparkles: with TypeScript support'
        ];

        mockDescriptions.forEach((desc, index) => {
            const processed = EmojiUtils.restoreEmojis(desc);
            console.debug(`描述 ${index + 1}:`);
            console.debug(`  原始: ${desc}`);
            console.debug(`  处理后: ${processed}`);
            console.debug('---');
        });
    }

    /**
     * 测试用户笔记中的emoji处理
     */
    static testUserNotes(): void {
        console.debug('=== 用户笔记Emoji测试 ===');

        const mockNotes = [
            '很有用的工具 :thumbsup:',
            ':memo: 需要学习的项目',
            '已经在生产环境使用 :white_check_mark:',
            '🔥 非常推荐！',
            ':warning: 注意版本兼容性',
            '待研究 :eyes: 看起来很有趣'
        ];

        mockNotes.forEach((note, index) => {
            const processed = EmojiUtils.restoreEmojis(note);
            console.debug(`笔记 ${index + 1}:`);
            console.debug(`  原始: ${note}`);
            console.debug(`  处理后: ${processed}`);
            console.debug('---');
        });
    }

    /**
     * 测试导出内容中的emoji处理
     */
    static testExportContent(): void {
        console.debug('=== 导出内容Emoji测试 ===');

        const mockExportContent = `---
GSM-title: awesome-project
GSM-description: :rocket: A fast web framework
GSM-user-notes: 很有用的工具 :thumbsup:
GSM-user-tags:
  - :fire: hot
  - :sparkles: awesome
---`;

        const processed = EmojiUtils.restoreEmojis(mockExportContent);
        console.debug('导出内容测试:');
        console.debug('原始内容:');
        console.debug(mockExportContent);
        console.debug('\n处理后内容:');
        console.debug(processed);
    }

    /**
     * 运行所有测试
     */
    static runAllTests(): void {
        console.debug('🧪 开始Emoji处理功能测试...\n');

        this.testEmojiConversion();
        this.testRepositoryDescription();
        this.testUserNotes();
        this.testExportContent();

        console.debug('✅ 所有测试完成！');
        console.debug('\n支持的emoji短代码:');
        console.debug(EmojiUtils.getSupportedShortcodes().join(', '));
    }

    /**
     * 模拟HTML元素设置测试
     */
    static testHTMLElementSetting(): void {
        console.debug('=== HTML元素设置测试 ===');

        // 创建模拟的HTML元素
        interface MockElement {
            innerHTML: string;
            setAttribute: (attr: string, value: string) => void;
        }

        const mockElement: MockElement = {
            innerHTML: '',
            setAttribute: function(attr: string, value: string) {
                console.debug(`设置属性 ${attr}: ${value}`);
            }
        };

        const testTexts = [
            ':rocket: 快速启动',
            '🎉 原生emoji',
            ':fire: 热门项目 :star:'
        ];

        testTexts.forEach((text, index) => {
            console.debug(`HTML测试 ${index + 1}:`);
            console.debug(`  原始文本: ${text}`);
            EmojiUtils.setEmojiText(mockElement as unknown as HTMLElement, text);
            console.debug(`  设置结果: ${mockElement.innerHTML}`);
            console.debug('---');
        });
    }
}

// 如果直接运行此文件，执行测试
if (typeof window === 'undefined') {
    // Node.js环境下的测试
    EmojiTest.runAllTests();
    EmojiTest.testHTMLElementSetting();
}