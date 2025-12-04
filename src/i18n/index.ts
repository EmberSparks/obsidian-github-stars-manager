import { en, TranslationKeys } from './en';
import { zh } from './zh';

export type Language = 'en' | 'zh';

const translations: Record<Language, TranslationKeys> = {
    en,
    zh,
};

/**
 * i18n utility class for managing translations
 */
export class I18n {
    private static currentLanguage: Language = 'en';

    /**
     * Set the current language
     */
    static setLanguage(lang: Language): void {
        this.currentLanguage = lang;
    }

    /**
     * Get the current language
     */
    static getLanguage(): Language {
        return this.currentLanguage;
    }

    /**
     * Get translation by key path
     * Example: t('view.title') returns 'GitHub Stars' or 'GitHub 星标仓库'
     */
    static t(keyPath: string, variables?: Record<string, string | number>): string {
        const keys = keyPath.split('.');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let value: any = translations[this.currentLanguage];

        for (const key of keys) {
            if (typeof value === 'object' && value !== null && key in value) {
                value = value[key];
            } else {
                console.warn(`Translation key not found: ${keyPath}`);
                return keyPath;
            }
        }

        if (typeof value !== 'string') {
            console.warn(`Translation value is not a string: ${keyPath}`);
            return keyPath;
        }

        // Replace variables in the string
        if (variables) {
            return value.replace(/\{(\w+)\}/g, (match, key) => {
                return key in variables ? String(variables[key]) : match;
            });
        }

        return value;
    }
}

// Export convenience function
export const t = I18n.t.bind(I18n);
