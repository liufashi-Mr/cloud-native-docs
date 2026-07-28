export type AppearanceMode = 'auto' | 'light' | 'dark'

export const DEFAULT_COLOR = '#28755D'

export const PRESET_COLORS = [
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
] as const

const COLOR_STORAGE_KEY = 'cloud-native-theme-color'
const MODE_STORAGE_KEY = 'cloud-native-theme-mode'
const LEGACY_COLOR_STORAGE_KEY = 'k8s-theme-color'
const LEGACY_MODE_STORAGE_KEY = 'k8s-theme-mode'

export interface AppearanceState {
  color: string
  mode: AppearanceMode
}

export interface AccentColors {
  light: string
  dark: string
}

export interface ButtonAccentColors {
  base: string
  hover: string
  active: string
}

interface AccentChannels {
  hue: number
  saturation: number
}

type RgbColor = readonly [number, number, number]

const LIGHT_TEXT_BACKGROUND: RgbColor = [1, 1, 1]
const DARK_TEXT_BACKGROUND: RgbColor = [34 / 255, 40 / 255, 46 / 255]
const MINIMUM_TEXT_CONTRAST = 4.5

export function normalizeHex(value: string): string | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(value)
  return match ? `#${match[1].toUpperCase()}` : null
}

export function deriveAccent(value: string): AccentColors {
  const { hue, saturation } = deriveAccentChannels(value)

  return {
    light: formatHsl(hue, saturation, 36),
    dark: formatHsl(hue, saturation, 68),
  }
}

export function deriveTextAccent(value: string): AccentColors {
  const { hue, saturation } = deriveAccentChannels(value)
  const light = findContrastLightness(
    hue,
    saturation,
    36,
    -1,
    LIGHT_TEXT_BACKGROUND,
  )
  const dark = findContrastLightness(
    hue,
    saturation,
    68,
    1,
    DARK_TEXT_BACKGROUND,
  )

  return {
    light: formatHsl(hue, saturation, light),
    dark: formatHsl(hue, saturation, dark),
  }
}

export function deriveButtonAccent(value: string): ButtonAccentColors {
  const { hue, saturation } = deriveAccentChannels(value)
  const base = findContrastLightness(
    hue,
    saturation,
    36,
    -1,
    LIGHT_TEXT_BACKGROUND,
  )

  return {
    base: formatHsl(hue, saturation, base),
    hover: formatHsl(hue, saturation, Math.max(0, base - 4)),
    active: formatHsl(hue, saturation, Math.max(0, base - 8)),
  }
}

function deriveAccentChannels(value: string): AccentChannels {
  const normalized = normalizeHex(value) ?? DEFAULT_COLOR
  const red = Number.parseInt(normalized.slice(1, 3), 16) / 255
  const green = Number.parseInt(normalized.slice(3, 5), 16) / 255
  const blue = Number.parseInt(normalized.slice(5, 7), 16) / 255
  const maximum = Math.max(red, green, blue)
  const minimum = Math.min(red, green, blue)
  const delta = maximum - minimum
  const lightness = (maximum + minimum) / 2

  let hue = 0
  if (delta !== 0) {
    if (maximum === red) {
      hue = ((green - blue) / delta + 6) % 6
    } else if (maximum === green) {
      hue = (blue - red) / delta + 2
    } else {
      hue = (red - green) / delta + 4
    }
  }

  const rawSaturation =
    delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1))
  const saturation = Math.min(72, Math.max(34, Math.round(rawSaturation * 100)))
  const hueDegrees = Math.floor(hue * 60)

  return { hue: hueDegrees, saturation }
}

function formatHsl(hue: number, saturation: number, lightness: number): string {
  return `hsl(${hue} ${saturation}% ${lightness}%)`
}

function findContrastLightness(
  hue: number,
  saturation: number,
  initialLightness: number,
  direction: -1 | 1,
  background: RgbColor,
): number {
  let lightness = initialLightness

  while (
    contrastRatio(hslToRgb(hue, saturation, lightness), background) <
      MINIMUM_TEXT_CONTRAST &&
    lightness > 0 &&
    lightness < 100
  ) {
    lightness += direction
  }

  return lightness
}

