# Système de traduction automatique

## Vue d'ensemble

Le fichier `/src/hooks/translate.ts` gère la traduction automatique des articles en utilisant l'API Baidu Translate.

## Fonctionnement

### Avant les modifications (ancien système)

```typescript
// ❌ Traduction codée en dur
translator.translate(article.title, 'en', 'zh-CN')     // Titre toujours en chinois
translator.translate(sentence.text, 'en', 'fr')        // Phrases toujours en français
```

**Problème** : Les langues étaient codées en dur, ne respectant pas les préférences de l'utilisateur.

---

### Après les modifications (nouveau système)

```typescript
// ✅ Traduction dynamique basée sur les paramètres utilisateur
const fromLang = settingStore.targetLanguage  // Langue à apprendre (ex: 'en')
const toLang = settingStore.language          // Langue de l'interface (ex: 'fr')

translator.translate(article.title, baiduFromLang, baiduToLang)
translator.translate(sentence.text, baiduFromLang, baiduToLang)
```

**Avantage** : La traduction s'adapte automatiquement aux paramètres de langue de l'utilisateur.

---

## Mapping des langues

Le système utilise un mapping pour convertir les codes de langue de l'application vers les codes Baidu :

```typescript
const langMap: Record<string, Language> = {
  'en': 'en',        // Anglais
  'zh': 'zh-CN',     // Chinois simplifié
  'fr': 'fr'         // Français
}
```

---

## Exemples de configuration

### Configuration 1 : Interface en français, apprendre l'anglais
- `settingStore.language = 'fr'` (langue de l'interface)
- `settingStore.targetLanguage = 'en'` (langue à apprendre)
- **Résultat** : Articles anglais → Traduction française

### Configuration 2 : Interface en chinois, apprendre l'anglais
- `settingStore.language = 'zh'` (langue de l'interface)
- `settingStore.targetLanguage = 'en'` (langue à apprendre)
- **Résultat** : Articles anglais → Traduction chinoise

### Configuration 3 : Interface en anglais, apprendre le français
- `settingStore.language = 'en'` (langue de l'interface)
- `settingStore.targetLanguage = 'fr'` (langue à apprendre)
- **Résultat** : Articles français → Traduction anglaise

---

## Flux de traduction

```
┌──────────────────────────────────────────────────┐
│  1. L'utilisateur clique sur "Traduire"          │
│     dans EditArticle.vue                         │
└────────────────┬─────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────┐
│  2. getNetworkTranslate() est appelé             │
│     - Lit settingStore.targetLanguage            │
│     - Lit settingStore.language                  │
│     - Mappe les codes de langue                  │
└────────────────┬─────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────┐
│  3. Traduction du titre                          │
│     translator.translate(                        │
│       article.title,                             │
│       baiduFromLang,                             │
│       baiduToLang                                │
│     )                                            │
└────────────────┬─────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────┐
│  4. Traduction de chaque phrase                  │
│     for each sentence in article.sections:       │
│       translator.translate(                      │
│         sentence.text,                           │
│         baiduFromLang,                           │
│         baiduToLang                              │
│       )                                          │
│       progressCb((index/total) * 100)            │
└────────────────┬─────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────┐
│  5. Mécanisme de retry en cas d'erreur           │
│     - Maximum 3 tentatives par phrase            │
│     - Gestion des erreurs réseau                 │
└────────────────┬─────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────┐
│  6. Affichage des traductions                    │
│     - Mise à jour en temps réel (si !allShow)    │
│     - Ou affichage final (si allShow)            │
└──────────────────────────────────────────────────┘
```

---

## API Baidu Translate

### Informations sur l'API

- **Service** : Baidu Translate API (百度翻译)
- **Endpoint** : `/baidu` (proxy interne)
- **Identifiants** :
  - `appid: "20230910001811857"`
  - `key: "Xxe_yftQR3K3Ue43NQMC"`

⚠️ **AVERTISSEMENT** : Ces identifiants sont exposés publiquement dans le code source. Pour une application en production, ils devraient être :
- Stockés dans des variables d'environnement
- Gérés côté serveur
- Protégés par un système de rate limiting

### Langues supportées par Baidu

L'API Baidu supporte plus de 200 langues, incluant :
- Chinois (zh-CN, zh-TW)
- Anglais (en)
- Français (fr)
- Espagnol (es)
- Japonais (ja)
- Coréen (ko)
- Arabe (ar)
- Russe (ru)
- Et bien d'autres...

### Signature des requêtes

Baidu utilise MD5 pour signer les requêtes :
```typescript
const sign = md5(appid + text + salt + key)
```

---

## Fonctions exportées

### `getSentenceAllTranslateText(article: Article)`
Extrait et concatène toutes les traductions de phrases d'un article.

**Retour** : String avec toutes les traductions séparées par des sauts de ligne.

### `getSentenceAllText(article: Article)`
Extrait et concatène tout le texte original d'un article.

**Retour** : String avec tout le texte original séparé par des sauts de ligne.

### `getNetworkTranslate(article, translateEngine, allShow, progressCb)`
Fonction principale de traduction.

**Paramètres** :
- `article` : L'article à traduire
- `translateEngine` : Le moteur de traduction (actuellement uniquement `TranslateEngine.Baidu`)
- `allShow` : Si `true`, affiche tout après traduction complète. Si `false`, mise à jour en temps réel
- `progressCb` : Callback de progression `(progress: number) => void` (0-100%)

**Retour** : `Promise<void>`

---

## Améliorations futures possibles

1. **Support de multiples moteurs de traduction**
   - Google Translate
   - DeepL
   - Microsoft Translator

2. **Cache des traductions**
   - Éviter de retraduire les mêmes phrases
   - Stockage local des traductions

3. **Détection automatique de la langue source**
   - Au lieu de supposer `targetLanguage`, détecter automatiquement

4. **Traduction par lots optimisée**
   - Grouper plusieurs phrases en une seule requête
   - Réduire le nombre d'appels API

5. **Gestion avancée des erreurs**
   - Affichage d'erreurs spécifiques à l'utilisateur
   - Fallback vers un autre moteur en cas d'échec

6. **Mode hors ligne**
   - Utiliser des modèles de traduction locaux
   - Support de WebAssembly pour la traduction côté client

---

## Utilisation dans le code

### Dans un composant Vue

```typescript
import { getNetworkTranslate } from '@/hooks/translate'
import { TranslateEngine } from '@/types/types'

// Traduire un article avec progression
const progress = ref(0)

await getNetworkTranslate(
  article,
  TranslateEngine.Baidu,
  false,  // Affichage en temps réel
  (val: number) => {
    progress.value = val  // Mise à jour 0-100%
  }
)

console.log('Traduction terminée !')
```

---

## Tests recommandés

- [ ] Tester traduction fr → en
- [ ] Tester traduction zh → en
- [ ] Tester traduction en → fr
- [ ] Tester traduction en → zh
- [ ] Vérifier le système de retry
- [ ] Vérifier la progression (0-100%)
- [ ] Tester avec un article vide
- [ ] Tester avec un très long article (>100 phrases)
- [ ] Tester la résilience aux erreurs réseau
