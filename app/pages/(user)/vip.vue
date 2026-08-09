<script setup lang="ts">
import { BaseButton, BaseInput, BasePage, InputNumber, PopConfirm, Radio, RadioGroup, Toast } from '@/base'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/core/stores/user.ts'
import type { User } from '@/core/apis/user.ts'
import { onMounted, onUnmounted, watch } from 'vue'
import Header from '@/core/components/Header.vue'
import type { CouponInfo, LevelBenefits } from '@/core/apis/member.ts'
import {
  alipayQuery,
  couponInfo,
  levelBenefits,
  orderCreate,
  orderStatus,
  setAutoRenewApi,
} from '@/core/apis/member.ts'
import { _dateFormat, _nextTick } from '@/core/utils'

const router = useRouter()
const userStore = useUserStore()

interface Plan {
  id: string
  name: string
  price: number
  unit: '月' | '年'
  highlight?: string
  autoRenew?: boolean
}

let loading = $ref(false)
let selectedPaymentMethod = $ref('alipay')
let selectedPlanId = $ref('')
let duration = $ref(1)
const member = $computed<User['member']>(() => userStore.user?.member ?? ({} as any))

const memberEndDate = $computed(() => {
  if (member?.endDate === null) return '永久'
  return member?.endDate
})

let data = $ref<LevelBenefits>({} as any)
const plans: Plan[] = $computed(() => {
  let list = []
  if (data?.level) {
    list.push({
      id: 'month',
      name: '月付',
      price: data.level.price,
      unit: '月',
    })
    list.push({
      id: 'month_auto',
      name: '连续包月',
      price: data.level.price_auto,
      unit: '月',
      highlight: '性价比更高',
      autoRenew: true,
    })
    list.push({
      id: 'year',
      name: '年度会员',
      price: data.level.yearly_price,
      unit: '年',
      highlight: '年度优惠',
    })
  }
  return list
})

// Payment methods - WeChat and Alipay
const paymentMethods = [
  // {
  //   id: 'wechat',
  //   name: '微信支付',
  //   description: '使用微信支付'
  // },
  {
    id: 'alipay',
    name: '支付宝',
    description: '使用支付宝支付',
  },
]

const currentPlan = $computed(() => {
  return plans.find(v => v.id === member?.plan) ?? null
})

const selectPlan = $computed(() => {
  return plans.find(v => v.id === selectedPlanId) ?? null
})

// Calculate original price based on plan type
const originalPrice = $computed(() => {
  return selectPlan?.id === 'month_auto' ? Number(selectPlan?.price) : Number(duration) * Number(selectPlan?.price)
})

// check Is it enough for a discount
const enoughDiscount = $computed(() => {
  if (coupon.is_valid) {
    if (coupon.min_amount) {
      const minAmount = Number(coupon.min_amount)
      return originalPrice > minAmount
    }
    return true
  }
  return false
})

const endPrice = $computed(() => {
  if (!coupon.is_valid) {
    return Number(originalPrice.toFixed(2))
  }

  if (coupon.type === 'free_trial') return 0

  if (!enoughDiscount) {
    return Number(originalPrice.toFixed(2))
  }

  let discountAmount = 0
  if (coupon.type === 'discount') {
    // Discount coupon: e.g., 0.8 means 20% off
    const discountRate = Number(coupon.value)
    discountAmount = originalPrice * (1 - discountRate)

    // Apply max_discount limit if available
    if (coupon.max_discount) {
      const maxDiscount = Number(coupon.max_discount)
      discountAmount = Math.min(discountAmount, maxDiscount)
    }
  } else if (coupon.type === 'amount') {
    // Amount coupon: fixed amount off
    discountAmount = Number(coupon.value)
  }

  const finalPrice = Math.max(originalPrice - discountAmount, 0)
  return finalPrice.toFixed(2)
})

const startDate = $computed(() => {
  if (member?.active) {
    return member.endDate
  } else {
    return _dateFormat(Date.now())
  }
})

onMounted(async () => {
  let res = await levelBenefits({ levelCode: 'basic' })
  if (res.success) {
    data = res.data
  }
})

let loading2 = $ref(false)

async function toggleAutoRenew() {
  if (loading2) return
  loading2 = true
  let res = await setAutoRenewApi({ autoRenew: false })
  if (res.success) {
    Toast.success('取消成功')
    userStore.init()
  } else {
    Toast.error(res.msg || '取消失败')
  }
  loading2 = false
}

