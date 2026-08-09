<template>
  <div class="question-form en-article-family">
    <div class="flex items-center justify-between">
      <div class="font-bold">Multiple choice questions {{ $t('multiple_choice') }}</div>
      <div v-if="false">
        <button v-if="!started" class="bg-blue-600 text-white px-4 py-1 rounded" @click="startExam">
          {{ $t('start') }}
        </button>
        <span v-if="started" class="text-red-600 font-semibold font-family">
          {{ $t('countdown') }}：{{ timeLeft }} {{ $t('seconds') }}
        </span>
      </div>
    </div>

    <form @submit.prevent>
      <QuestionItem
        v-for="(q, i) in questions"
        :key="i"
        ref="questionRefs1"
        :question-index="i + 1"
        :stem="q.stem"
        :options="q.options"
        :correct-answer="q.correctAnswer"
        :explanation="q.explanation"
        :immediate-feedback="props.immediateFeedback"
        :randomize="props.randomize"
        @answered="onAnswered"
      />
    </form>

    <div class="center items-center gap-2 mt-10">
      <button class="bg-green-600 text-white px-6 py-2 rounded" @click="submitAll">{{ $t('submit_exam') }}</button>
      <span class="text-xl">{{ $t('exam_color_hint') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'
import QuestionItem from './QuestionItem.vue'
import { Toast } from '@/base'

interface IProps {
  questions: Array
  duration: Number
  immediateFeedback: Boolean
  randomize: Boolean
}

const props = withDefaults(defineProps<IProps>(), {
  questions: [],
  duration: 300,
  immediateFeedback: false,
  randomize: false,
})

const questionRefs = useTemplateRef('questionRefs1')
const started = ref(false)
const timeLeft = ref(props.duration || 300)
let timer = null

const startExam = () => {
  started.value = true
  timeLeft.value = props.duration || 300
  timer = setInterval(() => {
    timeLeft.value--
    if (timeLeft.value <= 0) {
      clearInterval(timer)
      submitAll()
    }
  }, 1000)
}

const onAnswered = res => {
  console.log('Answered:', res)
  // 可收集中间过程（非必须）
}

const submitAll = () => {
  console.log(questionRefs)
  questionRefs.value.forEach(q => q.submit())
  const results = questionRefs.value.map(q => q.getResult())
  const correctCount = results.filter(r => r.isCorrect).length
  const wrongCount = results.length - correctCount

  console.log('最终结果：', results)
  Toast.success(`共 ${results.length} 题，答对 ${correctCount}，答错 ${wrongCount}`)
}
</script>

<style scoped></style>
