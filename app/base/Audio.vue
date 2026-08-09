<script setup lang="ts">
import { computed, ref, useAttrs, watch } from 'vue'

interface IProps {
  src?: string
  autoplay?: boolean
  loop?: boolean
  volume?: number // 0-1
  currentTime?: number
  playbackRate?: number
  disabled?: boolean
}

const props = withDefaults(defineProps<IProps>(), {
  autoplay: false,
  loop: false,
  volume: 1,
  currentTime: 0,
  playbackRate: 1,
  disabled: false,
})

const emit = defineEmits<{
  (e: 'ended'): []
  (e: 'update-volume', volume: number): void
  (e: 'update-speed', volume: number): void
}>()

const attrs = useAttrs()

// 音频元素引用
const audioRef = ref<HTMLAudioElement>()
const progressBarRef = ref<HTMLDivElement>()
const volumeBarRef = ref<HTMLDivElement>()
const volumeFillRef = ref<HTMLElement>()

// 状态管理
const isPlaying = ref(false)
const isLoading = ref(false)
const duration = ref(0)
const currentTime = ref(0)
// const volume = ref(props.volume);
const volume = ref(props.volume)
const playbackRate = ref(props.playbackRate)
const isDragging = ref(false)
const isVolumeDragging = ref(false)
const isVolumeHovering = ref(false) // 添加音量控制hover状态变量
const volumePosition = ref('top') // 音量控制位置，'top'或'down'
const error = ref('')

// 计算属性
const progress = computed(() => {
  return duration.value > 0 ? (currentTime.value / duration.value) * 100 : 0
})

const volumeProgress = computed(() => {
  return volume.value * 100
})

