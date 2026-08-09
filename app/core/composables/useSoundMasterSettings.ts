import { computed, ref, watch } from 'vue'
import { useSettingStore } from '../stores/setting'
import type { SettingState } from '../stores/setting'

type VolumeKey =
  | 'wordSoundVolume'
  | 'sentenceSoundVolume'
  | 'articleSoundVolume'
  | 'keyboardSoundVolume'
  | 'effectSoundVolume'

type SpeedKey = 'wordSoundSpeed' | 'sentenceSoundSpeed' | 'articleSoundSpeed'

export const SOUND_VOLUME_ITEMS: { key: VolumeKey; labelKey: string }[] = [
  { key: 'wordSoundVolume', labelKey: 'word_pronunciation' },
  { key: 'sentenceSoundVolume', labelKey: 'sentence_volume' },
  { key: 'articleSoundVolume', labelKey: 'article_volume' },
  { key: 'keyboardSoundVolume', labelKey: 'keyboard_volume' },
  { key: 'effectSoundVolume', labelKey: 'effect_volume' },
]

export const SOUND_SPEED_ITEMS: { key: SpeedKey; labelKey: string }[] = [
  { key: 'wordSoundSpeed', labelKey: 'word_speed' },
  { key: 'sentenceSoundSpeed', labelKey: 'sentence_speed' },
  { key: 'articleSoundSpeed', labelKey: 'article_speed' },
]

function createMasterControl<K extends keyof SettingState>(keys: K[]) {
  const settingStore = useSettingStore()

  const isUnified = computed(() => {
    const values = keys.map(key => settingStore[key] as number)
    return values.every(v => v === values[0])
  })

  // 子项不一致时默认展开详细设置（含下次进入页面）
  const expanded = ref(!isUnified.value)

  watch(isUnified, unified => {
    if (!unified) expanded.value = true
  })

  const showDetail = computed(() => expanded.value || !isUnified.value)

  const master = computed({
    get: () => settingStore[keys[0]] as number,
    set: (value: number) => {
      const patch = {} as Partial<SettingState>
      keys.forEach(key => {
        patch[key] = value as SettingState[typeof key]
      })
      settingStore.$patch(patch)
    },
  })

  function toggleExpanded() {
    expanded.value = !expanded.value
  }

  return {
    expanded,
    isUnified,
    showDetail,
    master,
    toggleExpanded,
    keys,
  }
}

export function useSoundMasterSettings() {
  const volume = createMasterControl(SOUND_VOLUME_ITEMS.map(item => item.key))
  const speed = createMasterControl(SOUND_SPEED_ITEMS.map(item => item.key))

  return {
    volumeExpanded: volume.expanded,
    volumeIsUnified: volume.isUnified,
    volumeShowDetail: volume.showDetail,
    volumeMaster: volume.master,
    volumeToggleExpanded: volume.toggleExpanded,
    speedExpanded: speed.expanded,
    speedIsUnified: speed.isUnified,
    speedShowDetail: speed.showDetail,
    speedMaster: speed.master,
    speedToggleExpanded: speed.toggleExpanded,
  }
}
