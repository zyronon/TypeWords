import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { convertDictText, type DictScript } from '@/core/utils/zh-script.ts'

/**
 * 词典中文释义的展示脚本。
 * UI 语言为繁體中文（tw）时转繁体，其余转简体。
 */
export function useDictScript() {
  const { locale } = useI18n()
  const script = computed<DictScript>(() => (locale.value === 'tw' ? 'zh-TW' : 'zh-CN'))
  function formatCn(text?: string | null): string {
    return convertDictText(text ?? '', script.value)
  }
  return { script, formatCn }
}
