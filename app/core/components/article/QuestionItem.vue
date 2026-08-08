<template>
  <div ref="container" class="question-item mb-4">
    <div class="mb-1 "
         :class="noChoseClass"
    ><span class="font-family">{{ questionIndex }}</span>. {{ stem }}
    </div>
    <div
        class="grid gap-1"
        :class="layoutClass"
    >
      <label
          v-for="(opt, i) in shuffledOptions"
          :key="i"
          class="option border rounded  cursor-pointer hover:bg-gray-300"
          :class="feedbackClass(i)"
      >
        <input
            :type="isMultiple ? 'checkbox' : 'radio'"
            :name="`question-${questionIndex}`"
            class="mr-2"
            :value="opt"
            v-model="userSelection"
            @change="onSelect"
        />
        <span ref="optionRefs">(<span class="italic">{{ ['a', 'b', 'c', 'd'][i] }}</span>) {{ opt }}</span>
      </label>
    </div>

    <div v-if="explanation && isSubmitted" class="mt-2 text-xl text-gray-600">
      {{ $t('explanation') }}：{{ explanation }}
    </div>
  </div>
</template>

<script setup>
import {computed, nextTick, onMounted, ref, watch} from 'vue'
import {shuffle} from '../../utils';

const props = defineProps({
  stem: String,
  options: Array,
  correctAnswer: Array, // ['a', 'b']
  explanation: String,
  immediateFeedback: Boolean,
  questionIndex: Number,
  randomize: Boolean
})

const emit = defineEmits(['answered'])

// 将选项打乱并映射回原始下标
const originalOptions = props.options
const shuffledOptions = ref([])
const answerMap = ref([]) // 映射 shuffled[i] 对应原始 index（用于判分）

const isMultiple = computed(() => props.correctAnswer.length > 1)
const userSelection = ref(isMultiple.value ? [] : '')
const isSubmitted = ref(false)
const isCorrect = ref(null)

// 初始化打乱选项
const initOptions = () => {
  const indices = originalOptions.map((_, i) => i)
  const shuffledIndices = props.randomize ? shuffle(indices) : indices
  shuffledOptions.value = shuffledIndices.map(i => originalOptions[i])
  answerMap.value = shuffledIndices
}

initOptions()

const getLetter = (index) => ['a', 'b', 'c', 'd'][index]
const getOriginalLetter = (shuffledIndex) => getLetter(answerMap.value[shuffledIndex])

const onSelect = () => {
  if (props.immediateFeedback) submit()
  emitAnswer()
}

const emitAnswer = () => {
  const selectedLetters = isMultiple.value
      ? userSelection.value.map(val => getOriginalLetter(shuffledOptions.value.indexOf(val)))
      : [getOriginalLetter(shuffledOptions.value.indexOf(userSelection.value))]

  const isAnswerCorrect =
      selectedLetters.sort().join() === props.correctAnswer.sort().join()

  emit('answered', {
    index: props.questionIndex,
    selected: selectedLetters,
    isCorrect: isAnswerCorrect
  })
}

const submit = () => {
  isSubmitted.value = true
  const selectedLetters = isMultiple.value
      ? userSelection.value.map(val => getOriginalLetter(shuffledOptions.value.indexOf(val)))
      : [getOriginalLetter(shuffledOptions.value.indexOf(userSelection.value))]
  isCorrect.value =
      selectedLetters.sort().join() === props.correctAnswer.sort().join()
}

const feedbackClass = (i) => {
  if (!isSubmitted.value) return ''
  const selected = isMultiple.value
      ? userSelection.value.includes(shuffledOptions.value[i])
      : userSelection.value === shuffledOptions.value[i]
  const correct = props.correctAnswer.includes(getOriginalLetter(i))
  if (correct) return 'bg-green-200'
  if (selected && !correct) return 'bg-red-200'
  return ''
}
const noChoseClass = computed(() => {
  if (!isSubmitted.value) return ''
  const selected = isMultiple.value
      ? userSelection.value.length
      : userSelection.value
  return !selected && 'bg-red-400'
})

// 父组件调用此方法统一评分
defineExpose({
  submit,
  getResult: () => {
    const selectedLetters = isMultiple.value
        ? userSelection.value.map(val => getOriginalLetter(shuffledOptions.value.indexOf(val)))
        : [getOriginalLetter(shuffledOptions.value.indexOf(userSelection.value))]
    return {
      index: props.questionIndex,
      selected: selectedLetters,
      isCorrect: selectedLetters.sort().join() === props.correctAnswer.sort().join()
    }
  }
})

const optionRefs = ref([])
const container = ref(null)
const layoutClass = ref('')

const calculateLayout = () => {
  if (!container.value || optionRefs.value.length === 0) return

  const containerWidth = container.value.clientWidth
  const widths = optionRefs.value.map(el => el.getBoundingClientRect().width)

  const totalWidth = widths.reduce((sum, w) => sum + w, 0)
  // console.log(widths,totalWidth)

  // 如果任意选项宽度超过容器一半
  if (widths.some(w => w > containerWidth / 2)) {
    layoutClass.value = 'grid-cols-1'
    return
  }

  // 如果所有选项都可以在一行内放下
  if (totalWidth + 80 * (widths.length - 1) <= containerWidth) {
    layoutClass.value = 'grid-cols-4'
    return
  }

  // 否则 2 列
  layoutClass.value = 'grid-cols-2'
}


onMounted(async () => {
  await nextTick()
  calculateLayout()

  const resizeObserver = new ResizeObserver(() => {
    calculateLayout()
  })

  resizeObserver.observe(container.value)
})

watch(() => props.options, async () => {
  await nextTick()
  calculateLayout()
})
</script>

<style scoped>

.option {
  white-space: normal;
  text-overflow: unset;
  overflow: visible;
  word-break: keep-all;
  padding: 5px;
  border-radius: 6px;
  transition: all 0.2s ease;
}
</style>
