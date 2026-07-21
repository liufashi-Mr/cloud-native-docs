import type { Ref } from 'vue'
import { nextTick } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import AppearanceControl from '../docs/.vitepress/theme/components/AppearanceControl.vue'
import {
  PRESET_COLORS,
  deriveAccent,
} from '../docs/.vitepress/theme/appearance'

const vitepressData = vi.hoisted(
  (): { isDark: Ref<boolean> | null } => ({ isDark: null }),
)

vi.mock('vitepress', async () => {
  const { ref } = await import('vue')
  vitepressData.isDark = ref(false)
  return {
    useData: () => ({ isDark: vitepressData.isDark }),
  }
})

enableAutoUnmount(afterEach)

interface MediaController {
  media: MediaQueryList
  emit: (matches: boolean) => void
  addEventListener: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
}

function installMatchMedia(initialMatches = false): MediaController {
  const listeners = new Set<(event: MediaQueryListEvent) => void>()
  const addEventListener = vi.fn(
    (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener)
    },
  )
  const removeEventListener = vi.fn(
    (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener)
    },
  )
  const media = {
    matches: initialMatches,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener,
    removeEventListener,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList

  vi.stubGlobal('matchMedia', vi.fn(() => media))

  return {
    media,
    addEventListener,
    removeEventListener,
    emit(matches: boolean) {
      Object.defineProperty(media, 'matches', { configurable: true, value: matches })
      listeners.forEach((listener) => listener({ matches } as MediaQueryListEvent))
    },
  }
}

function mountControl() {
  return mount(AppearanceControl, { attachTo: document.body })
}

describe('AppearanceControl', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    document.documentElement.style.removeProperty('--k8s-accent')
    document.documentElement.style.removeProperty('--k8s-accent-dark')
    if (vitepressData.isDark) vitepressData.isDark.value = false
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('opens and closes an accessible appearance dialog', async () => {
    installMatchMedia()
    const wrapper = mountControl()
    const trigger = wrapper.get('button[aria-label="外观设置"]')

    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)

    await trigger.trigger('click')

    expect(trigger.attributes('aria-expanded')).toBe('true')
    const dialog = wrapper.get('[role="dialog"]')
    expect(dialog.attributes('aria-label')).toBe('外观设置')
    expect(trigger.attributes('aria-haspopup')).toBe('dialog')
    expect(trigger.attributes('aria-controls')).toBe(dialog.attributes('id'))

    await trigger.trigger('click')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('shows the current color on the trigger and updates it for every color choice', async () => {
    installMatchMedia()
    const wrapper = mountControl()
    const trigger = wrapper.get('button[aria-label="外观设置"]')
    const currentColor = trigger.get('.k8s-appearance__current-color')

    expect(currentColor.attributes('style')).toContain(
      `--current-color: ${PRESET_COLORS[0]}`,
    )

    await trigger.trigger('click')
    await wrapper.get(`button[data-color="${PRESET_COLORS[3]}"]`).trigger('click')
    expect(currentColor.attributes('style')).toContain(
      `--current-color: ${PRESET_COLORS[3]}`,
    )

    await wrapper.get('input[type="color"]').setValue('#8fd8bc')
    expect(currentColor.attributes('style')).toContain('--current-color: #8FD8BC')
  })

  it('renders every preset and persists the selected color', async () => {
    installMatchMedia()
    const wrapper = mountControl()
    await wrapper.get('button[aria-label="外观设置"]').trigger('click')

    const swatches = wrapper.findAll('button[data-color]')
    expect(swatches).toHaveLength(PRESET_COLORS.length)

    await swatches[2].trigger('click')

    expect(swatches[2].attributes('aria-pressed')).toBe('true')
    expect(localStorage.getItem('k8s-theme-color')).toBe(PRESET_COLORS[2])
    expect(
      document.documentElement.style.getPropertyValue('--k8s-accent'),
    ).toBe(deriveAccent(PRESET_COLORS[2]).light)
  })

  it('applies and persists a custom color from the native color input', async () => {
    installMatchMedia()
    const wrapper = mountControl()
    await wrapper.get('button[aria-label="外观设置"]').trigger('click')

    await wrapper.get('input[type="color"]').setValue('#8fd8bc')

    expect(localStorage.getItem('k8s-theme-color')).toBe('#8FD8BC')
    expect(wrapper.text()).toContain('#8FD8BC')
    expect(wrapper.find('button[data-color][aria-pressed="true"]').exists()).toBe(
      false,
    )
  })

  it('loads mode state and keeps VitePress isDark synchronized with choices', async () => {
    installMatchMedia(false)
    localStorage.setItem('k8s-theme-color', '#555DB0')
    localStorage.setItem('k8s-theme-mode', 'dark')

    const wrapper = mountControl()
    await wrapper.get('button[aria-label="外观设置"]').trigger('click')

    expect(wrapper.get('button[data-mode="dark"]').attributes('aria-pressed')).toBe(
      'true',
    )
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(vitepressData.isDark!.value).toBe(true)

    await wrapper.get('button[data-mode="light"]').trigger('click')

    expect(localStorage.getItem('k8s-theme-mode')).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(vitepressData.isDark!.value).toBe(false)
  })

  it('closes on outside click and Escape', async () => {
    installMatchMedia()
    const wrapper = mountControl()
    const trigger = wrapper.get('button[aria-label="外观设置"]')

    await trigger.trigger('click')
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)

    await trigger.trigger('click')
    const swatch = wrapper.get('button[data-color]').element as HTMLButtonElement
    swatch.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger.element)
  })

  it('keeps desktop and mobile control state synchronized', async () => {
    installMatchMedia()
    const desktop = mountControl()
    const mobile = mountControl()

    await desktop.get('button[aria-label="外观设置"]').trigger('click')
    await desktop.get(`button[data-color="${PRESET_COLORS[4]}"]`).trigger('click')
    await desktop.get('button[data-mode="dark"]').trigger('click')

    await mobile.get('button[aria-label="外观设置"]').trigger('click')

    expect(
      mobile
        .get(`button[data-color="${PRESET_COLORS[4]}"]`)
        .attributes('aria-pressed'),
    ).toBe('true')
    expect(mobile.get('button[data-mode="dark"]').attributes('aria-pressed')).toBe(
      'true',
    )
  })

  it('tracks system changes only in auto mode and removes the listener', async () => {
    const media = installMatchMedia(false)
    const wrapper = mountControl()

    expect(media.addEventListener).toHaveBeenCalledWith('change', expect.any(Function))
    expect(vitepressData.isDark!.value).toBe(false)

    media.emit(true)
    await nextTick()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(vitepressData.isDark!.value).toBe(true)

    await wrapper.get('button[aria-label="外观设置"]').trigger('click')
    await wrapper.get('button[data-mode="light"]').trigger('click')
    media.emit(true)
    await nextTick()
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(vitepressData.isDark!.value).toBe(false)

    wrapper.unmount()
    expect(media.removeEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function),
    )
  })
})
