export default defineEventHandler(async (event) => {
  const key = getRouterParam(event, 'key')
  if (!key) {
    throw createError({ statusCode: 400, message: 'Missing key' })
  }
  const body = await readBody<{ data: string | null }>(event)
  const storage = useStorage('localdata')
  if (body.data === null || body.data === undefined) {
    await storage.removeItem(key)
  } else {
    await storage.setItem(key, body.data)
  }
  return { success: true }
})
