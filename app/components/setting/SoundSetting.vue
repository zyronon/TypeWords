<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Option, Select, Slider, Switch, VolumeIcon } from '@/base'
import SettingItem from './SettingItem.vue'
import SoundMasterControl from './SoundMasterControl.vue'
import { useSettingStore } from '@/core/stores/setting.ts'
import { ENV, SoundFileOptions } from '@/core/config/env.ts'
import { getBrowserKey, getAudioFileUrl, usePlayAudio } from '@/core/hooks/sound.ts'
import {
  useSoundMasterSettings,
  SOUND_VOLUME_ITEMS,
  SOUND_SPEED_ITEMS,
} from '@/core/composables/useSoundMasterSettings.ts'

const settingStore = useSettingStore()
const {
  volumeExpanded,
  volumeIsUnified,
  volumeMaster,
  volumeToggleExpanded,
  speedExpanded,
  speedIsUnified,
  speedMaster,
  speedToggleExpanded,
} = useSoundMasterSettings()

const showVolumeSubsInSections = computed(() => !volumeIsUnified.value && !volumeExpanded.value)
const showSpeedSubsInSections = computed(() => !speedIsUnified.value && !speedExpanded.value)
const showVolumeSubsInMaster = computed(() => volumeExpanded.value)
const showSpeedSubsInMaster = computed(() => speedExpanded.value)

// ---- TTS 声色 ----
const ttsVoiceList = ref<SpeechSynthesisVoice[]>([])
const ttsSelectKey = ref(0)

onMounted(() => {
  if (typeof speechSynthesis === 'undefined') return
  const load = () => {
    ttsVoiceList.value = speechSynthesis
      .getVoices()
      .filter(v => v.lang.startsWith('en'))
      .sort((a, b) => (b.localService ? 0 : 1) - (a.localService ? 0 : 1))
    ttsSelectKey.value++
  }
  load()
  speechSynthesis.onvoiceschanged = load
})

const browserKey = getBrowserKey()

const currentTtsVoice = computed({
  get() {
    return settingStore.ttsVoiceMap?.find(v => v.key === browserKey)?.voice ?? ''
  },
  set(voiceName: string) {
    const map = settingStore.ttsVoiceMap ? [...settingStore.ttsVoiceMap] : []
    const idx = map.findIndex(v => v.key === browserKey)
    if (idx >= 0) {
      map[idx] = { key: browserKey, voice: voiceName }
    } else {
      map.push({ key: browserKey, voice: voiceName })
    }
    settingStore.ttsVoiceMap = map
  },
})

const exampleText = 'How are you? I am fine, thank you. And you?'

function previewTtsVoice(voiceName: string) {
  if (typeof speechSynthesis === 'undefined') return
  speechSynthesis.cancel()
  const msg = new SpeechSynthesisUtterance(exampleText)
  msg.lang = 'en-US'
  msg.volume = settingStore.sentenceSoundVolume / 100
  msg.rate = settingStore.sentenceSoundSpeed
  const voice = ttsVoiceList.value.find(v => v.name === voiceName)
  if (voice) msg.voice = voice
  speechSynthesis.speak(msg)
}
</script>

