export interface LanguageOption {
    code: string;
    name: string;
    nativeName?: string;
    flag: string;
}

export const SUPPORTED_LANGUAGES: Record<string, LanguageOption> = {
    zh: {
        code: "zh",
        name: "中文",
        nativeName: "中文",
        flag: "🇨🇳",
    },
    en: {
        code: "en",
        name: "English",
        nativeName: "English",
        flag: "🇬🇧",
    },
    fr: {
        code: "fr",
        name: "Français",
        nativeName: "Français",
        flag: "🇫🇷",
    },
} as const;

export type LanguageCode = keyof typeof SUPPORTED_LANGUAGES;

export const SOURCE_LANGUAGE_CODES = ["zh", "fr"] as const;
export type SourceLanguageCode = (typeof SOURCE_LANGUAGE_CODES)[number];

export const TARGET_LANGUAGE_CODES = ["en"] as const;
export type TargetLanguageCode = (typeof TARGET_LANGUAGE_CODES)[number];

export const DEFAULT_SOURCE_LANGUAGE: SourceLanguageCode = "zh";
export const DEFAULT_TARGET_LANGUAGE: TargetLanguageCode = "en";

export const SOURCE_LANGUAGE_OPTIONS: LanguageOption[] =
    SOURCE_LANGUAGE_CODES.map((code) => SUPPORTED_LANGUAGES[code]);

export const TARGET_LANGUAGE_OPTIONS: LanguageOption[] =
    TARGET_LANGUAGE_CODES.map((code) => SUPPORTED_LANGUAGES[code]);

export const ALL_LANGUAGE_CODES: LanguageCode[] = Array.from(
    new Set<LanguageCode>([
        ...TARGET_LANGUAGE_CODES,
        ...SOURCE_LANGUAGE_CODES,

        ...(Object.keys(SUPPORTED_LANGUAGES) as LanguageCode[]),
    ]),
);

export const ALL_LANGUAGE_OPTIONS: LanguageOption[] = ALL_LANGUAGE_CODES.map(
    (code) => SUPPORTED_LANGUAGES[code],
);

export function getLanguageOption(code: string): LanguageOption | undefined {
    return SUPPORTED_LANGUAGES[code];
}

export function isSupportedLanguage(code: string): code is LanguageCode {
    return (ALL_LANGUAGE_CODES as readonly string[]).includes(code);
}

export function isSourceLanguage(code: string): code is SourceLanguageCode {
    return SOURCE_LANGUAGE_CODES.some((lang) => lang === code);
}

export function isTargetLanguage(code: string): code is TargetLanguageCode {
    return TARGET_LANGUAGE_CODES.some((lang) => lang === code);
}

export function getSourceLanguageOptions(): LanguageOption[] {
    return SOURCE_LANGUAGE_CODES.map((lang) => SUPPORTED_LANGUAGES[lang]);
}

export function getTargetLanguageOptions(): LanguageOption[] {
    return TARGET_LANGUAGE_CODES.map((lang) => SUPPORTED_LANGUAGES[lang]);
}

export function sanitizeSourceLanguage(
    code: string | null | undefined,
): SourceLanguageCode {
    return code && isSourceLanguage(code) ? code : DEFAULT_SOURCE_LANGUAGE;
}

export function sanitizeTargetLanguage(
    code: string | null | undefined,
): TargetLanguageCode {
    return code && isTargetLanguage(code) ? code : DEFAULT_TARGET_LANGUAGE;
}
