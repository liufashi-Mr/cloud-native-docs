import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..')
const docsRoot = resolve(root, 'docs')
const kubernetesFiles = [
  'docs/kubernetes/index.md',
  'docs/kubernetes/guide/deployment-flow.md',
  'docs/kubernetes/concepts/resource-model.md',
  'docs/kubernetes/concepts/cluster-nodes.md',
  'docs/kubernetes/concepts/workloads.md',
  'docs/kubernetes/concepts/networking.md',
  'docs/kubernetes/concepts/config-storage.md',
  'docs/kubernetes/concepts/security.md',
  'docs/kubernetes/concepts/scheduling-resources.md',
  'docs/kubernetes/operations/health-lifecycle.md',
  'docs/kubernetes/operations/release-scaling.md',
  'docs/kubernetes/operations/troubleshooting.md',
  'docs/kubernetes/reference/concept-map.md',
]

describe('Kubernetes topic routing', () => {
  it.each(kubernetesFiles)('%s exists under the Kubernetes topic', (file) => {
    expect(existsSync(resolve(root, file))).toBe(true)
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

  it('scopes the sidebar and all representative links to Kubernetes', () => {
    const config = readFileSync(resolve(docsRoot, '.vitepress/config.mts'), 'utf8')

    expect(config).toContain("'/kubernetes/': [")
    expect(config).toContain("link: '/kubernetes/'")
    expect(config).toContain("link: '/kubernetes/concepts/resource-model'")
    expect(config).toContain("link: '/kubernetes/operations/troubleshooting'")
    expect(config).toContain("link: '/kubernetes/reference/concept-map'")
  })
})
