import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(
  resolve(import.meta.dirname, '../docs/.vitepress/theme/styles.css'),
  'utf8',
)

describe('responsive theme styles', () => {
  it('maps brand text to foreground-safe accent tokens', () => {
    expect(styles).toMatch(
      /:root\s*{[^}]*--vp-c-brand-1:\s*var\(--k8s-accent-text\)/,
    )
    expect(styles).toMatch(
      /\.dark\s*{[^}]*--vp-c-brand-1:\s*var\(--k8s-accent-text-dark\)/,
    )
    expect(styles).toMatch(
      /:root\s*{[^}]*--vp-c-tip-2:\s*color-mix\(in srgb, var\(--k8s-accent-text\)/,
    )
    expect(styles).toMatch(
      /\.dark\s*{[^}]*--vp-c-tip-2:\s*color-mix\(in srgb, var\(--k8s-accent-text-dark\)/,
    )
  })

  it('contains mobile code overflow inside the document gutter', () => {
    const mobileStyles = styles.slice(
      styles.indexOf('@media (max-width: 767px)'),
      styles.indexOf('@media (prefers-reduced-motion: reduce)'),
    )

    expect(mobileStyles).toContain(".vp-doc div[class*='language-']")
    expect(mobileStyles).toContain('.vp-block')
    expect(mobileStyles).toMatch(/margin-left:\s*0/)
    expect(mobileStyles).toMatch(/margin-right:\s*0/)
    expect(mobileStyles).toMatch(/width:\s*100%/)
  })

  it('contains mobile code group tabs while preserving local scrolling', () => {
    const mobileStyles = styles.slice(
      styles.indexOf('@media (max-width: 767px)'),
      styles.indexOf('@media (prefers-reduced-motion: reduce)'),
    )
    const tabsRule = mobileStyles.match(/\.vp-code-group \.tabs\s*{([^}]*)}/)

    expect(mobileStyles).toContain('.vp-code-group .tabs')
    expect(tabsRule?.[1]).toMatch(/margin-left:\s*0/)
    expect(tabsRule?.[1]).toMatch(/margin-right:\s*0/)
    expect(tabsRule?.[1]).toMatch(/width:\s*100%/)
    expect(tabsRule?.[1]).toMatch(/max-width:\s*100%/)
    expect(tabsRule?.[1]).toMatch(/overflow-x:\s*auto/)
  })

  it('globally minimizes motion and disables smooth scrolling on request', () => {
    const reducedMotionStyles = styles.slice(
      styles.indexOf('@media (prefers-reduced-motion: reduce)'),
    )

    expect(reducedMotionStyles).toContain('*::before')
    expect(reducedMotionStyles).toContain('*::after')
    expect(reducedMotionStyles).toMatch(/animation-duration:\s*0\.01ms\s*!important/)
    expect(reducedMotionStyles).toMatch(/animation-iteration-count:\s*1\s*!important/)
    expect(reducedMotionStyles).toMatch(/transition-duration:\s*0\.01ms\s*!important/)
    expect(reducedMotionStyles).toMatch(/scroll-behavior:\s*auto\s*!important/)
  })

  it('hides only the visible mobile mode labels', () => {
    const mobileStyles = styles.slice(
      styles.indexOf('@media (max-width: 767px)'),
      styles.indexOf('@media (prefers-reduced-motion: reduce)'),
    )

    expect(mobileStyles).toMatch(
      /\.k8s-appearance__mode-label\s*{[^}]*display:\s*none/,
    )
  })
})
