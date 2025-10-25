import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import VueJsx from "@vitejs/plugin-vue-jsx";
import { resolve } from 'path'
import { visualizer } from "rollup-plugin-visualizer";
import SlidePlugin from './src/components/slide/data.js';
import { getLastCommit } from "git-last-commit";
import UnoCSS from 'unocss/vite'
import VueMacros from 'unplugin-vue-macros/vite'
import Icons from 'unplugin-icons/vite'
import Components from 'unplugin-vue-components/vite'
import IconsResolver from 'unplugin-icons/resolver'
import { viteExternalsPlugin } from 'vite-plugin-externals'

function pathResolve(dir: string) {
  return resolve(__dirname, ".", dir)
}

const lifecycle = process.env.npm_lifecycle_event;
let isCdnBuild = ['build', 'report'].includes(lifecycle)

// https://vitejs.dev/config/
export default defineConfig(() => {
  return new Promise(resolve => {
    let latestCommitHash = ''
    getLastCommit((err, commit) => {
      if (!err) latestCommitHash = commit.shortHash
      resolve({
        plugins: [
          Icons({
            //自动安装@iconify-json/xx
            autoInstall: true,
            compiler: 'vue3',
          }),
          Components({
            resolvers: [
              // 自动解析 <IconMdiHome /> 这种组件名
              IconsResolver({
                prefix: 'Icon', // 默认前缀
              }),
            ],
          }),
          VueMacros({
            plugins: {
              vue: Vue(),
              vueJsx: VueJsx(), // 如果需要
            },
          }),
          UnoCSS(),
          lifecycle === 'report' ?
            visualizer({
              gzipSize: true,
              brotliSize: true,
              emitFile: false,
              filename: "report.html", //分析图生成的文件名
              open: true //如果存在本地服务端口，将在打包后自动展示
            }) : null,
          SlidePlugin(),
          isCdnBuild ? [
            //这里不要用vite-plugin-cdn-import，他里面使用了rollup-plugin-external-globals插件，会导致自动加载components.d.ts里面的组件全部没引入，也不报错
            {
              name: 'inject-cdn-head',
              enforce: 'pre',
              transformIndexHtml(html) {
                const scripts = `
<!-- Vue 3 (生产版) -->
<script src="https://cdn.jsdelivr.net/npm/vue@3/dist/vue.global.prod.min.js" crossorigin="anonymous"></script>

<!-- Vue Router 4 (生产版) -->
<script src="https://cdn.jsdelivr.net/npm/vue-router@4/dist/vue-router.global.prod.min.js" crossorigin="anonymous"></script>

<!-- Axios (最新稳定版) -->
<script src="https://cdn.jsdelivr.net/npm/axios@1/dist/axios.min.js" crossorigin="anonymous"></script>
`
                return html.replace('<head>', `<head>${scripts}`)
              },
            },
            viteExternalsPlugin({
              vue: 'Vue',
              'vue-router': 'VueRouter',
              axios: 'axios',
            })
          ] : null,
        ],
        build: {
          rollupOptions: {
            // 因为已经把包复制过来了，里面的axios实例用的项目的，所以这行代码可以不要了
            // external: isCdnBuild ? ['axios'] : [],// 使用全局的 axios。因为百度翻译库内部用了0.19版本的axios，会被打包到代码里面
            output: {
              manualChunks(id) {
                if (id.includes('node_modules/@iconify') || id.includes('~icons')) {
                  return 'icons';
                }
                if (id.includes('utils')
                  || id.includes('hooks')
                  // || id.includes('types')
                  // || id.includes('libs')
                ) {
                  return 'utils'
                }
                if (!isCdnBuild) return
                //不知为何不引入cdn之后，这里分包会报错
                if (id.includes('dialog')) {
                  return 'dialog'
                }
              }
            }
          }
        },
        define: {
          LATEST_COMMIT_HASH: JSON.stringify(latestCommitHash + (process.env.NODE_ENV === 'production' ? '' : ' (dev)')),
        },
        //默认是'',导致只能在一级域名下使用。
        base: '/',
        resolve: {
          alias: {
            "@": pathResolve("src"),
          },
          extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue']
        },
        css: {
          preprocessorOptions: {
            scss: {
              //解决 sass 控制台出现 Deprecation Warning: The legacy JS API is deprecated and will be removed in Dart Sass 2.0.0 的问题
              api: "modern-compiler" // or 'modern'
            }
          }
        },
        server: {
          port: 3000,
          open: false,
          host: '0.0.0.0',
          fs: {
            strict: false,
          },
          proxy: {
            '/baidu': 'https://api.fanyi.baidu.com/api/trans/vip/translate'
          }
        }
      })
    })
  })
})
