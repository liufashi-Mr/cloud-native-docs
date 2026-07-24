import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

import { kubernetesRouteManifest } from './support/kubernetes-routes'

const root = resolve(import.meta.dirname, '..')
const dist = resolve(root, 'docs/.vitepress/dist')

function builtKubernetesRoutes(): string[] {
  return readdirSync(resolve(dist, 'kubernetes'), {
    encoding: 'utf8',
    recursive: true,
  })
    .filter((file) => file.endsWith('.html'))
    .map((file) => file.replace(/\.html$/, ''))
    .sort()
}

beforeAll(() => {
  rmSync(dist, { force: true, recursive: true })
  execFileSync(
    process.execPath,
    [resolve(root, 'node_modules/vitepress/bin/vitepress.js'), 'build', 'docs'],
    { cwd: root, stdio: 'pipe' },
  )
}, 30_000)

describe('production build', () => {
  it('keeps the source logo within navigation asset bounds', () => {
    const logo = readFileSync(resolve(root, 'docs/public/logo.png'))

    expect(logo.subarray(12, 16).toString('ascii')).toBe('IHDR')
    expect(logo.readUInt32BE(16)).toBe(256)
    expect(logo.readUInt32BE(20)).toBe(256)
    expect([4, 6]).toContain(logo[25])
    expect(logo.byteLength).toBeLessThanOrEqual(200 * 1024)
  })

  it('publishes the root workbench and every Kubernetes topic page without legacy routes', () => {
    expect(existsSync(resolve(dist, 'index.html'))).toBe(true)
    expect(existsSync(resolve(dist, 'logo.png'))).toBe(true)
    for (const route of kubernetesRouteManifest) {
      const page = `kubernetes/${route}.html`
      expect(existsSync(resolve(dist, page)), `${page} must be published`).toBe(true)
    }

    for (const directory of ['guide', 'concepts', 'operations', 'reference']) {
      expect(existsSync(resolve(dist, directory))).toBe(false)
    }

    const home = readFileSync(resolve(dist, 'index.html'), 'utf8')
    const kubernetesHome = readFileSync(resolve(dist, 'kubernetes/index.html'), 'utf8')
    expect(home).toContain('应用开发者的云原生技术工作台')
    expect(home).toContain('云原生开发手册')
    expect(home).toContain('href="/kubernetes/"')
    expect(home).toContain('Kubernetes')
    expect(kubernetesHome).toContain('Kubernetes 概念总览')
  })

  it('publishes exactly the Kubernetes HTML route inventory', () => {
    expect(builtKubernetesRoutes()).toEqual([...kubernetesRouteManifest].sort())
  })

  it('does not publish internal superpowers pages', () => {
    expect(existsSync(resolve(dist, 'superpowers'))).toBe(false)
  })

  it('does not eagerly preload Mermaid', () => {
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
