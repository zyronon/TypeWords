# Système de Double Langue

## Vue d'ensemble

L'application TypeWords supporte maintenant un système de double langue :
- **Langue source (Source Language)** : La langue de l'interface de l'application
- **Langue cible (Target Language)** : La langue que vous souhaitez apprendre

## Configuration

### Dans les paramètres

1. Allez dans **Paramètres** → Onglet **Général**
2. Vous verrez deux options de langue :
   - **Langue source** : Choisissez la langue dans laquelle vous souhaitez voir l'interface (Français, English, 中文)
   - **Langue cible** : Choisissez la langue que vous souhaitez apprendre (English, 中文, Français)

### Exemples de configuration

- **Français → English** : Interface en français, apprentissage de l'anglais
- **中文 → English** : Interface en chinois, apprentissage de l'anglais
- **English → Français** : Interface en anglais, apprentissage du français

## Fonctionnalités

- **Interface adaptative** : Tous les textes de l'interface s'affichent dans la langue source choisie
- **Dictionnaires ciblés** : Les dictionnaires et exercices sont adaptés à votre langue cible
- **Persistance** : Vos choix de langue sont sauvegardés automatiquement
- **Changement en temps réel** : Les modifications de langue sont appliquées immédiatement

## Implémentation technique

### Structure du store (setting.ts)

```typescript
export interface SettingState {
  language: string,        // Langue source (interface)
  targetLanguage: string,  // Langue cible (apprentissage)
  // ...
}
```

### Hook useLanguage

```typescript
const { t, changeLanguage, changeTargetLanguage, sourceLanguage, targetLanguage } = useLanguage()
```

- `t(key)` : Fonction de traduction basée sur la langue source
- `changeLanguage(lang)` : Changer la langue de l'interface
- `changeTargetLanguage(lang)` : Changer la langue à apprendre
- `sourceLanguage` : Langue actuelle de l'interface
- `targetLanguage` : Langue actuellement apprise

### Composants

- **LanguageSelect.vue** : Sélecteur simple de langue (langue source)
- **DualLanguageSelect.vue** : Sélecteur double langue (optionnel, design alternatif)

## Langues supportées

Actuellement, les langues suivantes sont supportées :
- 🇬🇧 English (en)
- 🇨🇳 中文 (zh)
- 🇫🇷 Français (fr)

## Migration depuis l'ancienne version

Si vous utilisez une version antérieure :
- Votre langue existante devient automatiquement la **langue source**
- La langue cible par défaut est l'**anglais** (en)
- Aucune perte de données ou de paramètres

## À venir

- Support de nouvelles langues (espagnol, allemand, japonais, etc.)
- Dictionnaires bilingues spécifiques pour chaque paire de langues
- Traductions contextuelles adaptées à la langue cible
