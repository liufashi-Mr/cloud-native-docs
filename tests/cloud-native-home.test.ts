import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

vi.mock('vitepress', () => ({
  withBase: (path: string) => `/project${path}`,
}))

import CloudNativeHome from '../docs/.vitepress/theme/components/CloudNativeHome.vue'
import {
  developerPaths,
  technologyDomains,
  type TechnologyTopic,
} from '../docs/.vitepress/theme/home-content'

// @ts-expect-error available topics require href
const invalidAvailableTopic: TechnologyTopic = {
  title: 'Broken topic',
  status: 'available',
}

const componentSource = readFileSync(
  resolve(process.cwd(), 'docs/.vitepress/theme/components/CloudNativeHome.vue'),
  'utf8',
)

function styleRule(selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = componentSource.match(new RegExp(`${escapedSelector}\\s*{([\\s\\S]*?)\\n}`))

  if (!match) {
    throw new Error(`Missing ${selector} style rule`)
  }

  return match[1]
}

describe('CloudNativeHome', () => {
  it('provides the five developer paths and a six-domain, 24-topic catalog', () => {
    const topics = technologyDomains.flatMap((domain) => domain.topics)

    expect(developerPaths).toHaveLength(5)
    expect(technologyDomains).toHaveLength(6)
    expect(topics).toHaveLength(24)
    expect(topics.filter((topic) => topic.status === 'available')).toEqual([
      expect.objectContaining({
        title: 'Kubernetes',
        href: '/kubernetes/',
        logo: '/kubernetes-logo.svg',
      }),
    ])
    expect(topics.filter((topic) => topic.status === 'planned')).toHaveLength(23)
  })

  it('renders the workbench counts and preserves available versus planned topic semantics', () => {
    const wrapper = mount(CloudNativeHome)
    const expectedPathSequences = [
      'Git → CI → OCI → Registry → Kubernetes → Helm → GitOps',
      'DNS → TLS → Gateway → Service → Pod',
      'Config → Secret → Volume → CSI → Backup',
      'Metrics → Logs → Traces → Alert → Linux',
      'Identity → RBAC → Policy → Supply chain',
    ]

    expect(wrapper.get('h1').text()).toBe('应用开发者的云原生技术工作台')
    expect(wrapper.text()).toContain('5 条开发路径')
    expect(wrapper.text()).toContain('24 个技术主题')
    expect(wrapper.text()).toContain('1 个已完成')
    expect(wrapper.findAll('[data-path]')).toHaveLength(5)
    expect(wrapper.findAll('[data-domain]')).toHaveLength(6)
    expect(wrapper.findAll('[data-topic]')).toHaveLength(24)
    for (const [index, sequence] of expectedPathSequences.entries()) {
      expect(wrapper.findAll('[data-path]')[index].text()).toContain(sequence)
    }

    const kubernetes = wrapper.get('[data-topic][data-status="available"]')
    expect(kubernetes.element.tagName).toBe('A')
    expect(kubernetes.attributes('href')).toBe('/project/kubernetes/')
    expect(kubernetes.text()).toContain('Kubernetes')
    expect(kubernetes.text()).toContain('已完成')

    const planned = wrapper.findAll('[data-topic][data-status="planned"]')
    expect(planned).toHaveLength(23)
    for (const topic of planned) {
      expect(topic.element.tagName).toBe('DIV')
      expect(topic.attributes('tabindex')).toBeUndefined()
    }
  })

  it('links the recommended start without rendering a homepage search control', () => {
    const wrapper = mount(CloudNativeHome)

    const start = wrapper.get('[data-recommended-start] a')
    expect(start.text()).toBe('进入 Kubernetes 专题')
    expect(start.attributes('href')).toBe('/project/kubernetes/')
    expect(wrapper.find('button[aria-label="搜索文档"]').exists()).toBe(false)
  })

  it('uses accented domain modules with separator topic rows and a soft Kubernetes treatment', () => {
    const domain = styleRule('.cloud-native-home__domain')
    const topics = styleRule('.cloud-native-home__topics')
    const topic = styleRule('.cloud-native-home__topic')
    const availableTopic = styleRule('.cloud-native-home__topic--available')

    expect(domain).toContain('border: 1px solid var(--vp-c-divider);')
    expect(domain).toContain('border-top: 3px solid var(--domain-accent);')
    expect(domain).toContain('background: var(--vp-c-bg);')
    expect(topics).toContain('gap: 0;')
    expect(componentSource).toContain('.cloud-native-home__topic + .cloud-native-home__topic')
    expect(componentSource).toContain(
      'border-top: 1px solid color-mix(in srgb, var(--vp-c-divider) 58%, transparent);',
    )
    expect(topic).not.toMatch(/\b(border|background|border-radius)\s*:/)
    expect(availableTopic).not.toMatch(/\bborder(?:-color)?\s*:/)
    expect(availableTopic).toMatch(/\bbackground\s*:/)
  })
})
