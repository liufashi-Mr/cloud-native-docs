import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import BackToTop from '../docs/.vitepress/theme/components/BackToTop.vue'

describe('BackToTop', () => {
  let scrollY = 0

  beforeEach(() => {
    scrollY = 0
    vi.spyOn(window, 'scrollY', 'get').mockImplementation(() => scrollY)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows an icon-only return-to-top action after scrolling 320px', async () => {
    const wrapper = mount(BackToTop)
    expect(wrapper.find('button[aria-label="返回顶部"]').exists()).toBe(false)

    scrollY = 321
    window.dispatchEvent(new Event('scroll'))
    await nextTick()

    const button = wrapper.get('button[aria-label="返回顶部"]')

    expect(button.text()).toBe('')
    expect(button.attributes('title')).toBe('返回顶部')
    expect(button.find('svg').exists()).toBe(true)
    expect(wrapper.get('.k8s-back-to-top').element).toBeInstanceOf(
      HTMLButtonElement,
    )

    scrollY = 320
    window.dispatchEvent(new Event('scroll'))
    await nextTick()
    expect(wrapper.find('button[aria-label="返回顶部"]').exists()).toBe(false)
  })

  it('smoothly scrolls the page to the top', async () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    scrollY = 500
    const wrapper = mount(BackToTop)
    await nextTick()

    await wrapper.get('button').trigger('click')

    expect(scrollTo).toHaveBeenCalledWith({
      top: 0,
      left: 0,
      behavior: 'smooth',
    })
  })
})
