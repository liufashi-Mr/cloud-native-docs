import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import MarkdownIt from 'markdown-it'
import { describe, expect, it } from 'vitest'

import { dockerOciRouteManifest } from './support/docker-oci-routes'

const root = resolve(import.meta.dirname, '..')
const docsRoot = resolve(root, 'docs')
const markdownParser = new MarkdownIt()
const dockerOciFiles = dockerOciRouteManifest.map(
  (route) => `docs/docker-oci/${route}.md`,
)

function relativeDocumentDestinations(source: string): string[] {
  return markdownParser.parse(source, {}).flatMap((token) => token.children ?? [])
    .filter((token) => token.type === 'link_open')
    .map((token) => token.attrGet('href') ?? '')
    .filter((destination) => {
      const pathname = destination.split(/[?#]/, 1)[0]
      return destination !== '' && !destination.startsWith('/') &&
        !destination.startsWith('#') &&
        !/^[a-z][a-z\d+.-]*:/i.test(destination) &&
        !/\.(?:avif|gif|ico|jpe?g|pdf|png|svg|webp)$/i.test(pathname)
    })
}

describe('Docker / OCI routing', () => {
  it('contains exactly the planned Markdown route inventory', () => {
    const routes = readdirSync(resolve(docsRoot, 'docker-oci'), {
      encoding: 'utf8', recursive: true,
    }).filter((file) => file.endsWith('.md')).map((file) => file.replace(/\.md$/, '')).sort()

    expect(routes).toEqual([...dockerOciRouteManifest].sort())
  })

  it.each(dockerOciRouteManifest)('publishes /docker-oci/%s from a source page', (route) => {
    expect(existsSync(resolve(docsRoot, 'docker-oci', `${route}.md`))).toBe(true)
  })

  it.each(dockerOciFiles)('uses root-absolute document links in %s', (file) => {
    const source = readFileSync(resolve(root, file), 'utf8')
    expect(relativeDocumentDestinations(source)).toEqual([])
  })

  it('scopes a complete sidebar to /docker-oci/', () => {
    const config = readFileSync(resolve(docsRoot, '.vitepress/config.mts'), 'utf8')
    const sidebar = config.slice(config.indexOf("'/docker-oci/': ["), config.indexOf("'/kubernetes/': ["))

    expect(sidebar).toContain("link: '/docker-oci/'")
    for (const route of dockerOciRouteManifest.slice(1)) {
      expect(sidebar).toContain(`link: '/docker-oci/${route}'`)
    }
  })

  it('keeps Docker / OCI and Kubernetes links bidirectional', () => {
    const links = [
      ['docs/docker-oci/concepts/docker-architecture.md', '/kubernetes/concepts/cluster-nodes'],
      ['docs/kubernetes/concepts/cluster-nodes.md', '/docker-oci/concepts/docker-architecture'],
      ['docs/docker-oci/guide/container-to-kubernetes.md', '/kubernetes/concepts/workloads'],
      ['docs/kubernetes/concepts/workloads.md', '/docker-oci/guide/container-to-kubernetes'],
      ['docs/docker-oci/runtime/storage.md', '/kubernetes/concepts/config-storage'],
      ['docs/kubernetes/concepts/config-storage.md', '/docker-oci/runtime/storage'],
      ['docs/docker-oci/runtime/process-lifecycle.md', '/kubernetes/operations/health-lifecycle'],
      ['docs/kubernetes/operations/health-lifecycle.md', '/docker-oci/runtime/process-lifecycle'],
    ] as const

    for (const [file, destination] of links) {
      expect(readFileSync(resolve(root, file), 'utf8'), `${file} must link ${destination}`)
        .toContain(`](${destination})`)
    }
  })
})
