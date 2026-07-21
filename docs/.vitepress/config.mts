import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

export default withMermaid(
  defineConfig({
    lang: 'zh-CN',
    title: 'K8s 概念手册',
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
  }),
)
