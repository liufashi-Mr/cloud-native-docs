import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Ref } from 'vue'
import { nextTick } from 'vue'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import MermaidDiagram from '../docs/.vitepress/theme/components/MermaidDiagram.vue'
import MermaidFullscreenViewer from '../docs/.vitepress/theme/components/MermaidFullscreenViewer.vue'

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

  it('preserves Mermaid label paragraph metrics', () => {
    const componentSource = readFileSync(
      resolve(
        process.cwd(),
        'docs/.vitepress/theme/components/MermaidDiagram.vue',
      ),
      'utf8',
    )
    const labelParagraphRule = componentSource.match(
      /\.mermaid-diagram\s+:deep\(\.label p\)\s*\{([^}]*)\}/,
    )?.[1]

    expect(labelParagraphRule).toBeDefined()
    expect(labelParagraphRule).toMatch(/\bmargin:\s*0\s*;/)
    expect(labelParagraphRule).toMatch(/\bline-height:\s*inherit\s*;/)
  })

  it('loads the full-screen viewer asynchronously', () => {
    const componentSource = readFileSync(
      resolve(
        process.cwd(),
        'docs/.vitepress/theme/components/MermaidDiagram.vue',
      ),
      'utf8',
    )

    expect(componentSource).not.toMatch(
      /import\s+MermaidFullscreenViewer\s+from\s+['"]\.\/MermaidFullscreenViewer\.vue['"]/,
    )
    expect(componentSource).toMatch(
      /defineAsyncComponent\(\(\)\s*=>\s*import\(['"]\.\/MermaidFullscreenViewer\.vue['"]\)\)/,
    )
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

  it('rerenders the SVG with the decoded source when encodedSource changes', async () => {
    const initialSource = 'flowchart LR\nA --> B'
    const updatedSource = 'flowchart TD\nC --> D'
    mermaid.render
      .mockResolvedValueOnce({ svg: '<svg data-source="initial"></svg>' })
      .mockResolvedValueOnce({ svg: '<svg data-source="updated"></svg>' })

    const wrapper = mount(MermaidDiagram, {
      props: { encodedSource: encodeURIComponent(initialSource) },
    })
    await flushPromises()

    await wrapper.setProps({ encodedSource: encodeURIComponent(updatedSource) })
    await flushPromises()

    expect(mermaid.render).toHaveBeenCalledTimes(2)
    expect(mermaid.render.mock.calls[1]?.[1]).toBe(updatedSource)
    expect(wrapper.find('svg').attributes('data-source')).toBe('updated')
  })

  it('ignores stale render results after a source change', async () => {
    const initialRender = deferred<{ svg: string }>()
    const updatedRender = deferred<{ svg: string }>()
    mermaid.render
      .mockImplementationOnce(() => initialRender.promise)
      .mockImplementationOnce(() => updatedRender.promise)

    const wrapper = mount(MermaidDiagram, {
      props: { encodedSource: encodeURIComponent('flowchart LR\nA --> B') },
    })
    await flushPromises()

    await wrapper.setProps({
      encodedSource: encodeURIComponent('flowchart TD\nC --> D'),
    })
    await flushPromises()
    expect(mermaid.render).toHaveBeenCalledTimes(2)

    updatedRender.resolve({ svg: '<svg data-source="updated"></svg>' })
    await flushPromises()
    expect(wrapper.find('svg').attributes('data-source')).toBe('updated')

    initialRender.resolve({ svg: '<svg data-source="initial"></svg>' })
    await flushPromises()
    expect(wrapper.find('svg').attributes('data-source')).toBe('updated')
  })

  it('preserves a readable intrinsic width for wide rendered diagrams', async () => {
    mermaid.render.mockResolvedValue({
      svg: '<svg width="100%" viewBox="0 0 2371 1868"></svg>',
    })

    const wrapper = mount(MermaidDiagram, {
      props: { encodedSource: encodeURIComponent('flowchart TD\nA --> B') },
    })
    await flushPromises()

    const canvas = wrapper.find('.mermaid-diagram__canvas')
    expect(canvas.classes()).toContain('mermaid-diagram__canvas--wide')
    expect(canvas.attributes('style')).toContain(
      '--mermaid-intrinsic-width: 2000px',
    )
  })

  it('does not enlarge a simple rendered diagram', async () => {
    mermaid.render.mockResolvedValue({
      svg: '<svg width="100%" viewBox="0 0 640 360"></svg>',
    })

    const wrapper = mount(MermaidDiagram, {
      props: { encodedSource: encodeURIComponent('flowchart LR\nA --> B') },
    })
    await flushPromises()

    const canvas = wrapper.find('.mermaid-diagram__canvas')
    expect(canvas.classes()).not.toContain('mermaid-diagram__canvas--wide')
    expect(canvas.attributes('style')).toBeUndefined()
  })

  it('opens the already-rendered SVG without rerendering Mermaid', async () => {
    const renderedSvg =
      '<svg viewBox="0 0 1200 600"><text>diagram</text></svg>'
    mermaid.render.mockResolvedValue({ svg: renderedSvg })

    const wrapper = mount(MermaidDiagram, {
      attachTo: document.body,
      props: { encodedSource: encodeURIComponent('flowchart LR\nA --> B') },
    })
    await flushPromises()

    const trigger = wrapper.get('button[aria-label="全屏查看图表"]')
    expect(trigger.attributes('title')).toBe('全屏查看图表')
    await trigger.trigger('click')
    await flushPromises()

    const dialog = document.body.querySelector('[role="dialog"]')
    expect(dialog).not.toBeNull()
    expect(dialog?.querySelector('.mermaid-fullscreen-viewer__surface')?.innerHTML).toBe(
      renderedSvg,
    )
    expect(mermaid.render).toHaveBeenCalledTimes(1)
  })

  it('restores focus after closing and supports repeated open and close', async () => {
    mermaid.render.mockResolvedValue({
      svg: '<svg viewBox="0 0 1200 600"><text>diagram</text></svg>',
    })

    const wrapper = mount(MermaidDiagram, {
      attachTo: document.body,
      props: { encodedSource: encodeURIComponent('flowchart LR\nA --> B') },
    })
    await flushPromises()

    const trigger = wrapper.get<HTMLButtonElement>(
      'button[aria-label="全屏查看图表"]',
    )
    trigger.element.focus()
    await trigger.trigger('click')
    await flushPromises()
    await wrapper.getComponent(MermaidFullscreenViewer).vm.$emit('close')
    await nextTick()

    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(trigger.element)

    await trigger.trigger('click')
    await flushPromises()
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()
    await wrapper.getComponent(MermaidFullscreenViewer).vm.$emit('close')
    await nextTick()
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(trigger.element)
  })

  it('only shows the full-screen trigger after a successful SVG render', async () => {
    const pendingRender = deferred<{ svg: string }>()
    mermaid.render.mockReturnValue(pendingRender.promise)

    const wrapper = mount(MermaidDiagram, {
      props: { encodedSource: encodeURIComponent('flowchart LR\nA --> B') },
    })
    await nextTick()
    expect(wrapper.find('button[aria-label="全屏查看图表"]').exists()).toBe(false)
    expect(wrapper.find('.mermaid-diagram__source').exists()).toBe(true)

    pendingRender.resolve({ svg: '<svg><text>diagram</text></svg>' })
    await flushPromises()
    expect(wrapper.find('button[aria-label="全屏查看图表"]').exists()).toBe(true)

    wrapper.unmount()
    mermaid.render.mockRejectedValueOnce(new Error('bad diagram'))
    const errored = mount(MermaidDiagram, {
      props: { encodedSource: encodeURIComponent('flowchart LR\nA --> B') },
    })
    await flushPromises()
    expect(errored.find('button[aria-label="全屏查看图表"]').exists()).toBe(false)
    expect(errored.find('.mermaid-diagram__error').text()).toContain('bad diagram')
  })

  it('keeps the full-screen action outside the horizontally scrolling canvas', async () => {
    mermaid.render.mockResolvedValue({
      svg: '<svg viewBox="0 0 2371 1868"><text>wide diagram</text></svg>',
    })

    const wrapper = mount(MermaidDiagram, {
      props: { encodedSource: encodeURIComponent('flowchart LR\nA --> B') },
    })
    await flushPromises()

    const triggerSelector = 'button[aria-label="全屏查看图表"]'
    expect(wrapper.get('.mermaid-diagram__actions').find(triggerSelector).exists()).toBe(
      true,
    )
    expect(wrapper.get('.mermaid-diagram__viewport').find(triggerSelector).exists()).toBe(
      false,
    )

    const componentSource = readFileSync(
      resolve(
        process.cwd(),
        'docs/.vitepress/theme/components/MermaidDiagram.vue',
      ),
      'utf8',
    )
    expect(
      componentSource.match(/\.mermaid-diagram\s*\{([^}]*)\}/)?.[1],
    ).toMatch(/\boverflow-x:\s*auto\s*;/)
    expect(
      componentSource.match(/\.mermaid-diagram__viewport\s*\{([^}]*)\}/)?.[1],
    ).toMatch(/\boverflow-x:\s*auto\s*;/)
  })

  it('updates an open viewer with the latest theme SVG without an extra render', async () => {
    const lightSvg = '<svg data-theme="light"><text>light</text></svg>'
    const darkSvg = '<svg data-theme="dark"><text>dark</text></svg>'
    mermaid.render
      .mockResolvedValueOnce({ svg: lightSvg })
      .mockResolvedValueOnce({ svg: darkSvg })

    const wrapper = mount(MermaidDiagram, {
      attachTo: document.body,
      props: { encodedSource: encodeURIComponent('flowchart LR\nA --> B') },
    })
    await flushPromises()
    await wrapper.get('button[aria-label="全屏查看图表"]').trigger('click')
    await flushPromises()

    expect(
      document.body.querySelector('.mermaid-fullscreen-viewer__surface')?.innerHTML,
    ).toBe(lightSvg)

    vitepressData.isDark!.value = true
    await nextTick()
    await flushPromises()

    expect(wrapper.find('svg[data-theme="dark"]').exists()).toBe(true)
    expect(
      document.body.querySelector('.mermaid-fullscreen-viewer__surface')?.innerHTML,
    ).toBe(darkSvg)
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()
    expect(mermaid.render).toHaveBeenCalledTimes(2)
  })

  it('updates an open viewer when encodedSource changes without an extra render', async () => {
    const initialSvg = '<svg data-source="initial"><text>initial</text></svg>'
    const updatedSvg = '<svg data-source="updated"><text>updated</text></svg>'
    mermaid.render
      .mockResolvedValueOnce({ svg: initialSvg })
      .mockResolvedValueOnce({ svg: updatedSvg })

    const wrapper = mount(MermaidDiagram, {
      attachTo: document.body,
      props: {
        encodedSource: encodeURIComponent('flowchart LR\nA --> B'),
      },
    })
    await flushPromises()
    await wrapper.get('button[aria-label="全屏查看图表"]').trigger('click')
    await flushPromises()

    await wrapper.setProps({
      encodedSource: encodeURIComponent('flowchart TD\nC --> D'),
    })
    await flushPromises()

    expect(wrapper.getComponent(MermaidFullscreenViewer).props('svg')).toBe(
      updatedSvg,
    )
    expect(
      document.body.querySelector('.mermaid-fullscreen-viewer__surface svg')
        ?.getAttribute('data-source'),
    ).toBe('updated')
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()
    expect(mermaid.render).toHaveBeenCalledTimes(2)
  })

  it('closes an open viewer when the latest theme render fails', async () => {
    mermaid.render
      .mockResolvedValueOnce({ svg: '<svg data-theme="light"></svg>' })
      .mockRejectedValueOnce(new Error('dark render failed'))

    const wrapper = mount(MermaidDiagram, {
      attachTo: document.body,
      props: { encodedSource: encodeURIComponent('flowchart LR\nA --> B') },
    })
    await flushPromises()
    await wrapper.get('button[aria-label="全屏查看图表"]').trigger('click')
    await flushPromises()
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()

    vitepressData.isDark!.value = true
    await nextTick()
    await flushPromises()

    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    expect(wrapper.find('button[aria-label="全屏查看图表"]').exists()).toBe(false)
    expect(wrapper.get('.mermaid-diagram__error').text()).toContain(
      'dark render failed',
    )
  })

  it('closes an open viewer when a source-change render fails', async () => {
    mermaid.render
      .mockResolvedValueOnce({ svg: '<svg data-source="initial"></svg>' })
      .mockRejectedValueOnce(new Error('updated source failed'))

    const wrapper = mount(MermaidDiagram, {
      attachTo: document.body,
      props: {
        encodedSource: encodeURIComponent('flowchart LR\nA --> B'),
      },
    })
    await flushPromises()
    await wrapper.get('button[aria-label="全屏查看图表"]').trigger('click')
    await flushPromises()
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()

    await wrapper.setProps({
      encodedSource: encodeURIComponent('flowchart TD\nC --> D'),
    })
    await flushPromises()

    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    expect(wrapper.find('button[aria-label="全屏查看图表"]').exists()).toBe(false)
    expect(wrapper.get('.mermaid-diagram__error').text()).toContain(
      'updated source failed',
    )
    expect(mermaid.render).toHaveBeenCalledTimes(2)
  })

  it('closes the viewer and restores body scrolling when unmounted', async () => {
    document.body.style.overflow = 'scroll'
    mermaid.render.mockResolvedValue({
      svg: '<svg viewBox="0 0 1200 600"><text>diagram</text></svg>',
    })

    const wrapper = mount(MermaidDiagram, {
      attachTo: document.body,
      props: { encodedSource: encodeURIComponent('flowchart LR\nA --> B') },
    })
    await flushPromises()
    await wrapper.get('button[aria-label="全屏查看图表"]').trigger('click')
    await flushPromises()
    expect(document.body.style.overflow).toBe('hidden')

    wrapper.unmount()
    await nextTick()
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    expect(document.body.style.overflow).toBe('scroll')
  })
})
