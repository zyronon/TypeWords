import { defineStore } from "pinia";
import { checkAndUpgradeSaveSetting, cloneDeep } from "@/utils";
import { DefaultShortcutKeyMap } from "@/types/types.ts";
import { get } from "idb-keyval";
import { CAN_REQUEST, SAVE_SETTING_KEY } from "@/config/env.ts";
import { getSetting } from "@/apis";
import {
    DEFAULT_SOURCE_LANGUAGE,
    DEFAULT_TARGET_LANGUAGE,
    sanitizeSourceLanguage,
    sanitizeTargetLanguage,
    SourceLanguageCode,
    TargetLanguageCode,
} from "@/libs/i18n/languages";

export interface SettingState {
    language: SourceLanguageCode;
    targetLanguage: TargetLanguageCode;
    soundType: string;

    wordSound: boolean;
    wordSoundVolume: number;
    wordSoundSpeed: number;

    articleSound: boolean;
    articleAutoPlayNext: boolean;
    articleSoundVolume: number;
    articleSoundSpeed: number;

    keyboardSound: boolean;
    keyboardSoundVolume: number;
    keyboardSoundFile: string;

    effectSound: boolean;
    effectSoundVolume: number;

    repeatCount: number;
    repeatCustomCount: number | null;
    dictation: boolean;
    translate: boolean;
    showNearWord: boolean;
    ignoreCase: boolean;
    allowWordTip: boolean;
    waitTimeForChangeWord: number;
    fontSize: {
        articleForeignFontSize: number;
        articleTranslateFontSize: number;
        wordForeignFontSize: number;
        wordTranslateFontSize: number;
    };
    showToolbar: boolean;
    showPanel: boolean;
    sideExpand: boolean;
    theme: string;
    shortcutKeyMap: Record<string, string>;
    first: boolean;
    firstTime: number;
    load: boolean;
    conflictNotice: boolean;
    ignoreSimpleWord: boolean;
    wordPracticeMode: number;
    disableShowPracticeSettingDialog: boolean;
    autoNextWord: boolean;
    inputWrongClear: boolean;
}

export const getDefaultSettingState = (): SettingState => ({
    language: DEFAULT_SOURCE_LANGUAGE,
    targetLanguage: DEFAULT_TARGET_LANGUAGE,
    soundType: "us",

    wordSound: true,
    wordSoundVolume: 100,
    wordSoundSpeed: 1,

    articleSound: true,
    articleAutoPlayNext: false,
    articleSoundVolume: 100,
    articleSoundSpeed: 1,

    keyboardSound: true,
    keyboardSoundVolume: 100,
    keyboardSoundFile: "机械键盘2",

    effectSound: true,
    effectSoundVolume: 100,

    repeatCount: 1,
    repeatCustomCount: null,
    dictation: false,
    translate: true,
    showNearWord: true,
    ignoreCase: true,
    allowWordTip: true,
    waitTimeForChangeWord: 300,
    fontSize: {
        articleForeignFontSize: 48,
        articleTranslateFontSize: 20,
        wordForeignFontSize: 48,
        wordTranslateFontSize: 20,
    },
    showToolbar: true,
    showPanel: true,
    sideExpand: false,
    theme: "auto",
    shortcutKeyMap: cloneDeep(DefaultShortcutKeyMap),
    first: true,
    firstTime: Date.now(),
    load: false,
    conflictNotice: true,
    ignoreSimpleWord: false,
    wordPracticeMode: 0,
    disableShowPracticeSettingDialog: false,
    autoNextWord: true,
    inputWrongClear: false,
});

export const useSettingStore = defineStore("setting", {
    state: (): SettingState => {
        return getDefaultSettingState();
    },
    actions: {
        setState(obj: any) {
            if (obj && typeof obj === "object") {
                if (obj.language !== undefined) {
                    obj.language = sanitizeSourceLanguage(obj.language);
                }
                if (obj.targetLanguage !== undefined) {
                    obj.targetLanguage = sanitizeTargetLanguage(
                        obj.targetLanguage,
                    );
                }
            }
            this.$patch(obj);
        },
        init() {
            return new Promise(async (resolve) => {
                let configStr = localStorage.getItem(SAVE_SETTING_KEY.key);
                let configStr2 = await get(SAVE_SETTING_KEY.key);
                if (configStr2) {
                    configStr = configStr2;
                }
                let data = checkAndUpgradeSaveSetting(configStr);
                if (CAN_REQUEST) {
                    let res = await getSetting();
                    if (res.success) {
                        Object.assign(data, res.data);
                    }
                }
                this.setState({ ...data, load: true });
                resolve(true);
            });
        },
    },
});
