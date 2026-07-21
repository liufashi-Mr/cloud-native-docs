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

const COLOR_STORAGE_KEY = 'k8s-theme-color'
const MODE_STORAGE_KEY = 'k8s-theme-mode'

export interface AppearanceState {
  color: string
  mode: AppearanceMode
}

export interface AccentColors {
  light: string
  dark: string
}

export function normalizeHex(value: string): string | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(value)
  return match ? `#${match[1].toUpperCase()}` : null
}

export function deriveAccent(value: string): AccentColors {
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

  return {
    light: `hsl(${hueDegrees} ${saturation}% 36%)`,
    dark: `hsl(${hueDegrees} ${saturation}% 68%)`,
  }
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
): boolean {
  const dark = resolveDarkMode(mode, getSystemDark())

  if (typeof document === 'undefined') return dark

  const accent = deriveAccent(color)
  document.documentElement.style.setProperty('--k8s-accent', accent.light)
  document.documentElement.style.setProperty('--k8s-accent-dark', accent.dark)
  document.documentElement.classList.toggle('dark', dark)
  return dark
}

export function loadAppearance(): AppearanceState {
  const fallback: AppearanceState = { color: DEFAULT_COLOR, mode: 'auto' }
  const storage = getStorage()
  if (!storage) return fallback

  let color = fallback.color
  let mode = fallback.mode

  try {
    color = normalizeHex(storage.getItem(COLOR_STORAGE_KEY) ?? '') ?? color
  } catch {
    // Storage can be disabled even when localStorage exists.
  }

  try {
    const storedMode = storage.getItem(MODE_STORAGE_KEY)
    if (isAppearanceMode(storedMode)) mode = storedMode
  } catch {
    // Preserve any preference that was read successfully.
  }

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

function getSystemDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }

  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
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
