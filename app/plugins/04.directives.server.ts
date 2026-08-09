export default defineNuxtPlugin(nuxtApp => {
  nuxtApp.vueApp.directive('opacity', (el: HTMLElement, binding: any) => {})
  nuxtApp.vueApp.directive('loading', {})
})