const formatTime = (time: number) => {
  if (!isFinite(time)) return '0:00'
  const minutes = Math.floor(time / 60)
  const seconds = Math.floor(time % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

// 播放控制
const togglePlay = async () => {
  if (!audioRef.value || props.disabled) return

  try {
    if (isPlaying.value) {
      audioRef.value.pause()
    } else {
      await audioRef.value.play()
    }
  } catch (err) {
    console.error('播放失败:', err)
    error.value = '播放失败'
  }
}

const toggleMute = () => {
  if (!audioRef.value || props.disabled) return

  if (volume.value > 0) {
    volume.value = 0
    audioRef.value.volume = 0
  } else {
    volume.value = 1
    audioRef.value.volume = 1
  }
  emit('update-volume', Math.floor(volume.value * 100))
}

const changePlaybackRate = () => {
  if (!audioRef.value || props.disabled) return
  const rates = [0.5, 0.75, 1, 1.25, 1.5, 2]
  const currentIndex = rates.indexOf(playbackRate.value)
  const nextIndex = (currentIndex + 1) % rates.length
  playbackRate.value = rates[nextIndex]
  audioRef.value.playbackRate = playbackRate.value
  // 提交更新播放速度事件
  emit('update-speed', playbackRate.value)
}

// 事件处理
const handleLoadStart = () => {
  isLoading.value = true
}

const handleLoadedData = () => {
  isLoading.value = false
}

const handleLoadedMetadata = () => {
  if (audioRef.value) {
    audioRef.value.volume = volume.value
  }

  duration.value = audioRef.value?.duration || 0
}

const handleCanPlayThrough = () => {}

const handlePlay = () => {
  isPlaying.value = true
}

const handlePause = () => {
  isPlaying.value = false
}

const handleEnded = () => {
  isPlaying.value = false
  currentTime.value = 0
  emit('ended')
}

const handleError = () => {
  error.value = '音频加载失败'
  isLoading.value = false
}

const handleTimeUpdate = () => {
  if (audioRef.value && !isDragging.value) {
    currentTime.value = audioRef.value.currentTime
  }
}

const handleVolumeChange = () => {
  if (audioRef.value && !isVolumeDragging.value) {
    volume.value = audioRef.value.volume
  }
}

const handleRateChange = () => {
  if (audioRef.value) {
    playbackRate.value = audioRef.value.playbackRate
  }
}

// 进度条处理
const handleProgressMouseDown = (event: MouseEvent) => {
  if (!audioRef.value || !progressBarRef.value || props.disabled) return

  event.preventDefault()
  event.stopPropagation()

  const rect = progressBarRef.value.getBoundingClientRect()
  const startX = event.clientX
  const startY = event.clientY
  let hasMoved = false
  let lastPosition = 0 // 记录最后的位置
  const moveThreshold = 3 // 移动阈值，超过这个距离才认为是拖拽

  // 获取DOM元素引用
  const progressFill = progressBarRef.value.querySelector('.progress-fill') as HTMLElement
  const progressThumb = progressBarRef.value.querySelector('.progress-thumb') as HTMLElement

  // 立即跳转到点击位置
  const clickX = event.clientX - rect.left
  const percentage = Math.max(0, Math.min(1, clickX / rect.width))
  const newTime = percentage * duration.value

  // 直接更新DOM样式
  if (progressFill && progressThumb) {
    progressFill.style.width = `${percentage * 100}%`
    progressThumb.style.left = `${percentage * 100}%`
  }

  audioRef.value.currentTime = newTime
  currentTime.value = newTime
  lastPosition = newTime
  isDragging.value = true

  const handleMouseMove = (e: MouseEvent) => {
    const deltaX = Math.abs(e.clientX - startX)
    const deltaY = Math.abs(e.clientY - startY)

    if (deltaX > moveThreshold || deltaY > moveThreshold) {
      hasMoved = true
    }

    if (!hasMoved) return

    // 禁用过渡动画
    if (progressFill && progressThumb) {
      progressFill.style.transition = 'none'
      progressThumb.style.transition = 'none'
    }

    const rect = progressBarRef.value!.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percentage = Math.max(0, Math.min(1, clickX / rect.width))
    const newTime = percentage * duration.value

    // 直接更新DOM样式，不使用响应式变量
    if (progressFill && progressThumb) {
      progressFill.style.width = `${percentage * 100}%`
      progressThumb.style.left = `${percentage * 100}%`
    }

    // 只更新响应式变量用于时间显示，不用于样式
    currentTime.value = newTime
    lastPosition = newTime
  }

  const handleMouseUp = () => {
    isDragging.value = false

    // 恢复过渡动画
    if (progressFill && progressThumb) {
      progressFill.style.transition = ''
      progressThumb.style.transition = ''
    }

    // 如果是拖拽，在结束时更新audio元素到最终位置
    if (hasMoved && audioRef.value) {
      audioRef.value.currentTime = lastPosition
    }

    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

// 音量控制处理
const handleVolumeMouseDown = (event: MouseEvent) => {
  if (!audioRef.value || !volumeBarRef.value || props.disabled) return

  event.preventDefault()
  event.stopPropagation()

  const rect = volumeBarRef.value.getBoundingClientRect()
  const startX = event.clientX
  const startY = event.clientY
  let hasMoved = false
  let lastVolume = 0 // 记录最后音量
  const moveThreshold = 3 // 超过这个距离才认为是拖拽

  const volumeFill = volumeFillRef.value

  // 计算点击位置对应音量百分比（最上 100%，最下 0%）
  const clickY = event.clientY - rect.top
  const percentage = 1 - Math.max(0, Math.min(1, clickY / rect.height))

  // 更新 UI 与音量
  if (volumeFill) {
    volumeFill.style.height = `${percentage * 100}%`
  }

  volume.value = percentage
  audioRef.value.volume = percentage
  lastVolume = percentage
  isVolumeDragging.value = true

  // 鼠标移动时调整音量
  const handleMouseMove = (e: MouseEvent) => {
    const deltaX = Math.abs(e.clientX - startX)
    const deltaY = Math.abs(e.clientY - startY)

    if (deltaX > moveThreshold || deltaY > moveThreshold) {
      hasMoved = true
    }

    if (!hasMoved) return

    // 禁用过渡动画
    if (volumeFill) {
      volumeFill.style.transition = 'none'
    }

    const rect = volumeBarRef.value!.getBoundingClientRect()
    const moveY = e.clientY - rect.top
    const percentage = 1 - Math.max(0, Math.min(1, moveY / rect.height))

    if (volumeFill) {
      volumeFill.style.height = `${percentage * 100}%`
    }

    volume.value = percentage
    lastVolume = percentage
    if (audioRef.value) {
      audioRef.value.volume = percentage
    }
  }

  // 鼠标释放时结束拖动
  const handleMouseUp = () => {
    isVolumeDragging.value = false

    // 恢复过渡动画
    if (volumeFill) {
      volumeFill.style.transition = ''
    }

    if (hasMoved && audioRef.value) {
      audioRef.value.volume = lastVolume
    }
    // 提交更新音量事件
    emit('update-volume', Math.floor(volume.value * 100))

    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

// 音量控制鼠标移入事件，自动调整音量控制条位置
const onVolumeSectionEnter = (e: MouseEvent) => {
  isVolumeHovering.value = true
  const section = e.target as HTMLElement
  const top = section.getBoundingClientRect().top + window.scrollY
  const dropdownH = section.querySelector('.volume-dropdown').clientHeight
  if (top < dropdownH * 1.25) {
    volumePosition.value = 'down'
  } else {
    volumePosition.value = 'top'
  }
}

// 监听属性变化
watch(
  () => props.src,
  newSrc => {
    if (audioRef.value) {
      // 重置所有状态
      isPlaying.value = false
      isLoading.value = false
      currentTime.value = 0
      duration.value = 0
      error.value = ''

      if (newSrc) {
        audioRef.value.src = newSrc
        audioRef.value.load()
      } else {
        // 如果src为空，清空音频源
        audioRef.value.src = ''
        audioRef.value.load()
      }
    }
  }
)

watch(
  () => props.volume,
  newVolume => {
    volume.value = newVolume
    if (audioRef.value) {
      audioRef.value.volume = newVolume
    }
  }
)

watch(
  () => props.currentTime,
  newTime => {
    if (audioRef.value && !isDragging.value) {
      audioRef.value.currentTime = newTime
      currentTime.value = newTime
    }
  }
)

watch(
  () => props.playbackRate,
  newRate => {
    playbackRate.value = newRate
    if (audioRef.value) {
      audioRef.value.playbackRate = newRate
    }
  }
)

defineExpose({ audioRef })
</script>

<template>
  <div class="custom-audio" :class="{ disabled: disabled || error, 'has-error': error }" v-bind="attrs">
    <!-- 隐藏的原生audio元素 -->
    <audio
      ref="audioRef"
      :src="src"
      preload="auto"
      :autoplay="autoplay"
      :loop="loop"
      :controls="false"
      @loadstart="handleLoadStart"
      @loadeddata="handleLoadedData"
      @loadedmetadata="handleLoadedMetadata"
      @canplaythrough="handleCanPlayThrough"
      @play="handlePlay"
      @pause="handlePause"
      @ended="handleEnded"
      @error="handleError"
      @timeupdate="handleTimeUpdate"
      @volumechange="handleVolumeChange"
      @ratechange="handleRateChange"
    />

    <!-- 自定义控制界面 -->
    <div class="audio-container">
      <!-- 播放/暂停按钮 -->
      <button
        class="play-button"
        :class="{ loading: isLoading }"
        @click="togglePlay"
        :disabled="disabled"
        :aria-label="isPlaying ? '暂停' : '播放'"
      >
        <div v-if="isLoading" class="loading-spinner"></div>
        <svg v-else-if="isPlaying" class="icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
        </svg>
        <svg v-else class="icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      </button>

      <!-- 进度条区域 -->
      <div class="progress-section">
        <!-- 进度条 -->
        <div class="progress-container" @mousedown="handleProgressMouseDown" ref="progressBarRef">
          <div class="progress-track">
            <div class="progress-fill" :style="{ width: progress + '%' }"></div>
            <div class="progress-thumb" :style="{ left: progress + '%' }"></div>
          </div>
        </div>
        <!-- 时间显示 -->
        <span class="time-display">{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</span>
      </div>

      <!-- 音量控制 -->
      <div class="volume-section" @mouseenter="onVolumeSectionEnter" @mouseleave="isVolumeHovering = false">
        <button
          class="volume-button"
          tabindex="-1"
          @click="toggleMute"
          :disabled="disabled"
          :aria-label="volume > 0 ? '静音' : '取消静音'"
        >
          <IconBxVolumeMute v-if="volume === 0" class="icon"></IconBxVolumeMute>
          <IconBxVolumeLow v-else-if="volume < 0.5" class="icon"></IconBxVolumeLow>
          <IconBxVolumeFull v-else class="icon"></IconBxVolumeFull>
        </button>

        <!-- 音量下拉控制条 -->
        <div class="volume-dropdown" :class="[{ active: isVolumeHovering || isVolumeDragging }, volumePosition]">
          <div class="volume-container" @mousedown="handleVolumeMouseDown" ref="volumeBarRef">
            <div class="volume-track">
              <div class="volume-fill" ref="volumeFillRef" :style="{ height: volumeProgress + '%', bottom: 0 }"></div>
            </div>
            <div class="volume-num">
              <span>{{ Math.floor(volumeProgress) }}%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 播放速度控制 -->
      <button
        class="speed-button"
        @click="changePlaybackRate"
        :disabled="disabled"
        :aria-label="`播放速度: ${playbackRate}x`"
      >
        {{ playbackRate }}x
      </button>
    </div>

    <!-- 错误信息 -->
    <div v-if="error" class="error-message">{{ error }}</div>
  </div>
</template>

<style scoped lang="scss">
.custom-audio {
  --audio-border-radius: 8px;
  --audio-box-shadow: 0 2px 2px rgba(0, 0, 0, 0.1);
  --audio-button-bg: rgba(255, 255, 255, 0.2);
  --audio-thumb-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  --audio-volume-thumb-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  --audio-speed-button-border: rgba(255, 255, 255, 0.3);
  --audio-error-bg: #f56c6c;
  --height: 32px;
  --gap: 8px;

  border-radius: var(--audio-border-radius);
  box-shadow: var(--audio-box-shadow);
  color: var(--color-reverse-black);
  transition: all 0.3s ease;
  font-family: var(--font-family);
  padding: 0.3rem 0.4rem;
  @apply box-border w-full relative bg-primary inline-block max-w-[600px];

  &.disabled {
    pointer-events: none;
  }

  &.has-error {
    border: 1px solid var(--audio-error-bg);
  }
}

.audio-container {
  @apply flex items-center gap-2;
}

.play-button {
  @apply flex items-center justify-center mr-2 rounded-full bg-second cursor-pointer transition-all duration-300 flex-shrink-0;
  width: var(--height);
  height: var(--height);
  color: var(--color-reverse-black);
  background: var(--color-second);
  border: 1px solid var(--audio-speed-button-border);

  &:hover {
    background: var(--color-card-active) !important;
  }

  &.loading {
    background: var(--audio-button-bg);
  }

  .icon {
    @apply w-5 h-5;
  }

  .loading-spinner {
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top: 2px solid currentColor;
    animation: spin 1s linear infinite;
    @apply w-5 h-5 rounded-full box-border flex-shrink-0;
  }
}

.progress-section {
  @apply flex items-center gap-2 flex-1 min-w-0;
}

.time-display {
  @apply text-xs font-medium opacity-80 whitespace-nowrap text-center;
}

.progress-container {
  @apply flex items-center cursor-pointer p-0 flex-1;
}

.progress-track {
  @apply relative w-full h-2 bg-second rounded-sm;
}

.progress-fill {
  @apply h-full bg-fourth rounded-sm transition-width duration-100;
}
  
.progress-thumb {
  @apply absolute top-1/2 transform-translate-x-1/2 w-3 h-3 bg-fourth rounded-full cursor-grab opacity-100 transition-all duration-200;
  transform: translate(-50%, -50%);
  box-shadow: var(--audio-thumb-shadow);

  &:active {
    @apply cursor-grabbing;
  }
}

.volume-section {
  @apply flex items-center justify-center gap-2 flex-shrink-0 relative;
}

.volume-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--height);
  height: var(--height);
  border-radius: 4px;
  background: var(--color-second);
  cursor: pointer;
  color: var(--color-reverse-black);
  transition: all 0.2s ease;
  border: 1px solid var(--audio-speed-button-border);

  &:hover {
    background: var(--color-card-active);
  }

  .icon {
    @apply w-5 h-5;
  }
}

.volume-dropdown {
  position: absolute;
  background: var(--color-reverse-white);
  border-radius: 8px;
  padding: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  opacity: 0;
  visibility: hidden;
  transition:
    opacity 0.2s ease,
    visibility 0.2s ease;
  z-index: 10;
  color: var(--color-reverse-black);

  &.active {
    opacity: 1;
    visibility: visible;
  }

  &.top {
    bottom: 42px;
  }

  &.down {
    top: 42px;
  }
}

.volume-container {
  width: 24px;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 8px 0;
}

.volume-track {
  position: relative;
  width: 6px;
  height: 100%;
  background: var(--color-second);
  border-radius: 6px;
  // overflow: hidden;
}

.volume-num {
  display: flex;
  position: absolute;
  bottom: 0;
  font-size: 12px;
  transform: scale(0.85);
  line-height: normal;
}

.volume-fill {
  position: absolute;
  bottom: 0;
  width: 100%;
  height: var(--fill-height);
  background: var(--color-fourth);
  border-radius: 6px;
  display: flex;
  justify-content: center;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    width: 10px;
    height: 10px;
    border-radius: 100%;
    background: var(--color-fourth);
    transform: translateY(-50%);
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.5);
    cursor: grab;
  }
}

.speed-button {
  padding: 0 0.5rem;
  border: 1px solid var(--audio-speed-button-border);
  border-radius: 4px;
  background: var(--color-second);
  height: var(--height);
  cursor: pointer;
  color: var(--color-reverse-black);
  transition: all 0.2s ease;

  &:hover {
    background: var(--color-card-active);
  }
}

.error-message {
  position: absolute;
  right: 0;
  left: 2.6rem;
  top: 0;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background: var(--audio-error-bg);
  color: var(--color-reverse-white);
  font-size: 12px;
  border-radius: var(--audio-border-radius);
}

// 动画
@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}
</style>
