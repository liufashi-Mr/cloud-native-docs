// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import mermaid from 'mermaid'
import { beforeAll, describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..')
const diagramFiles = [
  'docs/index.md',
  'docs/guide/deployment-flow.md',
]

function mermaidFences(markdown: string): string[] {
  return Array.from(
    markdown.matchAll(/^```mermaid\s*\n([\s\S]*?)^```\s*$/gm),
    (match) => match[1].trim(),
  )
}

describe('documentation Mermaid diagrams', () => {
  beforeAll(() => {
    mermaid.initialize({
      securityLevel: 'strict',
      startOnLoad: false,
    })
  })

  it.each(diagramFiles)('%s contains only parseable Mermaid fences', async (file) => {
    const markdown = readFileSync(resolve(root, file), 'utf8')
    const diagrams = mermaidFences(markdown)

    expect(diagrams.length, `${file} has no Mermaid fences`).toBeGreaterThan(0)

    for (const [index, diagram] of diagrams.entries()) {
      try {
        await mermaid.parse(diagram)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(`${file} Mermaid fence ${index + 1}: ${message}`)
      }
    }
  })
})
