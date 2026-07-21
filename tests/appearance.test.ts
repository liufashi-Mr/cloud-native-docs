import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_COLOR,
  PRESET_COLORS,
  applyAppearance,
  deriveAccent,
  loadAppearance,
  normalizeHex,
  resolveDarkMode,
  saveAppearance,
} from '../docs/.vitepress/theme/appearance'

describe('appearance utilities', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    document.documentElement.style.removeProperty('--k8s-accent')
    document.documentElement.style.removeProperty('--k8s-accent-dark')
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('normalizes six-digit hex colors', () => {
    expect(normalizeHex('#28755d')).toBe('#28755D')
    expect(normalizeHex('2b69a7')).toBe('#2B69A7')
  })

  it('rejects malformed hex colors', () => {
    expect(normalizeHex('#xyzxyz')).toBeNull()
  })

  it('exports the supported preset palette', () => {
    expect(DEFAULT_COLOR).toBe('#28755D')
    expect(PRESET_COLORS).toEqual([
      '#28755D',
      '#277A72',
      '#2B69A7',
      '#555DB0',
      '#76549A',
      '#A43F5A',
      '#AA493F',
      '#A85C28',
      '#8A6B1F',
      '#5B6670',
    ])
  })

  it('derives readable light and dark accents from a custom color', () => {
    expect(deriveAccent('#8FD8BC')).toEqual({
      light: 'hsl(156 48% 36%)',
      dark: 'hsl(156 48% 68%)',
    })
  })

  it('falls back to the default accent for invalid colors', () => {
    expect(deriveAccent('#xyzxyz')).toEqual(deriveAccent(DEFAULT_COLOR))
  })

  it('resolves explicit and automatic color modes', () => {
    expect(resolveDarkMode('auto', true)).toBe(true)
    expect(resolveDarkMode('auto', false)).toBe(false)
    expect(resolveDarkMode('light', true)).toBe(false)
    expect(resolveDarkMode('dark', false)).toBe(true)
  })

  it('applies accent variables and the resolved dark class', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))

    expect(applyAppearance('#8FD8BC', 'auto')).toBe(true)

    expect(
      document.documentElement.style.getPropertyValue('--k8s-accent'),
    ).toBe('hsl(156 48% 36%)')
    expect(
      document.documentElement.style.getPropertyValue('--k8s-accent-dark'),
    ).toBe('hsl(156 48% 68%)')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('falls back safely when system preference detection fails', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => {
        throw new Error('media query denied')
      }),
    )

    expect(() => applyAppearance('#28755D', 'auto')).not.toThrow()
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('round trips saved appearance preferences', () => {
    saveAppearance('#2B69A7', 'dark')

    expect(loadAppearance()).toEqual({ color: '#2B69A7', mode: 'dark' })
    expect(localStorage.getItem('k8s-theme-color')).toBe('#2B69A7')
    expect(localStorage.getItem('k8s-theme-mode')).toBe('dark')
  })

  it('falls back when persisted appearance preferences are invalid', () => {
    localStorage.setItem('k8s-theme-color', '#xyzxyz')
    localStorage.setItem('k8s-theme-mode', 'sepia')

    expect(loadAppearance()).toEqual({ color: DEFAULT_COLOR, mode: 'auto' })
  })

  it('survives unavailable browser globals and storage failures', () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => {
        throw new Error('storage denied')
      }),
      setItem: vi.fn(() => {
        throw new Error('storage denied')
      }),
    })

    expect(() => saveAppearance('#2B69A7', 'dark')).not.toThrow()
    expect(loadAppearance()).toEqual({ color: DEFAULT_COLOR, mode: 'auto' })

    vi.stubGlobal('window', undefined)
    vi.stubGlobal('document', undefined)
    expect(() => applyAppearance('#2B69A7', 'auto')).not.toThrow()
    expect(loadAppearance()).toEqual({ color: DEFAULT_COLOR, mode: 'auto' })
    expect(() => saveAppearance('#2B69A7', 'dark')).not.toThrow()
  })
})
