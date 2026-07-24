import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const themeDirectory = resolve(process.cwd(), 'docs/.vitepress/theme')

describe('appearance theme integration', () => {
  it('uses the cloud native handbook brand and leaves the top navigation empty', async () => {
    const config = await readFile(
      resolve(process.cwd(), 'docs/.vitepress/config.mts'),
      'utf8',
    )

    expect(config).toContain("title: '云原生开发手册'")
    expect(config).toContain("siteTitle: '云原生开发手册'")
    expect(config).toContain("logo: '/logo.png'")
    expect(config).toContain("const siteBase = process.env.BASE_PATH || '/'")
    expect(config).toContain('base: siteBase')
    expect(config).not.toContain('logoLink:')
    expect(config).not.toMatch(/\bnav:\s*\[/)
  })

  it('localizes the page outline and uses the base-aware PNG logo as favicon', async () => {
    const config = await readFile(
      resolve(process.cwd(), 'docs/.vitepress/config.mts'),
      'utf8',
    )

    expect(config).toContain("outlineTitle: '本页目录'")
    expect(config).toContain("returnToTopLabel: '返回顶部'")
    expect(config).toContain('transformHead({ siteData })')
    expect(config).toMatch(
      /rel:\s*'icon'[\s\S]*type:\s*'image\/png'[\s\S]*href:\s*`\$\{siteData\.base\}logo\.png`/,
    )
    expect(config).not.toContain("href: '/logo.png'")
  })

  it('mounts the appearance control in desktop and mobile-safe layout slots', async () => {
    const layout = await readFile(resolve(themeDirectory, 'Layout.vue'), 'utf8')

    expect(layout).toContain('DefaultTheme.Layout')
    expect(layout).toContain('#nav-bar-content-after')
    expect(layout).toContain('#nav-screen-content-after')
    expect(layout.match(/<AppearanceControl/g)).toHaveLength(2)
    expect(layout).toContain('<BackToTop />')
    expect(layout).toContain('<SidebarResizeHandle />')
  })

  it('keeps the outline text spaced from its divider at every desktop width', async () => {
    const styles = await readFile(resolve(themeDirectory, 'styles.css'), 'utf8')
    const outlineContentRule = styles.match(
      /\.VPDoc\s+\.VPDocAsideOutline\s+\.content\s*\{([^}]*)\}/,
    )?.[1]

    expect(outlineContentRule).toMatch(/padding-left:\s*28px/)
    expect(styles).not.toMatch(
      /\.VPDocAsideOutline\s+\.outline-title\s*\{[^}]*margin-bottom/,
    )
  })

  it('keeps the desktop nav title border inside the resizable sidebar', async () => {
    const styles = await readFile(resolve(themeDirectory, 'styles.css'), 'utf8')
    const desktopStyles = styles.match(
      /@media\s*\(min-width:\s*1100px\)\s*\{([\s\S]*?)\n\}/,
    )?.[1]

    expect(desktopStyles).toBeDefined()
    expect(desktopStyles).not.toMatch(
      /\.VPNavBar\.has-sidebar\s+\.title\s*\{/,
    )
    expect(desktopStyles).toMatch(
      /\.VPNavBar\.has-sidebar\s+\.container\s*>\s*\.title\s*\{[^}]*box-sizing:\s*border-box;[^}]*width:\s*var\(--k8s-sidebar-width\);/,
    )
    expect(desktopStyles).toMatch(
      /\.VPNavBar\.has-sidebar\s+\.VPNavBarTitle\s+\.title\s*\{[^}]*box-sizing:\s*border-box;[^}]*width:\s*100%;/,
    )
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
    expect(config).toContain('k8s-sidebar-width')
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
