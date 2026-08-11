<script setup lang="ts">
import { onMounted } from 'vue'
import { useUserStore } from '@/core/stores/user.ts'
import { useRouter } from 'vue-router'
import { BaseInput } from '@/base'
import { BaseButton, BaseIcon, BasePage, Form, type FormInstance, FormItem, Toast } from '@/base'
import { APP_NAME, EMAIL } from '@/core/config/env.ts'
import { PASSWORD_CONFIG, PHONE_CONFIG } from '@/core/config/auth.ts'
import type { User } from '@/core/apis/user.ts'
import { changeEmailApi, changePhoneApi, setPassword, updateUserInfoApi } from '@/core/apis/user.ts'
import { codeRules, emailRules, passwordRules, phoneRules } from '@/core/utils/validation.ts'
import { cloneDeep, jump2Feedback } from '@/core/utils'
import Code from '@/components/user/Code.vue'
import { MessageBox } from '@/core/utils/MessageBox.tsx'
import { CodeType } from '@/core/types/enum.ts'

const userStore = useUserStore()
const router = useRouter()

let showChangePwd = $ref(false)
let showChangeEmail = $ref(false)
let showChangeUsername = $ref(false)
let showChangePhone = $ref(false)
let loading = $ref(false)

const handleLogout = () => {
  userStore.logout()
  router.push('/login')
}

const contactSupport = () => {
  console.log('Contact support')
}

onMounted(() => {
  userStore.fetchUserInfo()
})

// 修改手机号
// 修改手机号
// 修改手机号
let changePhoneFormRef = $ref<FormInstance>()
let defaultFrom = { oldCode: '', phone: '', code: '', pwd: '' }
let changePhoneForm = $ref(cloneDeep(defaultFrom))
let changePhoneFormRules = {
  oldCode: codeRules,
  phone: [
    ...phoneRules,
    {
      validator: (rule: any, value: any) => {
        if (userStore.user?.phone && value === userStore.user?.phone) {
          throw new Error('新手机号与原手机号一致')
        }
      },
      trigger: 'blur',
    },
  ],
  code: codeRules,
  pwd: passwordRules,
}

function showChangePhoneForm() {
  showChangePhone = showChangeUsername = showChangeEmail = showChangePwd = false
  showChangePhone = true
  changePhoneForm = cloneDeep(defaultFrom)
}

function changePhone() {
  changePhoneFormRef.validate(async valid => {
    if (valid) {
      try {
        loading = true
        const res = await changePhoneApi(changePhoneForm)
        if (res.success) {
          Toast.success('修改成功')
          await userStore.fetchUserInfo()
          showChangePhone = false
        } else {
          Toast.error(res.msg || '修改失败')
        }
      } catch (error) {
        Toast.error(error || '修改失败，请重试')
      } finally {
        loading = false
      }
    }
  })
}

// 修改用户名
// 修改用户名
// 修改用户名
let changeUsernameFormRef = $ref<FormInstance>()
let changeUsernameForm = $ref({ username: '' })
let changeUsernameFormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
}

function showChangeUsernameForm() {
  showChangePhone = showChangeUsername = showChangeEmail = showChangePwd = false
  showChangeUsername = true
  changeUsernameForm = cloneDeep({ username: userStore.user?.username ?? '' })
}

function changeUsername() {
  changeUsernameFormRef.validate(async valid => {
    if (valid) {
      try {
        loading = true
        const res = await updateUserInfoApi(changeUsernameForm)
        if (res.success) {
          Toast.success('修改成功')
          await userStore.fetchUserInfo()
          showChangeUsername = false
        } else {
          Toast.error(res.msg || '修改失败')
        }
      } catch (error) {
        Toast.error(error || '修改失败，请重试')
      } finally {
        loading = false
      }
    }
  })
}

// 修改邮箱
// 修改邮箱
// 修改邮箱
let changeEmailFormRef = $ref<FormInstance>()

let changeEmailForm = $ref({
  email: '',
  pwd: '',
  code: '',
})
let changeEmailFormRules = {
  email: [
    ...emailRules,
    {
      validator: (rule: any, value: any) => {
        if (userStore.user?.email && value === userStore.user?.email) {
          throw new Error('该邮箱与当前一致')
        }
      },
      trigger: 'blur',
    },
  ],
  pwd: passwordRules,
  code: codeRules,
}

function showChangeEmailForm() {
  showChangePhone = showChangeUsername = showChangeEmail = showChangePwd = false
  showChangeEmail = true
  changeEmailForm = cloneDeep({ email: userStore.user?.email ?? '', pwd: '', code: '' })
}

