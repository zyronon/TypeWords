import {onMounted, watchEffect} from "vue"
import {useSettingStore} from "@/stores/setting.ts";
import {PronunciationApi} from "@/types/types.ts";

import { SoundFileOptions } from "@/config/env.ts";

export function useSound(audioSrcList?: string[], audioFileLength?: number) {
  let audioList: HTMLAudioElement[] = $ref([])
  let audioLength = $ref(1)
  let index = $ref(0)

  onMounted(() => {
    if (audioSrcList) setAudio(audioSrcList, audioFileLength)
  })

  function setAudio(audioSrcList2: string[], audioFileLength2?: number) {
    if (audioFileLength2) audioLength = audioFileLength2
    audioList = []
    for (let i = 0; i < audioLength; i++) {
      audioSrcList2.map(src => audioList.push(new Audio(src)))
    }
    index = 0
  }

  function play(volume: number = 100) {
    index++
    if (audioList.length > 1 && audioList.length !== audioLength) {
      audioList[index % audioList.length].volume = volume / 100
      audioList[index % audioList.length].play()
    } else {
      audioList[index % audioLength].volume = volume / 100
      audioList[index % audioLength].play()
    }
  }

  return {play, setAudio}
}


export function usePlayKeyboardAudio() {
  const settingStore = useSettingStore()
  const {play, setAudio} = useSound()

  watchEffect(() => {
    if (!SoundFileOptions.find(v => v.value === settingStore.keyboardSoundFile)) {
      settingStore.keyboardSoundFile = 'mechanical2'
    }
    let urlList = getAudioFileUrl(settingStore.keyboardSoundFile)
    setAudio(urlList, urlList.length === 1 ? 3 : 1)
  })

  function playAudio() {
    if (settingStore.keyboardSound) {
      play(settingStore.keyboardSoundVolume)
    }
  }

  return playAudio
}

export function usePlayBeep() {
  const settingStore = useSettingStore()
  const {play} = useSound([`/sound/beep.wav`], 1)

  function playAudio() {
    if (settingStore.effectSound) {
      play(settingStore.effectSoundVolume)
    }
  }

  return playAudio
}

export function usePlayCorrect() {
  const settingStore = useSettingStore()
  const {play} = useSound([`/sound/correct.wav`], 1)

  function playAudio() {
    if (settingStore.effectSound) {
      play(settingStore.effectSoundVolume)
    }
  }

  return playAudio
}

export function usePlayWordAudio() {
  const settingStore = useSettingStore()
  const audio = $ref(new Audio())

  function playAudio(word: string) {
    let url = `${PronunciationApi}${word}&type=2`
    if (settingStore.soundType === 'uk') {
      url = `${PronunciationApi}${word}&type=1`
    }
    audio.src = url
    audio.volume = settingStore.wordSoundVolume / 100
    audio.playbackRate = settingStore.wordSoundSpeed
    audio.play()
  }

  return playAudio
}

export function useTTsPlayAudio() {
  let isPlay = $ref(false)

  function play(text: string) {
    // if (isPlay) {
    //   isPlay = false
    //   return window.speechSynthesis.pause();
    // }
    let msg = new SpeechSynthesisUtterance();
    msg.text = text
    msg.rate = 1;
    msg.pitch = 1;
    // msg.lang = 'en-US';
    msg.lang = 'zh-CN';
    isPlay = true
    window.speechSynthesis.speak(msg);
    console.log('text', text)

  }

  return play
}

export function usePlayAudio(url: string) {
  new Audio(url).play().then(r => void 0)
}

export function getAudioFileUrl(name: string) {
  // Mapping pour les anciens noms chinois vers les nouveaux noms
  const nameMap = {
    '机械键盘': 'mechanical',
    '机械键盘1': 'mechanical1',
    '机械键盘2': 'mechanical2',
    '老式机械键盘': 'vintage',
    '笔记本键盘': 'laptop'
  }
  
  // Convertir l'ancien nom si nécessaire
  const mappedName = nameMap[name] || name
  
  if (mappedName === 'mechanical') {
    return [
      `/sound/key-sounds/jixie/机械0.mp3`,
      `/sound/key-sounds/jixie/机械1.mp3`,
      `/sound/key-sounds/jixie/机械2.mp3`,
      `/sound/key-sounds/jixie/机械3.mp3`,
    ]
  } else {
    // Mapper les nouveaux noms vers les fichiers existants
    const fileMap = {
      'mechanical1': '机械键盘1',
      'mechanical2': '机械键盘2',
      'vintage': '老式机械键盘',
      'laptop': '笔记本键盘'
    }
    const fileName = fileMap[mappedName] || mappedName
    return [`/sound/key-sounds/${fileName}.mp3`]
  }
}