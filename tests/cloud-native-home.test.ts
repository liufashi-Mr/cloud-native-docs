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
const styleMatch = componentSource.match(/<style scoped>([\s\S]*?)<\/style>/)

if (!styleMatch) {
  throw new Error('Missing CloudNativeHome scoped style block')
}

const styleSource = styleMatch[1]

function styleRule(selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = styleSource.match(new RegExp(`${escapedSelector}\\s*{([\\s\\S]*?)\\n}`))

  if (!match) {
    throw new Error(`Missing ${selector} style rule`)
  }

  return match[1]
}

function mediaBlock(query: string): string {
  const start = styleSource.indexOf(query)

  if (start === -1) {
    throw new Error(`Missing ${query} media query`)
  }

  const openingBrace = styleSource.indexOf('{', start)
  let depth = 0

  for (let index = openingBrace; index < styleSource.length; index += 1) {
    if (styleSource[index] === '{') depth += 1
    if (styleSource[index] === '}') depth -= 1
    if (depth === 0) return styleSource.slice(openingBrace + 1, index)
  }

  throw new Error(`Unclosed ${query} media query`)
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
    expect(kubernetes.text()).not.toContain('已完成')
    expect(kubernetes.find('.cloud-native-home__completion').exists()).toBe(false)
    expect(kubernetes.find('.cloud-native-home__status').exists()).toBe(false)
    expect(kubernetes.find('img').exists()).toBe(true)
    expect(kubernetes.findAll('svg[aria-hidden="true"]')).toHaveLength(1)

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

  it('uses a divided domain catalog with separator topic rows and a soft Kubernetes treatment', () => {
    const domains = styleRule('.cloud-native-home__domains')
    const domain = styleRule('.cloud-native-home__domain')
    const topics = styleRule('.cloud-native-home__topics')
    const topic = styleRule('.cloud-native-home__topic')
    const availableTopic = styleRule('.cloud-native-home__topic--available')
    const availableTopicHover = styleRule('.cloud-native-home__topic--available:hover')

    expect(domains).toContain('gap: 0;')
    expect(domain).not.toMatch(/\b(border|border-radius|box-shadow|background)\s*:/)
    expect(componentSource).toContain('@media (min-width: 1101px)')
    expect(componentSource).toContain('.cloud-native-home__domain:nth-child(3n + 2)')
    expect(componentSource).toContain('.cloud-native-home__domain:nth-child(n + 4)')
    expect(componentSource).toContain('.cloud-native-home__domain:nth-child(even)')
    expect(componentSource).toContain('.cloud-native-home__domain:nth-child(n + 3)')
    expect(componentSource).toContain('.cloud-native-home__domain + .cloud-native-home__domain')
    expect(topics).toContain('gap: 0;')
    expect(componentSource).toContain('.cloud-native-home__topic + .cloud-native-home__topic')
    expect(componentSource).toContain(
      'border-top: 1px solid color-mix(in srgb, var(--vp-c-divider) 58%, transparent);',
    )
    expect(topic).not.toMatch(/\b(border|background|border-radius)\s*:/)
    expect(availableTopic).not.toMatch(/\b(border|background|border-radius)\s*:/)
    expect(availableTopicHover).toContain('color: var(--vp-c-brand-1);')
    expect(availableTopicHover).not.toMatch(/\bbackground\s*:/)
  })

  it('moves only the Kubernetes arrow on hover and disables that motion when requested', () => {
    const arrow = styleRule('.cloud-native-home__topic--available > svg')
    const arrowHover = styleRule('.cloud-native-home__topic--available:hover > svg')
    const reducedMotion = mediaBlock('@media (prefers-reduced-motion: reduce)')

    expect(arrow).toMatch(/transition\s*:\s*transform\s+\d+(?:\.\d+)?(?:ms|s)/)
    expect(arrowHover).toMatch(/transform\s*:\s*translateX\(3px\)/)
    expect(reducedMotion).toMatch(
      /\.cloud-native-home__topic--available > svg\s*{[^}]*transition\s*:\s*none\s*;/,
    )
  })

  it('keeps catalog dividers scoped to their responsive grid boundaries', () => {
    const domains = styleRule('.cloud-native-home__domains')
    const wide = mediaBlock('@media (min-width: 1101px)')
    const mediumLayout = mediaBlock('@media (max-width: 1100px)')
    const medium = mediaBlock('@media (min-width: 681px) and (max-width: 1100px)')
    const mobile = mediaBlock('@media (max-width: 680px)')

    expect(domains).toContain('grid-template-columns: repeat(3, minmax(0, 1fr));')
    expect(wide).toMatch(
      /\.cloud-native-home__domain:nth-child\(3n \+ 2\),[\s\S]*?\.cloud-native-home__domain:nth-child\(3n \+ 3\)\s*{[\s\S]*?border-(?:inline-start|left):/,
    )
    expect(wide).toMatch(
      /\.cloud-native-home__domain:nth-child\(n \+ 4\)\s*{[\s\S]*?border-(?:block-start|top):/,
    )

    expect(mediumLayout).toMatch(
      /\.cloud-native-home__domains\s*{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/,
    )
    expect(medium).toMatch(
      /\.cloud-native-home__domain:nth-child\(even\)\s*{[\s\S]*?border-(?:inline-start|left):/,
    )
    expect(medium).toMatch(
      /\.cloud-native-home__domain:nth-child\(n \+ 3\)\s*{[\s\S]*?border-(?:block-start|top):/,
    )

    expect(mobile).toMatch(
      /\.cloud-native-home__domains\s*{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/,
    )
    expect(mobile).not.toMatch(
      /\.cloud-native-home__domain\s*{[^}]*border-(?:inline-start|left)\s*:/,
    )
    expect(mobile).toMatch(
      /\.cloud-native-home__domain \+ \.cloud-native-home__domain\s*{[\s\S]*?border-(?:block-start|top):/,
    )
  })
})
