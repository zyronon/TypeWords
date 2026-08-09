<script lang="jsx">
import { Teleport, Transition } from 'vue'
import BaseButton from './BaseButton.vue'

export default {
  name: 'PopConfirm',
  components: {
    Teleport,
    Transition,
    BaseButton,
  },
  props: {
    title: {
      type: [String, Array],
      default() {
        return ''
      },
      validator(value) {
        // Validate that array items have the correct structure
        if (Array.isArray(value)) {
          return value.every(
            item =>
              typeof item === 'object' &&
              item !== null &&
              typeof item.text === 'string' &&
              ['normal', 'bold', 'red', 'redBold'].includes(item.type)
          )
        }
        return typeof value === 'string'
      },
    },
    disabled: {
      type: Boolean,
      default() {
        return false
      },
    },
  },
  computed: {
    titleItems() {
      if (typeof this.title === 'string') {
        return [{ text: this.title, type: 'normal' }]
      }
      if (Array.isArray(this.title)) {
        return this.title
      }
      return []
    },
  },
  data() {
    return {
      show: false,
    }
  },
  mounted() {
    window.addEventListener('click', () => {
      this.show = false
    })
    window.addEventListener('keydown', () => {
      this.show = false
    })
  },
  methods: {
    getTextStyle(type) {
      const styles = {
        normal: {
          fontWeight: 'normal',
          color: 'inherit',
        },
        bold: {
          fontWeight: 'bold',
          color: 'inherit',
        },
        red: {
          fontWeight: 'normal',
          color: 'red',
        },
        redBold: {
          fontWeight: 'bold',
          color: 'red',
        },
      }
      return styles[type] || styles.normal
    },
    showPop(e) {
      if (this.disabled) return this.$emit('confirm')
      e?.stopPropagation()
      let rect = e.target.getBoundingClientRect()
      this.show = true
      this.$nextTick(() => {
        let tip = this.$refs?.tip?.getBoundingClientRect()
        // console.log('rect', rect, tip)
        if (!tip) return
        if (rect.top < 150) {
          this.$refs.tip.style.top = rect.top + rect.height + tip.height + 30 + 'px'
        } else {
          this.$refs.tip.style.top = rect.top - 10 + 'px'
        }
        this.$refs.tip.style.left = rect.left + rect.width / 2 - 50 + 'px'
      })
    },
    confirm() {
      this.show = false
      this.$emit('confirm')
    },
  },
  render() {
    let Vnode = this.$slots.default()[0]
    return (
      <div class="pop-confirm leading-none">
        <Teleport to="body">
          <Transition name="fade">
            {this.show && (
              <div ref="tip" class="pop-confirm-content shadow-2xl">
                <div class="w-52 title-content">
                  {this.titleItems.map((item, index) => (
                    <div key={index} style={this.getTextStyle(item.type)} class="title-item">
                      {item.text}
                    </div>
                  ))}
                </div>
                <div class="options">
                  <BaseButton type="info" size="small" onClick={() => (this.show = false)}>
                    {this.$t('cancel')}
                  </BaseButton>
                  <BaseButton size="small" onClick={() => this.confirm()}>
                    {this.$t('confirm')}
                  </BaseButton>
                </div>
              </div>
            )}
          </Transition>
        </Teleport>
        <Vnode onClick={e => this.showPop(e)} />
      </div>
    )
  },
}
</script>
<style lang="scss" scoped>
.pop-confirm-content {
  background: var(--color-tooltip-bg);
  transform: translate(-50%, calc(-100% - 0.6rem));
  @apply fixed z-9999 shadow-2xl rounded-lg p-3;

  .title-content {
    .title-item {
      margin-bottom: 0.25rem;

      &:last-child {
        margin-bottom: 0;
      }
    }
  }

  .options {
    margin-top: 0.9rem;
    text-align: right;
  }
}
</style>
