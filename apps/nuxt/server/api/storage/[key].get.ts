export default defineEventHandler(async (event) => {
  const key = getRouterParam(event, 'key')
  if (!key) {
    throw createError({ statusCode: 400, message: 'Missing key' })
  }
  const storage = useStorage('localdata')
  const data = await storage.getItem<string>(key)
  return { success: true, data: data ?? null }
})