<template>
  <div>
    <!-- 总音量 / 总倍速 -->
    <SoundMasterControl
      v-model="volumeMaster"
      type="volume"
      :is-unified="volumeIsUnified"
      :expanded="volumeExpanded"
      :show-subs-in-master="showVolumeSubsInMaster"
      :items="SOUND_VOLUME_ITEMS"
      @toggle-expanded="volumeToggleExpanded()"
    />
    <SoundMasterControl
      v-model="speedMaster"
      type="speed"
      :is-unified="speedIsUnified"
      :expanded="speedExpanded"
      :show-subs-in-master="showSpeedSubsInMaster"
      :items="SOUND_SPEED_ITEMS"
      @toggle-expanded="speedToggleExpanded()"
    />

    <div class="line"></div>

    <!-- 单词发音 -->
    <SettingItem :mainTitle="$t('word_pronunciation')" />

    <SettingItem :title="$t('word_auto_pronunciation')">
      <Switch v-model="settingStore.wordSound" />
    </SettingItem>
    <SettingItem :title="$t('pronunciation_accent')" :desc="$t('pronunciation_accent_desc')">
      <Select v-model="settingStore.soundType" :placeholder="$t('please_select')" class="w-50!">
        <Option :label="$t('us_accent')" value="us" />
        <Option :label="$t('uk_accent')" value="uk" />
      </Select>
    </SettingItem>
    <SettingItem v-if="showVolumeSubsInSections" :title="$t('volume')">
      <Slider v-model="settingStore.wordSoundVolume" showText showValue unit="%" />
    </SettingItem>
    <SettingItem v-if="showSpeedSubsInSections" :title="$t('speed')">
      <Slider v-model="settingStore.wordSoundSpeed" :step="0.1" :min="0.5" :max="3" showText showValue />
    </SettingItem>

    <!-- 例句发音 -->
    <div class="line"></div>
    <SettingItem :mainTitle="$t('sentence_pronunciation')" />
    <SettingItem :title="$t('auto_play_first_sentence')" :desc="$t('auto_play_first_sentence_desc')">
      <Switch v-model="settingStore.autoPlayFirstSentence" />
    </SettingItem>
    <SettingItem v-if="showVolumeSubsInSections" :title="$t('sentence_volume')">
      <Slider v-model="settingStore.sentenceSoundVolume" showText showValue unit="%" />
    </SettingItem>
    <SettingItem v-if="showSpeedSubsInSections" :title="$t('sentence_speed')">
      <Slider v-model="settingStore.sentenceSoundSpeed" :step="0.1" :min="0.5" :max="3" showText showValue />
    </SettingItem>
    <SettingItem :title="$t('tts_voice_setting_title')" :desc="$t('tts_voice_setting_desc')">
      <Select
        :key="ttsSelectKey"
        v-model="currentTtsVoice"
        :placeholder="ttsVoiceList.length ? $t('tts_select_placeholder') : $t('tts_no_voice_available')"
        class="w-80!"
      >
        <Option v-for="voice in ttsVoiceList" :key="voice.name" :label="voice.name" :value="voice.name">
          <div class="flex justify-between items-center w-full">
            <span class="truncate">{{
              voice.name + `（${voice.localService ? $t('tts_local_voice') : $t('tts_network_voice')}）`
            }}</span>
            <VolumeIcon :time="100" @click="previewTtsVoice(voice.name)" />
          </div>
        </Option>
      </Select>
    </SettingItem>
    <div>{{ $t('tts_voice_preview_sentence') }}{{ exampleText }}</div>
    <div v-if="!currentTtsVoice" class="text-sm text-orange-500 mt-1 mb-2">
      {{ $t('tts_no_voice_warning') }}
    </div>

    <!-- 文章音效 -->
    <div class="line"></div>
    <SettingItem :mainTitle="$t('article_sound_settings')" />
    <SettingItem :title="$t('auto_play_sentence')">
      <Switch v-model="settingStore.articleSound" />
    </SettingItem>
    <SettingItem :title="$t('play_next_after_end')">
      <Switch v-model="settingStore.articleAutoPlayNext" />
    </SettingItem>
    <SettingItem v-if="showVolumeSubsInSections" :title="$t('article_volume')">
      <Slider v-model="settingStore.articleSoundVolume" showText showValue unit="%" />
    </SettingItem>
    <SettingItem v-if="showSpeedSubsInSections" :title="$t('article_speed')">
      <Slider v-model="settingStore.articleSoundSpeed" :step="0.1" :min="0.5" :max="3" showText showValue />
    </SettingItem>

    <!-- 按键音效 -->
    <div class="line"></div>
    <SettingItem :mainTitle="$t('keyboard_sound_settings')" />
    <SettingItem :title="$t('keyboard_sound')">
      <Switch v-model="settingStore.keyboardSound" />
    </SettingItem>
    <SettingItem :title="$t('keyboard_sound_effect')">
      <Select v-model="settingStore.keyboardSoundFile" :placeholder="$t('please_select')" class="w-50!">
        <Option v-for="item in SoundFileOptions" :key="item.value" :label="item.label" :value="item.value">
          <div class="flex justify-between items-center w-full">
            <span>{{ item.label }}</span>
            <VolumeIcon :time="100" @click="usePlayAudio(ENV.RESOURCE_URL + getAudioFileUrl(item.value)[0])" />
          </div>
        </Option>
      </Select>
    </SettingItem>
    <SettingItem v-if="showVolumeSubsInSections" :title="$t('volume')">
      <Slider v-model="settingStore.keyboardSoundVolume" showText showValue unit="%" />
    </SettingItem>

    <!-- 效果音 -->
    <div class="line"></div>
    <SettingItem :mainTitle="$t('effect_sound_settings')" />
    <SettingItem :title="$t('effect_sound')">
      <Switch v-model="settingStore.effectSound" />
    </SettingItem>
    <SettingItem v-if="showVolumeSubsInSections" :title="$t('effect_volume')">
      <Slider v-model="settingStore.effectSoundVolume" showText showValue unit="%" />
    </SettingItem>
  </div>
</template>

<style scoped lang="scss">
.line {
  border-bottom: 1px solid var(--color-line, #c4c3c3);
  margin: 0.8rem 0;
}
</style>
