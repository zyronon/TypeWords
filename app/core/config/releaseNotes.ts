import { APP_VERSION } from './env'

export type ReleaseFeatureType = 'new' | 'improve' | 'fix'

export interface ReleaseFeature {
  type: ReleaseFeatureType
  title: string
  desc?: string
}

export interface ReleaseVersion {
  version: number
  date: string
  title: string
  summary: string
  features: ReleaseFeature[]
}

export const RELEASE_NOTES: ReleaseVersion[] = [
  {
    version: APP_VERSION.version,
    date: '2026-06-22',
    title: '练习体验与导入升级',
    summary: '重复播放单词、点击查词、导入流程全面优化',
    features: [
      { type: 'new', title: '点击查词', desc: '练习时点击单词即可查看释义' },
      { type: 'improve', title: '重复播放单词', desc: '支持重复播放当前单词，并可降低语速' },
      { type: 'improve', title: '导入流程优化', desc: '单词与文章导入界面更清晰，操作更直观' },
      { type: 'new', title: '文章标题发音', desc: '文章标题和问题支持语音播放' },
      { type: 'new', title: '自定义复习范围', desc: '随机复习/测试时可自定义单词范围' },
      { type: 'improve', title: '多语言优化', desc: '完善多语言界面与文案' },
    ],
  },
  {
    version: 2,
    date: '2025-08-10',
    title: '2.0 全新改版',
    summary: '全新 UI、短语例句、近义词与文章编辑能力',
    features: [
      { type: 'new', title: '全新 UI', desc: '界面与交互全面重新设计' },
      { type: 'new', title: '短语与例句', desc: '单词学习支持短语和例句展示' },
      { type: 'new', title: '近义词', desc: '单词详情新增近义词信息' },
      { type: 'improve', title: '文章编辑', desc: '完善文章编辑、导入、导出等功能' },
      { type: 'new', title: '自动播放下一篇', desc: '文章练习支持自动播放下一篇' },
    ],
  },
  {
    version: 1,
    date: '2025-07-19',
    title: '首次发布',
    summary: 'TypeWords 1.0 正式上线',
    features: [{ type: 'new', title: '核心打字练习', desc: '支持单词与文章的键盘打字练习' }],
  },
]

export function getCurrentRelease(): ReleaseVersion | undefined {
  return RELEASE_NOTES.find(r => r.version === APP_VERSION.version)
}