// Get button text based on current plan
function getPlanButtonText(plan: Plan) {
  if (plan.id === selectedPlanId) return '已选中'
  if (plan.id === currentPlan?.id) return '当前计划'
  return '选择'
}

function goPurchase(plan: Plan) {
  if (!userStore.isLogin) {
    router.push({ path: '/login', query: { redirect: '/vip' } })
    return
  }
  selectedPlanId = plan.id
  _nextTick(() => {
    let el = document.getElementById('pay')
    el.scrollIntoView({ behavior: 'smooth' })
  })
}

let startLoop = $ref(false)
let orderNo = $ref('')
let timer: number = $ref()
let showCouponInput = $ref(false)
let coupon = $ref<CouponInfo>({ code: '' } as CouponInfo)
let checkLoading = $ref(false)
let showCheckBtn = $ref(false)

watch(
  () => startLoop,
  n => {
    if (n) {
      clearInterval(timer)
      timer = setInterval(() => {
        orderStatus({ orderNo }).then(res => {
          if (res?.success) {
            if (res.data?.payment_status === 'paid') {
              Toast.success('付款成功')
              userStore.init()
              startLoop = false
              selectedPlanId = undefined
            }
          } else {
            startLoop = false
            Toast.error(res.msg || '付款失败')
          }
        })
      }, 1000)
      setTimeout(() => {
        showCheckBtn = true
      }, 3000)
    } else {
      clearInterval(timer)
      showCheckBtn = false
    }
  }
)

onUnmounted(() => {
  startLoop = false
  clearInterval(timer)
})

async function handlePayment() {
  // let win = window.open('about:blank')
  // let res1 = await testPay()
  // if (res1.success) {
  //   win.document.write(res1.data as string);
  //   win.document.close();
  // }
  // return
  if (loading || startLoop) return
  loading = true
  let data = {
    plan: selectedPlanId,
    duration: Number(duration),
    payment_method: selectedPaymentMethod,
    couponCode: coupon.is_valid ? coupon.code : undefined,
  }
  let res = await orderCreate(data)
  console.log('res', res)
  if (res.success) {
    _nextTick(() => {
      const iframe = document.getElementById('payFrame')
      // 强制重置为 about:blank，让 document 可写
      iframe.src = 'about:blank'
      iframe.onload = () => {
        const doc = iframe.contentWindow.document
        doc.open()
        doc.write(res.data.result) // 写入 form
        doc.close() // form 会自动提交
      }
      startLoop = true
    })
    orderNo = res.data.orderNo
  } else {
    Toast.error(res.msg || '付款失败')
  }
  loading = false
}

async function checkOrderStatus() {
  if (checkLoading) return
  checkLoading = true
  let res = await alipayQuery({ orderNo })
  if (!res.success) {
    Toast.info(res.msg || '未付款')
  }
  checkLoading = false
}

let couponLoading = $ref(false)

async function getCouponInfo() {
  if (showCouponInput) {
    if (!coupon.code) return Toast.info('请输入优惠券')
    if (couponLoading) return
    couponLoading = true
    let res = await couponInfo(coupon)
    if (res.success) {
      if (res.data.is_valid) {
        coupon = res.data
      } else {
        coupon = { code: coupon.code } as CouponInfo
        Toast.info('优惠券已失效')
      }
    } else {
      coupon = { code: coupon.code } as CouponInfo
      Toast.error(res.msg || '优惠券无效')
    }
    couponLoading = false
  } else {
    showCouponInput = true
  }
}
</script>