function hslToRgb(
  hue: number,
  saturationPercent: number,
  lightnessPercent: number,
): RgbColor {
  const saturation = saturationPercent / 100
  const lightness = lightnessPercent / 100
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

function relativeLuminance([red, green, blue]: RgbColor): number {
  const linearize = (channel: number): number =>
    channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4

  return (
    0.2126 * linearize(red) +
    0.7152 * linearize(green) +
    0.0722 * linearize(blue)
  )
}

function contrastRatio(first: RgbColor, second: RgbColor): number {
  const firstLuminance = relativeLuminance(first)
  const secondLuminance = relativeLuminance(second)
  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05)
  )
}

export function resolveDarkMode(
  mode: AppearanceMode,
  systemDark: boolean,
): boolean {
  if (mode === 'dark') return true
  if (mode === 'light') return false
  return systemDark
}

export function applyAppearance(
  color: string,
  mode: AppearanceMode,
): void {
  const systemDark = mode === 'auto' ? getSystemDark() : false
  const dark = resolveDarkMode(mode, systemDark)

  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (!root) return

  const accent = deriveAccent(color)
  const textAccent = deriveTextAccent(color)
  const buttonAccent = deriveButtonAccent(color)
  root.style.setProperty('--cloud-native-accent', accent.light)
  root.style.setProperty('--cloud-native-accent-dark', accent.dark)
  root.style.setProperty('--cloud-native-accent-text', textAccent.light)
  root.style.setProperty('--cloud-native-accent-text-dark', textAccent.dark)
  root.style.setProperty('--cloud-native-accent-button', buttonAccent.base)
  root.style.setProperty('--cloud-native-accent-button-hover', buttonAccent.hover)
  root.style.setProperty('--cloud-native-accent-button-active', buttonAccent.active)
  root.classList.toggle('dark', dark)
}

export function loadAppearance(): AppearanceState {
  const fallback: AppearanceState = { color: DEFAULT_COLOR, mode: 'auto' }
  const storage = getStorage()
  if (!storage) return fallback

  let color = fallback.color
  let mode = fallback.mode

  const storedColor = readMigratedValue(
    storage,
    COLOR_STORAGE_KEY,
    LEGACY_COLOR_STORAGE_KEY,
    normalizeHex,
  )
  if (storedColor !== null) color = storedColor

  const storedMode = readMigratedValue(
    storage,
    MODE_STORAGE_KEY,
    LEGACY_MODE_STORAGE_KEY,
    (value) => (isAppearanceMode(value) ? value : null),
  )
  if (storedMode !== null) mode = storedMode

  return { color, mode }
}

export function saveAppearance(color: string, mode: AppearanceMode): void {
  const storage = getStorage()
  if (!storage) return

  const normalizedColor = normalizeHex(color) ?? DEFAULT_COLOR
  const normalizedMode = isAppearanceMode(mode) ? mode : 'auto'

  try {
    storage.setItem(COLOR_STORAGE_KEY, normalizedColor)
  } catch {
    // Persistence is optional; appearance still applies in memory.
  }

  try {
    storage.setItem(MODE_STORAGE_KEY, normalizedMode)
  } catch {
    // Persistence is optional; appearance still applies in memory.
  }
}

function isAppearanceMode(value: unknown): value is AppearanceMode {
  return value === 'auto' || value === 'light' || value === 'dark'
}

function readMigratedValue<T extends string>(
  storage: Storage,
  currentKey: string,
  legacyKey: string,
  normalize: (value: string) => T | null,
): T | null {
  let currentValue: string | null = null
  try {
    currentValue = storage.getItem(currentKey)
  } catch {
    return null
  }

  const normalizedCurrent = normalize(currentValue ?? '')
  if (normalizedCurrent !== null) return normalizedCurrent

  let legacyValue: string | null = null
  try {
    legacyValue = storage.getItem(legacyKey)
  } catch {
    return null
  }

  const normalizedLegacy = normalize(legacyValue ?? '')
  if (normalizedLegacy === null) return null

  try {
    storage.setItem(currentKey, normalizedLegacy)
    storage.removeItem(legacyKey)
  } catch {
    // Migration is best-effort; the valid value still applies in memory.
  }

  return normalizedLegacy
}

function getSystemDark(): boolean {
  if (typeof window === 'undefined') return false

  try {
    const matchMedia = window.matchMedia
    return typeof matchMedia === 'function'
      ? matchMedia.call(window, '(prefers-color-scheme: dark)').matches
      : false
  } catch {
    return false
  }
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null

  try {
    return window.localStorage
  } catch {
    return null
  }
}
