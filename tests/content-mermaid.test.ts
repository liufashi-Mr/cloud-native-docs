// @vitest-environment jsdom

import mermaid from 'mermaid'
import { beforeAll, describe, expect, it } from 'vitest'

import { markdownFences, readPublicMarkdownFences } from './support/markdown'

function mermaidFences(markdown: string): string[] {
  return markdownFences(markdown)
    .filter((fence) => fence.language === 'mermaid')
    .map((fence) => fence.content)
}

describe('documentation Mermaid diagrams', () => {
  beforeAll(() => {
    mermaid.initialize({
      securityLevel: 'strict',
      startOnLoad: false,
    })
  })

  it('parses every Mermaid fence in public content', async () => {
    const diagrams = readPublicMarkdownFences().filter(
      (fence) => fence.language === 'mermaid',
    )
    let parsedDiagrams = 0

    for (const diagram of diagrams) {
      try {
        await mermaid.parse(diagram.content)
        parsedDiagrams += 1
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(`${diagram.location}: ${message}`)
      }
    }

    expect(parsedDiagrams).toBeGreaterThan(0)
  })

  it('recognizes longer fences and trailing info like VitePress', () => {
    const markdown = [
      '````mermaid title="request path"',
      'flowchart LR',
      '  A -->|calls| B',
      '````',
    ].join('\n')

    expect(mermaidFences(markdown)).toEqual([
      'flowchart LR\n  A -->|calls| B',
    ])
  })
})
