const { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } = require('fs')
const { join, resolve } = require('path')

const distDir = resolve(process.env.TYPEWORDS_DIST_DIR || resolve(__dirname, '.output/public'))
const indexableRobotsPattern = /<meta\s+name=["']robots["']\s+content=["'][^"']*["']\s*\/?>/i
const noIndexMeta = '<meta name="robots" content="noindex, nofollow, noarchive">'

function collectHtmlFiles(directory) {
  return readdirSync(directory).flatMap(name => {
    const path = join(directory, name)
    return statSync(path).isDirectory() ? collectHtmlFiles(path) : path.endsWith('.html') ? [path] : []
  })
}

for (const htmlFile of collectHtmlFiles(distDir)) {
  const html = readFileSync(htmlFile, 'utf8')
  const nextHtml = indexableRobotsPattern.test(html)
    ? html.replace(indexableRobotsPattern, noIndexMeta)
    : html.replace('</head>', `${noIndexMeta}</head>`)

  writeFileSync(htmlFile, nextHtml)
}

writeFileSync(join(distDir, 'robots.txt'), 'User-agent: *\nDisallow: /\n')

const sitemapPath = join(distDir, 'sitemap.xml')
if (existsSync(sitemapPath)) rmSync(sitemapPath)

console.log('✅ 开发站已写入 noindex，并移除 sitemap')
