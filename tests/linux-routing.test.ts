import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import MarkdownIt from 'markdown-it'
import { describe, expect, it } from 'vitest'

import { linuxRouteManifest } from './support/linux-routes'

const root = resolve(import.meta.dirname, '..')
const docsRoot = resolve(root, 'docs')
const markdownParser = new MarkdownIt()
const linuxFiles = linuxRouteManifest.map((route) => `docs/linux/${route}.md`)

function relativeDocumentDestinations(source: string): string[] {
  return markdownParser
    .parse(source, {})
    .flatMap((token) => token.children ?? [])
    .filter((token) => token.type === 'link_open')
    .map((token) => token.attrGet('href') ?? '')
    .filter((destination) => {
      const pathname = destination.split(/[?#]/, 1)[0]
      return (
        destination !== '' &&
        !destination.startsWith('/') &&
        !destination.startsWith('#') &&
        !/^[a-z][a-z\d+.-]*:/i.test(destination) &&
        !/\.(?:avif|gif|ico|jpe?g|pdf|png|svg|webp)$/i.test(pathname)
      )
    })
}

describe('Linux routing', () => {
  it('contains exactly the planned Markdown route inventory', () => {
    const routes = readdirSync(resolve(docsRoot, 'linux'), {
      encoding: 'utf8',
      recursive: true,
    })
      .filter((file) => file.endsWith('.md'))
      .map((file) => file.replace(/\.md$/, ''))
      .sort()
    expect(routes).toEqual([...linuxRouteManifest].sort())
  })

  it.each(linuxRouteManifest)(
    'publishes /linux/%s from a source page',
    (route) => {
      expect(existsSync(resolve(docsRoot, 'linux', `${route}.md`))).toBe(true)
    },
  )

  it.each(linuxFiles)('uses root-absolute document links in %s', (file) => {
    expect(
      relativeDocumentDestinations(readFileSync(resolve(root, file), 'utf8')),
    ).toEqual([])
  })

  it('scopes a complete sidebar to /linux/', () => {
    const config = readFileSync(
      resolve(docsRoot, '.vitepress/config.mts'),
      'utf8',
    )
    const sidebar = config.slice(
      config.indexOf("'/linux/': ["),
      config.indexOf("'/docker-oci/': ["),
    )
    expect(sidebar).toContain("link: '/linux/'")
    for (const route of linuxRouteManifest.slice(1)) {
      expect(sidebar).toContain(`link: '/linux/${route}'`)
    }
  })

  it('keeps Linux, Docker / OCI, and Kubernetes links bidirectional', () => {
    const links = [
      ['docs/linux/concepts/namespaces.md', '/docker-oci/concepts/container-model'],
      ['docs/docker-oci/concepts/container-model.md', '/linux/concepts/namespaces'],
      ['docs/linux/concepts/signals-and-exit-status.md', '/docker-oci/runtime/process-lifecycle'],
      ['docs/docker-oci/runtime/process-lifecycle.md', '/linux/concepts/signals-and-exit-status'],
      ['docs/linux/concepts/filesystems-and-mounts.md', '/docker-oci/runtime/storage'],
      ['docs/docker-oci/runtime/storage.md', '/linux/concepts/filesystems-and-mounts'],
      ['docs/linux/runtime/sockets-and-name-resolution.md', '/docker-oci/runtime/networking'],
      ['docs/docker-oci/runtime/networking.md', '/linux/runtime/sockets-and-name-resolution'],
      ['docs/linux/concepts/cgroups-and-resources.md', '/kubernetes/concepts/scheduling-resources'],
      ['docs/kubernetes/concepts/scheduling-resources.md', '/linux/concepts/cgroups-and-resources'],
      ['docs/linux/operations/security-boundaries.md', '/kubernetes/concepts/security'],
      ['docs/kubernetes/concepts/security.md', '/linux/operations/security-boundaries'],
      ['docs/linux/operations/troubleshooting.md', '/kubernetes/operations/troubleshooting'],
      ['docs/kubernetes/operations/troubleshooting.md', '/linux/operations/troubleshooting'],
      ['docs/linux/concepts/processes-and-procfs.md', '/kubernetes/concepts/cluster-nodes'],
      ['docs/kubernetes/concepts/cluster-nodes.md', '/linux/concepts/processes-and-procfs'],
      ['docs/linux/concepts/signals-and-exit-status.md', '/kubernetes/operations/health-lifecycle'],
      ['docs/kubernetes/operations/health-lifecycle.md', '/linux/concepts/signals-and-exit-status'],
    ] as const

    for (const [file, destination] of links) {
      expect(
        readFileSync(resolve(root, file), 'utf8'),
        `${file} must link ${destination}`,
      ).toContain(`](${destination})`)
    }
  })
})
