// @vitest-environment node

import { resolve } from 'node:path'
import { createMarkdownRenderer } from 'vitepress'
import { describe, expect, it } from 'vitest'

import { mermaidFencePlugin } from '../docs/.vitepress/markdown/mermaid-fence'

describe('Mermaid fence transformer', () => {
  it('creates a safe MermaidDiagram invocation', async () => {
    const markdown = await createMarkdownRenderer(resolve(import.meta.dirname, '..'))
    const source = 'flowchart LR\n  A["<script>alert(1)</script>"] --> B'

    markdown.use(mermaidFencePlugin)
    const html = markdown.render(`\`\`\`mermaid\n${source}\n\`\`\``)

    expect(html).toContain('<MermaidDiagram')
    expect(html).toContain(
      `encoded-source="${encodeURIComponent(`${source}\n`)}"`,
    )
    expect(html).not.toContain('<script>')
  })

  it('leaves differently-cased fence languages as ordinary code', async () => {
    const markdown = await createMarkdownRenderer(resolve(import.meta.dirname, '..'))
    markdown.use(mermaidFencePlugin)

    const html = markdown.render('```Mermaid\nflowchart LR\n  A --> B\n```')

    expect(html).not.toContain('<MermaidDiagram')
    expect(html).toContain('<div class="language-Mermaid')
  })
})
