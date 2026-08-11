<script setup lang="ts">
import { BaseIcon, BaseInput, Toast } from '@/base'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWordOptions } from '@/core/hooks/dict.ts'
import { closeWordCollectPicker, wordCollectPickerState } from '@/core/hooks/useWordCollectPicker.ts'
import type { Dict } from '@/core/types'
import { useDisableEventListener } from '@/core/hooks/event'

const { t: $t } = useI18n()
const { getCollectibleDicts, addWordToDict, createCustomDict } = useWordOptions()

const popoverRef = ref<HTMLElement | null>(null)
const positionStyle = ref({ left: '0px', top: '0px' })
let creatingLoading = $ref(false)

const dictList = computed(() => getCollectibleDicts(wordCollectPickerState.excludeDictId || undefined))

function adjustPosition() {
  nextTick(() => {
    const el = popoverRef.value
    if (!el) return
    const rect = el.getBoundingClientRect()
    let left = wordCollectPickerState.x - rect.width / 2
    let top = wordCollectPickerState.y
    const padding = 8
    if (left < padding) left = padding
    if (left + rect.width > window.innerWidth - padding) {
      left = window.innerWidth - rect.width - padding
    }
    if (top + rect.height > window.innerHeight - padding) {
      top = wordCollectPickerState.y - rect.height - 16
    }
    positionStyle.value = {
      left: `${left}px`,
      top: `${top}px`,
    }
  })
}

function selectDict(dict: Dict) {
  const word = wordCollectPickerState.word
  if (!word) return
  const result = addWordToDict(word, dict)
  if (result.ok) {
    Toast.success($t('add_success'))
    closeWordCollectPicker()
  } else {
    Toast.warning($t('already_in_dict'))
  }
}

function selectDictByIndex(index: number) {
  const dict = dictList.value[index]
  if (dict) selectDict(dict)
}

function startCreating() {
  wordCollectPickerState.creating = true
  wordCollectPickerState.newDictName = ''
}

function cancelCreating() {
  wordCollectPickerState.creating = false
  wordCollectPickerState.newDictName = ''
}

async function confirmCreateDict() {
  if (creatingLoading) return
  creatingLoading = true
  const result = await createCustomDict(wordCollectPickerState.newDictName)
  creatingLoading = false
  if (!result.ok) {
    if (result.reason === 'duplicate') Toast.warning($t('name_already_exists'))
    else if (result.reason === 'api') Toast.error($t('add_failed'))
    return
  }
  cancelCreating()
  Toast.success($t('add_success'))
  nextTick(() => {
    const listEl = popoverRef.value?.querySelector('.dict-list')
    if (listEl) listEl.scrollTop = listEl.scrollHeight
  })
}

function onDocumentClick(e: MouseEvent) {
  const el = popoverRef.value
  if (el && !el.contains(e.target as Node)) {
    closeWordCollectPicker()
  }
}

function onKeydown(e: KeyboardEvent) {
  if (!wordCollectPickerState.visible) return

  if (e.key === 'Escape') {
    e.stopPropagation()
    if (wordCollectPickerState.creating) {
      cancelCreating()
    } else {
      closeWordCollectPicker()
    }
    return
  }

  if (wordCollectPickerState.creating) {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      confirmCreateDict()
    }
    return
  }

  const digitMatch = e.key.match(/^[1-9]$/)
  if (digitMatch) {
    e.preventDefault()
    e.stopImmediatePropagation()
    selectDictByIndex(Number(digitMatch[0]) - 1)
  }
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onKeydown, true)
})

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKeydown, true)
})

watch(
  () => [wordCollectPickerState.visible, wordCollectPickerState.x, wordCollectPickerState.y],
  () => {
    if (wordCollectPickerState.visible) adjustPosition()
  }
)

useDisableEventListener(() => wordCollectPickerState.visible)
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="wordCollectPickerState.visible"
        ref="popoverRef"
        class="word-collect-popover"
        :style="positionStyle"
        @click.stop
      >
        <div class="font-medium mb-2 pr-1">{{ $t('collect_to_dict') }}</div>

        <div v-if="dictList.length" class="dict-list">
          <div v-for="(dict, index) in dictList" :key="dict.id" class="dict-item" @click="selectDict(dict)">
            <span class="dict-name">{{ dict.name }}</span>
            <span v-if="index < 9" class="dict-shortcut">{{ $t('shortcut') }} {{ index + 1 }}</span>
          </div>
        </div>

        <div class="popover-footer" :class="{ 'has-divider': dictList.length }">
          <div v-if="wordCollectPickerState.creating" class="create-row">
            <BaseInput
              v-model="wordCollectPickerState.newDictName"
              class="flex-1"
              autofocus
              :placeholder="$t('please_enter_dict_name')"
              :maxlength="20"
              @keydown.enter.prevent="confirmCreateDict"
            />
            <BaseIcon class="action-btn" :title="$t('cancel')" @click="cancelCreating">
              <IconFluentDismiss16Regular />
            </BaseIcon>
            <BaseIcon
              class="action-btn"
              :class="{ disabled: !wordCollectPickerState.newDictName.trim() || creatingLoading }"
              :title="$t('confirm')"
              @click="confirmCreateDict"
            >
              <IconFluentCheckmark16Regular />
            </BaseIcon>
          </div>
          <div v-else class="add-dict-btn" @click="startCreating">
            <IconFluentAdd16Regular class="text-base" />
            <span>{{ $t('add_custom_dict') }}</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.word-collect-popover {
  position: fixed;
  z-index: 10001;
  min-width: 12rem;
  max-width: 18rem;
  background: var(--color-tooltip-bg);
  border: 1px solid var(--color-item-border);
  border-radius: 0.5rem;
  padding: 0.75rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  pointer-events: auto;
}

.dict-list {
  display: flex;
  flex-direction: column;
  max-height: 16rem;
  overflow-y: auto;
  overflow-x: hidden;
}

.dict-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  width: 100%;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  background: transparent;
  color: var(--color-main-text);
  cursor: pointer;
  text-align: left;
  transition: background-color 0.3s;
  box-sizing: border-box;

  &:hover {
    background-color: var(--color-fourth);

    .dict-shortcut {
      opacity: 1;
    }
  }
}

.dict-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dict-shortcut {
  flex-shrink: 0;
  color: var(--color-gray);
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.2s;
}

.popover-footer {
  &.has-divider {
    margin-top: 0.375rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--color-item-border);
  }
}

.add-dict-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  width: 100%;
  padding: 0.25rem 0.5rem;
  border: none;
  border-radius: 0.375rem;
  background: transparent;
  color: var(--color-gray);
  cursor: pointer;
  box-sizing: border-box;
  transition:
    background-color 0.3s,
    color 0.3s;

  &:hover {
    background-color: var(--color-fourth);
    color: var(--color-main-text);
  }
}

.create-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.action-btn {
  flex-shrink: 0;
  cursor: pointer;

  &.disabled {
    opacity: 0.4;
    pointer-events: none;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
