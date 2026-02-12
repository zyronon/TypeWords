<!--<script setup lang="ts">-->
<!--import { onMounted, watch } from 'vue'-->
<!--import { BaseState, useBaseStore } from '@/stores/base'-->
<!--import { useRuntimeStore } from '@/stores/runtime'-->
<!--import { useSettingStore } from '@/stores/setting'-->
<!--import useTheme from '@/hooks/theme'-->
<!--import { loadJsLib, shakeCommonDict } from '@/utils'-->
<!--import { get, set } from 'idb-keyval'-->

<!--import { useRoute } from 'vue-router'-->
<!--import { APP_VERSION, AppEnv, DictId, LOCAL_FILE_KEY, Origin, SAVE_DICT_KEY, SAVE_SETTING_KEY } from '@/config/env'-->
<!--import { syncSetting } from '@/apis'-->
<!--import { useUserStore } from '@/stores/user'-->
<!--import MigrateDialog from '@/components/MigrateDialog.vue'-->

<!--const store = useBaseStore()-->
<!--const runtimeStore = useRuntimeStore()-->
<!--const settingStore = useSettingStore()-->
<!--const userStore = useUserStore()-->
<!--const { setTheme } = useTheme()-->

<!--let lastAudioFileIdList = []-->
<!--let isInitializing = true // 标记是否正在初始化-->
<!--watch(store.$state, (n: BaseState) => {-->
<!--  // 如果正在初始化，不保存数据，避免覆盖-->
<!--  if (isInitializing) return-->
<!--  let data = shakeCommonDict(n)-->
<!--  set(SAVE_DICT_KEY.key, JSON.stringify({ val: data, version: SAVE_DICT_KEY.version }))-->

<!--  //筛选自定义和收藏-->
<!--  let bookList = data.article.bookList.filter(v => v.custom || [DictId.articleCollect].includes(v.id))-->
<!--  let audioFileIdList = []-->
<!--  bookList.forEach(v => {-->
<!--    //筛选 audioFileId 字体有值的-->
<!--    v.articles-->
<!--      .filter(s => !s.audioSrc && s.audioFileId)-->
<!--      .forEach(a => {-->
<!--        //所有 id 存起来，下次直接判断字符串是否相等，因为这个watch会频繁调用-->
<!--        audioFileIdList.push(a.audioFileId)-->
<!--      })-->
<!--  })-->
<!--  if (audioFileIdList.toString() !== lastAudioFileIdList.toString()) {-->
<!--    let result = []-->
<!--    //删除未使用到的文件-->
<!--    get(LOCAL_FILE_KEY).then((fileList: Array<{ id: string; file: Blob }>) => {-->
<!--      if (fileList && fileList.length > 0) {-->
<!--        audioFileIdList.forEach(a => {-->
<!--          let item = fileList.find(b => b.id === a)-->
<!--          item && result.push(item)-->
<!--        })-->
<!--        set(LOCAL_FILE_KEY, result)-->
<!--        lastAudioFileIdList = audioFileIdList-->
<!--      }-->
<!--    })-->
<!--  }-->
<!--})-->

<!--watch(-->
<!--  () => settingStore.$state,-->
<!--  n => {-->
<!--    if (isInitializing) return-->
<!--    set(SAVE_SETTING_KEY.key, JSON.stringify({ val: n, version: SAVE_SETTING_KEY.version }))-->
<!--    if (AppEnv.CAN_REQUEST) {-->
<!--      syncSetting(null, settingStore.$state)-->
<!--    }-->
<!--  },-->
<!--  { deep: true }-->
<!--)-->

<!--async function init() {-->
<!--  isInitializing = true // 开始初始化-->
<!--  await userStore.init()-->
<!--  await store.init()-->
<!--  await settingStore.init()-->
<!--  store.load = true-->
<!--  isInitializing = false // 初始化完成，允许保存数据-->

<!--  setTheme(settingStore.theme)-->

<!--  if (settingStore.first) {-->
<!--    set(APP_VERSION.key, APP_VERSION.version)-->
<!--  } else {-->
<!--    get(APP_VERSION.key).then(r => {-->
<!--      runtimeStore.isNew = r ? APP_VERSION.version > Number(r) : true-->
<!--    })-->
<!--  }-->
<!--  window.umami?.track('host', { host: window.location.host })-->
<!--}-->

<!--onMounted(init)-->

<!--//迁移数据-->
<!--let showTransfer = $ref(false)-->
<!--onMounted(() => {-->
<!--  if (new URLSearchParams(window.location.search).get('from_old_site') === '1' && location.origin === Origin) {-->
<!--    if (localStorage.getItem('__migrated_from_2study_top__')) return-->
<!--    setTimeout(() => {-->
<!--      showTransfer = true-->
<!--    }, 1000)-->
<!--  }-->
<!--})-->

<!--// let transitionName = $ref('go')-->
<!--// const route = useRoute()-->
<!--// watch(() => route.path, (to, from) => {-->
<!--//   return transitionName = ''-->
<!--// console.log('watch', to, from)-->
<!--// //footer下面的5个按钮，对跳不要用动画-->
<!--// let noAnimation = [-->
<!--//   '/pc/practice',-->
<!--//   '/pc/dict',-->
<!--//   '/mobile',-->
<!--//   '/'-->
<!--// ]-->
<!--// if (noAnimation.indexOf(from) !== -1 && noAnimation.indexOf(to) !== -1) {-->
<!--//   return transitionName = ''-->
<!--// }-->
<!--//-->
<!--// const toDepth = routes.findIndex(v => v.path === to)-->
<!--// const fromDepth = routes.findIndex(v => v.path === from)-->
<!--// transitionName = toDepth > fromDepth ? 'go' : 'back'-->
<!--// console.log('transitionName', transitionName, toDepth, fromDepth)-->
<!--// })-->
<!--</script>-->

<!--<template>-->
<!--  &lt;!&ndash;  <router-view v-slot="{ Component }">&ndash;&gt;-->
<!--  &lt;!&ndash;    <transition :name="transitionName">&ndash;&gt;-->
<!--  &lt;!&ndash;      <keep-alive :exclude="runtimeStore.excludeRoutes">&ndash;&gt;-->
<!--  &lt;!&ndash;        <component :is="Component"/>&ndash;&gt;-->
<!--  &lt;!&ndash;      </keep-alive>&ndash;&gt;-->
<!--  &lt;!&ndash;    </transition>&ndash;&gt;-->
<!--  &lt;!&ndash;  </router-view>&ndash;&gt;-->
<!--  <router-view></router-view>-->
<!--  <MigrateDialog v-model="showTransfer" @ok="init" />-->
<!--</template>-->
