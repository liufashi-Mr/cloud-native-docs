import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const themeDirectory = resolve(process.cwd(), 'docs/.vitepress/theme')

describe('appearance theme integration', () => {
  it('mounts the appearance control in desktop and mobile-safe layout slots', async () => {
    const layout = await readFile(resolve(themeDirectory, 'Layout.vue'), 'utf8')

    expect(layout).toContain('DefaultTheme.Layout')
    expect(layout).toContain('#nav-bar-content-after')
    expect(layout).toContain('#nav-screen-content-after')
    expect(layout.match(/<AppearanceControl/g)).toHaveLength(2)
  })

  it('uses the custom layout without dropping Mermaid registration', async () => {
    const theme = await readFile(resolve(themeDirectory, 'index.ts'), 'utf8')

    expect(theme).toContain('Layout,')
    expect(theme).toContain("app.component('MermaidDiagram', MermaidDiagram)")
  })

  it('disables VitePress appearance and initializes saved state before paint', async () => {
    const config = await readFile(
      resolve(process.cwd(), 'docs/.vitepress/config.mts'),
      'utf8',
    )

    expect(config).toMatch(/appearance:\s*false/)
    expect(config).toContain('k8s-theme-color')
    expect(config).toContain('k8s-theme-mode')
    expect(config).toContain('--k8s-accent')
    expect(config).toContain('--k8s-accent-dark')
    expect(config).toContain('--k8s-accent-text')
    expect(config).toContain('--k8s-accent-text-dark')
    expect(config).toContain('--k8s-accent-button')
    expect(config).toContain('--k8s-accent-button-hover')
    expect(config).toContain('--k8s-accent-button-active')
    expect(config).toContain('relativeLuminance')
    expect(config).toContain('contrastRatio')
    expect(config).toContain("classList.toggle('dark'")
    expect(config.indexOf('head:')).toBeLessThan(config.indexOf('themeConfig:'))
    expect(config).toContain("srcExclude: ['superpowers/**']")
    expect(config).toContain('markdown.use(mermaidFencePlugin)')
  })
})
