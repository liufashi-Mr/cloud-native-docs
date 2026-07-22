// @vitest-environment jsdom

import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import mermaid from 'mermaid'
import { beforeAll, describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..')
const docsRoot = resolve(root, 'docs')

function publicMarkdownFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith('.') || entry.name === 'superpowers') return []
    const absolutePath = resolve(directory, entry.name)
    if (entry.isDirectory()) return publicMarkdownFiles(absolutePath)
    return entry.name.endsWith('.md') ? [absolutePath] : []
  })
}

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

  it('parses every Mermaid fence in public content', async () => {
    const markdownFiles = publicMarkdownFiles(docsRoot)
    let parsedDiagrams = 0

    for (const file of markdownFiles) {
      const markdown = readFileSync(file, 'utf8')
      for (const [index, diagram] of mermaidFences(markdown).entries()) {
        try {
          await mermaid.parse(diagram)
          parsedDiagrams += 1
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          throw new Error(`${file} Mermaid fence ${index + 1}: ${message}`)
        }
      }
    }

    expect(parsedDiagrams).toBeGreaterThan(0)
  })
})
