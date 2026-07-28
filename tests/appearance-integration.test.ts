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
    const staticHead = config.slice(
      config.indexOf('head: ['),
      config.indexOf('transformHead'),
    )

    expect(config).toContain("outlineTitle: '本页目录'")
    expect(config).toContain("returnToTopLabel: '返回顶部'")
    expect(staticHead).toMatch(
      /rel:\s*'icon'[\s\S]*type:\s*'image\/png'[\s\S]*href:\s*`\$\{siteBase\}logo\.png`/,
    )
    expect(config).toContain('transformHead({ siteData, head })')
    expect(config).toContain("favicon[1].href = `${siteData.base}logo.png`")
  })

  it('mounts the appearance control in desktop and mobile-safe layout slots', async () => {
    const layout = await readFile(resolve(themeDirectory, 'Layout.vue'), 'utf8')

    expect(layout).toContain('DefaultTheme.Layout')
    expect(layout).toContain('#nav-bar-content-after')
    expect(layout).toContain('#nav-screen-content-after')
    expect(layout.match(/<AppearanceControl/g)).toHaveLength(2)
    expect(layout).toContain('<BackToTop />')
    expect(layout).toContain("import { useSidebar } from 'vitepress/theme'")
    expect(layout).toContain('const { hasSidebar } = useSidebar()')
    expect(layout).toContain('<SidebarResizeHandle v-if="hasSidebar" />')
    expect(layout).not.toContain('<SidebarResizeHandle />')
  })

  it('keeps color and mode as independent stable icon controls', async () => {
    const component = await readFile(
      resolve(themeDirectory, 'components/AppearanceControl.vue'),
      'utf8',
    )
    const styles = await readFile(resolve(themeDirectory, 'styles.css'), 'utf8')

    expect(component).toContain('data-mode-trigger')
    expect(component).toContain('cloud-native-appearance__mode-trigger')
    expect(component).not.toContain('cloud-native-appearance__modes')
    expect(styles).toMatch(
      /\.cloud-native-appearance\s*\{[^}]*display:\s*inline-flex;[^}]*gap:\s*4px;/,
    )
    expect(styles).toMatch(
      /\.cloud-native-appearance__trigger,\s*\.cloud-native-appearance__mode-trigger\s*\{[^}]*width:\s*36px;[^}]*height:\s*32px;/,
    )
    expect(styles).toMatch(
      /\.cloud-native-appearance-slot--mobile\s+\.cloud-native-appearance\s*\{[^}]*flex-wrap:\s*wrap;[^}]*width:\s*100%;[^}]*row-gap:\s*0;/,
    )
    expect(styles).not.toContain('.cloud-native-appearance__modes')
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

  it('renders the square navbar logo at a compact fixed size', async () => {
    const styles = await readFile(resolve(themeDirectory, 'styles.css'), 'utf8')
    const logoRule = styles.match(
      /\.VPNavBarTitle\s+\.logo\s*\{([^}]*)\}/,
    )?.[1]

    expect(logoRule).toMatch(/width:\s*32px/)
    expect(logoRule).toMatch(/height:\s*32px/)
    expect(logoRule).toMatch(/margin-right:\s*4px/)
    expect(logoRule).toMatch(/object-fit:\s*contain/)
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
      /\.VPNavBar\.has-sidebar\s+\.container\s*>\s*\.title\s*\{[^}]*box-sizing:\s*border-box;[^}]*width:\s*var\(--cloud-native-sidebar-width\);/,
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
    for (const contract of [
      'cloud-native-theme-color',
      'cloud-native-theme-mode',
      'cloud-native-sidebar-width',
      '--cloud-native-accent',
      '--cloud-native-accent-dark',
      '--cloud-native-accent-text',
      '--cloud-native-accent-text-dark',
      '--cloud-native-accent-button',
      '--cloud-native-accent-button-hover',
      '--cloud-native-accent-button-active',
    ]) {
      expect(config).toContain(contract)
    }
    for (const legacyKey of [
      'k8s-theme-color',
      'k8s-theme-mode',
      'k8s-sidebar-width',
    ]) {
      expect(config).not.toContain(legacyKey)
    }
    expect(config).toContain('relativeLuminance')
    expect(config).toContain('contrastRatio')
    expect(config).toContain("classList.toggle('dark'")
    expect(config.indexOf('head:')).toBeLessThan(config.indexOf('themeConfig:'))
    expect(config).toContain("srcExclude: ['superpowers/**']")
    expect(config).toContain('markdown.use(mermaidFencePlugin)')
  })
})
