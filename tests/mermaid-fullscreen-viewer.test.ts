import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { nextTick } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import MermaidFullscreenViewer from '../docs/.vitepress/theme/components/MermaidFullscreenViewer.vue'

enableAutoUnmount(afterEach)

const SVG =
  '<svg viewBox="0 0 1200 600"><text>diagram</text></svg>'

let viewportWidth = 1000
let viewportHeight = 700
let toolbarBounds: DOMRect | null = null
let animationFrameSequence = 0
let animationFrameCallbacks = new Map<number, FrameRequestCallback>()

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    toJSON: () => ({}),
  }
}

function flushAnimationFrame(): void {
  const callbacks = Array.from(animationFrameCallbacks.values())
  animationFrameCallbacks.clear()
  callbacks.forEach((callback) => callback(performance.now()))
}

function viewport(): HTMLElement {
  const element = document.querySelector<HTMLElement>(
    '.mermaid-fullscreen-viewer__viewport',
  )
  if (!element) throw new Error('viewport not found')
  return element
}

function surface(): HTMLElement {
  const element = document.querySelector<HTMLElement>(
    '.mermaid-fullscreen-viewer__surface',
  )
  if (!element) throw new Error('surface not found')
  return element
}

function toolbarButtons(): HTMLButtonElement[] {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>(
      '.mermaid-fullscreen-viewer__toolbar button',
    ),
  )
}

function button(label: string): HTMLButtonElement {
  const element = document.querySelector<HTMLButtonElement>(
    `button[aria-label="${label}"]`,
  )
  if (!element) throw new Error(`button not found: ${label}`)
  return element
}

function transform(): { x: number; y: number; scale: number } {
  const value = surface().style.transform
  const match = value.match(
    /translate\(([-\d.e]+)px,\s*([-\d.e]+)px\)\s*scale\(([-\d.e]+)\)/,
  )
  if (!match) throw new Error(`unexpected transform: ${value}`)
  return { x: Number(match[1]), y: Number(match[2]), scale: Number(match[3]) }
}

function dispatchPointer(
  target: EventTarget,
  type: string,
  init: {
    pointerId: number
    clientX: number
    clientY: number
    pointerType?: string
    button?: number
  },
): Event {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    pointerId: { value: init.pointerId },
    clientX: { value: init.clientX },
    clientY: { value: init.clientY },
    pointerType: { value: init.pointerType ?? 'mouse' },
    button: { value: init.button ?? 0 },
  })
  target.dispatchEvent(event)
  return event
}

function cssDeclarations(source: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const declarations = source.match(
    new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, 's'),
  )?.[1]
  if (!declarations) throw new Error(`CSS rule not found: ${selector}`)
  return declarations
}

function cssHexColor(declarations: string, property: string): string {
  const color = declarations.match(
    new RegExp(`\\b${property}:\\s*(#[\\da-f]{6})\\s*;`, 'i'),
  )?.[1]
  if (!color) throw new Error(`hex color not found for ${property}`)
  return color
}

function relativeLuminance(hex: string): number {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    ?.map((channel) => Number.parseInt(channel, 16) / 255)
  if (!channels) throw new Error(`invalid color: ${hex}`)

  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4,
  )
  return red * 0.2126 + green * 0.7152 + blue * 0.0722
}

function contrastRatio(first: string, second: string): number {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second))
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second))
  return (lighter + 0.05) / (darker + 0.05)
}

async function mountViewer() {
  const wrapper = mount(MermaidFullscreenViewer, {
    attachTo: document.body,
    props: { svg: SVG },
  })
  await nextTick()
  return wrapper
}

