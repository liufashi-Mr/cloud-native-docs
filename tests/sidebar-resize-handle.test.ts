import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import SidebarResizeHandle from '../docs/.vitepress/theme/components/SidebarResizeHandle.vue'

function dispatchPointer(
  target: EventTarget,
  type: string,
  clientX: number,
  pointerId = 7,
): void {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    clientX: { value: clientX },
    pointerId: { value: pointerId },
    pointerType: { value: 'mouse' },
    button: { value: 0 },
  })
  target.dispatchEvent(event)
}

describe('SidebarResizeHandle', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.style.removeProperty('--cloud-native-sidebar-width')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    localStorage.clear()
    document.documentElement.classList.remove('cloud-native-sidebar-resizing')
    document.documentElement.style.removeProperty('--cloud-native-sidebar-width')
  })

  it('clamps pointer resizing to the 220-380px desktop range', async () => {
    const wrapper = mount(SidebarResizeHandle, { attachTo: document.body })
    const handle = wrapper.get<HTMLElement>('[role="separator"]')
    handle.element.setPointerCapture = vi.fn()
    handle.element.releasePointerCapture = vi.fn()

    dispatchPointer(handle.element, 'pointerdown', 280)
    dispatchPointer(handle.element, 'pointermove', 460)
    await nextTick()

    expect(document.documentElement.style.getPropertyValue('--cloud-native-sidebar-width')).toBe(
      '380px',
    )
    expect(handle.attributes('aria-valuenow')).toBe('380')

    dispatchPointer(handle.element, 'pointermove', 120)
    dispatchPointer(handle.element, 'pointerup', 120)
    await nextTick()

    expect(document.documentElement.style.getPropertyValue('--cloud-native-sidebar-width')).toBe(
      '220px',
    )
    expect(localStorage.getItem('cloud-native-sidebar-width')).toBe('220')
    expect(document.documentElement.classList.contains('cloud-native-sidebar-resizing')).toBe(
      false,
    )
  })

  it('supports keyboard resizing and persists the selected width', async () => {
    localStorage.setItem('cloud-native-sidebar-width', '260')
    const wrapper = mount(SidebarResizeHandle)
    await nextTick()
    const handle = wrapper.get('[role="separator"]')

    expect(handle.attributes('aria-valuemin')).toBe('220')
    expect(handle.attributes('aria-valuemax')).toBe('380')
    expect(handle.attributes('aria-valuenow')).toBe('260')

    await handle.trigger('keydown', { key: 'ArrowRight' })
    expect(handle.attributes('aria-valuenow')).toBe('272')
    expect(localStorage.getItem('cloud-native-sidebar-width')).toBe('272')

    await handle.trigger('keydown', { key: 'Home' })
    expect(handle.attributes('aria-valuenow')).toBe('220')

    await handle.trigger('keydown', { key: 'End' })
    expect(handle.attributes('aria-valuenow')).toBe('380')
  })

  it('migrates a valid legacy sidebar width', async () => {
    localStorage.setItem('k8s-sidebar-width', '260')

    const wrapper = mount(SidebarResizeHandle)
    await nextTick()

    expect(wrapper.get('[role="separator"]').attributes('aria-valuenow')).toBe('260')
    expect(localStorage.getItem('cloud-native-sidebar-width')).toBe('260')
    expect(localStorage.getItem('k8s-sidebar-width')).toBeNull()
  })

  it('prefers a valid cloud-native sidebar width', async () => {
    localStorage.setItem('cloud-native-sidebar-width', '272')
    localStorage.setItem('k8s-sidebar-width', '260')

    const wrapper = mount(SidebarResizeHandle)
    await nextTick()

    expect(wrapper.get('[role="separator"]').attributes('aria-valuenow')).toBe('272')
  })

  it('continues resizing when browser storage is unavailable', async () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => {
        throw new Error('storage denied')
      }),
      setItem: vi.fn(() => {
        throw new Error('storage denied')
      }),
      removeItem: vi.fn(() => {
        throw new Error('storage denied')
      }),
    })

    const wrapper = mount(SidebarResizeHandle)
    await nextTick()
    const handle = wrapper.get('[role="separator"]')

    await handle.trigger('keydown', { key: 'End' })

    expect(handle.attributes('aria-valuenow')).toBe('380')
  })

  it('keeps keyboard focus feedback on the narrow handle instead of its full-height box', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'docs/.vitepress/theme/components/SidebarResizeHandle.vue',
      ),
      'utf8',
    )
    expect(source).toMatch(
      /\.k8s-sidebar-resize-handle:focus-visible\s*\{[^}]*outline:\s*none/,
    )
  })
})
