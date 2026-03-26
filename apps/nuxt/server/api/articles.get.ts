import { readFileSync } from 'fs'
import { resolve } from 'path'

export default defineEventHandler(async () => {
  try {
    return await $fetch('https://typewords.cc/list/article.json')
  } catch {
    const path = resolve(process.cwd(), 'public/list/article.json')
    return JSON.parse(readFileSync(path, 'utf-8'))
  }
})
