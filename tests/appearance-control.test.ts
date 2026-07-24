import type { Ref } from 'vue'
import { nextTick } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import AppearanceControl from '../docs/.vitepress/theme/components/AppearanceControl.vue'
import {
  PRESET_COLORS,
  deriveAccent,
} from '../docs/.vitepress/theme/appearance'
import { resetAppearanceStateForTests } from '../docs/.vitepress/theme/appearance-state'

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
    resetAppearanceStateForTests()
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

  it('renders an accessible standalone trigger for the current mode', async () => {
    installMatchMedia()
    const wrapper = mountControl()
    const modeTrigger = wrapper.get('button[data-mode-trigger]')

    expect(modeTrigger.attributes('data-mode')).toBe('auto')
    expect(modeTrigger.attributes('aria-label')).toBe(
      '明暗模式：当前自适应，点击切换为浅色',
    )
    expect(modeTrigger.attributes('title')).toBe(
      '明暗模式：当前自适应，点击切换为浅色',
    )
    expect(modeTrigger.get('svg').classes()).toContain('lucide-monitor')
    expect(modeTrigger.get('svg').attributes('aria-hidden')).toBe('true')

    await wrapper.get('button[aria-label="外观设置"]').trigger('click')

    expect(wrapper.get('[role="dialog"]').find('[data-mode]').exists()).toBe(false)
  })

  it('focuses the selected color when the popover opens', async () => {
    installMatchMedia()
    const wrapper = mountControl()

    await wrapper.get('button[aria-label="外观设置"]').trigger('click')
    await nextTick()

    expect(document.activeElement).toBe(
      wrapper.get(`button[data-color="${PRESET_COLORS[0]}"]`).element,
    )
  })

  it('shows the current color on the trigger and updates it for every color choice', async () => {
    installMatchMedia()
    const wrapper = mountControl()
    const trigger = wrapper.get('button[aria-label="外观设置"]')
    const palette = trigger.get('svg')

    expect(palette.attributes('stroke')).toBe(PRESET_COLORS[0])

    await trigger.trigger('click')
    await wrapper.get(`button[data-color="${PRESET_COLORS[3]}"]`).trigger('click')
    expect(palette.attributes('stroke')).toBe(PRESET_COLORS[3])

    await wrapper.get('input[type="color"]').setValue('#8fd8bc')
    expect(palette.attributes('stroke')).toBe('#8FD8BC')
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

  it('cycles auto, light, and dark while persisting and synchronizing state', async () => {
    installMatchMedia(true)
    const wrapper = mountControl()
    const modeTrigger = wrapper.get('button[data-mode-trigger]')

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(vitepressData.isDark!.value).toBe(true)

    await modeTrigger.trigger('click')

    expect(modeTrigger.attributes('data-mode')).toBe('light')
    expect(modeTrigger.attributes('aria-label')).toBe(
      '明暗模式：当前浅色，点击切换为深色',
    )
    expect(modeTrigger.attributes('title')).toBe(
      '明暗模式：当前浅色，点击切换为深色',
    )
    expect(modeTrigger.get('svg').classes()).toContain('lucide-sun')
    expect(localStorage.getItem('k8s-theme-mode')).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(vitepressData.isDark!.value).toBe(false)

    await modeTrigger.trigger('click')

    expect(modeTrigger.attributes('data-mode')).toBe('dark')
    expect(modeTrigger.attributes('aria-label')).toBe(
      '明暗模式：当前深色，点击切换为自适应',
    )
    expect(modeTrigger.attributes('title')).toBe(
      '明暗模式：当前深色，点击切换为自适应',
    )
    expect(modeTrigger.get('svg').classes()).toContain('lucide-moon')
    expect(localStorage.getItem('k8s-theme-mode')).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(vitepressData.isDark!.value).toBe(true)

    await modeTrigger.trigger('click')

    expect(modeTrigger.attributes('data-mode')).toBe('auto')
    expect(modeTrigger.get('svg').classes()).toContain('lucide-monitor')
    expect(localStorage.getItem('k8s-theme-mode')).toBe('auto')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(vitepressData.isDark!.value).toBe(true)
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
    const media = installMatchMedia()
    const desktop = mountControl()
    const mobile = mountControl()

    expect(media.addEventListener).toHaveBeenCalledOnce()

    await desktop.get('button[aria-label="外观设置"]').trigger('click')
    await desktop.get(`button[data-color="${PRESET_COLORS[4]}"]`).trigger('click')
    await desktop.get('button[data-mode-trigger]').trigger('click')

    await mobile.get('button[aria-label="外观设置"]').trigger('click')

    expect(
      mobile
        .get(`button[data-color="${PRESET_COLORS[4]}"]`)
        .attributes('aria-pressed'),
    ).toBe('true')
    expect(mobile.get('button[data-mode-trigger]').attributes('data-mode')).toBe(
      'light',
    )

    await mobile.get('button[data-mode-trigger]').trigger('click')

    expect(desktop.get('button[data-mode-trigger]').attributes('data-mode')).toBe(
      'dark',
    )
    expect(desktop.get('button[data-mode-trigger] svg').classes()).toContain(
      'lucide-moon',
    )

    desktop.unmount()
    expect(media.removeEventListener).not.toHaveBeenCalled()
    mobile.unmount()
    expect(media.removeEventListener).toHaveBeenCalledOnce()
  })

  it('preserves in-memory choices across remounts when storage writes fail', async () => {
    installMatchMedia(false)
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(() => {
        throw new Error('storage denied')
      }),
    })

    const first = mountControl()
    await first.get('button[aria-label="外观设置"]').trigger('click')
    await first.get(`button[data-color="${PRESET_COLORS[6]}"]`).trigger('click')
    await first.get('button[data-mode-trigger]').trigger('click')
    await first.get('button[data-mode-trigger]').trigger('click')
    expect(vitepressData.isDark!.value).toBe(true)
    first.unmount()

    vitepressData.isDark!.value = false
    const remounted = mountControl()
    await remounted.get('button[aria-label="外观设置"]').trigger('click')

    expect(
      remounted
        .get(`button[data-color="${PRESET_COLORS[6]}"]`)
        .attributes('aria-pressed'),
    ).toBe('true')
    expect(remounted.get('button[data-mode-trigger]').attributes('data-mode')).toBe(
      'dark',
    )
    expect(remounted.get('button[data-mode-trigger] svg').classes()).toContain(
      'lucide-moon',
    )
    expect(vitepressData.isDark!.value).toBe(true)
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

    await wrapper.get('button[data-mode-trigger]').trigger('click')
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
