// Exemple d'utilisation du système de double langue dans un composant Vue

import { useLanguage } from '@/hooks/useLanguage'
import { useSettingStore } from '@/stores/setting'

export default {
  setup() {
    const { t, sourceLanguage, targetLanguage } = useLanguage()
    const settingStore = useSettingStore()
    
    // Exemples d'utilisation
    
    // 1. Afficher un texte traduit dans la langue de l'interface
    console.log(t('Welcome')) // "Bienvenue" si sourceLanguage = 'fr'
    
    // 2. Accéder aux langues actuelles
    console.log('Langue de l\'interface:', sourceLanguage) // ex: 'fr'
    console.log('Langue à apprendre:', targetLanguage)     // ex: 'en'
    
    // 3. Changer les langues par programmation
    const switchToFrenchInterface = () => {
      settingStore.language = 'fr'
    }
    
    const learnEnglish = () => {
      settingStore.targetLanguage = 'en'
    }
    
    // 4. Logique conditionnelle basée sur la langue cible
    const getDictionaryPath = () => {
      const target = settingStore.targetLanguage
      if (target === 'en') {
        return '/dicts/word/TOEIC-FR.json'
      } else if (target === 'fr') {
        return '/dicts/word/TOEIC-EN.json'
      } else {
        return '/dicts/word/default.json'
      }
    }
    
    // 5. Afficher les langues disponibles
    const languages = [
      { code: 'en', name: 'English', flag: '🇬🇧' },
      { code: 'zh', name: '中文', flag: '🇨🇳' },
      { code: 'fr', name: 'Français', flag: '🇫🇷' },
    ]
    
    return {
      t,
      sourceLanguage,
      targetLanguage,
      switchToFrenchInterface,
      learnEnglish,
      getDictionaryPath,
      languages
    }
  }
}

// Exemple dans un template Vue
/*
<template>
  <div>
    <h1>{{ t('Welcome') }}</h1>
    <p>{{ t('InterfaceLanguage') }}: {{ sourceLanguage }}</p>
    <p>{{ t('LearningLanguage') }}: {{ targetLanguage }}</p>
    
    <button @click="switchToFrenchInterface">
      {{ t('SwitchToFrench') }}
    </button>
    
    <button @click="learnEnglish">
      {{ t('LearnEnglish') }}
    </button>
  </div>
</template>
*/

// Exemple d'utilisation dans la logique de traduction
import { useSettingStore } from '@/stores/setting'

async function translateContent(text: string) {
  const settingStore = useSettingStore()
  
  // Traduire du texte de la langue cible vers la langue source
  const fromLang = settingStore.targetLanguage // ex: 'en'
  const toLang = settingStore.language         // ex: 'fr'
  
  // Utiliser un service de traduction
  const translation = await translator.translate(text, fromLang, toLang)
  
  return translation
}

// Exemple de chargement de dictionnaire adapté
import { useSettingStore } from '@/stores/setting'

function loadDictionary() {
  const settingStore = useSettingStore()
  const targetLang = settingStore.targetLanguage
  
  let dictPath = ''
  
  switch (targetLang) {
    case 'en':
      // Si on apprend l'anglais, charger un dictionnaire anglais
      dictPath = '/dicts/word/TOEIC-EN.json'
      break
    case 'fr':
      // Si on apprend le français, charger un dictionnaire français
      dictPath = '/dicts/word/TOEIC-FR.json'
      break
    case 'zh':
      // Si on apprend le chinois, charger un dictionnaire chinois
      dictPath = '/dicts/word/HSK.json'
      break
    default:
      dictPath = '/dicts/word/default.json'
  }
  
  return fetch(dictPath).then(r => r.json())
}

// Exemple de configuration de prononciation audio
import { useSettingStore } from '@/stores/setting'

function getAudioConfig() {
  const settingStore = useSettingStore()
  const targetLang = settingStore.targetLanguage
  
  // Adapter la prononciation en fonction de la langue cible
  if (targetLang === 'en') {
    return {
      accent: settingStore.soundType, // 'us' ou 'uk'
      speed: settingStore.wordSoundSpeed
    }
  } else if (targetLang === 'fr') {
    return {
      accent: 'fr',
      speed: settingStore.wordSoundSpeed
    }
  }
  
  return { accent: 'default', speed: 1 }
}
