import { readFileSync } from 'fs'
import { resolve } from 'path'

export default defineEventHandler(() => {
    return $fetch('https://typewords.cc/list/article.json')
    // 模拟后端接口返回 JSON 数据
    const path = resolve(process.cwd(), 'public/list/article.json')
    const data = JSON.parse(readFileSync(path, 'utf-8'))
    return data
})
