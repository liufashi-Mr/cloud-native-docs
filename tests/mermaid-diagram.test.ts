import type { Ref } from 'vue'
import { nextTick } from 'vue'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import MermaidDiagram from '../docs/.vitepress/theme/components/MermaidDiagram.vue'

const vitepressData = vi.hoisted(
  (): { isDark: Ref<boolean> | null } => ({ isDark: null }),
)
const mermaid = vi.hoisted(() => ({
  initialize: vi.fn(),
  render: vi.fn(),
}))

vi.mock('vitepress', async () => {
  const { ref } = await import('vue')
  vitepressData.isDark = ref(false)
  return {
    useData: () => ({ isDark: vitepressData.isDark }),
  }
})

vi.mock('mermaid', () => ({ default: mermaid }))

enableAutoUnmount(afterEach)

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

describe('MermaidDiagram', () => {
  beforeEach(() => {
    if (vitepressData.isDark) vitepressData.isDark.value = false
    mermaid.initialize.mockReset()
    mermaid.render.mockReset()
  })

  it('rerenders the SVG when VitePress changes color mode', async () => {
    mermaid.render
      .mockResolvedValueOnce({ svg: '<svg data-theme="light"></svg>' })
      .mockResolvedValueOnce({ svg: '<svg data-theme="dark"></svg>' })

    const wrapper = mount(MermaidDiagram, {
      props: { encodedSource: encodeURIComponent('flowchart LR\nA --> B') },
    })
    await flushPromises()

    expect(mermaid.initialize).toHaveBeenLastCalledWith({
      securityLevel: 'strict',
      startOnLoad: false,
      theme: 'default',
    })
    expect(wrapper.find('svg').attributes('data-theme')).toBe('light')

    vitepressData.isDark!.value = true
    await nextTick()
    await flushPromises()

    expect(mermaid.initialize).toHaveBeenLastCalledWith({
      securityLevel: 'strict',
      startOnLoad: false,
      theme: 'dark',
    })
    expect(wrapper.find('svg').attributes('data-theme')).toBe('dark')
  })

  it('ignores stale render results after a color-mode change', async () => {
    const lightRender = deferred<{ svg: string }>()
    const darkRender = deferred<{ svg: string }>()
    mermaid.render
      .mockImplementationOnce(() => lightRender.promise)
      .mockImplementationOnce(() => darkRender.promise)

    const wrapper = mount(MermaidDiagram, {
      props: { encodedSource: encodeURIComponent('flowchart LR\nA --> B') },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('flowchart LR')

    vitepressData.isDark!.value = true
    await nextTick()
    await flushPromises()

    darkRender.resolve({ svg: '<svg data-theme="dark"></svg>' })
    await flushPromises()
    expect(wrapper.find('svg').attributes('data-theme')).toBe('dark')

    lightRender.resolve({ svg: '<svg data-theme="light"></svg>' })
    await flushPromises()
    expect(wrapper.find('svg').attributes('data-theme')).toBe('dark')
  })
})