describe('MermaidFullscreenViewer', () => {
  beforeEach(() => {
    viewportWidth = 1000
    viewportHeight = 700
    toolbarBounds = null
    animationFrameSequence = 0
    animationFrameCallbacks = new Map()
    document.body.style.overflow = ''

    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        const id = ++animationFrameSequence
        animationFrameCallbacks.set(id, callback)
        return id
      }),
    )
    vi.stubGlobal(
      'cancelAnimationFrame',
      vi.fn((id: number) => animationFrameCallbacks.delete(id)),
    )

    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(
      function (this: HTMLElement) {
        return this.classList.contains('mermaid-fullscreen-viewer__viewport')
          ? viewportWidth
          : 0
      },
    )
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(
      function (this: HTMLElement) {
        return this.classList.contains('mermaid-fullscreen-viewer__viewport')
          ? viewportHeight
          : 0
      },
    )
    vi.spyOn(
      HTMLElement.prototype,
      'getBoundingClientRect',
    ).mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('mermaid-fullscreen-viewer__viewport')) {
        return rect(100, 50, viewportWidth, viewportHeight)
      }
      if (
        toolbarBounds &&
        this.classList.contains('mermaid-fullscreen-viewer__toolbar')
      ) {
        return toolbarBounds
      }
      return rect(0, 0, 0, 0)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    document.body.style.overflow = ''
  })

  it('teleports an accessible dialog and names every toolbar control', async () => {
    await mountViewer()

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')
    expect(dialog).not.toBeNull()
    expect(dialog?.getAttribute('aria-modal')).toBe('true')

    const titleId = dialog?.getAttribute('aria-labelledby')
    const title = titleId ? document.getElementById(titleId) : null
    expect(title?.textContent).toBe('全屏图表')
    expect(title?.classList.contains('mermaid-fullscreen-viewer__sr-only')).toBe(
      true,
    )
    expect(surface().querySelectorAll('svg')).toHaveLength(1)
    expect(surface().textContent).toContain('diagram')

    expect(toolbarButtons().map((control) => control.getAttribute('aria-label'))).toEqual([
      '放大图表',
      '缩小图表',
      '重置图表视图',
      '关闭全屏图表',
    ])
    for (const control of toolbarButtons()) {
      expect(control.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    }
  })

  it('locks body scrolling, restores the previous value, and requests close once', async () => {
    document.body.style.overflow = 'scroll'
    const wrapper = await mountViewer()

    expect(document.body.style.overflow).toBe('hidden')
    button('关闭全屏图表').click()
    await nextTick()
    expect(wrapper.emitted('close')).toHaveLength(1)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(wrapper.emitted('close')).toHaveLength(1)

    wrapper.unmount()
    expect(document.body.style.overflow).toBe('scroll')
  })

  it('coordinates scroll lock, keyboard ownership, and close across modal instances', async () => {
    document.body.style.overflow = 'scroll'
    const first = await mountViewer()
    const second = await mountViewer()
    const dialogs = Array.from(
      document.querySelectorAll<HTMLElement>('[role="dialog"]'),
    )
    const firstDialog = dialogs[0]
    const secondDialog = dialogs[1]
    const secondControls = Array.from(
      secondDialog.querySelectorAll<HTMLButtonElement>('button'),
    )
    const secondFirstControl = secondControls[0]
    const secondClose = secondControls.at(-1)
    if (!secondClose) throw new Error('second close button not found')

    expect(document.body.style.overflow).toBe('hidden')
    expect(document.activeElement).toBe(secondClose)

    const tabEvent = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Tab',
    })
    const preventDefault = vi.spyOn(tabEvent, 'preventDefault')
    secondClose.dispatchEvent(tabEvent)
    await nextTick()

    expect(preventDefault).toHaveBeenCalledOnce()
    expect(document.activeElement).toBe(secondFirstControl)
    expect(firstDialog.contains(document.activeElement)).toBe(false)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(first.emitted('close')).toBeUndefined()
    expect(second.emitted('close')).toHaveLength(1)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    secondClose.click()
    await nextTick()
    expect(first.emitted('close')).toBeUndefined()
    expect(second.emitted('close')).toHaveLength(1)

    first.unmount()
    expect(document.body.style.overflow).toBe('hidden')
    second.unmount()
    expect(document.body.style.overflow).toBe('scroll')
  })

  it('removes resize and keydown listeners without post-unmount side effects', async () => {
    const addWindowListener = vi.spyOn(window, 'addEventListener')
    const removeWindowListener = vi.spyOn(window, 'removeEventListener')
    const addDocumentListener = vi.spyOn(document, 'addEventListener')
    const removeDocumentListener = vi.spyOn(document, 'removeEventListener')
    const wrapper = await mountViewer()

    const resizeHandler = addWindowListener.mock.calls.find(
      ([type]) => type === 'resize',
    )?.[1]
    const keydownHandler = addDocumentListener.mock.calls.find(
      ([type]) => type === 'keydown',
    )?.[1]
    expect(resizeHandler).toBeDefined()
    expect(keydownHandler).toBeDefined()

    viewportWidth = 800
    window.dispatchEvent(new Event('resize'))
    flushAnimationFrame()
    await nextTick()
    const renderedSurface = surface()
    const transformBeforeUnmount = renderedSurface.style.transform
    const closeCountBeforeUnmount = wrapper.emitted('close')?.length ?? 0

    wrapper.unmount()

    expect(removeWindowListener).toHaveBeenCalledWith('resize', resizeHandler)
    expect(removeDocumentListener).toHaveBeenCalledWith(
      'keydown',
      keydownHandler,
    )

    viewportWidth = 600
    window.dispatchEvent(new Event('resize'))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()

    expect(renderedSurface.style.transform).toBe(transformBeforeUnmount)
    expect(wrapper.emitted('close')?.length ?? 0).toBe(closeCountBeforeUnmount)
  })

  it('coalesces resize fits without reparsing SVG and cancels pending work', async () => {
    const parseSvg = vi.spyOn(DOMParser.prototype, 'parseFromString')
    const wrapper = await mountViewer()
    const initialTransform = transform()

    expect(parseSvg).toHaveBeenCalledOnce()

    viewportWidth = 900
    window.dispatchEvent(new Event('resize'))
    viewportWidth = 800
    window.dispatchEvent(new Event('resize'))
    viewportWidth = 700
    window.dispatchEvent(new Event('resize'))

    expect(parseSvg).toHaveBeenCalledOnce()
    expect(requestAnimationFrame).toHaveBeenCalledOnce()
    expect(transform()).toEqual(initialTransform)

    flushAnimationFrame()
    await nextTick()
    expect(transform().scale).toBeCloseTo(604 / 1200)
    expect(transform().x).toBeCloseTo(48)
    expect(transform().y).toBeCloseTo(199)

    viewportWidth = 600
    window.dispatchEvent(new Event('resize'))
    expect(animationFrameCallbacks.size).toBe(1)
    wrapper.unmount()

    expect(cancelAnimationFrame).toHaveBeenCalled()
    expect(animationFrameCallbacks.size).toBe(0)
  })

  it('fits initially, resets to fit, and refits after window resize', async () => {
    await mountViewer()

    expect(surface().style.width).toBe('1200px')
    expect(surface().style.height).toBe('600px')
    expect(transform().scale).toBeCloseTo(904 / 1200)
    expect(transform().x).toBeCloseTo(48)
    expect(transform().y).toBeCloseTo(124)

    button('放大图表').click()
    await nextTick()
    expect(transform().scale).toBeGreaterThan(904 / 1200)

    button('重置图表视图').click()
    await nextTick()
    expect(transform().scale).toBeCloseTo(904 / 1200)
    expect(transform().x).toBeCloseTo(48)
    expect(transform().y).toBeCloseTo(124)

    viewportWidth = 800
    viewportHeight = 500
    window.dispatchEvent(new Event('resize'))
    flushAnimationFrame()
    await nextTick()
    expect(transform().scale).toBeCloseTo(704 / 1200)
    expect(transform().x).toBeCloseTo(48)
    expect(transform().y).toBeCloseTo(74)
  })

  it('fits the diagram clear of a toolbar obstructing viewport edges', async () => {
    toolbarBounds = rect(900, 62, 188, 50)
    const wrapper = mount(MermaidFullscreenViewer, {
      attachTo: document.body,
      props: {
        svg: '<svg viewBox="0 0 1200 1000"><text>diagram</text></svg>',
      },
    })
    await nextTick()

    const fitted = transform()
    const viewportBounds = viewport().getBoundingClientRect()
    const diagramBounds = rect(
      viewportBounds.left + fitted.x,
      viewportBounds.top + fitted.y,
      1200 * fitted.scale,
      1000 * fitted.scale,
    )
    const toolbar = toolbarBounds
    if (!toolbar) throw new Error('toolbar bounds not configured')

    expect(
      diagramBounds.right <= toolbar.left ||
        diagramBounds.left >= toolbar.right ||
        diagramBounds.bottom <= toolbar.top ||
        diagramBounds.top >= toolbar.bottom,
    ).toBe(true)

    toolbarBounds = rect(506, 688, 188, 50)
    window.dispatchEvent(new Event('resize'))
    flushAnimationFrame()
    await nextTick()
    const resized = transform()
    const resizedDiagramBounds = rect(
      viewportBounds.left + resized.x,
      viewportBounds.top + resized.y,
      1200 * resized.scale,
      1000 * resized.scale,
    )
    expect(
      resizedDiagramBounds.right <= toolbarBounds.left ||
        resizedDiagramBounds.left >= toolbarBounds.right ||
        resizedDiagramBounds.bottom <= toolbarBounds.top ||
        resizedDiagramBounds.top >= toolbarBounds.bottom,
    ).toBe(true)

    button('放大图表').click()
    button('重置图表视图').click()
    await nextTick()
    expect(transform()).toEqual(resized)
    wrapper.unmount()
  })

  it('zooms with controls and scales wheel input continuously around its pointer', async () => {
    await mountViewer()
    const fitted = transform()
    const center = { x: viewportWidth / 2, y: viewportHeight / 2 }
    const diagramCenterBeforeZoom = {
      x: (center.x - fitted.x) / fitted.scale,
      y: (center.y - fitted.y) / fitted.scale,
    }

    button('放大图表').click()
    await nextTick()
    const zoomed = transform()
    expect(zoomed.scale).toBeCloseTo(fitted.scale * 1.2)
    expect((center.x - zoomed.x) / zoomed.scale).toBeCloseTo(
      diagramCenterBeforeZoom.x,
    )
    expect((center.y - zoomed.y) / zoomed.scale).toBeCloseTo(
      diagramCenterBeforeZoom.y,
    )

    button('缩小图表').click()
    await nextTick()
    const restored = transform()
    expect(restored.scale).toBeCloseTo(fitted.scale)
    expect((center.x - restored.x) / restored.scale).toBeCloseTo(
      diagramCenterBeforeZoom.x,
    )
    expect((center.y - restored.y) / restored.scale).toBeCloseTo(
      diagramCenterBeforeZoom.y,
    )

    const pointer = { x: 200, y: 200 }
    const diagramPointBeforeWheel = {
      x: (pointer.x - restored.x) / restored.scale,
      y: (pointer.y - restored.y) / restored.scale,
    }
    const smallPixelEvent = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX: 300,
      clientY: 250,
      deltaY: -1,
      deltaMode: WheelEvent.DOM_DELTA_PIXEL,
    })
    viewport().dispatchEvent(smallPixelEvent)
    await nextTick()

    const smallPixelZoom = transform()
    expect(smallPixelEvent.defaultPrevented).toBe(true)
    expect(smallPixelZoom.scale).toBeGreaterThan(fitted.scale)
    expect(smallPixelZoom.scale).toBeLessThan(fitted.scale * 1.02)
    expect((pointer.x - smallPixelZoom.x) / smallPixelZoom.scale).toBeCloseTo(
      diagramPointBeforeWheel.x,
    )
    expect((pointer.y - smallPixelZoom.y) / smallPixelZoom.scale).toBeCloseTo(
      diagramPointBeforeWheel.y,
    )
    expect(
      document
        .querySelector('.mermaid-fullscreen-viewer')
        ?.classList.contains('mermaid-fullscreen-viewer--wheel-zooming'),
    ).toBe(true)

    button('重置图表视图').click()
    const largePixelEvent = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX: 300,
      clientY: 250,
      deltaY: -120,
      deltaMode: WheelEvent.DOM_DELTA_PIXEL,
    })
    viewport().dispatchEvent(largePixelEvent)
    await nextTick()
    const largePixelScale = transform().scale
    expect(largePixelScale).toBeGreaterThan(smallPixelZoom.scale)

    button('重置图表视图').click()
    const lineEvent = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX: 300,
      clientY: 250,
      deltaY: -1,
      deltaMode: WheelEvent.DOM_DELTA_LINE,
    })
    viewport().dispatchEvent(lineEvent)
    await nextTick()
    expect(transform().scale).toBeGreaterThan(smallPixelZoom.scale)
    expect(transform().scale).toBeLessThan(largePixelScale)

    button('重置图表视图').click()
    const pageEvent = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX: 300,
      clientY: 250,
      deltaY: -1,
      deltaMode: WheelEvent.DOM_DELTA_PAGE,
    })
    viewport().dispatchEvent(pageEvent)
    await nextTick()
    expect(transform().scale).toBeGreaterThan(largePixelScale)

    flushAnimationFrame()
    await nextTick()
    expect(
      document
        .querySelector('.mermaid-fullscreen-viewer')
        ?.classList.contains('mermaid-fullscreen-viewer--wheel-zooming'),
    ).toBe(false)
  })

  it('clamps zoom between half the fitted scale and four', async () => {
    await mountViewer()
    const fittedScale = transform().scale

    for (let index = 0; index < 20; index += 1) button('缩小图表').click()
    await nextTick()
    expect(transform().scale).toBeCloseTo(fittedScale / 2)

    for (let index = 0; index < 40; index += 1) button('放大图表').click()
    await nextTick()
    expect(transform().scale).toBe(4)
  })

  it('pans touch and pen pointers by client delta while owning capture', async () => {
    await mountViewer()
    const target = viewport()
    const setPointerCapture = vi.fn()
    const releasePointerCapture = vi.fn()
    target.setPointerCapture = setPointerCapture
    target.releasePointerCapture = releasePointerCapture
    const fitted = transform()

    dispatchPointer(target, 'pointerdown', {
      pointerId: 7,
      clientX: 250,
      clientY: 300,
      pointerType: 'touch',
    })
    dispatchPointer(target, 'pointermove', {
      pointerId: 8,
      clientX: 900,
      clientY: 900,
      pointerType: 'touch',
    })
    await nextTick()
    expect(transform()).toEqual(fitted)

    dispatchPointer(target, 'pointermove', {
      pointerId: 7,
      clientX: 270,
      clientY: 275,
      pointerType: 'touch',
    })
    await nextTick()
    expect(transform().x).toBeCloseTo(fitted.x + 20)
    expect(transform().y).toBeCloseTo(fitted.y - 25)
    expect(setPointerCapture).toHaveBeenCalledWith(7)

    dispatchPointer(target, 'pointerup', {
      pointerId: 7,
      clientX: 270,
      clientY: 275,
      pointerType: 'touch',
    })
    expect(releasePointerCapture).toHaveBeenCalledWith(7)

    const afterTouch = transform()
    dispatchPointer(target, 'pointerdown', {
      pointerId: 9,
      clientX: 400,
      clientY: 300,
      pointerType: 'pen',
    })
    dispatchPointer(target, 'lostpointercapture', {
      pointerId: 9,
      clientX: 400,
      clientY: 300,
      pointerType: 'pen',
    })
    dispatchPointer(target, 'pointermove', {
      pointerId: 9,
      clientX: 500,
      clientY: 500,
      pointerType: 'pen',
    })
    await nextTick()
    expect(transform()).toEqual(afterTouch)

    dispatchPointer(target, 'pointerdown', {
      pointerId: 10,
      clientX: 300,
      clientY: 200,
      pointerType: 'pen',
    })
    dispatchPointer(target, 'pointercancel', {
      pointerId: 10,
      clientX: 300,
      clientY: 200,
      pointerType: 'pen',
    })
    dispatchPointer(target, 'pointermove', {
      pointerId: 10,
      clientX: 600,
      clientY: 600,
      pointerType: 'pen',
    })
    await nextTick()
    expect(releasePointerCapture).toHaveBeenCalledWith(10)
    expect(transform()).toEqual(afterTouch)
  })

  it('pans a left-button mouse pointer and ignores non-left buttons', async () => {
    await mountViewer()
    const target = viewport()
    const setPointerCapture = vi.fn()
    const releasePointerCapture = vi.fn()
    target.setPointerCapture = setPointerCapture
    target.releasePointerCapture = releasePointerCapture
    const fitted = transform()

    dispatchPointer(target, 'pointerdown', {
      pointerId: 21,
      clientX: 200,
      clientY: 180,
      pointerType: 'mouse',
      button: 2,
    })
    dispatchPointer(target, 'pointermove', {
      pointerId: 21,
      clientX: 500,
      clientY: 480,
      pointerType: 'mouse',
    })
    dispatchPointer(target, 'pointerup', {
      pointerId: 21,
      clientX: 500,
      clientY: 480,
      pointerType: 'mouse',
      button: 2,
    })
    await nextTick()

    expect(transform()).toEqual(fitted)
    expect(setPointerCapture).not.toHaveBeenCalled()
    expect(releasePointerCapture).not.toHaveBeenCalled()

    dispatchPointer(target, 'pointerdown', {
      pointerId: 22,
      clientX: 320,
      clientY: 260,
      pointerType: 'mouse',
    })
    dispatchPointer(target, 'pointermove', {
      pointerId: 22,
      clientX: 345,
      clientY: 245,
      pointerType: 'mouse',
    })
    await nextTick()

    expect(transform().x).toBeCloseTo(fitted.x + 25)
    expect(transform().y).toBeCloseTo(fitted.y - 15)
    expect(setPointerCapture).toHaveBeenCalledWith(22)

    dispatchPointer(target, 'pointerup', {
      pointerId: 22,
      clientX: 345,
      clientY: 245,
      pointerType: 'mouse',
    })
    expect(releasePointerCapture).toHaveBeenCalledWith(22)
  })

  it('traps focus within toolbar controls and initially focuses close', async () => {
    await mountViewer()
    const controls = toolbarButtons()
    const first = controls[0]
    const close = controls[controls.length - 1]

    expect(document.activeElement).toBe(close)

    close.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Tab' }),
    )
    await nextTick()
    expect(document.activeElement).toBe(first)

    first.focus()
    first.dispatchEvent(
      new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        key: 'Tab',
        shiftKey: true,
      }),
    )
    await nextTick()
    expect(document.activeElement).toBe(close)
  })

  it('uses SVG dimensions when viewBox is invalid and keeps fallback geometry finite', async () => {
    const wrapper = mount(MermaidFullscreenViewer, {
      attachTo: document.body,
      props: { svg: '<svg width="800" height="400"><text>diagram</text></svg>' },
    })
    await nextTick()

    expect(transform().scale).toBe(1)
    expect(transform().x).toBe(100)
    expect(transform().y).toBe(150)

    await wrapper.setProps({ svg: '<svg viewBox="invalid"></svg>' })
    window.dispatchEvent(new Event('resize'))
    await nextTick()
    expect(Number.isFinite(transform().scale)).toBe(true)
    expect(Number.isFinite(transform().x)).toBe(true)
    expect(Number.isFinite(transform().y)).toBe(true)
  })

  it('keeps interaction and responsive style contracts explicit', () => {
    const componentSource = readFileSync(
      resolve(
        process.cwd(),
        'docs/.vitepress/theme/components/MermaidFullscreenViewer.vue',
      ),
      'utf8',
    )
    const styles = componentSource.match(
      /<style scoped>([\s\S]*?)<\/style>/,
    )?.[1]
    if (!styles) throw new Error('scoped component styles not found')

    const surfaceRule = cssDeclarations(
      styles,
      '.mermaid-fullscreen-viewer__surface',
    )
    const viewportRule = cssDeclarations(
      styles,
      '.mermaid-fullscreen-viewer__viewport',
    )
    expect(surfaceRule).toMatch(/\btransform-origin:\s*0 0\s*;/)
    expect(viewportRule).toMatch(/\btouch-action:\s*none\s*;/)

    const lightRule = cssDeclarations(styles, '.mermaid-fullscreen-viewer')
    const darkRule = cssDeclarations(
      styles,
      ':global(.dark) .mermaid-fullscreen-viewer',
    )
    for (const rule of [lightRule, darkRule]) {
      expect(rule).toMatch(/\bcolor:\s*#[\da-f]{6}\s*;/i)
      expect(rule).toMatch(/\bbackground:\s*rgba\([^;]+\)\s*;/)
    }
    expect(lightRule).toMatch(/\bcolor-scheme:\s*light\s*;/)
    expect(darkRule).toMatch(/\bcolor-scheme:\s*dark\s*;/)

    const darkToolbarRule = cssDeclarations(
      styles,
      ':global(.dark) .mermaid-fullscreen-viewer__toolbar',
    )
    const darkToolbarHoverRule = cssDeclarations(
      styles,
      ':global(.dark) .mermaid-fullscreen-viewer__toolbar button:hover',
    )
    const darkFocusRule = cssDeclarations(
      styles,
      ':global(.dark) .mermaid-fullscreen-viewer__toolbar button:focus-visible',
    )
    const darkFocusColor = cssHexColor(darkFocusRule, 'outline-color')
    expect(
      contrastRatio(
        darkFocusColor,
        cssHexColor(darkToolbarRule, 'background'),
      ),
    ).toBeGreaterThanOrEqual(3)
    expect(
      contrastRatio(
        darkFocusColor,
        cssHexColor(darkToolbarHoverRule, 'background'),
      ),
    ).toBeGreaterThanOrEqual(3)

    const toolbarButtonRule = cssDeclarations(
      styles,
      '.mermaid-fullscreen-viewer__toolbar button',
    )
    expect(toolbarButtonRule).toMatch(/\bwidth:\s*40px\s*;/)
    expect(toolbarButtonRule).toMatch(/\bheight:\s*40px\s*;/)

    const mobileStart = styles.indexOf('@media (max-width: 480px)')
    const reducedMotionStart = styles.indexOf(
      '@media (prefers-reduced-motion: reduce)',
    )
    expect(mobileStart).toBeGreaterThanOrEqual(0)
    expect(reducedMotionStart).toBeGreaterThan(mobileStart)
    const mobileStyles = styles.slice(mobileStart, reducedMotionStart)
    expect(mobileStyles).toMatch(
      /\bbottom:\s*calc\(12px \+ env\(safe-area-inset-bottom\)\)\s*;/,
    )
    expect(mobileStyles).toMatch(/\bmax-width:\s*calc\(100vw - 24px\)\s*;/)

    const reducedMotionStyles = styles.slice(reducedMotionStart)
    const reducedMotionSurfaceRule = cssDeclarations(
      reducedMotionStyles,
      '.mermaid-fullscreen-viewer__surface',
    )
    expect(reducedMotionSurfaceRule).toMatch(/\btransition:\s*none\s*;/)
  })
})
