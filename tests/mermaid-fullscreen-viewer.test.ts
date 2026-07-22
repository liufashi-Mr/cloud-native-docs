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
  },
): Event {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    pointerId: { value: init.pointerId },
    clientX: { value: init.clientX },
    clientY: { value: init.clientY },
    pointerType: { value: init.pointerType ?? 'mouse' },
    button: { value: 0 },
  })
  target.dispatchEvent(event)
  return event
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
    document.body.style.overflow = ''

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
        return {
          x: 100,
          y: 50,
          left: 100,
          top: 50,
          right: 100 + viewportWidth,
          bottom: 50 + viewportHeight,
          width: viewportWidth,
          height: viewportHeight,
          toJSON: () => ({}),
        }
      }
      return {
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        width: 0,
        height: 0,
        toJSON: () => ({}),
      }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
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

  it('locks body scrolling, restores the previous value, and closes on Escape', async () => {
    document.body.style.overflow = 'scroll'
    const wrapper = await mountViewer()

    expect(document.body.style.overflow).toBe('hidden')
    button('关闭全屏图表').click()
    await nextTick()
    expect(wrapper.emitted('close')).toHaveLength(1)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(wrapper.emitted('close')).toHaveLength(2)

    wrapper.unmount()
    expect(document.body.style.overflow).toBe('scroll')
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
    await nextTick()
    expect(transform().scale).toBeCloseTo(704 / 1200)
    expect(transform().x).toBeCloseTo(48)
    expect(transform().y).toBeCloseTo(74)
  })

  it('zooms with controls and keeps the wheel pointer position anchored', async () => {
    await mountViewer()
    const fitted = transform()

    button('放大图表').click()
    await nextTick()
    expect(transform().scale).toBeCloseTo(fitted.scale * 1.2)

    button('缩小图表').click()
    await nextTick()
    expect(transform().scale).toBeCloseTo(fitted.scale)

    const event = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX: 300,
      clientY: 250,
      deltaY: -1,
    })
    viewport().dispatchEvent(event)
    await nextTick()

    expect(event.defaultPrevented).toBe(true)
    expect(transform().scale).toBeCloseTo(fitted.scale * 1.2)
    expect(transform().x).toBeCloseTo(17.6)
    expect(transform().y).toBeCloseTo(108.8)
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
})
