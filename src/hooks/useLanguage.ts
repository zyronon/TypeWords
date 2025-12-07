import { useSettingStore } from "@/stores/setting";

import { watch } from "vue";

import zhCN from "@/locales/zh-CN";

import frFR from "@/locales/fr-FR";
import {
    DEFAULT_SOURCE_LANGUAGE,
    sanitizeSourceLanguage,
    sanitizeTargetLanguage,
    SourceLanguageCode,
    TargetLanguageCode,
} from "@/libs/i18n/languages";

type MessageDictionary = Record<string, string>;
type MessageMap = Record<SourceLanguageCode, MessageDictionary>;

const messages: MessageMap = {
    zh: zhCN,
    fr: frFR,
};

type TranslationParams = Record<string, string | number>;

interface UseLanguageResult {
    t: (key: string, params?: TranslationParams) => string;
    changeLanguage: (lang: SourceLanguageCode) => void;
    changeTargetLanguage: (lang: TargetLanguageCode) => void;
    sourceLanguage: SourceLanguageCode;
    targetLanguage: TargetLanguageCode;
}

const missingTranslationLog = new Set<string>();

const logMissingTranslation = (lang: string, key: string) => {
    const cacheKey = `${lang}::${key}`;
    if (missingTranslationLog.has(cacheKey)) {
        return;
    }
    missingTranslationLog.add(cacheKey);
    console.warn(
        `[i18n] Missing translation for key "${key}" in language "${lang}"`,
    );
};

let languageWatchInitialized = false;

export function useLanguage(): UseLanguageResult {
    const settingStore = useSettingStore();

    const syncSourceLanguageSideEffects = (lang: string) => {
        localStorage.setItem("language", lang);
        document.documentElement.lang = lang;
    };

    const syncTargetLanguageSideEffects = (lang: string) => {
        localStorage.setItem("targetLanguage", lang);
    };

    const changeLanguage = (lang: SourceLanguageCode) => {
        const safeLang = sanitizeSourceLanguage(lang);
        if (settingStore.language !== safeLang) {
            settingStore.language = safeLang;
        }

        syncSourceLanguageSideEffects(safeLang);
    };

    const changeTargetLanguage = (lang: TargetLanguageCode) => {
        const safeLang = sanitizeTargetLanguage(lang);
        if (settingStore.targetLanguage !== safeLang) {
            settingStore.targetLanguage = safeLang;
        }
        syncTargetLanguageSideEffects(safeLang);
    };

    if (!languageWatchInitialized) {
        watch(
            () => settingStore.language,
            (newLang) => {
                if (newLang) {
                    const safeLang = sanitizeSourceLanguage(newLang);
                    if (safeLang !== settingStore.language) {
                        settingStore.language = safeLang;
                    }
                    syncSourceLanguageSideEffects(safeLang);
                }
            },
            { immediate: true },
        );

        watch(
            () => settingStore.targetLanguage,
            (newLang) => {
                if (newLang) {
                    const safeLang = sanitizeTargetLanguage(newLang);
                    if (safeLang !== settingStore.targetLanguage) {
                        settingStore.targetLanguage = safeLang;
                    }
                    syncTargetLanguageSideEffects(safeLang);
                }
            },
            { immediate: true },
        );

        languageWatchInitialized = true;
    }

    const interpolate = (
        template: string,
        params: Record<string, string | number>,
    ) => {
        if (!params || Object.keys(params).length === 0) {
            return template;
        }
        return template.replace(/\{(\w+)\}/g, (_, match) => {
            return match in params ? String(params[match]) : `{${match}}`;
        });
    };

    const t = (key: string, params: TranslationParams = {}) => {
        const currentLang = sanitizeSourceLanguage(settingStore.language);

        const fallbackChain: SourceLanguageCode[] =
            currentLang === DEFAULT_SOURCE_LANGUAGE
                ? [currentLang]
                : [currentLang, DEFAULT_SOURCE_LANGUAGE];

        for (const lang of fallbackChain) {
            const candidate = messages[lang]?.[key];
            if (typeof candidate === "string") {
                if (lang !== currentLang) {
                    logMissingTranslation(currentLang, key);
                }
                return interpolate(candidate, params);
            }
        }

        logMissingTranslation(currentLang, key);
        return key;
    };

    return {
        t,
        changeLanguage,
        changeTargetLanguage,
        sourceLanguage: sanitizeSourceLanguage(settingStore.language),
        targetLanguage: sanitizeTargetLanguage(settingStore.targetLanguage),
    };
}
