import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import MarkdownIt from 'markdown-it'

const markdown = new MarkdownIt()
const docsRoot = resolve(import.meta.dirname, '..', '..', 'docs')

export interface MarkdownFence {
  content: string
  file: string
  info: string
  language: string
  line: number
  location: string
}

export function publicMarkdownFiles(directory = docsRoot): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      if (entry.name.startsWith('.') || entry.name === 'superpowers') return []
      const absolutePath = resolve(directory, entry.name)
      if (entry.isDirectory()) return publicMarkdownFiles(absolutePath)
      return entry.name.endsWith('.md') ? [absolutePath] : []
    })
    .sort()
}

export function markdownFences(
  source: string,
  file = '<inline>',
): MarkdownFence[] {
  return markdown.parse(source, {}).flatMap((token) => {
    if (token.type !== 'fence') return []

    const info = token.info.trim()
    const language = info.split(/\s+/, 1)[0]?.toLowerCase() ?? ''
    const line = (token.map?.[0] ?? 0) + 1
    return [{
      content: token.content.trim(),
      file,
      info,
      language,
      line,
      location: `${file}:${line}`,
    }]
  })
}

export function readPublicMarkdownFences(): MarkdownFence[] {
  return publicMarkdownFiles().flatMap((file) =>
    markdownFences(readFileSync(file, 'utf8'), file),
  )
}
