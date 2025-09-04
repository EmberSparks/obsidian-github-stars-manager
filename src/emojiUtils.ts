/**
 * Emoji处理工具类
 * 用于在Obsidian中正确显示和导出emoji
 */
export class EmojiUtils {
    /**
     * 保护emoji不被转码的映射表
     */
    private static emojiProtectionMap: { [key: string]: string } = {
        ':rocket:': '🚀',
        ':star:': '⭐',
        ':fire:': '🔥',
        ':heart:': '❤️',
        ':thumbsup:': '👍',
        ':thumbsdown:': '👎',
        ':eyes:': '👀',
        ':tada:': '🎉',
        ':sparkles:': '✨',
        ':zap:': '⚡',
        ':boom:': '💥',
        ':bulb:': '💡',
        ':gear:': '⚙️',
        ':wrench:': '🔧',
        ':hammer:': '🔨',
        ':nut_and_bolt:': '🔩',
        ':package:': '📦',
        ':books:': '📚',
        ':book:': '📖',
        ':memo:': '📝',
        ':pencil:': '✏️',
        ':computer:': '💻',
        ':phone:': '📱',
        ':globe_with_meridians:': '🌐',
        ':link:': '🔗',
        ':lock:': '🔒',
        ':unlock:': '🔓',
        ':key:': '🔑',
        ':shield:': '🛡️',
        ':warning:': '⚠️',
        ':exclamation:': '❗',
        ':question:': '❓',
        ':information_source:': 'ℹ️',
        ':white_check_mark:': '✅',
        ':x:': '❌',
        ':heavy_check_mark:': '✔️',
        ':heavy_multiplication_x:': '✖️',
        ':arrow_right:': '➡️',
        ':arrow_left:': '⬅️',
        ':arrow_up:': '⬆️',
        ':arrow_down:': '⬇️',
        ':fast_forward:': '⏩',
        ':rewind:': '⏪',
        ':play_or_pause_button:': '⏯️',
        ':stop_button:': '⏹️',
        ':record_button:': '⏺️',
        ':construction:': '🚧',
        ':bug:': '🐛',
        ':art:': '🎨',
        ':lipstick:': '💄',
        ':rotating_light:': '🚨',
        ':green_heart:': '💚',
        ':blue_heart:': '💙',
        ':purple_heart:': '💜',
        ':yellow_heart:': '💛',
        ':orange_heart:': '🧡',
        ':black_heart:': '🖤',
        ':white_heart:': '🤍',
        ':brown_heart:': '🤎'
    };

    /**
     * 将短代码转换回emoji
     */
    public static restoreEmojis(text: string): string {
        if (!text) return text;
        
        let result = text;
        for (const [shortcode, emoji] of Object.entries(this.emojiProtectionMap)) {
            result = result.replace(new RegExp(shortcode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), emoji);
        }
        return result;
    }

    /**
     * 保护文本中的emoji不被转码（用于输入处理）
     */
    public static protectEmojis(text: string): string {
        if (!text) return text;
        
        // 使用Unicode范围匹配emoji
        const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
        
        // 创建临时占位符来保护emoji
        const emojiPlaceholders: { [key: string]: string } = {};
        let placeholderIndex = 0;
        
        const protectedText = text.replace(emojiRegex, (match) => {
            const placeholder = `__EMOJI_PLACEHOLDER_${placeholderIndex}__`;
            emojiPlaceholders[placeholder] = match;
            placeholderIndex++;
            return placeholder;
        });
        
        return protectedText;
    }

    /**
     * 恢复被保护的emoji
     */
    public static restoreProtectedEmojis(text: string, placeholders: { [key: string]: string }): string {
        if (!text || !placeholders) return text;
        
        let result = text;
        for (const [placeholder, emoji] of Object.entries(placeholders)) {
            result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), emoji);
        }
        
        return result;
    }

    /**
     * 为HTML元素设置包含emoji的文本内容
     */
    public static setEmojiText(element: HTMLElement, text: string): void {
        if (!element || !text) return;
        
        const processedText = this.restoreEmojis(text);
        element.innerHTML = processedText;
    }

    /**
     * 为HTML元素设置包含emoji的属性值
     */
    public static setEmojiAttribute(element: HTMLElement, attribute: string, value: string): void {
        if (!element || !value) return;
        
        const processedValue = this.restoreEmojis(value);
        element.setAttribute(attribute, processedValue);
    }

    /**
     * 检查文本是否包含emoji短代码
     */
    public static hasEmojiShortcodes(text: string): boolean {
        if (!text) return false;
        
        return Object.keys(this.emojiProtectionMap).some(shortcode => text.includes(shortcode));
    }

    /**
     * 获取所有支持的emoji短代码
     */
    public static getSupportedShortcodes(): string[] {
        return Object.keys(this.emojiProtectionMap);
    }

    /**
     * 添加新的emoji映射
     */
    public static addEmojiMapping(shortcode: string, emoji: string): void {
        this.emojiProtectionMap[shortcode] = emoji;
    }
}