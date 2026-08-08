<script lang="jsx">
import {Teleport, Transition} from 'vue'

export default {
  name: "Tooltip",
  components: {
    Teleport,
    Transition
  },
  props: {
    title: {
      type: String,
      default() {
        return ''
      }
    },
    disabled: {
      type: Boolean,
      default() {
        return false
      }
    }
  },
  data() {
    return {
      show: false
    }
  },
  methods: {
    showPop(e) {
      if (this.disabled) return
      if (!this.title && !this.$slots?.reference) return;
      e.stopPropagation()
      let rect = e.target.getBoundingClientRect()
      this.show = true
      this.$nextTick(() => {
        let tip = this.$refs?.tip?.getBoundingClientRect()
        if (!tip) return
        if (rect.top < 50) {
          this.$refs.tip.style.top = rect.top + rect.height + 10 + 'px'
        } else {
          this.$refs.tip.style.top = rect.top - tip.height - 10 + 'px'
        }
        let tipWidth = tip.width
        let rectWidth = rect.width
        this.$refs.tip.style.left = rect.left - (tipWidth - rectWidth) / 2 + 'px'
        // onmouseleave={() => this.show = false}
      })
    },
  },
  render() {
    let DefaultNode = this.$slots.default()[0]
    let ReferenceNode = this.$slots?.reference?.()?.[0]
    return <>
      <Transition name="fade">
        <Teleport to="body">
          {this.show && (
            <div ref="tip" class="tip">
              {ReferenceNode ? <ReferenceNode/> : this.title}
            </div>
          )}
        </Teleport>
      </Transition>

      <DefaultNode
        onmouseenter={(e) => this.showPop(e)}
        onmouseleave={() => this.show = false}
      />
    </>
  }
}
</script>
<style lang="scss" scoped>
.tip {
  background: var(--color-tooltip-bg);
  max-width: 22rem;
  @apply fixed z-9999 shadow-xl border-item-solid rounded-md px-2.5 py-1.5;
}
</style>
