import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import MarkdownIt from 'markdown-it'
import { describe, expect, it } from 'vitest'

import { dockerOciRouteManifest } from './support/docker-oci-routes'
import { kubernetesRouteManifest } from './support/kubernetes-routes'

const root = resolve(import.meta.dirname, '..')
const docsRoot = resolve(root, 'docs')
const markdownParser = new MarkdownIt()
const kubernetesFiles = kubernetesRouteManifest.map(
  (route) => `docs/kubernetes/${route}.md`,
)
const canonicalDocumentRoutes = new Set([
  ...kubernetesRouteManifest.map((route) => (
    route === 'index' ? '/kubernetes/' : `/kubernetes/${route}`
  )),
  ...dockerOciRouteManifest.map((route) => (
    route === 'index' ? '/docker-oci/' : `/docker-oci/${route}`
  )),
])

function sourceMarkdownRoutes(): string[] {
  return readdirSync(resolve(docsRoot, 'kubernetes'), {
    encoding: 'utf8',
    recursive: true,
  })
    .filter((file) => file.endsWith('.md'))
    .map((file) => file.replace(/\.md$/, ''))
    .sort()
}

function nonCanonicalDocumentDestinations(source: string): string[] {
  return markdownParser
    .parse(source, {})
    .flatMap((token) => token.children ?? [])
    .filter((token) => token.type === 'link_open')
    .map((token) => token.attrGet('href') ?? '')
    .filter((destination) => {
      const pathname = destination.split(/[?#]/, 1)[0]
      return (
        destination !== '' &&
        !destination.startsWith('#') &&
        !destination.startsWith('//') &&
        !/^[a-z][a-z\d+.-]*:/i.test(destination) &&
        !/\.(?:avif|gif|ico|jpe?g|pdf|png|svg|webp)$/i.test(pathname) &&
        !canonicalDocumentRoutes.has(pathname)
      )
    })
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

  it('rejects controlled relative Kubernetes document destinations', () => {
    const relativeDestinations = nonCanonicalDocumentDestinations(
      '[current](./guide/deployment-flow) [parent](../guide/deployment-flow) [bare](guide/deployment-flow)',
    )

    expect(relativeDestinations).toEqual([
      './guide/deployment-flow',
      '../guide/deployment-flow',
      'guide/deployment-flow',
    ])
  })

  it('excludes anchors, external schemes, and non-document assets from topic-link validation', () => {
    const excludedDestinations = nonCanonicalDocumentDestinations(
      '[anchor](#reading-path) [web](https://kubernetes.io) [mail](mailto:docs@example.com) [asset](/logo.png)',
    )

    expect(excludedDestinations).toEqual([])
  })

  it.each(kubernetesFiles)('uses canonical absolute routes for document links in %s', (file) => {
    const source = readFileSync(resolve(root, file), 'utf8')

    expect(nonCanonicalDocumentDestinations(source)).toEqual([])
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
