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
  it('publishes the root workbench and every Kubernetes topic page without legacy routes', () => {
    for (const page of [
      'index.html',
      'kubernetes/index.html',
      'kubernetes/guide/deployment-flow.html',
      'kubernetes/concepts/resource-model.html',
      'kubernetes/concepts/cluster-nodes.html',
      'kubernetes/concepts/workloads.html',
      'kubernetes/concepts/networking.html',
      'kubernetes/concepts/config-storage.html',
      'kubernetes/concepts/security.html',
      'kubernetes/concepts/scheduling-resources.html',
      'kubernetes/operations/health-lifecycle.html',
      'kubernetes/operations/release-scaling.html',
      'kubernetes/operations/troubleshooting.html',
      'kubernetes/reference/concept-map.html',
    ]) {
      expect(existsSync(resolve(dist, page)), `${page} must be published`).toBe(true)
    }

    for (const directory of ['guide', 'concepts', 'operations', 'reference']) {
      expect(existsSync(resolve(dist, directory))).toBe(false)
    }

    const home = readFileSync(resolve(dist, 'index.html'), 'utf8')
    const kubernetesHome = readFileSync(resolve(dist, 'kubernetes/index.html'), 'utf8')
    expect(home).toContain('应用开发者的云原生技术工作台')
    expect(home).toContain('href="/kubernetes/"')
    expect(home).toContain('Kubernetes')
    expect(kubernetesHome).toContain('Kubernetes 概念总览')
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
