<script lang="jsx">
import {Teleport, Transition} from 'vue'
import { useLanguage } from '@/hooks/useLanguage'

export default {
  name: "PopConfirm",
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
  setup() {
    const { t } = useLanguage()
    return { t }
  },
  data() {
    return {
      show: false
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
    }
  },
  render() {
    let Vnode = this.$slots.default()[0]
    return (
        <div class="pop-confirm">
          <Teleport to="body">
            <Transition>
              {
                  this.show && (
                      <div ref="tip" class="pop-confirm-content">
                        <div class="text">
                          {this.title}
                        </div>
                        <div class="options">
                          <div onClick={() => this.show = false}>{this.t('Cancel')}</div>
                          <div class="main" onClick={() => this.confirm()}>{this.t('Confirm')}</div>
                        </div>
                      </div>
                  )
              }
            </Transition>
          </Teleport>
          <Vnode onClick={(e) => this.showPop(e)}/>
        </div>
    )
  }
}
</script>
<style lang="scss" scoped>
$bg-color: rgb(226, 226, 226);

.pop-confirm-content {
  position: fixed;
  background: var(--color-tooltip-bg);
  padding: 1rem;
  border-radius: .3rem;
  transform: translate(-50%, calc(-100% - .6rem));
  box-shadow: 0 0 6px 1px var(--color-tooltip-shadow);
  z-index: 999;

  .text {
    color: var(--color-font-1);
    text-align: start;
    font-size: 1rem;
    width: 9rem;
    min-width: 9rem;
  }

  .options {
    margin-top: .9rem;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: .7rem;
    font-size: .9rem;

    div {
      cursor: pointer;
    }

    .main {
      color: gray;
      background: $bg-color;
      padding: .2rem .6rem;
      border-radius: .24rem;
    }
  }
}
</style>
