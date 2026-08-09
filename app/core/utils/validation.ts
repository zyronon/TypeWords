// 邮箱验证
import {EMAIL_CONFIG, PASSWORD_CONFIG, PHONE_CONFIG} from "../config/auth.ts";

export const validateEmail = (email: string): boolean => {
  return EMAIL_CONFIG.emailRegex.test(email)
}
// 手机号验证（中国大陆）
export const validatePhone = (phone: string): boolean => {
  return PHONE_CONFIG.phoneRegex.test(phone)
}

export const codeRules = [
  {required: true, message: '请输入验证码', trigger: 'blur'},
  {min: PHONE_CONFIG.codeLength, message: `请输入 ${PHONE_CONFIG.codeLength} 位验证码`, trigger: 'blur'},
]
export const accountRules = [
  {required: true, message: '请输入手机号/邮箱地址', trigger: 'blur'},
  {
    validator: (rule: any, value: any) => {
      if (!validatePhone(value) && !validateEmail(value)) {
        throw new Error('请输入有效的手机号或邮箱地址')
      }
    }, trigger: 'blur'
  },
]
export const emailRules = [
  {required: true, message: '请输入邮箱地址', trigger: 'blur'},
  {
    validator: (rule: any, value: any) => {
      if (!validateEmail(value)) {
        throw new Error('请输入有效的邮箱地址')
      }
    }, trigger: 'blur'
  },
]
export const phoneRules = [
  {required: true, message: '请输入手机号', trigger: 'blur'},
  {
    validator: (rule: any, value: any) => {
      if (!validatePhone(value)) {
        throw new Error('请输入有效的手机号')
      }
    }, trigger: 'blur'
  },
]
export const passwordRules = [
  {required: true, message: '请输入密码', trigger: 'blur'},
  {
    min: PASSWORD_CONFIG.minLength,
    max: PASSWORD_CONFIG.maxLength,
    message: `密码长度为 ${PASSWORD_CONFIG.minLength}-${PASSWORD_CONFIG.maxLength} 位`,
    trigger: 'blur'
  },
]
