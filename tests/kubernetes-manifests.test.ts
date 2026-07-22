import { readFileSync } from 'node:fs'
import { parseAllDocuments } from 'yaml'
import { describe, expect, it } from 'vitest'

import { markdownFences, publicMarkdownFiles } from './support/markdown'
import {
  KUBERNETES_SCHEMA_TARGET,
  validateKubernetesManifest,
} from './support/kubernetes-manifest'

describe(`Kubernetes ${KUBERNETES_SCHEMA_TARGET} YAML examples`, () => {
  it('parses and validates every full YAML manifest in public Markdown', () => {
    let manifestCount = 0

    for (const file of publicMarkdownFiles()) {
      const markdown = readFileSync(file, 'utf8')
      for (const fence of markdownFences(markdown, file)) {
        if (fence.language !== 'yaml') continue

        const documents = parseAllDocuments(fence.content, {
          prettyErrors: true,
          uniqueKeys: true,
        })
        expect(documents.length, `${fence.location} has no YAML documents`).toBeGreaterThan(0)

        for (const [index, document] of documents.entries()) {
          expect(
            document.errors,
            `${fence.location} document ${index + 1} has invalid YAML`,
          ).toEqual([])
          expect(
            document.warnings,
            `${fence.location} document ${index + 1} has YAML warnings`,
          ).toEqual([])
          validateKubernetesManifest(
            document.toJS(),
            `${fence.location} document ${index + 1}`,
          )
          manifestCount += 1
        }
      }
    }

    expect(manifestCount).toBeGreaterThan(0)
  })

  it('rejects unknown manifest kinds rather than silently skipping validation', () => {
    expect(() =>
      validateKubernetesManifest({
        apiVersion: 'v1',
        kind: 'UnvalidatedKind',
        metadata: { name: 'example' },
      }),
    ).toThrow(/unknown or unvalidated kind/i)
  })

  it.each([
    {
      name: 'Deployment with a selector that misses template labels',
      manifest: {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: { name: 'web' },
        spec: {
          selector: { matchLabels: { app: 'web' } },
          template: {
            metadata: { labels: { app: 'other' } },
            spec: { containers: [{ name: 'web', image: 'nginx' }] },
          },
        },
      },
    },
    {
      name: 'Service without ports',
      manifest: {
        apiVersion: 'v1',
        kind: 'Service',
        metadata: { name: 'web' },
        spec: { selector: { app: 'web' } },
      },
    },
    {
      name: 'RoleBinding without roleRef',
      manifest: {
        apiVersion: 'rbac.authorization.k8s.io/v1',
        kind: 'RoleBinding',
        metadata: { name: 'reader' },
        subjects: [{ kind: 'ServiceAccount', name: 'reader' }],
      },
    },
    {
      name: 'Pod with a volumeMount that has no volume',
      manifest: {
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: { name: 'web' },
        spec: {
          containers: [{
            name: 'web',
            image: 'nginx',
            volumeMounts: [{ name: 'missing', mountPath: '/data' }],
          }],
        },
      },
    },
    {
      name: 'PVC without storage request',
      manifest: {
        apiVersion: 'v1',
        kind: 'PersistentVolumeClaim',
        metadata: { name: 'data' },
        spec: { accessModes: ['ReadWriteOnce'], resources: { requests: {} } },
      },
    },
  ])('rejects $name', ({ manifest }) => {
    expect(() => validateKubernetesManifest(manifest)).toThrow()
  })
})
