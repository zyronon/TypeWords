import type {Language} from "../languages";
import type {AxiosInstance} from "axios";

export type Languages = Array<Language>;

export type TranslatorEnv = "node" | "ext";

export interface TranslatorInit<Config extends {}> {
  env?: TranslatorEnv;
  axios?: AxiosInstance;
  config?: Config;
}

export type TranslateErrorType =
  | "NETWORK_ERROR"
  | "NETWORK_TIMEOUT"
  | "API_SERVER_ERROR"
  | "UNSUPPORTED_LANG"
  | "UNKNOWN";

export class TranslateError extends Error {
  constructor(message: TranslateErrorType) {
    super(message);
  }
}

/** 统一的查询结果的数据结构 */
export interface TranslateResult {
  engine: string;
  text: string;
  from: Language;
  to: Language;
  /** 原文 */
  origin: {
    paragraphs: string[];
    tts?: string;
  };
  /** 译文 */
  trans: {
    paragraphs: string[];
    tts?: string;
  };
}

export type TranslateQueryResult = Omit<TranslateResult, "engine">;