function changeEmail() {
  changeEmailFormRef.validate(async valid => {
    if (valid) {
      try {
        loading = true
        const res = await changeEmailApi(changeEmailForm)
        if (res.success) {
          Toast.success('修改成功')
          await userStore.fetchUserInfo()
          showChangeEmail = false
        } else {
          Toast.error(res.msg || '修改失败')
        }
      } catch (error) {
        Toast.error(error || '修改失败，请重试')
      } finally {
        loading = false
      }
    }
  })
}

// 修改密码
// 修改密码
// 修改密码
let changePwdFormRef = $ref<FormInstance>()
const defaultChangePwdForm = {
  oldPwd: '',
  newPwd: '',
  confirmPwd: '',
}
let changePwdForm = $ref(cloneDeep(defaultChangePwdForm))
let changePwdFormRules = {
  oldPwd: passwordRules,
  newPwd: passwordRules,
  confirmPwd: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (rule: any, value: any) => {
        if (value !== changePwdForm.newPwd) {
          throw new Error('两次密码输入不一致')
        }
      },
      trigger: 'blur',
    },
  ],
}

function showChangePwdForm() {
  showChangePhone = showChangeUsername = showChangeEmail = showChangePwd = false
  showChangePwd = true
  changePwdForm = cloneDeep(defaultChangePwdForm)
}

function changePwd() {
  changePwdFormRef.validate(async valid => {
    if (valid) {
      try {
        loading = true
        const res = await setPassword(changePwdForm)
        if (res.success) {
          Toast.success('密码设置成功，请重新登录')
          showChangePwd = false
          userStore.logout()
        } else {
          Toast.error(res.msg || '设置失败')
        }
      } catch (error) {
        Toast.error(error || '设置密码失败，请重试')
      } finally {
        loading = false
      }
    }
  })
}

const member = $computed<User['member']>(() => userStore.user?.member ?? ({} as any))

const memberEndDate = $computed(() => {
  if (member?.endDate === null) return '永久'
  return member?.endDate
})

function subscribe() {
  router.push('/vip')
}

function onFileChange(e) {
  console.log('e', e)
}
</script>

