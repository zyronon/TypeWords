import { declarations as extract } from './migration-declarations.mjs'

// Select actual declarations with the TS parser so browser tests avoid unrelated Nuxt module initialization.
export function settingsMigrationSource(root) {
  const declarations = (path, names) => extract(root, path, names)
  return [
    "import { ShortcutKey, IdentifyMethod, WordPracticeMode, WordPracticeType } from '../types/enum'",
    "import { get } from 'idb-keyval'",
    "import { saveHashSnapshot } from '../composables/useDataSyncPersistence'",
    declarations('app/core/config/env.ts', ['APP_VERSION', 'BACKUP_INDEX_KEY', 'DefaultShortcutKeyMap']),
    declarations('app/core/stores/setting.ts', ['getDefaultSettingState']),
    declarations('app/core/utils/index.ts', ['cloneDeep', 'checkRiskKey', 'checkAndUpgradeSaveSetting']),
  ].join('\n')
}
