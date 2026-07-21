import { defineConfig } from 'vitepress'

import { mermaidFencePlugin } from './markdown/mermaid-fence'

export default defineConfig({
  lang: 'zh-CN',
  title: 'K8s 概念手册',
  description: '用关系与场景串联 Kubernetes 核心概念。',
  srcExclude: ['superpowers/**'],
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
