import { defineConfig } from 'vitepress'

import { mermaidFencePlugin } from './markdown/mermaid-fence'

export default defineConfig({
  lang: 'zh-CN',
  title: 'K8s 概念手册',
  description: '用关系与场景串联 Kubernetes 核心概念。',
  appearance: false,
  srcExclude: ['superpowers/**'],
  head: [
    [
      'script',
      {},
      `;(function () {
        var root = document.documentElement
        var defaultColor = '#28755D'
        var color = defaultColor
        var mode = 'auto'
        try {
          var savedColor = localStorage.getItem('k8s-theme-color')
          if (/^#[0-9a-f]{6}$/i.test(savedColor || '')) color = savedColor.toUpperCase()
          var savedMode = localStorage.getItem('k8s-theme-mode')
          if (savedMode === 'auto' || savedMode === 'light' || savedMode === 'dark') mode = savedMode
        } catch (_) {}

        var red = parseInt(color.slice(1, 3), 16) / 255
        var green = parseInt(color.slice(3, 5), 16) / 255
        var blue = parseInt(color.slice(5, 7), 16) / 255
        var maximum = Math.max(red, green, blue)
        var minimum = Math.min(red, green, blue)
        var delta = maximum - minimum
        var lightness = (maximum + minimum) / 2
        var hue = 0
        if (delta !== 0) {
          if (maximum === red) hue = ((green - blue) / delta + 6) % 6
          else if (maximum === green) hue = (blue - red) / delta + 2
          else hue = (red - green) / delta + 4
        }
        var rawSaturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1))
        var saturation = Math.min(72, Math.max(34, Math.round(rawSaturation * 100)))
        var hueDegrees = Math.floor(hue * 60)
        root.style.setProperty('--k8s-accent', 'hsl(' + hueDegrees + ' ' + saturation + '% 36%)')
        root.style.setProperty('--k8s-accent-dark', 'hsl(' + hueDegrees + ' ' + saturation + '% 68%)')

        var systemDark = false
        if (mode === 'auto') {
          try {
            systemDark = typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
          } catch (_) {}
        }
        root.classList.toggle('dark', mode === 'dark' || (mode === 'auto' && systemDark))
      })()`,
    ],
  ],
  markdown: {
    config(markdown) {
      markdown.use(mermaidFencePlugin)
    },
  },
  themeConfig: {
    search: {
      provider: 'local',
    },
    outline: {
      level: [2, 3],
    },
    docFooter: {
      prev: '上一篇',
      next: '下一篇',
    },
  },
})
