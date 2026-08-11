<script setup lang="ts">
import type { Article } from '@/core/types'
import { ref, watch } from 'vue'
import { get } from 'idb-keyval'
import { Audio } from '@/base'
import { ENV, LOCAL_FILE_KEY } from '@/core/config/env.ts'

const props = defineProps<{
  article: Article
}>()

const emit = defineEmits<{
  (e: 'ended'): []
  (e: 'update-volume', volume: number): void
  (e: 'update-speed', volume: number): void
}>()

let file = $ref(null)
let instance = $ref<{ audioRef: HTMLAudioElement }>({ audioRef: null })
const pendingUpdates = ref({})

const handleVolumeUpdate = (volume: number) => {
  emit('update-volume', volume)
}

const handleSpeedUpdate = (speed: number) => {
  emit('update-speed', speed)
}

const setAudioRefValue = (key: string, value: any) => {
  if (instance?.audioRef) {
    switch (key) {
      case 'currentTime':
        instance.audioRef.currentTime = value
        break
      case 'volume':
        instance.audioRef.volume = value
        break
      case 'playbackRate':
        instance.audioRef.playbackRate = value
        break
      default:
        break
    }
  } else {
    // 如果audioRef还未初始化，先存起来，等初始化后再设置 => watch监听instance变化
    pendingUpdates.value[key] = value
  }
}

watch(
  () => props.article.audioFileId,
  async () => {
    if (!props.article.audioSrc && props.article.audioFileId) {
      let list = await get(LOCAL_FILE_KEY)
      if (list) {
        let rItem = list.find(file => file.id === props.article.audioFileId)
        if (rItem) {
          file = URL.createObjectURL(rItem.file)
        }
      }
    } else {
      file = null
    }
  },
  { immediate: true }
)

// 监听instance变化，设置之前pending的值
watch(
  () => instance,
  newVal => {
    Object.entries(pendingUpdates.value).forEach(([key, value]) => {
      setAudioRefValue(key, value)
    })
    pendingUpdates.value = {}
  },
  { immediate: true }
)

//转发一遍，这里Proxy的默认值不能为{}，可能是vue做了什么
defineExpose(
  new Proxy(
    {
      currentTime: 0,
      played: false,
      src: '',
      volume: 0,
      playbackRate: 1,
      play: () => void 0,
      pause: () => void 0,
    },
    {
      get(target, key) {
        if (key === 'currentTime') return instance?.audioRef?.currentTime
        if (key === 'played') return instance?.audioRef?.played
        if (key === 'src') return instance?.audioRef?.src
        if (key === 'volume') return instance?.audioRef?.volume
        if (key === 'playbackRate') return instance?.audioRef?.playbackRate
        if (key === 'play') instance?.audioRef?.play()
        if (key === 'pause') instance?.audioRef?.pause()
        return target[key]
      },
      set(_, key, value) {
        setAudioRefValue(key as string, value)
        return true
      },
    }
  )
)
</script>

<template>
  <Audio
    v-bind="$attrs"
    ref="instance"
    v-if="props.article.audioSrc"
    :src="ENV.RESOURCE_URL + props.article.audioSrc"
    @ended="emit('ended')"
    @update-volume="handleVolumeUpdate"
    @update-speed="handleSpeedUpdate"
  />
  <Audio
    v-bind="$attrs"
    ref="instance"
    v-else-if="file"
    :src="file"
    @ended="emit('ended')"
    @update-volume="handleVolumeUpdate"
    @update-speed="handleSpeedUpdate"
  />
</template>
