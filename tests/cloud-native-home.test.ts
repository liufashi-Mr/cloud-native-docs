import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { generate, parse as parseCss, walk } from 'css-tree'
import type { CssNode } from 'css-tree'
import { compileStyle, parse as parseSfc } from '@vue/compiler-sfc'
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
  icon: 'terminal',
}

const HOME_COMPONENT_PATH = resolve(
  process.cwd(),
  'docs/.vitepress/theme/components/CloudNativeHome.vue',
)

const TOPIC_ICON_ASSETS = [
  'containerd.svg',
  'harbor.svg',
  'helm.svg',
  'argo-cd.svg',
  'prometheus.svg',
  'opentelemetry.svg',
  'grafana.svg',
] as const

const EXPECTED_TOPIC_LOGOS = new Map([
  ['Containerd', '/topic-icons/containerd.svg'],
  ['Registry / Harbor', '/topic-icons/harbor.svg'],
  ['Kubernetes', '/kubernetes-logo.svg'],
  ['Helm', '/topic-icons/helm.svg'],
  ['Argo CD / GitOps', '/topic-icons/argo-cd.svg'],
  ['Prometheus', '/topic-icons/prometheus.svg'],
  ['Grafana', '/topic-icons/grafana.svg'],
  ['OpenTelemetry', '/topic-icons/opentelemetry.svg'],
])

const EXPECTED_TOPIC_ICONS = new Map([
  ['Linux', 'terminal'],
  ['网络与 DNS', 'network'],
  ['存储', 'hard-drive'],
  ['云平台基础', 'cloud'],
  ['Docker / OCI', 'container'],
  ['SBOM 与签名', 'badge-check'],
  ['Kustomize', 'layers'],
  ['Gateway API', 'route'],
  ['CI/CD', 'workflow'],
  ['GitHub Actions', 'git-pull-request'],
  ['Loki / Logging', 'logs'],
  ['Identity / RBAC', 'user-cog'],
  ['Policy', 'scroll-text'],
  ['Secret 管理', 'key-round'],
  ['备份与灾备', 'database-backup'],
  ['成本与弹性', 'gauge'],
])

interface CssRule {
  declarations: Map<string, string>
  media: string | null
  order: number
  selector: string
}

function normalizeCss(value: string): string {
  return value.replace(/\s+/g, '')
}

function compiledHomeCssRules(): CssRule[] {
  const source = readFileSync(HOME_COMPONENT_PATH, 'utf8')
  const { descriptor, errors } = parseSfc(source, { filename: HOME_COMPONENT_PATH })
  if (errors.length > 0) throw errors[0]

  const style = descriptor.styles.find((block) => block.scoped)
  if (!style) throw new Error('Missing CloudNativeHome scoped style block')

  const result = compileStyle({
    filename: HOME_COMPONENT_PATH,
    id: 'data-v-cloud-native-home-test',
    source: style.content,
    scoped: true,
  })
  if (result.errors.length > 0) throw result.errors[0]

  const mediaStack: string[] = []
  const rules: CssRule[] = []
  let order = 0

  walk(parseCss(result.code), {
    enter(node: CssNode) {
      if (node.type === 'Atrule' && node.name === 'media' && node.prelude) {
        mediaStack.push(normalizeCss(generate(node.prelude)))
      }

      if (node.type === 'Rule' && node.prelude.type === 'SelectorList') {
        const declarations = new Map<string, string>()
        node.block.children.forEach((child: CssNode) => {
          if (child.type === 'Declaration') {
            declarations.set(child.property, normalizeCss(generate(child.value)))
          }
        })
        rules.push({
          declarations,
          media: mediaStack.at(-1) ?? null,
          order: order += 1,
          selector: generate(node.prelude),
        })
      }
    },
    leave(node: CssNode) {
      if (node.type === 'Atrule' && node.name === 'media') mediaStack.pop()
    },
  })

  return rules
}

const cssRules = compiledHomeCssRules()

function rule(selector: RegExp, media: string | null = null): CssRule {
  const match = cssRules.find(
    (candidate) => candidate.media === media && selector.test(candidate.selector),
  )
  if (!match) throw new Error(`Missing CSS rule matching ${selector}`)
  return match
}

