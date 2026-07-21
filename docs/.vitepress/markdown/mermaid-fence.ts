import type { MarkdownRenderer } from 'vitepress'

export function mermaidFencePlugin(markdown: MarkdownRenderer): void {
  const defaultFence = markdown.renderer.rules.fence

  markdown.renderer.rules.fence = (tokens, index, options, env, renderer) => {
    const token = tokens[index]
    const language = token.info.trim().split(/\s+/, 1)[0]

    if (language !== 'mermaid') {
      return defaultFence
        ? defaultFence(tokens, index, options, env, renderer)
        : renderer.renderToken(tokens, index, options)
    }

    const encodedSource = encodeURIComponent(token.content)
    return `<MermaidDiagram encoded-source="${encodedSource}" />\n`
  }
}
