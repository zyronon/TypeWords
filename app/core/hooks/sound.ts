import { onMounted, watchEffect } from 'vue'
import { useSettingStore } from '../stores/setting'
import { ref } from 'vue'

import { ENV, PronunciationApi, SoundFileOptions } from '../config/env'
import { Toast } from '@/base'

/**
 * 获取当前浏览器的 OS+浏览器 组合 key，用于 ttsVoiceMap 的索引
 * 返回如 "mac+chrome" / "windows+edge" / "ios+safari" 等固定组合
 */
export function getBrowserKey(): string {
  if (typeof navigator === 'undefined') return 'unknown+unknown'
  const ua = navigator.userAgent

  let os = 'unknown'
  if (/iPad|iPhone|iPod/.test(ua)) {
    os = 'ios'
  } else if (/Android/.test(ua)) {
    os = 'android'
  } else if (/Macintosh|Mac OS X/.test(ua)) {
    os = 'mac'
  } else if (/Windows/.test(ua)) {
    os = 'windows'
  } else if (/Linux/.test(ua)) {
    os = 'linux'
  }

  let browser = 'unknown'
  if (/Edg\//.test(ua)) {
    browser = 'edge'
  } else if (/OPR\/|Opera/.test(ua)) {
    browser = 'opera'
  } else if (/Chrome\//.test(ua)) {
    browser = 'chrome'
  } else if (/Firefox\//.test(ua)) {
    browser = 'firefox'
  } else if (/Safari\//.test(ua)) {
    browser = 'safari'
  }

  return `${os}+${browser}`
}

/**
 * 获取口音设置对应的 TTS 语言
 */
export function getAccentLang(soundType: string): string {
  return soundType === 'uk' ? 'en-GB' : 'en-US'
}

/**
 * 获取 ttsVoiceMap 的索引，声色按口音分开保存
 * 美音沿用原来的 key；英音如 "mac+chrome+uk"
 */
export function getTtsVoiceKey(lang: string): string {
  const browserKey = getBrowserKey()
  return lang === 'en-GB' ? `${browserKey}+uk` : browserKey
}

/**
 * 判断声色是否属于该语言，Android 上部分浏览器的 lang 格式为 en_us
 */
export function isVoiceOfLang(voice: SpeechSynthesisVoice, lang: string): boolean {
  return voice.lang.replace('_', '-').toLowerCase() === lang.toLowerCase()
}

/**
 * 查找用户为该口音保存的声色
 * 旧版只保存一个声色（即现在美音的 key）：英音未单独设置时，如果它本身是英音声色，或设备上没有英音声色，就继续沿用
 */
export function findSavedTtsVoice(
  voices: SpeechSynthesisVoice[],
  voiceMap: { key: string; voice: string }[] | undefined,
  lang: string
): SpeechSynthesisVoice | undefined {
  const findByKey = (key: string) => {
    const name = voiceMap?.find(v => v.key === key)?.voice
    return voices.find(v => v.name === name)
  }
  const saved = findByKey(getTtsVoiceKey(lang))
  if (saved || lang !== 'en-GB') return saved
  const legacy = findByKey(getBrowserKey())
  return legacy && (isVoiceOfLang(legacy, lang) || !voices.some(v => isVoiceOfLang(v, lang))) ? legacy : undefined
}

