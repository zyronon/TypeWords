import type {
  Languages,
  TranslatorEnv,
  TranslatorInit,
  TranslateResult,
  TranslateQueryResult
} from "./type";
import type { Language } from "../languages";
import Axios from "axios";
import type { AxiosInstance, AxiosRequestConfig, AxiosPromise } from "axios";

export abstract class Translator<Config extends {} = {}> {
  axios: AxiosInstance;

  protected readonly env: TranslatorEnv;

  /**
   * 自定义选项
   */
  config: Config;

  /**
   * 翻译源标识符
   */
  abstract readonly name: string;

  /**
   * 可选的axios实例
   */
  constructor(init: TranslatorInit<Config> = {}) {
    this.env = init.env || "node";
    this.axios = init.axios || Axios;
    this.config = init.config || ({} as Config);
  }

  /**
   * 获取翻译器所支持的语言列表： 语言标识符数组
   */
  abstract getSupportLanguages(): Languages;

  /**
   * 下游应用调用的接口
   */
  async translate(
    text: string,
    from: Language,
    to: Language,
    config = {} as Config
  ): Promise<TranslateResult> {
    const queryResult = await this.query(text, from, to, {
      ...this.config,
      ...config
    });

    return {
      ...queryResult,
      engine: this.name
    };
  }

  /**
   * 更新 token 的方法
   */
  updateToken?(): Promise<void>;

  /**
   * 翻译源需要实现的方法
   */
  protected abstract query(
    text: string,
    from: Language,
    to: Language,
    config: Config
  ): Promise<TranslateQueryResult>;

  protected request<R = {}>(
    url: string,
    config?: AxiosRequestConfig
  ): AxiosPromise<R> {
    return this.axios(url, config);
  }

  /**
   * 如果翻译源提供了单独的检测语言的功能，请实现此接口
   */
  async detect(text: string): Promise<Language> {
    return
  }

  /**
   * 文本转换为语音
   * @returns {Promise<string|null>} 语言文件地址
   */
  textToSpeech(
    text: string,
    lang: Language,
    meta?: any // eslint-disable-line @typescript-eslint/no-explicit-any
  ): Promise<string | null> {
    return Promise.resolve(null);
  }
}
