import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_COLOR,
  PRESET_COLORS,
  applyAppearance,
  deriveAccent,
  deriveButtonAccent,
  deriveTextAccent,
  loadAppearance,
  normalizeHex,
  resolveDarkMode,
  saveAppearance,
} from '../docs/.vitepress/theme/appearance'

type Assert<T extends true> = T
type IsExactlyVoid<T> = [T] extends [void]
  ? [void] extends [T]
    ? true
    : false
  : false
type ApplyAppearanceReturnsVoid = Assert<
  IsExactlyVoid<ReturnType<typeof applyAppearance>>
>

const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia')
const DARK_SURFACES = ['#22282E', '#1D2328', '#1A2224'] as const
const CONTRAST_COLORS = [
  ...PRESET_COLORS,
  '#3B30CF',
  '#FFD400',
  '#00FFFF',
  '#0066FF',
  '#FFFFFF',
  '#000000',
] as const

function hslToRgb(value: string): [number, number, number] {
  const match = /^hsl\((\d+) (\d+)% (\d+)%\)$/.exec(value)
  if (!match) throw new Error(`Expected an HSL color, received ${value}`)

  const hue = Number(match[1])
  const saturation = Number(match[2]) / 100
  const lightness = Number(match[3]) / 100
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const intermediate = chroma * (1 - Math.abs(((hue / 60) % 2) - 1))
  const offset = lightness - chroma / 2
  let red = 0
  let green = 0
  let blue = 0

  if (hue < 60) [red, green] = [chroma, intermediate]
  else if (hue < 120) [red, green] = [intermediate, chroma]
  else if (hue < 180) [green, blue] = [chroma, intermediate]
  else if (hue < 240) [green, blue] = [intermediate, chroma]
  else if (hue < 300) [red, blue] = [intermediate, chroma]
  else [red, blue] = [chroma, intermediate]

  return [red + offset, green + offset, blue + offset]
}

function hexToRgb(value: string): [number, number, number] {
  return [1, 3, 5].map(
    (offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255,
  ) as [number, number, number]
}

function relativeLuminance([red, green, blue]: [number, number, number]): number {
  const linear = [red, green, blue].map((channel) =>
    channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4,
  )
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

function contrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(hslToRgb(foreground))
  const backgroundLuminance = relativeLuminance(hexToRgb(background))
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  )
}

function restoreMatchMedia(): void {
  if (originalMatchMedia) {
    Object.defineProperty(window, 'matchMedia', originalMatchMedia)
  } else {
    Reflect.deleteProperty(window, 'matchMedia')
  }
}

describe('appearance utilities', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    restoreMatchMedia()
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    document.documentElement.style.removeProperty('--k8s-accent')
    document.documentElement.style.removeProperty('--k8s-accent-dark')
    document.documentElement.style.removeProperty('--k8s-accent-text')
    document.documentElement.style.removeProperty('--k8s-accent-text-dark')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    restoreMatchMedia()
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

  it.each(CONTRAST_COLORS)(
    'derives foreground-safe text accents for %s',
    (color) => {
      const textAccent = deriveTextAccent(color)
      const decorativeAccent = deriveAccent(color)

      expect(contrastRatio(textAccent.light, '#FFFFFF')).toBeGreaterThanOrEqual(4.5)
      for (const surface of DARK_SURFACES) {
        expect(contrastRatio(textAccent.dark, surface)).toBeGreaterThanOrEqual(4.5)
      }
      expect(textAccent.light.split(' ').slice(0, 2)).toEqual(
        decorativeAccent.light.split(' ').slice(0, 2),
      )
      expect(textAccent.dark.split(' ').slice(0, 2)).toEqual(
        decorativeAccent.dark.split(' ').slice(0, 2),
      )
      expect(contrastRatio(decorativeAccent.light, '#FFFFFF')).toBeGreaterThanOrEqual(3)
      expect(contrastRatio(decorativeAccent.dark, DARK_SURFACES[2])).toBeGreaterThanOrEqual(3)
    },
  )

  it.each(CONTRAST_COLORS)(
    'derives white-text-safe button accents for %s',
    (color) => {
      const buttons = deriveButtonAccent(color)

      for (const background of [buttons.base, buttons.hover, buttons.active]) {
        expect(contrastRatio(background, '#FFFFFF')).toBeGreaterThanOrEqual(4.5)
      }
    },
  )

  it('resolves explicit and automatic color modes', () => {
    expect(resolveDarkMode('auto', true)).toBe(true)
    expect(resolveDarkMode('auto', false)).toBe(false)
    expect(resolveDarkMode('light', true)).toBe(false)
    expect(resolveDarkMode('dark', false)).toBe(true)
  })

  it('applies accent variables and the resolved dark class', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))

    applyAppearance('#8FD8BC', 'auto')

    expect(
      document.documentElement.style.getPropertyValue('--k8s-accent'),
    ).toBe('hsl(156 48% 36%)')
    expect(
      document.documentElement.style.getPropertyValue('--k8s-accent-dark'),
    ).toBe('hsl(156 48% 68%)')
    const textAccent = deriveTextAccent('#8FD8BC')
    expect(
      document.documentElement.style.getPropertyValue('--k8s-accent-text'),
    ).toBe(textAccent.light)
    expect(
      document.documentElement.style.getPropertyValue('--k8s-accent-text-dark'),
    ).toBe(textAccent.dark)
    for (const name of [
      '--k8s-accent-button',
      '--k8s-accent-button-hover',
      '--k8s-accent-button-active',
    ]) {
      expect(
        document.documentElement.style.getPropertyValue(name),
      ).toMatch(/^hsl\(/)
      expect(
        contrastRatio(
          document.documentElement.style.getPropertyValue(name),
          '#FFFFFF',
        ),
      ).toBeGreaterThanOrEqual(4.5)
    }
    expect(
      contrastRatio(
        document.documentElement.style.getPropertyValue('--k8s-accent-text'),
        '#FFFFFF',
      ),
    ).toBeGreaterThanOrEqual(4.5)
    expect(
      contrastRatio(
        document.documentElement.style.getPropertyValue('--k8s-accent-text-dark'),
        DARK_SURFACES[0],
      ),
    ).toBeGreaterThanOrEqual(4.5)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('falls back safely when the matchMedia getter throws in auto mode', () => {
    const getter = vi.fn(() => {
      throw new Error('media query denied')
    })
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      get: getter,
    })

    expect(() => applyAppearance('#28755D', 'auto')).not.toThrow()
    expect(getter).toHaveBeenCalledOnce()
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('falls back safely when the matchMedia function throws in auto mode', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => {
        throw new Error('media query denied')
      }),
    )

    expect(() => applyAppearance('#28755D', 'auto')).not.toThrow()
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('does not read matchMedia for explicit light and dark modes', () => {
    const getter = vi.fn(() => {
      throw new Error('media query denied')
    })
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      get: getter,
    })

    expect(() => applyAppearance('#28755D', 'light')).not.toThrow()
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(() => applyAppearance('#28755D', 'dark')).not.toThrow()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(getter).not.toHaveBeenCalled()
  })

  it('is safe when the document has no root element', () => {
    vi.spyOn(document, 'documentElement', 'get').mockReturnValue(
      null as unknown as HTMLElement,
    )

    expect(() => applyAppearance('#28755D', 'light')).not.toThrow()
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
