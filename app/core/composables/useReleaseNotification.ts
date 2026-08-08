import { computed } from 'vue'
import { APP_VERSION } from '../config/env'
import { getCurrentRelease } from '../config/releaseNotes'
import { useRuntimeStore } from '../stores/runtime'
import { useSettingStore } from '../stores/setting'

export function useReleaseNotification() {
  const runtimeStore = useRuntimeStore()
  const settingStore = useSettingStore()

  const currentRelease = computed(() => getCurrentRelease())
  const hasUnseenRelease = computed(() => runtimeStore.isNew)

  function markReleaseSeen() {
    settingStore.webAppVersion = APP_VERSION.version
    runtimeStore.isNew = false
  }

  return {
    currentRelease,
    hasUnseenRelease,
    markReleaseSeen,
  }
}