export function useSound(audioSrcList?: string[], audioFileLength?: number) {
  let audioList = ref<HTMLAudioElement[]>([])
  let audioLength = ref(1)
  let index = ref(0)

  onMounted(() => {
    if (audioSrcList) setAudio(audioSrcList, audioFileLength)
  })

  //这里同一个音频弄好几份是为了快速打字是，可同时发音
  function setAudio(audioSrcList2: string[], audioFileLength2?: number) {
    //@ts-ignore
    if (import.meta.server) return
    if (audioFileLength2) audioLength.value = audioFileLength2
    audioList.value = []
    for (let i = 0; i < audioLength.value; i++) {
      audioSrcList2.map(src => audioList.value.push(new Audio(ENV.RESOURCE_URL + src)))
    }
    index.value = 0
  }

  function play(volume: number = 100) {
    index.value++
    if (audioList.value.length > 1 && audioList.value.length !== audioLength.value) {
      let htmlAudioElement = audioList.value[index.value % audioList.value.length]
      if (htmlAudioElement) {
        htmlAudioElement.volume = volume / 100
        void htmlAudioElement.play().catch(() => {})
      }
    } else {
      let htmlAudioElement1 = audioList.value[index.value % audioLength.value]
      if (htmlAudioElement1) {
        htmlAudioElement1.volume = volume / 100
        void htmlAudioElement1.play().catch(() => {})
      }
    }
  }

  return { play, setAudio }
}

let keyboardPlayFn: ((volume: number) => void) | null = null
export function usePlayKeyboardAudio() {
  const settingStore = useSettingStore()

  if (!keyboardPlayFn) {
    const { play, setAudio } = useSound()

    watchEffect(() => {
      if (!settingStore.keyboardSound) return
      if (!SoundFileOptions.find(v => v.label === settingStore.keyboardSoundFile)) {
        settingStore.keyboardSoundFile = '机械键盘2'
      }
      let urlList = getAudioFileUrl(settingStore.keyboardSoundFile)
      setAudio(urlList, urlList.length === 1 ? 4 : 1)
    })

    keyboardPlayFn = play
  }

  function playAudio() {
    if (settingStore.keyboardSound) {
      keyboardPlayFn!(settingStore.keyboardSoundVolume)
    }
  }

  return playAudio
}

let playBeep = null
export function usePlayBeep() {
  const settingStore = useSettingStore()
  if (!playBeep) {
    const { play } = useSound([`/sound/beep.wav`], 1)
    playBeep = play
  }

  function playAudio() {
    if (settingStore.effectSound) {
      playBeep(settingStore.effectSoundVolume)
    }
  }

  return playAudio
}

export function usePlayCorrect() {
  const settingStore = useSettingStore()
  const { play } = useSound([`/sound/correct.wav`], 1)

  function playAudio() {
    if (settingStore.effectSound) {
      play(settingStore.effectSoundVolume)
    }
  }

  return playAudio
}

const activeWordPlayCountMap = new Map<string, number>()
let resetWordPlayCountTimer = -1

export function resetActiveWordPlayCount(word: string) {
  if (!word) return
  activeWordPlayCountMap.delete(word.trim().toLowerCase())
}

let cachedWordAudio: HTMLAudioElement | null = null
let wordPlaybackGeneration = 0
let ttsPlaybackGeneration = 0

function getCachedWordAudio(): HTMLAudioElement | null {
  if (!cachedWordAudio && typeof Audio !== 'undefined') {
    cachedWordAudio = new Audio()
  }
  return cachedWordAudio
}

export function cancelWordPracticeAudio() {
  wordPlaybackGeneration++
  ttsPlaybackGeneration++
  if (typeof speechSynthesis !== 'undefined') {
    speechSynthesis.pause()
    speechSynthesis.cancel()
  }
  const wordAudio = getCachedWordAudio()
  if (wordAudio) {
    wordAudio.onended = null
    wordAudio.onerror = null
    wordAudio.pause()
    wordAudio.currentTime = 0
  }
}

