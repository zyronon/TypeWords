import { useSettingStore } from '@/stores/setting'
import { watch } from 'vue'
import zhCN from '@/locales/zh-CN'
import frFR from '@/locales/fr-FR'

const messages: Record<string, any> = {
  'zh': zhCN,
  'fr': frFR
}

export function useLanguage() {
  const settingStore = useSettingStore()
  
  // Fonction pour changer la langue de l'application
  const changeLanguage = (lang: string) => {
    // Met à jour la langue dans le localStorage pour la persistance
    localStorage.setItem('language', lang)
    // Met à jour la langue dans le store
    settingStore.language = lang
    // Met à jour l'attribut lang de la page HTML
    document.documentElement.lang = lang
  }

  // Surveille les changements de langue dans le store
  watch(() => settingStore.language, (newLang) => {
    changeLanguage(newLang)
  })

  const t = (key: string) => {
    const currentLang = settingStore.language
    return messages[currentLang]?.[key] || messages['zh'][key] || key
  }

  return {
    t,
    changeLanguage
  }
}