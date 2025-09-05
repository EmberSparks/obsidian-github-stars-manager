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
        console.log('=== Emoji转换测试 ===');
        
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
            console.log(`测试 ${index + 1}:`);
            console.log(`  输入: ${testCase}`);
            console.log(`  输出: ${result}`);
            console.log(`  包含短代码: ${EmojiUtils.hasEmojiShortcodes(testCase)}`);
            console.log('---');
        });
    }

    /**
     * 测试仓库描述中的emoji处理
     */
    static testRepositoryDescription(): void {
        console.log('=== 仓库描述Emoji测试 ===');
        
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
            console.log(`描述 ${index + 1}:`);
            console.log(`  原始: ${desc}`);
            console.log(`  处理后: ${processed}`);
            console.log('---');
        });
    }

    /**
     * 测试用户笔记中的emoji处理
     */
    static testUserNotes(): void {
        console.log('=== 用户笔记Emoji测试 ===');
        
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
            console.log(`笔记 ${index + 1}:`);
            console.log(`  原始: ${note}`);
            console.log(`  处理后: ${processed}`);
            console.log('---');
        });
    }

    /**
     * 测试导出内容中的emoji处理
     */
    static testExportContent(): void {
        console.log('=== 导出内容Emoji测试 ===');
        
        const mockExportContent = `---
GSM-title: awesome-project
GSM-description: :rocket: A fast web framework
GSM-user-notes: 很有用的工具 :thumbsup:
GSM-user-tags:
  - :fire: hot
  - :sparkles: awesome
---`;

        const processed = EmojiUtils.restoreEmojis(mockExportContent);
        console.log('导出内容测试:');
        console.log('原始内容:');
        console.log(mockExportContent);
        console.log('\n处理后内容:');
        console.log(processed);
    }

    /**
     * 运行所有测试
     */
    static runAllTests(): void {
        console.log('🧪 开始Emoji处理功能测试...\n');
        
        this.testEmojiConversion();
        this.testRepositoryDescription();
        this.testUserNotes();
        this.testExportContent();
        
        console.log('✅ 所有测试完成！');
        console.log('\n支持的emoji短代码:');
        console.log(EmojiUtils.getSupportedShortcodes().join(', '));
    }

    /**
     * 模拟HTML元素设置测试
     */
    static testHTMLElementSetting(): void {
        console.log('=== HTML元素设置测试 ===');
        
        // 创建模拟的HTML元素
        const mockElement = {
            innerHTML: '',
            setAttribute: function(attr: string, value: string) {
                console.log(`设置属性 ${attr}: ${value}`);
            }
        } as any;

        const testTexts = [
            ':rocket: 快速启动',
            '🎉 原生emoji',
            ':fire: 热门项目 :star:'
        ];

        testTexts.forEach((text, index) => {
            console.log(`HTML测试 ${index + 1}:`);
            console.log(`  原始文本: ${text}`);
            EmojiUtils.setEmojiText(mockElement, text);
            console.log(`  设置结果: ${mockElement.innerHTML}`);
            console.log('---');
        });
    }
}

// 如果直接运行此文件，执行测试
if (typeof window === 'undefined') {
    // Node.js环境下的测试
    EmojiTest.runAllTests();
    EmojiTest.testHTMLElementSetting();
}