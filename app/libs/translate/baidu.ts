import type { Language, TranslateQueryResult } from "./translator";
import { Translator, TranslateError } from "./translator";
import md5 from "md5";
import qs from "../qs";

const langMap: [Language, string][] = [
  ["auto", "auto"],
  ["zh-CN", "zh"],
  ["en", "en"],
  ["yue", "yue"],
  ["wyw", "wyw"],
  ["ja", "jp"],
  ["ko", "kor"],
  ["fr", "fra"],
  ["es", "spa"],
  ["th", "th"],
  ["ar", "ara"],
  ["ru", "ru"],
  ["pt", "pt"],
  ["de", "de"],
  ["it", "it"],
  ["el", "el"],
  ["nl", "nl"],
  ["pl", "pl"],
  ["bg", "bul"],
  ["et", "est"],
  ["da", "dan"],
  ["fi", "fin"],
  ["cs", "cs"],
  ["ro", "rom"],
  ["sl", "slo"],
  ["sv", "swe"],
  ["hu", "hu"],
  ["zh-TW", "cht"],
  ["vi", "vie"]
];

export interface BaiduConfig {
  placeholder?: string;
  appid: string;
  key: string;
}

export class Baidu extends Translator<BaiduConfig> {
  readonly name = "baidu";

  readonly endpoint = "/baidu";

  protected async query(
    text: string,
    from: Language,
    to: Language,
    config: BaiduConfig
  ): Promise<TranslateQueryResult> {
    type BaiduTranslateError = {
      error_code: "54001" | string;
      error_msg: "Invalid Sign" | string;
    };

    type BaiduTranslateResult = {
      from: string;
      to: string;
      trans_result: Array<{
        dst: string;
        src: string;
      }>;
    };

    const salt = Date.now();
    const { endpoint } = this;
    const { appid, key } = config;

    const res = await this.request<BaiduTranslateResult | BaiduTranslateError>(
      endpoint,
      {
        params: {
          from: Baidu.langMap.get(from),
          to: Baidu.langMap.get(to),
          q: text,
          salt,
          appid,
          sign: md5(appid + text + salt + key)
        }
      }
    ).catch(() => {
      throw new TranslateError("NETWORK_ERROR");
    });

    const { data } = res;

    if ((data as BaiduTranslateError).error_code) {
      console.error(
        new Error("[Baidu service]" + (data as BaiduTranslateError).error_msg)
      );
      throw new TranslateError("API_SERVER_ERROR");
    }

    const {
      trans_result: transResult,
      from: langDetected
    } = data as BaiduTranslateResult;
    const transParagraphs = transResult.map(({ dst }) => dst);
    const detectedFrom = Baidu.langMapReverse.get(langDetected) as Language;

    return {
      text,
      from: detectedFrom,
      to,
      origin: {
        paragraphs: transResult.map(({ src }) => src),
        tts: await this.textToSpeech(text, detectedFrom)
      },
      trans: {
        paragraphs: transParagraphs,
        tts: await this.textToSpeech(transParagraphs.join(" "), to)
      }
    };
  }

  /** Translator lang to custom lang */
  private static readonly langMap = new Map(langMap);

  /** Custom lang to translator lang */
  private static readonly langMapReverse = new Map(
    langMap.map(([translatorLang, lang]) => [lang, translatorLang])
  );

  getSupportLanguages(): Language[] {
    return [...Baidu.langMap.keys()];
  }

  async textToSpeech(text: string, lang: Language): Promise<string> {
    return `https://fanyi.baidu.com/gettts?${qs.stringify({
      lan: Baidu.langMap.get(lang !== "auto" ? lang : "zh-CN") || "zh",
      text,
      spd: 5,
    })}`;
  }
}

export default Baidu;
