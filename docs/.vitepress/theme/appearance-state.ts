import { ref, type Ref } from 'vue'

import {
  DEFAULT_COLOR,
  applyAppearance,
  loadAppearance,
  normalizeHex,
  resolveDarkMode,
  saveAppearance,
  type AppearanceMode,
} from './appearance'

export const appearanceColor = ref(DEFAULT_COLOR)
export const appearanceMode = ref<AppearanceMode>('auto')

let initialized = false
let mountedControls = 0
let mediaQuery: MediaQueryList | null = null
const darkTargets = new Map<Ref<boolean>, number>()

function createMediaQuery(): MediaQueryList | null {
  if (typeof window === 'undefined') return null

  try {
    return typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null
  } catch {
    return null
  }
}

function systemDark(): boolean {
  return appearanceMode.value === 'auto' ? (mediaQuery?.matches ?? false) : false
}

function synchronizeDarkMode(systemIsDark = systemDark()): void {
  const dark = resolveDarkMode(appearanceMode.value, systemIsDark)
  darkTargets.forEach((_count, target) => {
    target.value = dark
  })
}

function applyCurrent(persist: boolean, systemIsDark = systemDark()): void {
  applyAppearance(appearanceColor.value, appearanceMode.value)
  synchronizeDarkMode(systemIsDark)
  if (persist) saveAppearance(appearanceColor.value, appearanceMode.value)
}

function handleSystemModeChange(event: MediaQueryListEvent): void {
  if (appearanceMode.value === 'auto') applyCurrent(false, event.matches)
}

function initializeOnce(): void {
  if (initialized) return

  const saved = loadAppearance()
  appearanceColor.value = saved.color
  appearanceMode.value = saved.mode
  initialized = true
}

export function mountAppearance(target: Ref<boolean>): () => void {
  initializeOnce()
  darkTargets.set(target, (darkTargets.get(target) ?? 0) + 1)
  mountedControls += 1

  if (mountedControls === 1) {
    mediaQuery = createMediaQuery()
    mediaQuery?.addEventListener('change', handleSystemModeChange)
  }

  applyCurrent(false)
  let active = true

  return () => {
    if (!active) return
    active = false

    const targetMounts = (darkTargets.get(target) ?? 1) - 1
    if (targetMounts > 0) darkTargets.set(target, targetMounts)
    else darkTargets.delete(target)

    mountedControls -= 1
    if (mountedControls === 0) {
      mediaQuery?.removeEventListener('change', handleSystemModeChange)
      mediaQuery = null
    }
  }
}

export function selectAppearanceColor(nextColor: string): void {
  appearanceColor.value = normalizeHex(nextColor) ?? DEFAULT_COLOR
  applyCurrent(true)
}

export function selectAppearanceMode(nextMode: AppearanceMode): void {
  appearanceMode.value = nextMode
  applyCurrent(true)
}

export function resetAppearanceStateForTests(): void {
  mediaQuery?.removeEventListener('change', handleSystemModeChange)
  mediaQuery = null
  initialized = false
  mountedControls = 0
  darkTargets.clear()
  appearanceColor.value = DEFAULT_COLOR
  appearanceMode.value = 'auto'
}
