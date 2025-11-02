# API Documentation - Dual Language System

## Store (Setting Store)

### État

```typescript
interface SettingState {
  language: string        // Langue source (interface de l'application)
  targetLanguage: string  // Langue cible (langue à apprendre)
  // ... autres propriétés
}
```

### Valeurs par défaut

```typescript
{
  language: 'zh',        // Interface en chinois par défaut
  targetLanguage: 'en'   // Apprentissage de l'anglais par défaut
}
```

### Accès

```typescript
import { useSettingStore } from '@/stores/setting'

const settingStore = useSettingStore()

// Lecture
console.log(settingStore.language)       // 'zh'
console.log(settingStore.targetLanguage) // 'en'

// Écriture
settingStore.language = 'fr'        // Change l'interface en français
settingStore.targetLanguage = 'en'  // Définit l'anglais comme langue à apprendre
```

---

## Hook (useLanguage)

### Import

```typescript
import { useLanguage } from '@/hooks/useLanguage'
```

### Utilisation

```typescript
const {
  t,                    // Fonction de traduction
  changeLanguage,       // Changer la langue source
  changeTargetLanguage, // Changer la langue cible
  sourceLanguage,       // Langue source actuelle
  targetLanguage        // Langue cible actuelle
} = useLanguage()
```

### Méthodes

#### `t(key: string): string`
Traduit une clé dans la langue source actuelle.

**Paramètres:**
- `key`: Clé de traduction (ex: 'Welcome', 'Settings', etc.)

**Retour:**
- Texte traduit dans la langue source

**Exemple:**
```typescript
const welcomeText = t('Welcome')
// Si language = 'fr' → "Bienvenue"
// Si language = 'en' → "Welcome"
// Si language = 'zh' → "欢迎"
```

#### `changeLanguage(lang: string): void`
Change la langue de l'interface (langue source).

**Paramètres:**
- `lang`: Code de langue ('en', 'zh', 'fr')

**Effets:**
- Met à jour `settingStore.language`
- Sauvegarde dans `localStorage.setItem('language', lang)`
- Met à jour `document.documentElement.lang`

**Exemple:**
```typescript
changeLanguage('fr')  // Interface en français
```

#### `changeTargetLanguage(lang: string): void`
Change la langue à apprendre (langue cible).

**Paramètres:**
- `lang`: Code de langue ('en', 'zh', 'fr')

**Effets:**
- Met à jour `settingStore.targetLanguage`
- Sauvegarde dans `localStorage.setItem('targetLanguage', lang)`

**Exemple:**
```typescript
changeTargetLanguage('en')  // Apprendre l'anglais
```

---

## Composants

### LanguageSelect

Sélecteur simple de langue (utilisé pour la langue source).

**Import:**
```typescript
import LanguageSelect from '@/components/base/select/LanguageSelect.vue'
```

**Utilisation:**
```vue
<template>
  <LanguageSelect />
</template>
```

**Propriétés:**
- Aucune (utilise directement le store)

**Événements:**
- Aucun (mise à jour automatique du store)

---

### DualLanguageSelect (Optionnel)

Sélecteur double avec affichage vertical et flèche.

**Import:**
```typescript
import DualLanguageSelect from '@/components/base/select/DualLanguageSelect.vue'
```

**Utilisation:**
```vue
<template>
  <DualLanguageSelect />
</template>
```

**Propriétés:**
- Aucune (utilise directement le store)

**Événements:**
- Aucun (mise à jour automatique du store)

---

## Codes de langues supportés

| Code | Langue    | Drapeau | Nom natif |
|------|-----------|---------|-----------|
| en   | Anglais   | 🇬🇧     | English   |
| zh   | Chinois   | 🇨🇳     | 中文      |
| fr   | Français  | 🇫🇷     | Français  |

---

## LocalStorage

### Clés utilisées

```typescript
'language'       // Langue source
'targetLanguage' // Langue cible
```

### Format

```typescript
localStorage.getItem('language')       // → 'fr'
localStorage.getItem('targetLanguage') // → 'en'
```

---

## Exemples complets

### Exemple 1: Composant avec sélection de langue

```vue
<script setup lang="ts">
import { useLanguage } from '@/hooks/useLanguage'
import { useSettingStore } from '@/stores/setting'

const { t } = useLanguage()
const settingStore = useSettingStore()

const languages = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
]
</script>

<template>
  <div class="language-settings">
    <h2>{{ t('LanguageSettings') }}</h2>
    
    <!-- Langue source -->
    <div class="setting-row">
      <label>{{ t('SourceLanguage') }}</label>
      <select v-model="settingStore.language">
        <option v-for="lang in languages" :key="lang.code" :value="lang.code">
          {{ lang.flag }} {{ lang.name }}
        </option>
      </select>
    </div>
    
    <!-- Langue cible -->
    <div class="setting-row">
      <label>{{ t('TargetLanguage') }}</label>
      <select v-model="settingStore.targetLanguage">
        <option v-for="lang in languages" :key="lang.code" :value="lang.code">
          {{ lang.flag }} {{ lang.name }}
        </option>
      </select>
    </div>
  </div>
</template>
```

### Exemple 2: Logique conditionnelle basée sur les langues

```typescript
import { useSettingStore } from '@/stores/setting'

function getDictionaryForCurrentLanguages() {
  const settingStore = useSettingStore()
  const source = settingStore.language
  const target = settingStore.targetLanguage
  
  // Exemple: français → anglais
  if (source === 'fr' && target === 'en') {
    return '/dicts/word/TOEIC-FR.json'
  }
  
  // Exemple: chinois → anglais
  if (source === 'zh' && target === 'en') {
    return '/dicts/word/TOEIC-ZH.json'
  }
  
  // Exemple: anglais → français
  if (source === 'en' && target === 'fr') {
    return '/dicts/word/FRENCH-EN.json'
  }
  
  return '/dicts/word/default.json'
}
```

### Exemple 3: Système de traduction adaptatif

```typescript
import { useSettingStore } from '@/stores/setting'

async function translateWord(word: string) {
  const settingStore = useSettingStore()
  const fromLang = settingStore.targetLanguage // La langue du mot
  const toLang = settingStore.language         // La langue de traduction
  
  // Appel API de traduction
  const response = await fetch(`/api/translate`, {
    method: 'POST',
    body: JSON.stringify({
      text: word,
      from: fromLang,
      to: toLang
    })
  })
  
  return await response.json()
}
```

---

## Migration automatique

Le système migre automatiquement les anciennes données :

```typescript
// Avant (ancienne version)
{
  language: 'fr'  // Une seule langue
}

// Après (nouvelle version, migration automatique)
{
  language: 'fr',        // Langue source (conservée)
  targetLanguage: 'en'   // Langue cible (ajoutée par défaut)
}
```

Aucune action requise de la part de l'utilisateur !

---

## Notes techniques

### Réactivité

Les changements de langue sont réactifs grâce à Pinia :

```typescript
// Automatiquement réactif
const settingStore = useSettingStore()

watch(() => settingStore.language, (newLang) => {
  console.log('Interface language changed to:', newLang)
})

watch(() => settingStore.targetLanguage, (newLang) => {
  console.log('Target language changed to:', newLang)
})
```

### Persistance

- **Store Pinia**: Sauvegardé automatiquement dans IndexedDB
- **LocalStorage**: Utilisé pour la langue source et cible en backup
- **Synchronisation**: Les deux systèmes sont synchronisés via watchers

### Performance

- Les changements de langue n'entraînent pas de rechargement de page
- Les traductions sont chargées de manière lazy
- Les dictionnaires sont mis en cache après le premier chargement
