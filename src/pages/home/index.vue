<script setup lang="ts">
import {GITHUB, ProjectName} from "@/config/env.ts";
import BaseButton from "@/components/BaseButton.vue";
import BaseIcon from "@/components/BaseIcon.vue";
import {defineAsyncComponent} from "vue";
import { useLanguage } from '@/hooks/useLanguage'

const { t } = useLanguage()
const Dialog = defineAsyncComponent(() => import('@/components/dialog/Dialog.vue'))
let showWechatDialog = $ref(false)
let showXhsDialog = $ref(false)
</script>

<template>
  <div class="flex flex-col justify-between min-h-screen">
    <div class="center flex-col gap-8">
      <h1>{{ ProjectName }}</h1>
      <div class="text-center -mt-10">
        <h2>{{ t('HomeHeaderTitle') }}</h2>
        <h2>{{ t('HomeHeaderSubtitle') }}</h2>
      </div>
      <div class="flex">
        <BaseButton size="large" @click="$router.push('/words')">{{ t('WordPractice') }}</BaseButton>
        <BaseButton size="large" @click="$router.push('/articles')">{{ t('ArticlePractice') }}</BaseButton>
      </div>

      <div class="center justify-center flex-col gap-2 w-full mb-4">
        <a href="https://skywork.ai/p/GrXQb4" class="w-60vw" target="_blank"><img src="/skywork-ai.png" alt="Skywork.AI" class="w-full rounded-lg"></a>
        <span>Skywork.AI:<a href="https://skywork.ai/p/GrXQb4" class="color-blue!" target="_blank">10 tasks in 1 hour, not 10 hours →Limited free spots: 127 left</a></span>
      </div>
      <div class="w-60vw">
        <div class="flex mb-5 gap-space">
          <div class="card">
            <div class="emoji">📚</div>
            <div class="title">{{ t('WordPractice') }}</div>
            <div class="desc">
              <ul>
                <li>{{ t('WordPracticeModes') }}</li>
                <li>{{ t('SmartMode') }}</li>
                <li>{{ t('FreeMode') }}</li>
              </ul>
            </div>
          </div>
          <div class="card">
            <div class="emoji">✍️</div>
            <div class="title">{{ t('ArticlePractice') }}</div>
            <div class="desc">
              <ul>
                <li>{{ t('ArticleFeature1') }}</li>
                <li>{{ t('ArticleFeature2') }}</li>
                <li>{{ t('ArticleFeature3') }}</li>
              </ul>
            </div>
          </div>
          <div class="card">
            <div class="emoji">📕</div>
            <div class="title">{{ t('CollectionWrongMastered') }}</div>
            <div class="desc">
              <ul>
                <li>{{ t('CollectionFeature1') }}</li>
                <li>{{ t('CollectionFeature2') }}</li>
                <li>{{ t('CollectionFeature3') }}</li>
              </ul>
            </div>
          </div>
          <div class="card">
            <div class="emoji">🌐</div>
            <div class="title">{{ t('MassiveVocabulary') }}</div>
            <div class="desc">
              {{ t('MassiveVocabularyDesc') }}
            </div>
          </div>

        </div>
        <div class="flex gap-space">
          <div class="card">
            <div class="emoji">🆓</div>
            <div class="title">{{ t('FreeOpenSource') }}</div>
            <div class="desc">
              <ul>
                <li>{{ t('FreeOpenSourceFeature1') }}</li>
                <li>{{ t('FreeOpenSourceFeature2') }}</li>
                <li>{{ t('FreeOpenSourceFeature3') }}</li>
              </ul>
            </div>
          </div>
          <div class="card">
            <div class="emoji">⚙️</div>
            <div class="title">{{ t('HighlyCustomizable') }}</div>
            <div class="desc">
              <ul>
                <li>{{ t('HighlyCustomizableFeature1') }}</li>
                <li>{{ t('HighlyCustomizableFeature2') }}</li>
                <li>{{ t('HighlyCustomizableFeature3') }}</li>
              </ul>
            </div>
          </div>
          <div class="card">
            <div class="emoji">🎨</div>
            <div class="title">{{ t('SimpleEfficient') }}</div>
            <div class="desc">
              <ul>
                <li>{{ t('SimpleEfficientFeature1') }}</li>
                <li>{{ t('SimpleEfficientFeature2') }}</li>
                <li>{{ t('SimpleEfficientFeature3') }}</li>
              </ul>
            </div>
          </div>

          <div class="card">
            <div class="emoji">🎯</div>
            <div class="title">{{ t('PersonalizedLearning') }}</div>
            <div class="desc">
              <ul>
                <li>{{ t('PersonalizedLearningFeature1') }}</li>
                <li>{{ t('PersonalizedLearningFeature2') }}</li>
                <li>{{ t('PersonalizedLearningFeature3') }}</li>
              </ul>
            </div>
          </div>
        </div>
        <div class="w-60vw text-center" v-if="false">
          <h3 class="text-4xl">单词练习</h3>
          <img src="/word.png" alt="word.png" class="w-full rounded-xl">
          <h3 class="text-4xl">文章练习</h3>
          <img src="/article.png" alt="article.png" class="w-full rounded-xl">
        </div>
      </div>
    </div>
    <div class="center gap-space  my-10 bottom">
      <div class="center gap-1">
        <a
            :href="GITHUB"
            target="_blank"
            rel="noreferrer"
            aria-label="GITHUB 项目地址">
          <BaseIcon>
            <IconSimpleIconsGithub/>
          </BaseIcon>
        </a>

        <BaseIcon @click="showWechatDialog = true">
          <IconSimpleIconsWechat/>
        </BaseIcon>
        <BaseIcon @click="showXhsDialog = true" >
          <IconSimpleIconsXiaohongshu/>
        </BaseIcon>
        <a
            href="https://x.com/typewords2"
            target="_blank"
            rel="noreferrer"
            aria-label="关注我的 X 账户 typewords2">
          <BaseIcon>
            <IconRiTwitterFill/>
          </BaseIcon>
        </a>
        <a
            href="mailto:zyronon@163.com"
            target="_blank"
            rel="noreferrer"
            aria-label="发送邮件到 zyronon@163.com">
          <BaseIcon>
            <IconMaterialSymbolsMail/>
          </BaseIcon>
        </a>
      </div>
      <div>蜀ICP备2025157466号</div>
    </div>

    <Dialog v-model="showWechatDialog" :title="t('CommunityGroup')">
      <div class="w-120 p-6 pt-0">
        <div class="mb-4">
          {{ t('CommunityGroupDesc') }}
        </div>
        <div class="text-center">
          <img src="/wechat.png" alt="微信群二维码" class="w-60 rounded-lg">
        </div>
      </div>
    </Dialog>
    <Dialog v-model="showXhsDialog" :title="t('RedBookTitle')">
      <div class="w-120 p-6 pt-0">
        <div class="mb-4">
          {{ t('RedBookDesc') }}
        </div>
        <div class="text-center">
          <img src="/xhs.png" alt="小红书二维码" class="w-60 rounded-lg">
        </div>
      </div>
    </Dialog>
  </div>
</template>
<style scoped lang="scss">
h1 {
  font-size: 5rem;
  background: linear-gradient(120deg, #bd34fe 30%, #41d1ff);
  -webkit-text-fill-color: transparent;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  margin: 2rem;
}

h2 {
  margin: 0;
}

h3:first-child {
  margin-top: 0;
}

.card {
  @apply flex flex-col items-start gap-2 mb-0 w-25%;
  .emoji {
    display: inline-block;
    background: var(--color-third);
    padding: .6rem;
    border-radius: 0.4rem;
    font-size: 1.5rem;
  }

  .title {
    font-weight: bold;
  }

  ul {
    margin: 0;
    padding-left: 1.2rem;
  }
}

.bottom {
  width: 100%;
  padding-top: 2rem;
  border-top: 1px solid #c4c4c4;
}

a {
  color: unset;
}

</style>
