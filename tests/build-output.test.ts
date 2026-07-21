import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..')
const dist = resolve(root, 'docs/.vitepress/dist')

beforeAll(() => {
  rmSync(dist, { force: true, recursive: true })
  execFileSync(
    process.execPath,
    [resolve(root, 'node_modules/vitepress/bin/vitepress.js'), 'build', 'docs'],
    { cwd: root, stdio: 'pipe' },
  )
}, 30_000)

describe('production build', () => {
  it('does not publish internal superpowers pages', () => {
    expect(existsSync(resolve(dist, 'superpowers'))).toBe(false)
  })

  it('does not preload Mermaid on the diagram-free home page', () => {
    const home = readFileSync(resolve(dist, 'index.html'), 'utf8')

    expect(home).not.toMatch(/(?:href|src)="[^"]*mermaid[^"]*"/i)
  })

  it('includes Mermaid as a lazy build asset', () => {
    const assets = readdirSync(resolve(dist, 'assets'), {
      encoding: 'utf8',
      recursive: true,
    })

    expect(assets.some((asset) => /mermaid/i.test(asset))).toBe(true)
  })
})