export function usePlayWordAudio() {
  const settingStore = useSettingStore()

  onMounted(() => {
    // @ts-ignore SSR guard
    if (import.meta.server) return
    getCachedWordAudio()
  })

  function playAudio(word: string, handle: boolean = true, onEnd?: () => void, onPlay?: () => void) {
    const wordAudio = getCachedWordAudio()
    if (!word || !wordAudio) return
    cancelWordPracticeAudio()
    const generation = ++wordPlaybackGeneration
    let playbackRate = settingStore.wordSoundSpeed
    if (handle) {
      const key = word.trim().toLowerCase()
      const count = activeWordPlayCountMap.get(key) ?? 0
      if (count % 3 !== 0) {
        playbackRate = playbackRate * 0.75
        Toast.success('0.75倍速播放')
      } else {
        Toast.closeAll()
      }
      activeWordPlayCountMap.set(key, count + 1)

      //5秒后重置，以免隔了很久播放，还是0.75倍
      clearTimeout(resetWordPlayCountTimer)
      resetWordPlayCountTimer = setTimeout(() => {
        activeWordPlayCountMap.set(key, 0)
      }, 5000)
    }
    // console.log('playAudio-handle', handle, playbackRate)
    let url = `${PronunciationApi}${word}&type=2`
    if (settingStore.soundType === 'uk') {
      url = `${PronunciationApi}${word}&type=1`
    }
    let onended = () => {
      if (generation !== wordPlaybackGeneration) return
      onEnd?.()
    }
    wordAudio.onended = onended
    wordAudio.onplay = () => onPlay?.()
    wordAudio.onerror = () => {
      if (generation !== wordPlaybackGeneration) return
      const ttsPlay = useTTsPlayAudio()
      ttsPlay(word, { rate: playbackRate, onEnd: onended })
    }
    wordAudio.src = url
    wordAudio.volume = settingStore.wordSoundVolume / 100
    wordAudio.playbackRate = playbackRate
    void wordAudio.play()
  }

  return playAudio
}

function getVoicesAsync() {
  return new Promise(resolve => {
    const voices = speechSynthesis.getVoices()
    if (voices.length) return resolve(voices)

    speechSynthesis.onvoiceschanged = () => {
      resolve(speechSynthesis.getVoices())
    }
  })
}

export interface TTsPlayOptions {
  rate?: number
  volume?: number
  pitch?: number
  lang?: string
  onEnd?: () => void
}

export function useTTsPlayAudio() {
  const settingStore = useSettingStore()

  function play(text: string, options: TTsPlayOptions = {}) {
    if (!text || typeof speechSynthesis === 'undefined') return
    const generation = ++ttsPlaybackGeneration
    speechSynthesis.cancel() // 防止 Chrome 队列卡死
    const lang = options.lang ?? getAccentLang(settingStore.soundType)
    let msg = new SpeechSynthesisUtterance(text)
    msg.rate = options.rate ?? settingStore.wordSoundSpeed
    msg.volume = options.volume ?? settingStore.wordSoundVolume / 100
    msg.pitch = options.pitch ?? 1
    msg.lang = lang
    msg.onend = () => options.onEnd?.()
    msg.onerror = () => options.onEnd?.()
    getVoicesAsync().then((voices: any[]) => {
      if (generation !== ttsPlaybackGeneration) return
      // 优先使用用户在当前浏览器为该口音配置的声色
      const savedVoice = findSavedTtsVoice(voices, settingStore?.ttsVoiceMap, lang)
      if (savedVoice) {
        msg.voice = savedVoice
        speechSynthesis.speak(msg)
        return
      }
      // 回退：优先用当前口音的声色（其中优先找 Emma / US），设备上没有则用其他英文声色
      let voiceList = voices.filter(v => isVoiceOfLang(v, lang))
      if (!voiceList.length) voiceList = voices.filter(v => v.lang.startsWith('en'))
      if (voiceList && voiceList.length) {
        msg.voice = voiceList.find(v => v.name.includes('US') || v.name.includes('Emma')) ?? voiceList[0]
      }
      speechSynthesis.speak(msg)
    })
  }

  return play
}

export function usePlayAudio(url: string) {
  void new Audio(url).play().catch(() => {})
}

export function getAudioFileUrl(name: string) {
  if (name === '机械键盘') {
    return [
      `/sound/key-sounds/jixie/机械0.mp3`,
      `/sound/key-sounds/jixie/机械1.mp3`,
      `/sound/key-sounds/jixie/机械2.mp3`,
      `/sound/key-sounds/jixie/机械3.mp3`,
    ]
  } else {
    return [`/sound/key-sounds/${name}.mp3`]
  }
}
