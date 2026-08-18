<script setup lang="ts">
import type { Word } from '@/core/types'
import { onMounted, watch } from 'vue'
import SentenceHightLightWord from './SentenceHightLightWord.vue'

const props = withDefaults(
  defineProps<{
    word: Word
    showFull: boolean
    posSpace?: boolean // 词性是否需要固定占位
  }>(),
  {
    posSpace: true,
  }
)

watch(
  () => props.word.trans,
  () => {
    init()
  }
)

let posList = $ref<{ pos: string; trans: { cn: string; frequency?: number }[]; totalFreq: number }[]>([])
let noposTrans = $ref<{ cn: string; frequency?: number }[]>([])

function init() {
  const trans = props.word.trans
  let posMap = new Map<string, { pos: string; cn: string; frequency?: number }[]>()
  let emptyPos: { cn: string; frequency?: number }[] = []
  trans.forEach(item => {
    if (!item.pos) {
      emptyPos.push(item)
      return
    }
    if (!posMap.has(item.pos)) {
      posMap.set(item.pos, [])
    }
    posMap.get(item.pos)?.push(item)
  })
  let list = Array.from(posMap, ([pos, trans]) => ({ pos: pos, trans: trans, totalFreq: 0 }))
  list.forEach(pos => {
    let totalFreq = 0
    pos.trans = pos.trans.sort((a, b) => b.frequency - a.frequency)
    pos.trans.forEach((tran, _) => {
      if (tran.frequency) {
        totalFreq += tran.frequency
      }
    })
    pos.totalFreq = totalFreq
  })
  list = list.sort((a, b) => b.totalFreq - a.totalFreq)
  posList = list
  noposTrans = emptyPos
}

onMounted(() => {
  init()
})
</script>
<template>
  <div>
    <div class="flex gap-3 flex-wrap items-end">
      <span v-for="tran in noposTrans">
        <SentenceHightLightWord
          :class="['rare', 'uncommon', 'common'][tran.frequency ?? 2]"
          :text="tran.cn"
          :word="word.word"
          :dictation="!props.showFull"
          :high-light="false"
        />
      </span>
    </div>
    <div class="flex" v-for="pos in posList">
      <div class="shrink-0 pos" :class="!posSpace && 'min-w-unset pr-0'">{{ pos.pos }}&nbsp;</div>
      <div class="flex gap-3 flex-wrap items-end">
        <span v-for="tran in pos.trans">
          <SentenceHightLightWord
            :class="['rare', 'uncommon', 'common'][tran.frequency ?? 2]"
            :text="tran.cn"
            :word="word.word"
            :dictation="!props.showFull"
            :high-light="false"
          />
        </span>
      </div>
    </div>
  </div>
</template>
<style scoped lang="scss">
.rare {
  opacity: 0.6;
  font-weight: 100;
}

.uncommon {
  opacity: 0.8;
  font-weight: 300;
}

.common {
  opacity: 1;
  //font-weight: 500;
}
</style>
