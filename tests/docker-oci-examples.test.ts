import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseDocument } from 'yaml'

import { markdownFences } from './support/markdown'

const root = resolve(import.meta.dirname, '..')

function readPage(file: string): string {
  return readFileSync(resolve(root, file), 'utf8')
}

describe('Docker / OCI continuous examples', () => {
  it('keeps the primary Compose example structurally valid', () => {
    const file = 'docs/docker-oci/runtime/compose.md'
    const source = readPage(file)
    const composeYaml = markdownFences(source, file)
      .find((fence) => fence.info === 'yaml title="compose.yaml"')?.content

    expect(composeYaml, `${file} must contain the primary compose.yaml fence`).toBeDefined()

    const document = parseDocument(composeYaml ?? '', {
      prettyErrors: true,
      uniqueKeys: true,
    })
    expect(document.errors).toEqual([])

    const compose = document.toJS() as {
      services: {
        api: {
          build: string
          ports: string[]
        }
        probe: {
          depends_on: Record<string, { condition: string }>
        }
      }
      volumes: Record<string, unknown>
    }

    expect(Object.keys(compose.services)).toEqual(['api', 'probe'])
    expect(compose.services.api).toMatchObject({
      build: '.',
      ports: ['127.0.0.1:8080:3000'],
    })
    expect(compose.services.probe.depends_on).toEqual({
      api: { condition: 'service_healthy' },
    })
    expect(Object.keys(compose.volumes)).toEqual(['api-data'])
  })

  it('carries the demo API identity across source, lifecycle, and Compose', () => {
    for (const file of [
      'docs/docker-oci/guide/source-to-container.md',
      'docs/docker-oci/runtime/process-lifecycle.md',
      'docs/docker-oci/runtime/compose.md',
    ]) {
      const source = readPage(file)
      expect(source, `${file} is missing demo-api`).toContain('demo-api')
      expect(source, `${file} is missing port 3000`).toContain('3000')
      expect(source, `${file} is missing /healthz`).toContain('/healthz')
    }
  })
})
