// uno.config.ts
import { defineConfig, presetWind3, transformerDirectives } from 'unocss'

export default defineConfig({
  transformers: [transformerDirectives()],
  shortcuts: {
    'bg-primary': 'bg-[var(--color-primary)]',
    'bg-primary2': 'bg-[var(--color-primary2)]',
    'bg-second': 'bg-[var(--color-second)]',
    'bg-third': 'bg-[var(--color-third)]',
    'bg-fourth': 'bg-[var(--color-fourth)]',
    'bg-fifth': 'bg-[var(--color-fifth)]',
    'bg-card-active': 'bg-[var(--color-card-active)]',
    'bg-item': 'bg-[var(--color-item-bg)]',
    'bg-reverse-white': 'bg-[var(--color-reverse-white)]',
    'bg-reverse-black': 'bg-[var(--color-reverse-black)]',
    'color-main': 'color-[var(--color-main-text)]',
    'color-link': 'color-[var(--color-link)]',
    'color-reverse-white': 'color-[var(--color-reverse-white)]',
    'color-reverse-black': 'color-[var(--color-reverse-black)]',
    'gap-space': 'gap-[var(--space)]',
    'p-space': 'p-[var(--space)]',
    'px-space': 'px-[var(--space)]',
    'py-space': 'py-[var(--space)]',
    'border-item': 'border-[var(--color-item-border)]',
    'border-item-solid': 'border-1 border-solid border-[var(--color-item-border)]',
    card: 'rounded-xl p-4 mb-8 shadow-lg box-border relative bg-second',
    'color-translate-main': 'color-[var(--color-translate-main)]',
    'color-translate-second': 'color-[var(--color-translate-second)]',
    'en-article-family': 'font-[var(--en-article-family)]',
    'cn-article-family': 'font-[var(--zh-article-family)]',
    'cp': 'cursor-pointer',
  },
  presets: [presetWind3()],
  // 自定义断点
  theme: {
    breakpoints: {
      xs: '480px', // 自定义小断点
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
      '3xl': '1920px',
      '4k': '2560px',
    },
  },
})
