import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { kubernetesRouteManifest } from './support/kubernetes-routes'

const root = resolve(import.meta.dirname, '..')
const docsRoot = resolve(root, 'docs')
const kubernetesFiles = kubernetesRouteManifest.map(
  (route) => `docs/kubernetes/${route}.md`,
)

function sourceMarkdownRoutes(): string[] {
  return readdirSync(resolve(docsRoot, 'kubernetes'), {
    encoding: 'utf8',
    recursive: true,
  })
    .filter((file) => file.endsWith('.md'))
    .map((file) => file.replace(/\.md$/, ''))
    .sort()
}

describe('Kubernetes topic routing', () => {
  it.each(kubernetesFiles)('%s exists under the Kubernetes topic', (file) => {
    expect(existsSync(resolve(root, file))).toBe(true)
  })

  it('contains exactly the Kubernetes Markdown route inventory', () => {
    expect(sourceMarkdownRoutes()).toEqual([...kubernetesRouteManifest].sort())
  })

  it.each(['guide', 'concepts', 'operations', 'reference'])(
    'does not leave a legacy docs/%s directory',
    (directory) => {
      expect(existsSync(resolve(docsRoot, directory))).toBe(false)
    },
  )

  it.each(kubernetesFiles)('does not retain legacy root links in %s', (file) => {
    const source = readFileSync(resolve(root, file), 'utf8')

    expect(source).not.toMatch(/\]\(\/(?:concepts|guide|operations|reference)(?:\/|\))/)
    expect(source).not.toMatch(/\]\(\/\)/)
  })

  it('links the Kubernetes reading path with an absolute topic route', () => {
    const source = readFileSync(resolve(docsRoot, 'kubernetes/index.md'), 'utf8')

    expect(source).toContain('[发布与调谐之旅](/kubernetes/guide/deployment-flow)')
  })

  it('scopes the sidebar and all representative links to Kubernetes', () => {
    const config = readFileSync(resolve(docsRoot, '.vitepress/config.mts'), 'utf8')

    expect(config).toContain("'/kubernetes/': [")
    expect(config).toContain("link: '/kubernetes/'")
    expect(config).toContain("link: '/kubernetes/concepts/resource-model'")
    expect(config).toContain("link: '/kubernetes/operations/troubleshooting'")
    expect(config).toContain("link: '/kubernetes/reference/concept-map'")
  })
})
