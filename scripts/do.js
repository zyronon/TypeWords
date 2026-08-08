const { SitemapStream } = require('sitemap')
const { createWriteStream } = require('fs')
const { mkdir } = require('fs/promises')
const { resolve } = require('path')
const { pipeline } = require('stream/promises')

async function generateSitemap() {
  const SITE_URL = (process.env.ORIGIN || 'https://typewords.cc').replace(/\/$/, '')
  const distDir = resolve(process.env.TYPEWORDS_DIST_DIR || resolve(__dirname, '.output/public'))

  // 只提交可索引、有独立内容且使用自引用 canonical 的页面。
  const pages = [
    { url: '/', changefreq: 'daily', priority: 1.0 },
    { url: '/words', changefreq: 'daily', priority: 0.9 },
    { url: '/articles', changefreq: 'daily', priority: 0.9 },
    { url: '/nce', changefreq: 'weekly', priority: 0.7 },
    { url: '/doc', changefreq: 'weekly', priority: 0.3 },
    { url: '/help', changefreq: 'monthly', priority: 0.5 },
    { url: '/about', changefreq: 'monthly', priority: 0.5 },
    { url: '/releases', changefreq: 'weekly', priority: 0.4 },
  ]

  const uniquePages = [...new Map(pages.map(page => [page.url, page])).values()]
  await mkdir(distDir, { recursive: true })

  const sitemap = new SitemapStream({ hostname: SITE_URL })
  const writeStream = createWriteStream(resolve(distDir, 'sitemap.xml'))
  const writeCompleted = pipeline(sitemap, writeStream)

  uniquePages.forEach(page => sitemap.write(page))

  sitemap.end()

  await writeCompleted
  console.log(`✅ sitemap.xml 已生成在 ${distDir}`)
}

generateSitemap().catch(error => {
  console.error('❌ sitemap.xml 生成失败', error)
  process.exitCode = 1
})
