import { existsSync, readFileSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..')
const contentFiles = [
  'docs/index.md',
  'docs/guide/deployment-flow.md',
  'docs/concepts/resource-model.md',
  'docs/concepts/cluster-nodes.md',
  'docs/concepts/workloads.md',
  'docs/concepts/networking.md',
  'docs/concepts/config-storage.md',
  'docs/concepts/security.md',
  'docs/concepts/scheduling-resources.md',
  'docs/operations/health-lifecycle.md',
  'docs/operations/release-scaling.md',
  'docs/operations/troubleshooting.md',
  'docs/reference/concept-map.md',
]

describe('content contract', () => {
  it.each(contentFiles)('%s exists', (file) => {
    expect(existsSync(resolve(root, file))).toBe(true)
  })

  it('defines the fluid responsive theme contracts', () => {
    const styles = readFileSync(
      resolve(root, 'docs/.vitepress/theme/styles.css'),
      'utf8',
    )

    for (const contract of [
      '--k8s-accent',
      'clamp(',
      '@media (max-width: 1099px)',
      '@media (max-width: 767px)',
      'prefers-reduced-motion',
      'overflow-x: auto',
    ]) {
      expect(styles, `styles.css is missing ${contract}`).toContain(contract)
    }
  })

  it('introduces the core workload relationships on the home page', () => {
    const home = readFileSync(resolve(root, 'docs/index.md'), 'utf8')

    for (const term of [
      'Deployment',
      'ReplicaSet',
      'Pod',
      'Service',
      'ConfigMap',
      'Secret',
      'PVC',
    ]) {
      expect(home).toContain(term)
    }
  })

  it('keeps relative Markdown links valid', () => {
    const markdownLink = /\[[^\]]*\]\(([^)]+)\)/g

    for (const file of contentFiles) {
      const absoluteFile = resolve(root, file)
      if (!existsSync(absoluteFile)) continue

      const markdown = readFileSync(absoluteFile, 'utf8')
      for (const match of markdown.matchAll(markdownLink)) {
        const href = match[1].trim().replace(/^<|>$/g, '')
        if (/^(?:[a-z]+:|#|\/)/i.test(href)) continue

        const pathname = decodeURIComponent(href.split(/[?#]/, 1)[0])
        const target = resolve(dirname(absoluteFile), pathname)
        const candidates = extname(target)
          ? [target]
          : [target, `${target}.md`, resolve(target, 'index.md')]

        expect(
          candidates.some((candidate) => existsSync(candidate)),
          `${file} contains a broken relative link: ${href}`,
        ).toBe(true)
      }
    }
  })
})
