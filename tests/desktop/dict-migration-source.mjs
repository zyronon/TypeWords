import { declarations } from './migration-declarations.mjs'

export function dictMigrationSource(root) {
  return [
    "import { DictType } from '../types/enum'",
    "import { shallowReactive } from 'vue'",
    "import { saveHashSnapshot } from '../composables/useDataSyncPersistence'",
    declarations(root, 'app/core/config/env.ts', ['DictId', 'SAVE_DICT_KEY']),
    declarations(root, 'app/core/types/func.ts', ['getDefaultDict']),
    declarations(root, 'app/core/stores/base.ts', ['getDefaultBaseState']),
    declarations(root, 'app/core/utils/index.ts', ['checkRiskKey', 'normalizeStoredDict', 'checkAndUpgradeSaveDict']),
  ].join('\n')
}
