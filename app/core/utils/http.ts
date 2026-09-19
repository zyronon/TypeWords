import axios from 'axios'
import type { AxiosInstance } from 'axios'
import { ENV } from '../config/env.ts'
import { Toast } from '@/base'

export const axiosInstance: AxiosInstance = axios.create({
  timeout: 15000,
})

axiosInstance.interceptors.request.use(
  config => {
    const runtime = useRuntimeConfig().public
    if (runtime.isDesktop) {
      // Static desktop builds have no Nitro proxy or implicit localhost API.
      let endpoint: URL | undefined
      try {
        endpoint = new URL(String(runtime.desktopApiBase || '').trim())
      } catch {}
      if (
        !endpoint ||
        endpoint.protocol !== 'https:' ||
        /^(localhost\.?|127(?:\.\d+){3}|\[::1\])$/i.test(endpoint.hostname) ||
        endpoint.username ||
        endpoint.password ||
        endpoint.search ||
        endpoint.hash
      ) {
        throw Object.assign(new Error('桌面在线查询 API 未配置有效的 HTTPS 服务，当前功能未启用'), {
          code: 'DESKTOP_API_UNAVAILABLE',
        })
      }
      config.baseURL = endpoint.href.replace(/\/?$/, '/')
    } else {
      config.baseURL = ENV.API
    }
    return config
  },
  error => Promise.reject(error)
)

axiosInstance.interceptors.response.use(
  // 响应正常的处理
  response => {
    // console.log(response.data)
    const { data } = response
    if (response.status !== 200) {
      Toast.warning(response.statusText)
      return Promise.reject(data)
    }
    if (data === null) {
      return Promise.resolve({
        code: 500,
        msg: '系统出现错误',
        data: {},
        success: false,
      })
    }
    if (typeof data !== 'object') {
      return Promise.resolve({
        data,
        success: true,
        code: 200,
      })
    }
    return Promise.resolve(data)
  },
  // 请求出错的处理
  error => {
    if (error.code === 'DESKTOP_API_UNAVAILABLE') {
      Toast.warning(error.message)
      return Promise.resolve({ code: 503, msg: error.message, data: null, success: false })
    }
    if (error.response === undefined && error.status === undefined) {
      return Promise.resolve({
        code: 500,
        msg: '服务器响应超时',
        data: null,
        success: false,
      })
    }
    if (error.response.status >= 500) {
      return Promise.resolve({
        code: 500,
        msg: '服务器出现错误',
        data: null,
        success: false,
      })
    }
    if (error.response.status === 401) {
      return Promise.resolve({
        code: 500,
        msg: '用户名或密码不正确',
        data: null,
      })
    }
    const { data } = error.response
    if (data.code !== undefined) {
      return Promise.resolve({
        code: data.code,
        msg: data.msg,
        success: false,
      })
    }
    return Promise.resolve({
      code: 500,
      success: false,
      msg: data.msg,
      data: null,
    })
  }
)

export type AxiosResponse<T> = { code: number; data: T; success: boolean; msg: string }

async function request<T>(url, data = {}, params = {}, method): Promise<AxiosResponse<T>> {
  return axiosInstance({
    url: url,
    method,
    data,
    params,
  })
}

export default request
