import http from '../utils/http'

export type LevelBenefits = {
  "level": {
    "id": number,
    "name": string,
    "code": string,
    "level": number,
    "price": string,
    "price_auto": string,
    "yearly_price": string,
    "description": string,
    "color": string,
    "icon": string,
    "is_active": number,
    "created_at": string,
    "updated_at": string
  },
  "benefits": {
    "code": string,
    "name": string,
    "type": boolean,
    "unit": null,
    "value": string
  }[]
}

export type CouponInfo = {
  "id": number,
  "code": string,
  "name": string,
  "type": string,
  "value"?: string,
  "min_amount"?: string,
  "max_discount"?: string,
  "applicable_levels": {
    code: string,
    name: string,
    level: string,
  }[]
  "usage_limit": number,
  "total_usage": number,
  "start_date": string
  "end_date": string
  "is_active": number,
  "created_at": string
  "updated_at": string
  "is_valid": boolean,
}

export function levelBenefits(params) {
  return http<LevelBenefits>('member/levelBenefits', null, params, 'get')
}

export function orderCreate(params) {
  return http<{ orderNo: string, result: string, }>('/member/orderCreate', params, null, 'post')
}

export function alipayQuery(params) {
  return http('/member/alipayQuery', null, params, 'get')
}

export function testPay() {
  return http('/member/testPay', null, null, 'get')
}

export function orderStatus(params) {
  return http('/member/orderStatus', null, params, 'get')
}

export function couponInfo(params) {
  return http<CouponInfo>('/member/couponInfo', null, params, 'get')
}

export function setAutoRenewApi(params) {
  return http('/member/setAutoRenew', params, null, 'post')
}
