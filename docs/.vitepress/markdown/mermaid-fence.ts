import type { MarkdownRenderer } from 'vitepress'

import { fenceLanguage } from './fence-info'

export function mermaidFencePlugin(markdown: MarkdownRenderer): void {
  const defaultFence = markdown.renderer.rules.fence

  markdown.renderer.rules.fence = (tokens, index, options, env, renderer) => {
    const token = tokens[index]
    const language = fenceLanguage(token.info)

    if (language !== 'mermaid') {
      return defaultFence
        ? defaultFence(tokens, index, options, env, renderer)
        : renderer.renderToken(tokens, index, options)
    }

    const encodedSource = encodeURIComponent(token.content)
    return `<MermaidDiagram encoded-source="${encodedSource}" />\n`
  }
}
