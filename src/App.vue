<script setup lang="ts">
import { onMounted, watch } from "vue";
import { BaseState, useBaseStore } from "@/stores/base.ts";
import { useRuntimeStore } from "@/stores/runtime.ts";
import { useSettingStore } from "@/stores/setting.ts";
import useTheme from "@/hooks/theme.ts";
import { shakeCommonDict } from "@/utils";
import { routes } from "@/router.ts";
import { get, set } from 'idb-keyval';
import { useLanguage } from '@/hooks/useLanguage';

import { useRoute } from "vue-router";
import { DictId } from "@/types/types.ts";
import { APP_VERSION, CAN_REQUEST, LOCAL_FILE_KEY, SAVE_DICT_KEY, SAVE_SETTING_KEY } from "@/config/env.ts";
import { syncSetting } from "@/apis";

const store = useBaseStore()
const runtimeStore = useRuntimeStore()
const settingStore = useSettingStore()
const {setTheme} = useTheme()
const { t } = useLanguage()

let lastAudioFileIdList = []
watch(store.$state, (n: BaseState) => {
  let data = shakeCommonDict(n)
  set(SAVE_DICT_KEY.key, JSON.stringify({val: data, version: SAVE_DICT_KEY.version}))

  //筛选自定义和收藏
  let bookList = data.article.bookList.filter(v => v.custom || [DictId.articleCollect].includes(v.id))
  let audioFileIdList = []
  bookList.forEach(v => {
    //筛选 audioFileId 字体有值的
    v.articles.filter(s => !s.audioSrc && s.audioFileId).forEach(a => {
      //所有 id 存起来，下次直接判断字符串是否相等，因为这个watch会频繁调用
      audioFileIdList.push(a.audioFileId)
    })
  })
  if (audioFileIdList.toString() !== lastAudioFileIdList.toString()) {
    let result = []
    //删除未使用到的文件
    get(LOCAL_FILE_KEY).then((fileList: Array<{ id: string, file: Blob }>) => {
      if (fileList && fileList.length > 0) {
        audioFileIdList.forEach(a => {
          let item = fileList.find(b => b.id === a)
          item && result.push(item)
        })
        set(LOCAL_FILE_KEY, result)
        lastAudioFileIdList = audioFileIdList
      }
    })
  }
})

watch(settingStore.$state, (n) => {
  set(SAVE_SETTING_KEY.key, JSON.stringify({val: n, version: SAVE_SETTING_KEY.version}))
  if (CAN_REQUEST) {
    syncSetting(null, settingStore.$state)
  }
})

async function init() {
  await store.init()
  await settingStore.init()
  store.load = true
  setTheme(settingStore.theme)

  if (!settingStore.first) {
    get(APP_VERSION.key).then(r => {
      runtimeStore.isNew = r ? (APP_VERSION.version > Number(r)) : true
    })
  }
  window.umami?.track('host', {host: window.location.host})
}

onMounted(init)

let transitionName = $ref('go')
const route = useRoute()
watch(() => route.path, (to, from) => {
  return transitionName = ''
  // console.log('watch', to, from)
  // //footer下面的5个按钮，对跳不要用动画
  let noAnimation = [
    '/pc/practice',
    '/pc/dict',
    '/mobile',
    '/'
  ]
  if (noAnimation.indexOf(from) !== -1 && noAnimation.indexOf(to) !== -1) {
    return transitionName = ''
  }

  const toDepth = routes.findIndex(v => v.path === to)
  const fromDepth = routes.findIndex(v => v.path === from)
  transitionName = toDepth > fromDepth ? 'go' : 'back'
  // console.log('transitionName', transitionName, toDepth, fromDepth)
})
</script>

<template>
  <!--  <router-view v-slot="{ Component }">-->
  <!--    <transition :name="transitionName">-->
  <!--      <keep-alive :exclude="runtimeStore.excludeRoutes">-->
  <!--        <component :is="Component"/>-->
  <!--      </keep-alive>-->
  <!--    </transition>-->
  <!--  </router-view>-->
  <router-view></router-view>
</template>

<style scoped lang="scss">

</style>