function declaration(cssRule: CssRule, property: string): string {
  const value = cssRule.declarations.get(property)
  if (!value) throw new Error(`Missing ${property} in ${cssRule.selector}`)
  return value
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

  it('assigns one exact visual to each topic and stores the seven official local logos safely', () => {
    const topics = technologyDomains.flatMap((domain) => domain.topics)
    const logoTopics = topics.filter((topic) => 'logo' in topic && Boolean(topic.logo))
    const iconTopics = topics.filter((topic) => 'icon' in topic && Boolean(topic.icon))

    expect(topics).toHaveLength(24)
    expect(topics.every((topic) => {
      const visualCount = Number('logo' in topic && Boolean(topic.logo))
        + Number('icon' in topic && Boolean(topic.icon))
      return visualCount === 1
    })).toBe(true)
    expect(logoTopics).toHaveLength(8)
    expect(iconTopics).toHaveLength(16)
    expect(new Map(logoTopics.map((topic) => [topic.title, topic.logo]))).toEqual(EXPECTED_TOPIC_LOGOS)
    expect(new Map(iconTopics.map((topic) => [topic.title, topic.icon]))).toEqual(EXPECTED_TOPIC_ICONS)

    for (const filename of TOPIC_ICON_ASSETS) {
      const path = resolve(process.cwd(), 'docs/public/topic-icons', filename)
      expect(existsSync(path)).toBe(true)
      if (!existsSync(path)) continue

      const svg = readFileSync(path, 'utf8')
      expect(svg).toMatch(/<svg\b/i)
      expect(svg).not.toMatch(/<script\b|<foreignObject\b/i)
      expect(svg).not.toMatch(/(?:href|xlink:href)=["'][^"']*https?:\/\//i)
    }
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

    const visuals = wrapper.findAll('[data-topic-visual]')
    expect(visuals).toHaveLength(24)
    for (const visual of visuals) {
      expect(visual.attributes('aria-hidden')).toBe('true')
      const children = visual.findAll('img, svg')
      expect(children).toHaveLength(1)
      expect(children[0].attributes('aria-hidden')).toBe('true')
      if (children[0].element.tagName === 'IMG') {
        expect(children[0].attributes('alt')).toBe('')
        expect(children[0].attributes('src')).toMatch(/^\/project\/(?:topic-icons\/|kubernetes-logo\.svg)/)
      }
    }

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

  it('keeps the Kubernetes row transparent and limited to its logo, title, and arrow action', () => {
    const available = rule(/\.cloud-native-home__topic--available(?:\[[^\]]+\])?$/)
    const availableHover = rule(/\.cloud-native-home__topic--available(?:\[[^\]]+\])?:hover$/)

    expect(available.declarations.has('background')).toBe(false)
    expect(available.declarations.has('border')).toBe(false)
    expect(availableHover.declarations.has('background')).toBe(false)
    expect(declaration(availableHover, 'color')).toBe('var(--vp-c-brand-1)')
  })

  it('uses logical catalog dividers with a continuous wide-to-mobile cascade', () => {
    const summaryDivider = rule(/\.cloud-native-home__summary.*span\s*\+\s*span/)
    const wideDomains = rule(/\.cloud-native-home__domains(?:\[[^\]]+\])?$/)
    const wideColumns = rule(/\.cloud-native-home__domain(?:\[[^\]]+\])?:nth-child\(3n\+2\)/)
    const wideRows = rule(/\.cloud-native-home__domain(?:\[[^\]]+\])?:nth-child\(n\+4\)/)
    const medium = '(max-width:1100px)'
    const mobile = '(max-width:680px)'
    const mobileSummaryDivider = rule(/\.cloud-native-home__summary.*span\s*\+\s*span/, mobile)
    const mediumDomains = rule(/\.cloud-native-home__domains(?:\[[^\]]+\])?/, medium)
    const mediumColumnReset = rule(
      /\.cloud-native-home__domain(?:\[[^\]]+\])?:nth-child\(3n\+2\)/,
      medium,
    )
    const mediumRowReset = rule(
      /\.cloud-native-home__domain(?:\[[^\]]+\])?:nth-child\(n\+4\)/,
      medium,
    )
    const mediumColumns = rule(/\.cloud-native-home__domain(?:\[[^\]]+\])?:nth-child\(even\)/, medium)
    const mediumRows = rule(/\.cloud-native-home__domain(?:\[[^\]]+\])?:nth-child\(n\+3\)/, medium)
    const mobileDomains = rule(/\.cloud-native-home__domains(?:\[[^\]]+\])?/, mobile)
    const mobileColumnReset = rule(/\.cloud-native-home__domain(?:\[[^\]]+\])?:nth-child\(even\)/, mobile)
    const mobileRowReset = rule(/\.cloud-native-home__domain(?:\[[^\]]+\])?:nth-child\(n\+3\)/, mobile)
    const mobileRows = rule(
      /\.cloud-native-home__domain(?:\[[^\]]+\])?\+\.cloud-native-home__domain/,
      mobile,
    )

    expect(cssRules.filter((candidate) => candidate.media?.includes('min-width'))).toHaveLength(0)
    expect(declaration(summaryDivider, 'padding-inline-start')).toBe('20px')
    expect(declaration(mobileSummaryDivider, 'padding-inline-start')).toBe('0')
    expect(declaration(wideDomains, 'grid-template-columns')).toBe('repeat(3,minmax(0,1fr))')
    expect(declaration(wideColumns, 'border-inline-start')).toContain('var(--catalog-divider)')
    expect(declaration(wideRows, 'border-block-start')).toContain('var(--catalog-divider)')

    expect(declaration(mediumDomains, 'grid-template-columns')).toBe('repeat(2,minmax(0,1fr))')
    expect(declaration(mediumColumnReset, 'border-inline-start')).toBe('0')
    expect(declaration(mediumRowReset, 'border-block-start')).toBe('0')
    expect(declaration(mediumColumns, 'border-inline-start')).toContain('var(--catalog-divider)')
    expect(declaration(mediumRows, 'border-block-start')).toContain('var(--catalog-divider)')
    expect(mediumColumnReset.order).toBeGreaterThan(wideColumns.order)
    expect(mediumRowReset.order).toBeGreaterThan(wideRows.order)
    expect(mediumColumns.order).toBeGreaterThan(mediumColumnReset.order)
    expect(mediumRows.order).toBeGreaterThan(mediumRowReset.order)

    expect(declaration(mobileDomains, 'grid-template-columns')).toBe('minmax(0,1fr)')
    expect(declaration(mobileColumnReset, 'border-inline-start')).toBe('0')
    expect(declaration(mobileRowReset, 'border-block-start')).toBe('0')
    expect(declaration(mobileRows, 'border-block-start')).toContain('var(--catalog-divider)')
    expect(mobileColumnReset.order).toBeGreaterThan(mediumColumns.order)
    expect(mobileRowReset.order).toBeGreaterThan(mediumRows.order)
    expect(mobileRows.order).toBeGreaterThan(mobileRowReset.order)
    expect(cssRules.some((candidate) => candidate.declarations.has('border-left'))).toBe(false)
    expect(cssRules.some((candidate) => candidate.declarations.has('border-top'))).toBe(false)
    expect(cssRules.some((candidate) => candidate.declarations.has('padding-left'))).toBe(false)
  })

  it('moves the Kubernetes arrow toward the logical forward direction and honors reduced motion', () => {
    const arrow = rule(/\.cloud-native-home__topic--available(?:\[[^\]]+\])?>svg/)
    const arrowHover = rule(/\.cloud-native-home__topic--available(?:\[[^\]]+\])?:hover>svg/)
    const rtlArrow = rule(
      /\[dir=(?:'rtl'|"rtl"|rtl)\]\s+\.cloud-native-home__topic--available.*>svg/,
    )
    const rtlArrowHover = rule(
      /\[dir=(?:'rtl'|"rtl"|rtl)\]\s+\.cloud-native-home__topic--available.*:hover>svg/,
    )
    const reducedMotion = rule(
      /\.cloud-native-home__topic--available(?:\[[^\]]+\])?>svg/,
      '(prefers-reduced-motion:reduce)',
    )

    expect(declaration(arrow, 'transition')).toMatch(/^transform\d+(?:\.\d+)?(?:ms|s)/)
    expect(declaration(arrowHover, 'transform')).toBe('translateX(3px)')
    expect(declaration(rtlArrow, 'transform')).toBe('scaleX(-1)')
    expect(declaration(rtlArrowHover, 'transform')).toBe('translateX(-3px)scaleX(-1)')
    expect(declaration(reducedMotion, 'transition')).toBe('none')
    expect(reducedMotion.order).toBeGreaterThan(arrow.order)
  })
})
