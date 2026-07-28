import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { markdownFences } from './support/markdown'

const root = resolve(import.meta.dirname, '..')
const initialPages = [
  'docs/linux/index.md',
  'docs/linux/guide/shell-practical-basics.md',
  'docs/linux/guide/run-demo-api.md',
]

describe('Linux runnable examples', () => {
  it.each(initialPages)('keeps Bash fences syntactically valid in %s', (file) => {
    const source = readFileSync(resolve(root, file), 'utf8')
    for (const fence of markdownFences(source, file).filter(
      ({ language }) => language === 'bash',
    )) {
      const result = spawnSync('bash', ['-n'], {
        encoding: 'utf8',
        input: fence.content,
      })
      expect(result.status, `${fence.location}: ${result.stderr}`).toBe(0)
    }
  })

  it('keeps the host demo identity aligned with Docker / OCI', () => {
    const source = readFileSync(
      resolve(root, 'docs/linux/guide/run-demo-api.md'),
      'utf8',
    )
    expect(source).toContain('demo-api')
    expect(source).toContain('3000')
    expect(source).toContain('/healthz')
    expect(source).toContain("request.url === '/healthz'")
  })
})
