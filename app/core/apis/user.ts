import http from '../utils/http.ts'
import { encryptPasswordFields } from '../utils/rsa-password.ts'

import {CodeType} from '../types';

// 用户登录接口
export interface LoginParams {
  account?: string
  password?: string
  phone?: string
  code?: string
  type: 'code' | 'pwd'
}

export interface User {
  id: string
  email?: string
  phone?: string
  username?: string
  avatar?: string,
  hasPwd?: boolean,
  member: {
    levelDesc: string,
    status: string,
    active: boolean,
    endDate: number,
    autoRenew: boolean,
    plan: string,
    planDesc: string,
  }
}


// 用户注册接口
export interface RegisterParams {
  account: string
  password: string
  code: string
}

export interface RegisterResponse {
  token: string
  user: {
    id: string
    email?: string
    phone: string
    nickname?: string
    avatar?: string
  }
}

// 发送验证码接口
export interface SendCodeParams {
  val: string
  type: CodeType
}

// 重置密码接口
export interface ResetPasswordParams {
  account: string
  code: string
  newPassword: string
}

// 微信登录接口
export interface WechatLoginParams {
  code: string
  state?: string
}

export function loginApi(params: LoginParams) {
  return http<{ token:string }>(
    'user/login',
    params.type === 'pwd' ? encryptPasswordFields(params, ['password']) : params,
    null,
    'post'
  )
}

export function registerApi(params: RegisterParams) {
  return http<{ token:string }>('user/register', encryptPasswordFields(params, ['password']), null, 'post')
}

export function sendCode(params: SendCodeParams) {
  return http<boolean>('user/sendCode', null, params, 'get')
}

export function resetPasswordApi(params: ResetPasswordParams) {
  return http<boolean>('user/resetPassword', encryptPasswordFields(params, ['newPassword']), null, 'post')
}

export function wechatLogin(params: WechatLoginParams) {
  return http<User>('user/wechatLogin', params, null, 'post')
}

export function refreshToken() {
  return http<{ token: string }>('user/refreshToken', null, null, 'post')
}

// 获取用户信息
export function getUserInfo() {
  return http<User>('user/userInfo', null, null, 'get')
}

// 设置密码
export function setPassword(data) {
  return http(
    'user/setPassword',
    encryptPasswordFields(data, ['newPwd', 'oldPwd', 'confirmPwd', 'newPassword', 'oldPassword', 'confirmPassword']),
    null,
    'post'
  )
}

// 修改邮箱
export function changeEmailApi(data) {
  return http('user/changeEmail', encryptPasswordFields(data, ['pwd']), null, 'post')
}

// 修改手机号
export function changePhoneApi(data) {
  return http('user/changePhone', encryptPasswordFields(data, ['pwd']), null, 'post')
}

// 修改用户信息
export function updateUserInfoApi(data) {
  return http('user/updateUserInfo', data, null, 'post')
}
