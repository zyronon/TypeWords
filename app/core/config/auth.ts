// 微信登录配置
export const WECHAT_CONFIG = {
  // 微信开放平台AppID（需要在微信开放平台申请）
  appId: 'your_wechat_app_id',

  // 微信授权回调地址
  // redirectUri: `${window.location.origin}/wechat/callback`,
  redirectUri: `/wechat/callback`,

  // 授权作用域
  scope: 'snsapi_userinfo',

  // 授权状态参数
  state: 'wechat_login'
}

// 获取微信授权URL
export function getWechatAuthUrl(state?: string): string {
  const {appId, redirectUri, scope} = WECHAT_CONFIG
  const authState = state || Math.random().toString(36).substr(2, 15)

  return `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&state=${authState}#wechat_redirect`
}

// 手机号验证配置
export const PHONE_CONFIG = {
  // 验证码长度
  codeLength: 6,

  // 验证码发送间隔（秒）
  sendInterval: 60,

  // 手机号正则表达式（中国大陆）
  phoneRegex: /^1[2-9]\d{9}$/
}

// 邮箱配置
export const EMAIL_CONFIG = {
  // 邮箱正则表达式
  emailRegex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,

  // 邮箱验证码长度
  codeLength: 6
}

// 密码配置
export const PASSWORD_CONFIG = {
  // 密码最小长度
  minLength: 9,

  // 密码最大长度
  maxLength: 20
}
