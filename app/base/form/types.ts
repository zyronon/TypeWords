// Form 组件的 TypeScript 类型定义

export interface FormType {
  validate: (cb: (vaild: boolean) => void) => void
}

export interface Field {
  prop: string
  modelValue: any
  validate: (rules: any[]) => boolean
}

// 表单字段接口
export interface FormField {
  prop: string
  modelValue: any
  validate: (rules: FormRule[]) => boolean
}

// 表单规则接口
export interface FormRule {
  required?: boolean
  message?: string
  pattern?: RegExp
  validator?: (rule: FormRule, value: any, callback: (error?: Error) => void) => void
  min?: number
  max?: number
  len?: number
  type?: string
}

// 表单规则对象类型
export type FormRules = Record<string, FormRule[]>

// 表单模型对象类型
export type FormModel = Record<string, any>

// Form 组件的 Props 接口
export interface FormProps {
  model?: FormModel
  rules?: FormRules
}

// Form 组件的实例接口
export interface FormInstance {
  /**
   * 校验整个表单
   * @param callback 校验完成后的回调函数，接收校验结果
   */
  validate: (callback: (valid: boolean) => void) => void

  /**
   * 校验指定字段
   * @param fieldName 要校验的字段名称
   * @param callback 可选的回调函数，接收校验结果
   * @returns 校验是否通过
   */
  validateField: (fieldName: string, callback?: (valid: boolean) => void) => boolean
}

// 注入的上下文类型
export interface FormContext {
  registerField: (field: FormField) => void
  formModel: FormModel
  formValidate: (callback: (valid: boolean) => void) => void
  formRules: FormRules
}

// 验证状态枚举
export enum ValidateStatus {
  Success = 'success',
  Error = 'error',
  Validating = 'validating',
  Pending = 'pending',
}
