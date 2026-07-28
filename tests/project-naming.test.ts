import { existsSync, readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = process.cwd()

describe('cloud-native project identity', () => {
  it('uses the cloud-native package name', async () => {
    const packageJson = JSON.parse(
      await readFile(resolve(root, 'package.json'), 'utf8'),
    ) as { name?: string }
    const packageLock = JSON.parse(
      await readFile(resolve(root, 'package-lock.json'), 'utf8'),
    ) as { name?: string; packages: Record<string, { name?: string }> }

    expect(packageJson.name).toBe('cloud-native')
    expect(packageLock.name).toBe('cloud-native')
    expect(packageLock.packages['']?.name).toBe('cloud-native')
  })

  it('does not use the old project namespace in active UI code', () => {
    const activeFiles = [
      'docs/.vitepress/theme/Layout.vue',
      'docs/.vitepress/theme/components/AppearanceControl.vue',
      'docs/.vitepress/theme/components/BackToTop.vue',
      'docs/.vitepress/theme/components/SidebarResizeHandle.vue',
      'docs/.vitepress/theme/styles.css',
    ]

    for (const file of activeFiles) {
      const source = readFileSync(resolve(root, file), 'utf8')
      expect(source, file).not.toMatch(/(?:--|\.)k8s-/)
      expect(source, file).not.toContain('k8s-sidebar-resizing')
    }
  })

  it('keeps legacy storage keys isolated to migration sources', () => {
    const runtimeFiles = [
      'docs/.vitepress/config.mts',
      'docs/.vitepress/theme/appearance.ts',
      'docs/.vitepress/theme/components/SidebarResizeHandle.vue',
      'docs/.vitepress/theme/components/AppearanceControl.vue',
      'docs/.vitepress/theme/components/BackToTop.vue',
      'docs/.vitepress/theme/Layout.vue',
      'docs/.vitepress/theme/styles.css',
    ]
    const sources = new Map(
      runtimeFiles.map((file) => [
        file,
        readFileSync(resolve(root, file), 'utf8'),
      ]),
    )
    const owners = (legacyKey: string) =>
      runtimeFiles.filter((file) => sources.get(file)?.includes(legacyKey))

    expect(owners('k8s-theme-color')).toEqual([
      'docs/.vitepress/theme/appearance.ts',
    ])
    expect(owners('k8s-theme-mode')).toEqual([
      'docs/.vitepress/theme/appearance.ts',
    ])
    expect(owners('k8s-sidebar-width')).toEqual([
      'docs/.vitepress/theme/components/SidebarResizeHandle.vue',
    ])

    for (const [file, source] of sources) {
      expect(source, file).toContain('cloud-native-')
    }

    const styles = sources.get('docs/.vitepress/theme/styles.css') ?? ''
    expect(styles).not.toContain('k8s-')
  })

  it('renames the initial Kubernetes module design and plan files', () => {
    for (const oldFile of [
      'docs/superpowers/specs/2026-07-21-k8s-concepts-docs-design.md',
      'docs/superpowers/plans/2026-07-21-k8s-concepts-site.md',
    ]) {
      expect(existsSync(resolve(root, oldFile)), oldFile).toBe(false)
    }

    for (const newFile of [
      'docs/superpowers/specs/2026-07-21-cloud-native-handbook-initial-kubernetes-module-design.md',
      'docs/superpowers/plans/2026-07-21-cloud-native-handbook-initial-kubernetes-module.md',
    ]) {
      expect(existsSync(resolve(root, newFile)), newFile).toBe(true)
    }
  })

  it('records the final GitHub repository remote consistently', () => {
    const renamePlan = readFileSync(
      resolve(
        root,
        'docs/superpowers/plans/2026-07-28-cloud-native-project-rename.md',
      ),
      'utf8',
    )

    expect(renamePlan).toContain(
      'git@github.com:liufashi-Mr/cloud-native-docs.git',
    )
    expect(renamePlan).not.toContain('origin uses `cloud-native.git`')
  })

  it('uses current project identifiers in historical maintenance documents', () => {
    const initialSpec = existsSync(
      resolve(
        root,
        'docs/superpowers/specs/2026-07-21-cloud-native-handbook-initial-kubernetes-module-design.md',
      ),
    )
      ? 'docs/superpowers/specs/2026-07-21-cloud-native-handbook-initial-kubernetes-module-design.md'
      : 'docs/superpowers/specs/2026-07-21-k8s-concepts-docs-design.md'
    const initialPlan = existsSync(
      resolve(
        root,
        'docs/superpowers/plans/2026-07-21-cloud-native-handbook-initial-kubernetes-module.md',
      ),
    )
      ? 'docs/superpowers/plans/2026-07-21-cloud-native-handbook-initial-kubernetes-module.md'
      : 'docs/superpowers/plans/2026-07-21-k8s-concepts-site.md'
    const historicalFiles = [
      initialSpec,
      'docs/superpowers/specs/2026-07-22-brand-and-mermaid-viewer-design.md',
      initialPlan,
      'docs/superpowers/plans/2026-07-22-github-pages-deployment.md',
      'docs/superpowers/plans/2026-07-22-kubernetes-brand-mermaid-viewer.md',
      'docs/superpowers/plans/2026-07-23-cloud-native-handbook-homepage.md',
      'docs/superpowers/plans/2026-07-24-brand-navigation-and-appearance.md',
    ]
    const oldProjectIdentifiers = [
      'k8s-concepts-handbook',
      'liufashi-Mr/k8s-doc',
      '/k8s-doc/',
      '--k8s-',
      '.k8s-appearance',
      'k8s-theme-color',
      'k8s-theme-mode',
      'k8s-sidebar-width',
      'K8s 概念手册',
    ]

    for (const file of historicalFiles) {
      const source = readFileSync(resolve(root, file), 'utf8')
      for (const identifier of oldProjectIdentifiers) {
        expect(source, `${file} still contains ${identifier}`).not.toContain(
          identifier,
        )
      }
    }
  })
})
