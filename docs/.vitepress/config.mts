import { defineConfig } from 'vitepress'

import { mermaidFencePlugin } from './markdown/mermaid-fence'

export default defineConfig({
  lang: 'zh-CN',
  title: 'Kubernetes',
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

        function hslToRgb(hueValue, saturationPercent, lightnessPercent) {
          var saturationValue = saturationPercent / 100
          var lightnessValue = lightnessPercent / 100
          var chroma = (1 - Math.abs(2 * lightnessValue - 1)) * saturationValue
          var intermediate = chroma * (1 - Math.abs(((hueValue / 60) % 2) - 1))
          var offset = lightnessValue - chroma / 2
          var redValue = 0
          var greenValue = 0
          var blueValue = 0
          if (hueValue < 60) { redValue = chroma; greenValue = intermediate }
          else if (hueValue < 120) { redValue = intermediate; greenValue = chroma }
          else if (hueValue < 180) { greenValue = chroma; blueValue = intermediate }
          else if (hueValue < 240) { greenValue = intermediate; blueValue = chroma }
          else if (hueValue < 300) { redValue = intermediate; blueValue = chroma }
          else { redValue = chroma; blueValue = intermediate }
          return [redValue + offset, greenValue + offset, blueValue + offset]
        }

        function relativeLuminance(rgb) {
          function linearize(channel) {
            return channel <= 0.04045
              ? channel / 12.92
              : Math.pow((channel + 0.055) / 1.055, 2.4)
          }
          return 0.2126 * linearize(rgb[0]) + 0.7152 * linearize(rgb[1]) + 0.0722 * linearize(rgb[2])
        }

        function contrastRatio(first, second) {
          var firstLuminance = relativeLuminance(first)
          var secondLuminance = relativeLuminance(second)
          return (Math.max(firstLuminance, secondLuminance) + 0.05) / (Math.min(firstLuminance, secondLuminance) + 0.05)
        }

        function findTextLightness(initialLightness, direction, background) {
          var textLightness = initialLightness
          while (contrastRatio(hslToRgb(hueDegrees, saturation, textLightness), background) < 4.5 && textLightness > 0 && textLightness < 100) {
            textLightness += direction
          }
          return textLightness
        }

        var lightTextLightness = findTextLightness(36, -1, [1, 1, 1])
        var darkTextLightness = findTextLightness(68, 1, [34 / 255, 40 / 255, 46 / 255])
        var buttonLightness = lightTextLightness
        var buttonHoverLightness = Math.max(0, buttonLightness - 4)
        var buttonActiveLightness = Math.max(0, buttonLightness - 8)
        root.style.setProperty('--k8s-accent', 'hsl(' + hueDegrees + ' ' + saturation + '% 36%)')
        root.style.setProperty('--k8s-accent-dark', 'hsl(' + hueDegrees + ' ' + saturation + '% 68%)')
        root.style.setProperty('--k8s-accent-text', 'hsl(' + hueDegrees + ' ' + saturation + '% ' + lightTextLightness + '%)')
        root.style.setProperty('--k8s-accent-text-dark', 'hsl(' + hueDegrees + ' ' + saturation + '% ' + darkTextLightness + '%)')
        root.style.setProperty('--k8s-accent-button', 'hsl(' + hueDegrees + ' ' + saturation + '% ' + buttonLightness + '%)')
        root.style.setProperty('--k8s-accent-button-hover', 'hsl(' + hueDegrees + ' ' + saturation + '% ' + buttonHoverLightness + '%)')
        root.style.setProperty('--k8s-accent-button-active', 'hsl(' + hueDegrees + ' ' + saturation + '% ' + buttonActiveLightness + '%)')

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
    logo: '/kubernetes-logo.svg',
    logoLink: '/',
    siteTitle: 'Kubernetes',
    nav: [
      { text: '概念', link: '/concepts/resource-model' },
      { text: '运行实践', link: '/operations/health-lifecycle' },
      { text: '速查', link: '/reference/concept-map' },
    ],
    sidebar: [
      {
        text: '开始',
        items: [
          { text: '概念总览', link: '/' },
          { text: '发布与调谐之旅', link: '/guide/deployment-flow' },
        ],
      },
      {
        text: '核心概念',
        items: [
          { text: '资源对象与元数据', link: '/concepts/resource-model' },
          { text: '集群与节点', link: '/concepts/cluster-nodes' },
          { text: '工作负载', link: '/concepts/workloads' },
          { text: '网络与流量', link: '/concepts/networking' },
          { text: '配置与存储', link: '/concepts/config-storage' },
          { text: '身份与安全', link: '/concepts/security' },
          { text: '调度与资源', link: '/concepts/scheduling-resources' },
        ],
      },
      {
        text: '运行实践',
        items: [
          { text: '健康检查与生命周期', link: '/operations/health-lifecycle' },
          { text: '发布与扩缩容', link: '/operations/release-scaling' },
          { text: '系统化排障', link: '/operations/troubleshooting' },
        ],
      },
      {
        text: '速查',
        items: [
          { text: '概念关系速查', link: '/reference/concept-map' },
        ],
      },
    ],
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
