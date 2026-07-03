<script setup lang="ts">
import { BaseIcon, MiniDialog, Option, Select, Switch, VolumeIcon } from '@typewords/base'
import { SoundFileOptions } from '../../config/env.ts'
import { useWindowClick } from '../../hooks/event.ts'
import { getAudioFileUrl, usePlayAudio } from '../../hooks/sound.ts'
import { useSettingStore } from '../../stores/setting.ts'
import { emitter, EventKey } from '../../utils/eventBus'

const settingStore = useSettingStore()
let timer = 0
//停止切换事件，因为hover到select时会跳出mini-dialog
let selectIsOpen = false
let show = $ref(false)

useWindowClick(() => {
  if (selectIsOpen) {
    selectIsOpen = false
  } else {
    show = false
  }
})

function toggle(val: boolean) {
  if (selectIsOpen) return
  clearTimeout(timer)
  if (val) {
    emitter.emit(EventKey.closeOther)
    show = val
  } else {
    timer = setTimeout(() => {
      show = val
    }, 100)
  }
}

function selectToggle(e: boolean) {
  //这里要延时设置，因为关闭的时候，如果太早设置了false了，useWindowClick的事件就会把弹框关闭
  setTimeout(() => (selectIsOpen = e))
}

function eventCheck(e) {
  const isSelfOrChild = e.currentTarget.contains(e.target)
  if (isSelfOrChild) {
    //如果下拉框打开的情况就不拦截
    if (selectIsOpen) return
    e.stopPropagation()
  }
}
</script>

<template>
  <div class="setting" @click="eventCheck">
    <BaseIcon @mouseenter="toggle(true)" @mouseleave="toggle(false)">
      <IconClarityVolumeUpLine />
    </BaseIcon>
    <MiniDialog width="18rem" @mouseenter="toggle(true)" @mouseleave="toggle(false)" v-model="show">
      <div class="mini-row-title">音效设置</div>
      <div class="mini-row">
        <label class="item-title">单词自动发音</label>
        <div class="wrapper">
          <Switch v-model="settingStore.wordSound" inline-prompt active-text="开" inactive-text="关" />
        </div>
      </div>
      <div class="mini-row">
        <label class="item-title">输入阶段自动发音</label>
        <div class="wrapper">
          <Switch v-model="settingStore.wordInputSound" inline-prompt active-text="开" inactive-text="关" />
        </div>
      </div>
      <div class="mini-row">
        <label class="item-title">单词发音口音</label>
        <div class="wrapper">
          <Select v-model="settingStore.soundType" @toggle="selectToggle" placeholder="请选择" size="small">
            <Option label="美音" value="us" />
            <Option label="英音" value="uk" />
          </Select>
        </div>
      </div>
      <div class="mini-row">
        <label class="item-title">按键音</label>
        <div class="wrapper">
          <Switch v-model="settingStore.keyboardSound" inline-prompt active-text="开" inactive-text="关" />
        </div>
      </div>
      <div class="mini-row">
        <label class="item-title">按键音效</label>
        <div class="wrapper">
          <Select v-model="settingStore.keyboardSoundFile" @toggle="selectToggle" placeholder="请选择" size="small">
            <Option v-for="item in SoundFileOptions" :key="item.value" :label="item.label" :value="item.value">
              <div class="el-option-row">
                <span>{{ item.label }}</span>
                <VolumeIcon :time="100" @click="usePlayAudio(getAudioFileUrl(item.value)[0])" />
              </div>
            </Option>
          </Select>
        </div>
      </div>
      <div class="mini-row">
        <label class="item-title">效果音</label>
        <div class="wrapper">
          <Switch v-model="settingStore.effectSound" inline-prompt active-text="开" inactive-text="关" />
        </div>
      </div>
    </MiniDialog>
  </div>
</template>

<style scoped lang="scss">
.wrapper {
  width: 50%;
  position: relative;
  text-align: right;
}

.setting {
  position: relative;
}

.el-option-row {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;

  .icon-wrapper {
    transform: translateX(10rem);
  }
}
</style>