<template>
  <BasePage>
    <div class="space-y-6">
      <div class="card-white">
        <Header title="会员介绍"></Header>
        <div class="grid grid-cols-3 grid-rows-3 gap-3">
          <div class="text-lg flex items-center" v-for="f in data.benefits" :key="f.name">
            <IconFluentCheckmarkCircle20Regular class="mr-2 text-green-600" />
            <span>
              <span>{{ f.name }}</span>
              <span v-if="f.value !== 'true'">{{ `(${f.value}${f.unit ?? ''})` }}</span>
            </span>
          </div>
        </div>
      </div>

      <div v-if="member?.active" class="card-white bg-green-50 dark:bg-item border border-green-200 mt-3 mb-6">
        <div class="flex items-center justify-between">
          <div class="flex items-center">
            <IconFluentCheckmarkCircle20Regular class="mr-2 text-green-600" />
            <div>
              <div class="font-semibold text-green-800">当前计划：{{ currentPlan?.name }}</div>
              <div class="text-sm text-green-600">到期时间：{{ memberEndDate }}</div>
            </div>
          </div>
          <div class="text-align-end space-y-2">
            <div v-if="member.autoRenew" class="flex items-center gap-space">
              <div class="flex items-center text-sm text-gray-600">
                <IconFluentArrowRepeatAll20Regular class="mr-1" />
                <span>自动续费已开启</span>
              </div>
              <PopConfirm title="确认取消？" @confirm="toggleAutoRenew">
                <BaseButton size="small" type="info" :loading="loading2">关闭</BaseButton>
              </PopConfirm>
            </div>
          </div>
        </div>
      </div>

      <div class="flex justify-between">
        <div class="title">选择适合您的套餐</div>
        <div class="subtitle">三种方案，按需选择</div>
      </div>

      <div class="plans">
        <div v-for="p in plans" :key="p.id" class="card-white p-0 overflow-hidden flex flex-col">
          <div class="text-2xl font-bold bg-gray-300 dark:bg-third px-6 py-4">{{ p.name }}</div>
          <div class="p-6 flex flex-col justify-between flex-1">
            <div class="plan-head">
              <div class="price">
                <span class="amount">¥{{ p.price }}</span>
                <span class="unit">/ 每{{ p.unit }}</span>
              </div>
              <div v-if="p.highlight" class="tag">{{ p.highlight }}</div>
            </div>
            <div v-if="p.autoRenew" class="text-sm flex items-center mt-4">
              <IconFluentArrowRepeatAll20Regular class="mr-2" />
              开启自动续费，可随时关闭
            </div>
            <BaseButton
              class="w-full mt-4"
              size="large"
              :type="p.id === currentPlan?.id || p.id === selectedPlanId ? 'primary' : 'info'"
              :disabled="p.id === currentPlan?.id"
              @click="goPurchase(p)"
            >
              {{ getPlanButtonText(p) }}
            </BaseButton>
          </div>
        </div>
      </div>
    </div>

    <div id="pay" class="mb-50" v-if="selectedPlanId">
      <!-- Page Header -->
      <div class="text-center mb-6">
        <h1 class="text-xl font-semibold mb-2">安全支付</h1>
        <p class="">选择支付方式完成订单</p>
      </div>

      <div class="center">
        <div class="card-white w-5/10">
          <div class="flex items-center justify-between gap-6">
            <div class="center gap-2" v-if="!showCouponInput">
              <IconStreamlineDiscountPercentCoupon />
              <span>有优惠券？</span>
            </div>
            <BaseInput
              v-else
              v-model="coupon.code"
              placeholder="请输入优惠券"
              autofocus
              clearable
              @enter="getCouponInfo"
            />
            <BaseButton size="large" :loading="couponLoading" @click="getCouponInfo"
              >{{ showCouponInput ? '确定' : '在此兑换!' }}
            </BaseButton>
          </div>

          <div class="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mt-4" v-if="coupon.is_valid">
            <div class="font-medium">优惠券: {{ coupon.name }}</div>
            <div class="flex justify-between w-full mt-2">
              <span v-if="coupon.type === 'discount'">折扣券：{{ (Number(coupon.value) * 10).toFixed(1) }}折</span>
              <span v-else-if="coupon.type === 'amount'">立减券：￥{{ Number(coupon.value).toFixed(2) }}</span>
              <span v-else-if="coupon.type === 'free_trial'">折扣: -100%</span>

              <!-- Coupon restrictions -->
              <div v-if="coupon.min_amount || coupon.max_discount">
                <span v-if="coupon.min_amount">满{{ Number(coupon.min_amount).toFixed(2) }}元可用</span>
                <span v-if="coupon.max_discount && coupon.type === 'discount'">
                  · 最高减{{ Number(coupon.max_discount).toFixed(2) }}元
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Content -->
      <div class="grid grid-cols-3 gap-8">
        <!-- Left Card: Payment Method Selection -->
        <div class="card-white">
          <div class="text-lg font-medium mb-4">选择支付方式</div>
          <RadioGroup v-model="selectedPaymentMethod">
            <div class="space-y-3 w-full">
              <div
                v-for="method in paymentMethods"
                :key="method.id"
                @click="selectedPaymentMethod = method.id"
                class="flex p-4 border rounded-lg cp transition-all duration-200 hover:bg-item"
                :class="selectedPaymentMethod === method.id && 'bg-item'"
              >
                <div class="flex items-center flex-1 gap-4">
                  <IconSimpleIconsWechat class="text-xl color-green-500" v-if="method.id === 'wechat'" />
                  <IconUiwAlipay class="text-xl color-blue" v-else />
                  <div>
                    <div class="font-medium color-main">{{ method.name }}</div>
                    <div class="text-sm text-gray-500">{{ method.description }}</div>
                  </div>
                </div>
                <Radio :value="method.id" label=""></Radio>
              </div>
            </div>
          </RadioGroup>
        </div>

        <!-- Right Card: Order Summary -->
        <div class="card-white">
          <div class="text-lg font-semibold mb-4">订单概要</div>

          <!-- Plan Info -->
          <div class="mb-4">
            <div class="text-purple-600 text-sm mb-2">付费方案（{{ selectPlan?.name }}）订阅</div>
            <div class="mb-4">从 {{ startDate }} 开始:</div>
          </div>

          <div class="flex justify-between items-center mb-4">
            <!-- Price -->
            <div class="flex items-baseline">
              <span class="font-semibold" :class="selectPlan?.id === 'month_auto' ? 'text-3xl' : 'text-xl'">
                ￥{{ selectPlan?.price }}
              </span>
              <span class="ml-2">/ {{ selectPlan?.unit }}</span>
            </div>
            <div v-if="selectPlan?.id !== 'month_auto'">
              <InputNumber :min="1" v-model="duration" />
            </div>
          </div>

          <div v-if="coupon.is_valid" class="mb-4">
            <div class="flex items-baseline text-gray-500 line-through" v-if="enoughDiscount">
              <span class="text-lg">原价：￥{{ Number(originalPrice).toFixed(2) }}</span>
              <span class="ml-2">/ {{ selectPlan?.unit }}</span>
            </div>
            <div class="text-sm">
              <div v-if="enoughDiscount" class="text-green-600 flex items-center">
                <IconStreamlineDiscountPercentCoupon class="mr-2" />
                <span>已优惠：￥{{ (Number(originalPrice) - Number(endPrice)).toFixed(2) }}</span>
              </div>
              <span v-else>优惠券不可用：未满足条件</span>
            </div>
          </div>

          <!-- Final Price -->
          <div class="flex items-baseline mb-4">
            <span class="text-2xl font-semibold">总计：</span>
            <span class="text-3xl font-semibold">￥{{ endPrice }}</span>
          </div>

          <div class="bg-second text-sm px-4 py-3 rounded-lg mb-4 text-gray-600">
            会员属于虚拟服务，一经购买激活后不支持退款。请在购买前仔细阅读权益说明，确认符合您的需求再进行支付。
          </div>

          <!-- Payment Button -->
          <BaseButton
            class="w-full"
            size="large"
            :loading="loading || startLoop"
            :type="!!selectedPaymentMethod ? 'primary' : 'info'"
            :disabled="!selectedPaymentMethod"
            @click="handlePayment"
          >
            付款
          </BaseButton>
        </div>

        <!-- Right Card: Order Summary -->
        <div class="card-white flex flex-col">
          <div class="text-lg font-semibold mb-4">扫码支付</div>
          <div class="center flex-col relative flex-1">
            <div class="center h-full w-full absolute left-0 top-0 bg-white z-2" v-if="!startLoop">
              <div class="w-5/10">请点击左侧付款按钮后，支付二维码将自动显示</div>
            </div>

            <iframe id="payFrame" class="w-[205px] h-[205px] center border-none"></iframe>
            <div class="text-center my-4">请使用支付宝扫码支付</div>
            <BaseButton size="large" v-if="showCheckBtn" :loading="checkLoading" @click="checkOrderStatus">
              我已付款
            </BaseButton>
          </div>
        </div>
      </div>
    </div>
  </BasePage>
</template>

<style scoped lang="scss">
.pay-dialog {
  position: fixed;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  z-index: 99999;
}

.plans {
  display: grid;
  gap: 3rem;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.plan-head {
  @apply flex flex-col gap-2;
}

.price {
  @apply flex items-end gap-1;
}

.amount {
  @apply text-4xl font-500;
}

.unit {
  @apply text-base text-gray-500;
}

.desc {
  @apply text-sm text-gray-600;
}

.tag {
  @apply text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded w-fit;
}
</style>