<template>
  <BasePage>
    <!-- Unauthenticated View -->
    <div v-if="!userStore.isLogin" class="center h-screen">
      <div class="card-white text-center flex-col gap-6 w-110">
        <div class="w-20 h-20 bg-blue-100 rounded-full center mx-auto">
          <IconFluentPerson20Regular class="text-3xl text-blue-600" />
        </div>
        <h1 class="text-2xl font-bold">
          <IconFluentHandWave20Regular class="text-xl translate-y-1 mr-2 shrink-0" />
          <span>欢迎使用</span>
        </h1>
        <p class="">登录，开启您的学习之旅</p>
        <div>保存进度、同步数据、解锁个性化内容</div>
        <BaseButton @click="router.push('/login')" size="large" class="w-full mt-4"> 登录 </BaseButton>
        <p class="text-sm text-gray-500">
          还没有账户？
          <router-link to="/login?register=1" class="line">立即注册</router-link>
        </p>
      </div>
    </div>

    <!-- Authenticated View -->
    <div v-else class="w-full flex gap-4">
      <!-- Main Account Settings -->
      <div class="card-white flex-1 flex flex-col gap-2 px-6">
        <h1 class="text-2xl font-bold mt-0">帐户</h1>

        <!--        用户名-->
        <div class="item">
          <div class="flex-1">
            <div class="mb-2">用户名</div>
            <div class="flex items-center gap-2" v-if="userStore.user?.username">
              <IconFluentPerson20Regular class="text-base" />
              <span>{{ userStore.user?.username }}</span>
            </div>
            <div v-else class="text-xs">在此设置用户名</div>
          </div>
          <BaseIcon @click="showChangeUsernameForm">
            <IconFluentTextEditStyle20Regular />
          </BaseIcon>
        </div>
        <div v-if="showChangeUsername">
          <Form ref="changeUsernameFormRef" :rules="changeUsernameFormRules" :model="changeUsernameForm">
            <FormItem prop="username">
              <BaseInput
                v-model="changeUsernameForm.username"
                type="text"
                size="large"
                placeholder="请输入用户名"
                autofocus
              >
                <template #preIcon>
                  <IconFluentPerson20Regular class="text-base" />
                </template>
              </BaseInput>
            </FormItem>
          </Form>
          <div class="text-align-end mb-2">
            <BaseButton type="info" @click="showChangeUsername = false">取消</BaseButton>
            <BaseButton @click="changeUsername">保存</BaseButton>
          </div>
        </div>
        <div class="line"></div>

        <!--        手机号-->
        <div class="item">
          <div class="flex-1">
            <div class="mb-2">手机号</div>
            <div class="flex items-center gap-2" v-if="userStore.user?.phone">
              <IconFluentMail20Regular class="text-base" />
              <span>{{ userStore.user?.phone }}</span>
            </div>
            <div v-else class="text-xs">在此设置手机号</div>
          </div>
          <BaseIcon @click="showChangePhoneForm">
            <IconFluentTextEditStyle20Regular />
          </BaseIcon>
        </div>
        <div v-if="showChangePhone">
          <Form ref="changePhoneFormRef" :rules="changePhoneFormRules" :model="changePhoneForm">
            <FormItem prop="oldCode" v-if="userStore.user?.phone">
              <div class="flex gap-2">
                <BaseInput
                  v-model="changePhoneForm.oldCode"
                  type="code"
                  autofocus
                  placeholder="请输入原手机号验证码"
                  :max-length="PHONE_CONFIG.codeLength"
                />
                <Code :validate-field="() => true" :type="CodeType.ChangePhoneOld" :val="userStore.user.phone" />
              </div>
            </FormItem>
            <FormItem prop="phone">
              <BaseInput v-model="changePhoneForm.phone" type="tel" size="large" placeholder="请输入新手机号" />
            </FormItem>
            <FormItem prop="code">
              <div class="flex gap-2">
                <BaseInput
                  v-model="changePhoneForm.code"
                  type="code"
                  placeholder="请输入新手机号验证码"
                  :max-length="PHONE_CONFIG.codeLength"
                />
                <Code
                  :validate-field="() => changePhoneFormRef.validateField('phone')"
                  :type="CodeType.ChangePhoneNew"
                  :val="changePhoneForm.phone"
                />
              </div>
            </FormItem>
            <FormItem prop="pwd" v-if="!userStore.user?.phone">
              <BaseInput v-model="changePhoneForm.pwd" type="password" size="large" placeholder="请输入原密码" />
            </FormItem>
          </Form>
          <div class="flex justify-between items-end mb-2">
            <span
              class="link text-sm cp"
              @click="MessageBox.notice(`请提供证明信息发送邮件到 ${EMAIL} 进行申诉`, '人工申诉')"
              v-if="userStore.user?.phone"
              >原手机号不可用，点此申诉</span
            >
            <span v-else></span>
            <div>
              <BaseButton type="info" @click="showChangePhone = false">取消</BaseButton>
              <BaseButton @click="changePhone">保存</BaseButton>
            </div>
          </div>
        </div>
        <div class="line"></div>

        <!-- Email Section -->
        <div class="item">
          <div class="flex-1">
            <div class="mb-2">电子邮箱</div>
            <div class="flex items-center gap-2" v-if="userStore.user?.email">
              <IconFluentMail20Regular class="text-base" />
              <span>{{ userStore.user?.email }}</span>
            </div>
            <div v-else class="text-xs">在此设置邮箱</div>
          </div>
          <BaseIcon @click="showChangeEmailForm">
            <IconFluentTextEditStyle20Regular />
          </BaseIcon>
        </div>
        <div v-if="showChangeEmail">
          <Form ref="changeEmailFormRef" :rules="changeEmailFormRules" :model="changeEmailForm">
            <FormItem prop="email">
              <BaseInput
                v-model="changeEmailForm.email"
                type="email"
                size="large"
                placeholder="请输入邮箱地址"
                autofocus
              />
            </FormItem>
            <FormItem prop="code">
              <div class="flex gap-2">
                <BaseInput
                  v-model="changeEmailForm.code"
                  type="code"
                  placeholder="请输入验证码"
                  :max-length="PHONE_CONFIG.codeLength"
                />
                <Code
                  :validate-field="() => changeEmailFormRef.validateField('email')"
                  :type="CodeType.ChangeEmail"
                  :val="changeEmailForm.email"
                />
              </div>
            </FormItem>
            <FormItem prop="pwd" v-if="userStore.user?.hasPwd">
              <BaseInput v-model="changePwdForm.pwd" type="password" size="large" placeholder="请输入密码" />
            </FormItem>
          </Form>
          <div class="text-align-end mb-2">
            <BaseButton type="info" @click="showChangeEmail = false">取消</BaseButton>
            <BaseButton @click="changeEmail">保存</BaseButton>
          </div>
        </div>
        <div class="line"></div>

        <!-- Password Section -->
        <div class="item">
          <div class="flex-1">
            <div class="mb-2">设置密码</div>
            <div class="text-xs">在此输入密码</div>
          </div>
          <BaseIcon @click="showChangePwdForm">
            <IconFluentTextEditStyle20Regular />
          </BaseIcon>
        </div>
        <div v-if="showChangePwd">
          <Form ref="changePwdFormRef" :rules="changePwdFormRules" :model="changePwdForm">
            <FormItem prop="oldPwd" v-if="userStore.user.hasPwd">
              <BaseInput v-model="changePwdForm.oldPwd" placeholder="旧密码" type="password" size="large" autofocus />
            </FormItem>

            <FormItem prop="newPwd">
              <BaseInput
                v-model="changePwdForm.newPwd"
                type="password"
                size="large"
                :placeholder="`请输入新密码（${PASSWORD_CONFIG.minLength}-${PASSWORD_CONFIG.maxLength}位）`"
                :min="PASSWORD_CONFIG.minLength"
                :max="PASSWORD_CONFIG.maxLength"
                autofocus
              />
            </FormItem>
            <FormItem prop="confirmPwd">
              <BaseInput
                v-model="changePwdForm.confirmPwd"
                type="password"
                size="large"
                placeholder="请再次输入新密码"
                :min="PASSWORD_CONFIG.minLength"
                :max="PASSWORD_CONFIG.maxLength"
              />
            </FormItem>
          </Form>
          <div class="text-align-end mb-2">
            <BaseButton type="info" @click="showChangePwd = false">取消</BaseButton>
            <BaseButton :loading="loading" @click="changePwd">保存</BaseButton>
          </div>
        </div>
        <div class="line"></div>

        <!-- Contact Support -->
        <div class="item cp" v-if="false" @click="contactSupport">
          <div class="flex-1">联系 {{ APP_NAME }} 客服</div>
          <IconFluentChevronLeft28Filled class="rotate-180" />
        </div>
        <!--        <div class="line"></div>-->

        <!--        同步进度-->
        <div class="item cp relative">
          <div class="flex-1">
            <div class="">同步进度</div>
            <!--            <div class="text-xs mt-2">在此输入密码</div>-->
          </div>
          <IconFluentChevronLeft28Filled class="rotate-180" />
          <input
            type="file"
            accept=".json,.zip,application/json,application/zip"
            @change="onFileChange"
            class="absolute left-0 top-0 w-full h-full bg-red cp opacity-0"
          />
        </div>
        <div class="line"></div>

        <!--        去github issue-->
        <div class="item cp" @click="jump2Feedback()">
          <div class="flex-1">给 {{ APP_NAME }} 提交意见</div>
          <IconFluentChevronLeft28Filled class="rotate-180" />
        </div>
        <div class="line"></div>

        <!-- Logout Button -->
        <div class="center w-full mt-4">
          <BaseButton @click="handleLogout" size="large" class="w-[40%]"> 登出 </BaseButton>
        </div>

        <div class="text-xs text-center mt-2">
          <a href="/user-agreement.html" target="_blank" class="text-gray-500 hover:text-gray-700">用户协议</a>
          、
          <a href="/privacy-policy.html" target="_blank" class="text-gray-500 hover:text-gray-700">隐私政策</a>
        </div>
      </div>

      <!-- Subscription Information -->
      <div class="card-white w-80">
        <div class="flex items-center gap-3 mb-4">
          <IconFluentCrown20Regular class="text-2xl text-yellow-500" />
          <div class="text-lg font-bold">订阅信息</div>
        </div>

        <div class="space-y-4">
          <template v-if="userStore.user?.member">
            <div>
              <div class="mb-1">当前计划</div>
              <div class="text-base font-bold">{{ member?.planDesc }}</div>
            </div>

            <div>
              <div class="mb-1">状态</div>
              <div class="flex items-center gap-2">
                <div class="w-2 h-2 rounded-full" :class="member?.active ? 'bg-green-500' : 'bg-red-500'"></div>
                <span class="text-base font-medium" :class="member?.active ? 'text-green-700' : 'text-red-700'">
                  {{ member?.status }}
                </span>
              </div>
            </div>

            <div>
              <div class="mb-1">到期时间</div>
              <div class="flex items-center gap-2">
                <IconFluentCalendarDate20Regular class="text-lg" />
                <span class="text-base font-medium">{{ memberEndDate }}</span>
              </div>
            </div>

            <div>
              <div class="mb-1">自动续费</div>
              <div class="flex items-center gap-2">
                <div class="w-2 h-2 rounded-full" :class="member?.autoRenew ? 'bg-blue-500' : 'bg-gray-400'"></div>
                <span class="text-base font-medium" :class="member?.autoRenew ? 'text-blue-700' : 'text-gray-600'">
                  {{ member?.autoRenew ? '已开启' : '已关闭' }}
                </span>
              </div>
            </div>
          </template>

          <div class="text-base" v-else>当前无订阅</div>

          <BaseButton class="w-full" size="large" @click="subscribe"
            >{{ userStore.user?.member ? '管理订阅' : '会员介绍' }}
          </BaseButton>
        </div>
      </div>
    </div>
  </BasePage>
</template>

<style scoped lang="scss">
.item {
  @apply flex items-center justify-between min-h-14;
}
</style>
