<script setup lang="tsx">
import { inject, onMounted, ref, useSlots } from 'vue'

const props = defineProps({
  prop: String,
  label: String,
})

const value = ref('')
let error = $ref('')

// 拿到 form 的 model 和注册函数
const formModel = inject<ref>('formModel')
const registerField = inject<Function>('registerField')
const formRules = inject('formRules', {})

const myRules = $computed(() => {
  return formRules?.[props.prop] || []
})

// 校验函数
const validate = (rules, isBlur = false) => {
  error = ''
  const val = formModel.value[props.prop]
  //为空并且是非主动触发检验的情况下，不检验
  if (isBlur && val.trim() === '') {
    return true
  }
  for (const rule of rules) {
    if (rule.required && (!val || !val.toString().trim())) {
      error = rule.message
      return false
    }
    if (rule.max && val && val.toString().length > rule.max) {
      error = rule.message
      return false
    }
    if (rule.min && val && val.toString().length < rule.min) {
      error = rule.message
      return false
    }
    if (rule.max && val && val.toString().length > rule.max) {
      error = rule.message
      return false
    }
    if (rule.validator) {
      try {
        rule.validator(rule, val)
      } catch (e) {
        error = e.message
        return false
      }
    }
  }
  return true
}

// 自动触发 blur 校验
function handleBlur() {
  const blurRules = myRules.filter(r => r.trigger === 'blur')
  if (blurRules.length) validate(blurRules, true)
}

function handChange() {
  error = ''
}

// 注册到 Form
onMounted(() => {
  registerField && registerField({ prop: props.prop, modelValue: value, validate })
})

let slot = useSlots()

function patchVNode(vnode, patchFn) {
  if (!vnode) return vnode

  // 如果当前节点就是我们要找的 BaseInput
  if (vnode.type && vnode.type.name) {
    return patchFn(vnode)
  }

  // 如果有子节点，则递归修改
  if (Array.isArray(vnode.children)) {
    vnode.children = vnode.children.map(child => patchVNode(child, patchFn))
  }

  return vnode
}

defineRender(() => {
  let DefaultNode: any = slot.default()[0]

  // 对 DefaultNode 深度查找 BaseInput 并加上 onBlur / error
  DefaultNode = patchVNode(DefaultNode, vnode => {
    return {
      ...vnode,
      props: {
        ...vnode.props,
        error: !!error,
        onBlur: handleBlur,
        onChange: handChange,
      },
    }
  })

  return (
    <div class="form-item   flex gap-space">
      {props.label && (
        <label class="w-20 flex items-start mt-1 justify-end">
          {myRules.length ? <span class="form-error">*</span> : null} {props.label}
        </label>
      )}
      <div class="flex-1 relative">
        <DefaultNode />
        <div class="form-error my-0.5 anim" style={{ opacity: error ? 1 : 0 }}>
          {error} &nbsp;
        </div>
      </div>
    </div>
  )
})
</script>

<style scoped lang="scss">
.form-error {
  color: #f56c6c;
  font-size: 0.8rem;
}
</style>
