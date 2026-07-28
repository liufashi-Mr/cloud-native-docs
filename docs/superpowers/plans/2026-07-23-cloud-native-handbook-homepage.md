# Cloud Native Handbook Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Kubernetes-only root page with a polished cloud-native developer workbench, make Kubernetes the only active topic, and move every existing Kubernetes page under `/kubernetes/**` without legacy redirects.

**Architecture:** A typed, static content catalog drives a dedicated Vue homepage component registered in the existing VitePress theme. The existing Kubernetes Markdown tree moves intact below `docs/kubernetes/`; a path-scoped sidebar serves only those pages, while the root page uses VitePress's `page` layout without a sidebar. Tests separately lock the catalog, rendered interaction semantics, route migration, branding, and production build output.

**Tech Stack:** VitePress 1.6, Vue 3.5, TypeScript, `@lucide/vue`, Vitest, Vue Test Utils, Markdown, CSS.

---

## File Map

- Create `docs/.vitepress/theme/home-content.ts`: typed homepage path/domain/topic catalog.
- Create `docs/.vitepress/theme/components/CloudNativeHome.vue`: accessible workbench homepage and responsive styles.
- Modify `docs/.vitepress/theme/index.ts`: register `CloudNativeHome` globally for Markdown use.
- Replace `docs/index.md`: page-layout shell that renders the homepage component.
- Move `docs/{guide,concepts,operations,reference}` and the current Kubernetes overview to `docs/kubernetes/**`.
- Modify `docs/.vitepress/config.mts`: cloud-native brand, global navigation, and path-scoped Kubernetes sidebar.
- Modify every moved Kubernetes Markdown file containing root-absolute links: rewrite links to `/kubernetes/**`.
- Create `tests/cloud-native-home.test.ts`: data count, status, link, search proxy, and rendered accessibility contracts.
- Create `tests/kubernetes-routing.test.ts`: new route tree, no legacy tree, link-prefix, and sidebar contracts.
- Modify `tests/content.test.ts`: point all existing Kubernetes content assertions at the moved files and routes.
- Modify `tests/appearance-integration.test.ts`: assert the new site brand while retaining appearance integration.
- Modify `tests/github-pages.test.ts`: replace Kubernetes-favicon assumptions with base-aware homepage asset assertions.
- Modify `tests/build-output.test.ts`: assert new pages exist and old routes are absent from production output.

### Task 1: Build the typed homepage catalog and component

**Files:**
- Create: `docs/.vitepress/theme/home-content.ts`
- Create: `docs/.vitepress/theme/components/CloudNativeHome.vue`
- Create: `tests/cloud-native-home.test.ts`

- [ ] **Step 1: Write the failing homepage contract test**

Create `tests/cloud-native-home.test.ts`:

```ts
// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import CloudNativeHome from '../docs/.vitepress/theme/components/CloudNativeHome.vue'
import {
  developerPaths,
  technologyDomains,
} from '../docs/.vitepress/theme/home-content'

vi.mock('vitepress', () => ({
  withBase: (path: string) => `/project${path}`,
}))

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('cloud-native developer homepage', () => {
  it('publishes the approved five paths, six domains, and 24 topics', () => {
    const topics = technologyDomains.flatMap((domain) => domain.topics)

    expect(developerPaths).toHaveLength(5)
    expect(technologyDomains).toHaveLength(6)
    expect(topics).toHaveLength(24)
    expect(topics.filter((topic) => topic.status === 'available')).toEqual([
      expect.objectContaining({ name: 'Kubernetes', href: '/kubernetes/' }),
    ])
    expect(topics.filter((topic) => topic.status === 'planned')).toHaveLength(23)
  })

  it('renders only Kubernetes as an interactive topic', () => {
    const wrapper = mount(CloudNativeHome)

    expect(wrapper.get('h1').text()).toBe('应用开发者的云原生技术工作台')
    expect(wrapper.findAll('[data-path]')).toHaveLength(5)
    expect(wrapper.findAll('[data-domain]')).toHaveLength(6)
    expect(wrapper.findAll('[data-topic]')).toHaveLength(24)

    const links = wrapper.findAll('[data-topic] a')
    expect(links).toHaveLength(1)
    expect(links[0].attributes('href')).toBe('/project/kubernetes/')
    expect(links[0].text()).toContain('Kubernetes')
    expect(links[0].text()).toContain('已完成')

    const planned = wrapper.findAll('[data-status="planned"]')
    expect(planned).toHaveLength(23)
    expect(planned.every((item) => item.element.tagName === 'DIV')).toBe(true)
    expect(planned.every((item) => item.attributes('tabindex') === undefined)).toBe(
      true,
    )

    const recommendedStart = wrapper.get('.cloud-native-home__start a')
    expect(recommendedStart.attributes('href')).toBe('/project/kubernetes/')
    expect(recommendedStart.text()).toContain('进入 Kubernetes 专题')
  })

  it('delegates homepage search to the existing VitePress search control', async () => {
    const navSearch = document.createElement('button')
    navSearch.className = 'VPNavBarSearchButton'
    document.body.append(navSearch)
    const click = vi.spyOn(navSearch, 'click')

    const wrapper = mount(CloudNativeHome, { attachTo: document.body })
    await wrapper.get('button[aria-label="搜索文档"]').trigger('click')

    expect(click).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run the test and observe RED**

Run:

```bash
npm test -- tests/cloud-native-home.test.ts
```

Expected: FAIL because `CloudNativeHome.vue` and `home-content.ts` do not exist.

- [ ] **Step 3: Add the typed homepage data**

Create `docs/.vitepress/theme/home-content.ts`:

```ts
export type DomainIcon =
  | 'activity'
  | 'boxes'
  | 'git-branch'
  | 'package'
  | 'shield'
  | 'terminal'

export type DomainTone =
  | 'amber'
  | 'blue'
  | 'green'
  | 'neutral'
  | 'rose'
  | 'violet'

export interface DeveloperPath {
  id: string
  title: string
  technologies: string
  tone: DomainTone
}

export interface TechnologyTopic {
  name: string
  status: 'available' | 'planned'
  href?: string
  logo?: string
}

export interface TechnologyDomain {
  id: string
  title: string
  summary: string
  icon: DomainIcon
  tone: DomainTone
  topics: readonly TechnologyTopic[]
}

export const developerPaths: readonly DeveloperPath[] = [
  {
    id: 'delivery',
    title: '构建与发布应用',
    technologies: 'Git → CI → OCI → Registry → Kubernetes → Helm → GitOps',
    tone: 'green',
  },
  {
    id: 'traffic',
    title: '让请求到达应用',
    technologies: 'DNS → TLS → Gateway → Service → Pod',
    tone: 'blue',
  },
  {
    id: 'state',
    title: '配置与持久化',
    technologies: 'Config → Secret → Volume → CSI → Backup',
    tone: 'violet',
  },
  {
    id: 'observability',
    title: '观察与定位故障',
    technologies: 'Metrics → Logs → Traces → Alert → Linux',
    tone: 'amber',
  },
  {
    id: 'security',
    title: '建立安全基线',
    technologies: 'Identity → RBAC → Policy → Supply chain',
    tone: 'rose',
  },
] as const

export const technologyDomains: readonly TechnologyDomain[] = [
  {
    id: 'foundation',
    title: '运行基础',
    summary: '理解应用实际运行的环境',
    icon: 'terminal',
    tone: 'neutral',
    topics: [
      { name: 'Linux', status: 'planned' },
      { name: '网络与 DNS', status: 'planned' },
      { name: '存储', status: 'planned' },
      { name: '云平台基础', status: 'planned' },
    ],
  },
  {
    id: 'artifacts',
    title: '容器与制品',
    summary: '构建可交付、可验证的制品',
    icon: 'package',
    tone: 'blue',
    topics: [
      { name: 'Docker / OCI', status: 'planned' },
      { name: 'Containerd', status: 'planned' },
      { name: 'Registry / Harbor', status: 'planned' },
      { name: 'SBOM 与签名', status: 'planned' },
    ],
  },
  {
    id: 'platform',
    title: '平台与编排',
    summary: '声明和运行生产工作负载',
    icon: 'boxes',
    tone: 'violet',
    topics: [
      {
        name: 'Kubernetes',
        status: 'available',
        href: '/kubernetes/',
        logo: '/kubernetes-logo.svg',
      },
      { name: 'Helm', status: 'planned' },
      { name: 'Kustomize', status: 'planned' },
      { name: 'Gateway API', status: 'planned' },
    ],
  },
  {
    id: 'delivery',
    title: '持续交付',
    summary: '把变更可靠地送入环境',
    icon: 'git-branch',
    tone: 'green',
    topics: [
      { name: 'CI/CD', status: 'planned' },
      { name: 'GitHub Actions', status: 'planned' },
      { name: 'Argo CD / GitOps', status: 'planned' },
    ],
  },
  {
    id: 'observability',
    title: '可观测性',
    summary: '解释系统正在发生什么',
    icon: 'activity',
    tone: 'amber',
    topics: [
      { name: 'Prometheus', status: 'planned' },
      { name: 'Grafana', status: 'planned' },
      { name: 'Loki / Logging', status: 'planned' },
      { name: 'OpenTelemetry', status: 'planned' },
    ],
  },
  {
    id: 'resilience',
    title: '安全与韧性',
    summary: '降低运行风险并保证可恢复',
    icon: 'shield',
    tone: 'rose',
    topics: [
      { name: 'Identity / RBAC', status: 'planned' },
      { name: 'Policy', status: 'planned' },
      { name: 'Secret 管理', status: 'planned' },
      { name: '备份与灾备', status: 'planned' },
      { name: '成本与弹性', status: 'planned' },
    ],
  },
] as const
```

- [ ] **Step 4: Add the accessible workbench component**

Create `docs/.vitepress/theme/components/CloudNativeHome.vue`:

```vue
<script setup lang="ts">
import {
  Activity,
  ArrowRight,
  Boxes,
  GitBranch,
  Package,
  Search,
  ShieldCheck,
  Terminal,
} from '@lucide/vue'
import type { Component } from 'vue'
import { withBase } from 'vitepress'

import {
  developerPaths,
  technologyDomains,
  type DomainIcon,
} from '../home-content'

const domainIcons = {
  activity: Activity,
  boxes: Boxes,
  'git-branch': GitBranch,
  package: Package,
  shield: ShieldCheck,
  terminal: Terminal,
} satisfies Record<DomainIcon, Component>

function openSearch(): void {
  document.querySelector<HTMLButtonElement>('.VPNavBarSearchButton')?.click()
}
</script>

<template>
  <div class="cloud-native-home">
    <header class="cloud-native-home__intro">
      <div>
        <p class="cloud-native-home__eyebrow">Developer knowledge base</p>
        <h1>应用开发者的云原生技术工作台</h1>
        <p class="cloud-native-home__lead">
          从实际任务进入，理解应用构建、发布、运行、观察和排障所依赖的技术。
        </p>
      </div>
      <dl class="cloud-native-home__summary" aria-label="内容概览">
        <div><dt>开发路径</dt><dd>5</dd></div>
        <div><dt>技术专题</dt><dd>24</dd></div>
        <div><dt>已完成</dt><dd>1</dd></div>
      </dl>
    </header>

    <button
      class="cloud-native-home__search"
      type="button"
      aria-label="搜索文档"
      @click="openSearch"
    >
      <Search :size="18" aria-hidden="true" />
      <span>搜索技术、概念或故障现象</span>
      <kbd>⌘ K</kbd>
    </button>

    <section id="paths" class="cloud-native-home__section" aria-labelledby="paths-title">
      <div class="cloud-native-home__section-heading">
        <div><p>Learning paths</p><h2 id="paths-title">跨技术开发路径</h2></div>
        <span>规划中</span>
      </div>
      <div class="cloud-native-home__paths">
        <article
          v-for="path in developerPaths"
          :key="path.id"
          class="cloud-native-home__path"
          :class="`cloud-native-home--${path.tone}`"
          :data-path="path.id"
        >
          <h3>{{ path.title }}</h3>
          <p>{{ path.technologies }}</p>
          <span>规划中</span>
        </article>
      </div>
    </section>

    <section
      id="technologies"
      class="cloud-native-home__section"
      aria-labelledby="technologies-title"
    >
      <div class="cloud-native-home__section-heading">
        <div><p>Technology catalog</p><h2 id="technologies-title">单技术专题</h2></div>
        <span>6 个领域 · 24 个专题</span>
      </div>
      <div class="cloud-native-home__domains">
        <section
          v-for="domain in technologyDomains"
          :key="domain.id"
          class="cloud-native-home__domain"
          :class="`cloud-native-home--${domain.tone}`"
          :data-domain="domain.id"
        >
          <header>
            <span class="cloud-native-home__domain-icon" aria-hidden="true">
              <component :is="domainIcons[domain.icon]" :size="18" />
            </span>
            <div><h3>{{ domain.title }}</h3><p>{{ domain.summary }}</p></div>
          </header>
          <div class="cloud-native-home__topics">
            <div v-for="topic in domain.topics" :key="topic.name" data-topic>
              <a
                v-if="topic.status === 'available' && topic.href"
                class="cloud-native-home__topic cloud-native-home__topic--available"
                :href="withBase(topic.href)"
                data-status="available"
              >
                <img
                  v-if="topic.logo"
                  :src="withBase(topic.logo)"
                  alt=""
                  width="24"
                  height="24"
                />
                <span><strong>{{ topic.name }}</strong><small>已完成</small></span>
                <ArrowRight :size="16" aria-hidden="true" />
              </a>
              <div
                v-else
                class="cloud-native-home__topic cloud-native-home__topic--planned"
                data-status="planned"
                :aria-label="`${topic.name}，规划中`"
              >
                <span><strong>{{ topic.name }}</strong><small>规划中</small></span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </section>

    <section class="cloud-native-home__start" aria-labelledby="start-title">
      <div>
        <p>Recommended start</p>
        <h2 id="start-title">从 Kubernetes 开始</h2>
        <span>先建立工作负载、网络、配置、存储和运行实践的完整概念框架。</span>
      </div>
      <a :href="withBase('/kubernetes/')">
        进入 Kubernetes 专题
        <ArrowRight :size="16" aria-hidden="true" />
      </a>
    </section>
  </div>
</template>

<style scoped>
.cloud-native-home {
  box-sizing: border-box;
  width: 100%;
  padding: 42px var(--cloud-native-content-padding) 72px;
  color: var(--vp-c-text-1);
}

.cloud-native-home__intro {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 0.42fr);
  gap: 40px;
  align-items: end;
  max-width: 1440px;
  margin: 0 auto;
}

.cloud-native-home__eyebrow,
.cloud-native-home__section-heading p {
  margin: 0 0 8px;
  color: var(--vp-c-brand-1);
  font-size: 12px;
  font-weight: 750;
  letter-spacing: 0;
  text-transform: uppercase;
}

.cloud-native-home h1 {
  max-width: 720px;
  margin: 0;
  font-size: 36px;
  line-height: 1.2;
  letter-spacing: 0;
}

.cloud-native-home__lead {
  max-width: 760px;
  margin: 14px 0 0;
  color: var(--vp-c-text-2);
  font-size: 16px;
  line-height: 1.7;
}

.cloud-native-home__summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 0;
  border-top: 1px solid var(--vp-c-divider);
  border-bottom: 1px solid var(--vp-c-divider);
}

.cloud-native-home__summary div { padding: 14px 12px; }
.cloud-native-home__summary dt { color: var(--vp-c-text-2); font-size: 11px; }
.cloud-native-home__summary dd { margin: 4px 0 0; font-size: 22px; font-weight: 760; }

.cloud-native-home__search {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  width: min(760px, 100%);
  min-height: 44px;
  margin: 28px auto 0;
  padding: 0 12px;
  border: 1px solid var(--vp-c-border);
  border-radius: 5px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  text-align: left;
  cursor: pointer;
}

.cloud-native-home__search:hover,
.cloud-native-home__search:focus-visible {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-text-1);
}

.cloud-native-home__search:focus-visible,
.cloud-native-home__topic--available:focus-visible {
  outline: 3px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}

.cloud-native-home__search kbd {
  border: 1px solid var(--vp-c-divider);
  border-radius: 3px;
  padding: 2px 6px;
  background: var(--vp-c-bg-soft);
  font: inherit;
  font-size: 11px;
}

.cloud-native-home__section { max-width: 1440px; margin: 54px auto 0; }
.cloud-native-home__section-heading { display: flex; justify-content: space-between; gap: 20px; align-items: end; margin-bottom: 14px; }
.cloud-native-home__section-heading h2 { margin: 0; border: 0; padding: 0; font-size: 22px; letter-spacing: 0; }
.cloud-native-home__section-heading > span { color: var(--vp-c-text-2); font-size: 12px; }

.cloud-native-home__paths { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
.cloud-native-home__path { min-height: 126px; padding: 16px; border: 1px solid var(--vp-c-divider); border-top: 3px solid var(--domain-color); border-radius: 5px; background: var(--vp-c-bg); }
.cloud-native-home__path h3 { margin: 0; font-size: 15px; }
.cloud-native-home__path p { margin: 10px 0 14px; color: var(--vp-c-text-2); font-size: 12px; line-height: 1.55; overflow-wrap: anywhere; }
.cloud-native-home__path span,
.cloud-native-home__topic small { color: var(--vp-c-text-2); font-size: 11px; }

.cloud-native-home__domains { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-top: 1px solid var(--vp-c-divider); border-left: 1px solid var(--vp-c-divider); }
.cloud-native-home__domain { min-width: 0; padding: 18px; border-right: 1px solid var(--vp-c-divider); border-bottom: 1px solid var(--vp-c-divider); background: var(--vp-c-bg); }
.cloud-native-home__domain > header { display: flex; gap: 10px; align-items: center; }
.cloud-native-home__domain-icon { display: inline-grid; width: 34px; height: 34px; flex: 0 0 34px; place-items: center; border-radius: 5px; background: var(--domain-color); color: #fff; }
.cloud-native-home__domain h3 { margin: 0; font-size: 16px; }
.cloud-native-home__domain header p { margin: 3px 0 0; color: var(--vp-c-text-2); font-size: 12px; }
.cloud-native-home__topics { display: grid; gap: 6px; margin-top: 16px; }
.cloud-native-home__topic { box-sizing: border-box; display: flex; min-height: 52px; align-items: center; gap: 10px; padding: 9px 10px; border: 1px solid var(--vp-c-divider); border-radius: 4px; color: var(--vp-c-text-1); text-decoration: none; }
.cloud-native-home__topic span { display: grid; gap: 2px; min-width: 0; }
.cloud-native-home__topic strong { overflow-wrap: anywhere; font-size: 13px; }
.cloud-native-home__topic--available { border-color: var(--domain-color); background: color-mix(in srgb, var(--domain-color) 8%, var(--vp-c-bg)); }
.cloud-native-home__topic--available svg { margin-left: auto; }
.cloud-native-home__topic--planned { background: var(--vp-c-bg-soft); color: var(--vp-c-text-2); }

.cloud-native-home__start { display: flex; max-width: 1440px; margin: 36px auto 0; padding: 20px 0; border-top: 1px solid var(--vp-c-divider); border-bottom: 1px solid var(--vp-c-divider); align-items: center; justify-content: space-between; gap: 24px; }
.cloud-native-home__start p { margin: 0 0 5px; color: var(--vp-c-brand-1); font-size: 12px; font-weight: 750; text-transform: uppercase; }
.cloud-native-home__start h2 { margin: 0; border: 0; padding: 0; font-size: 19px; letter-spacing: 0; }
.cloud-native-home__start span { display: block; margin-top: 6px; color: var(--vp-c-text-2); font-size: 13px; }
.cloud-native-home__start a { display: inline-flex; min-height: 38px; flex: 0 0 auto; align-items: center; gap: 8px; padding: 0 13px; border: 1px solid var(--vp-c-brand-1); border-radius: 4px; color: var(--vp-c-brand-1); font-size: 13px; font-weight: 650; text-decoration: none; }
.cloud-native-home__start a:hover { background: var(--vp-c-brand-soft); }
.cloud-native-home__start a:focus-visible { outline: 3px solid var(--vp-c-brand-1); outline-offset: 2px; }

.cloud-native-home--neutral { --domain-color: #58656e; }
.cloud-native-home--blue { --domain-color: #3978a8; }
.cloud-native-home--violet { --domain-color: #6654a3; }
.cloud-native-home--green { --domain-color: #28755d; }
.cloud-native-home--amber { --domain-color: #9a6b1c; }
.cloud-native-home--rose { --domain-color: #9a4b52; }

@media (max-width: 1099px) {
  .cloud-native-home__intro { grid-template-columns: minmax(0, 1fr); }
  .cloud-native-home__summary { max-width: 420px; }
  .cloud-native-home__paths { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .cloud-native-home__domains { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 767px) {
  .cloud-native-home { padding: 28px 20px 56px; }
  .cloud-native-home h1 { font-size: 28px; }
  .cloud-native-home__summary,
  .cloud-native-home__paths,
  .cloud-native-home__domains { grid-template-columns: minmax(0, 1fr); }
  .cloud-native-home__section { margin-top: 40px; }
  .cloud-native-home__section-heading { align-items: start; flex-direction: column; gap: 5px; }
  .cloud-native-home__path { min-height: 0; }
  .cloud-native-home__start { align-items: flex-start; flex-direction: column; }
}
</style>
```

- [ ] **Step 5: Run the focused test and observe GREEN**

Run:

```bash
npm test -- tests/cloud-native-home.test.ts
```

Expected: PASS with 3 tests.

- [ ] **Step 6: Commit the homepage unit**

```bash
git add docs/.vitepress/theme/home-content.ts docs/.vitepress/theme/components/CloudNativeHome.vue tests/cloud-native-home.test.ts
git diff --cached --check
git commit -m "feat: add cloud native homepage workbench"
```

### Task 2: Move the complete Kubernetes documentation tree

**Files:**
- Create: `tests/kubernetes-routing.test.ts`
- Move: `docs/index.md` → `docs/kubernetes/index.md`
- Move: `docs/guide/` → `docs/kubernetes/guide/`
- Move: `docs/concepts/` → `docs/kubernetes/concepts/`
- Move: `docs/operations/` → `docs/kubernetes/operations/`
- Move: `docs/reference/` → `docs/kubernetes/reference/`
- Create: `docs/index.md`
- Modify: `docs/.vitepress/theme/index.ts`
- Modify: `docs/.vitepress/config.mts`
- Modify: `tests/content.test.ts`
- Modify: `tests/build-output.test.ts`

- [ ] **Step 1: Write the failing routing contract**

Create `tests/kubernetes-routing.test.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..')
const movedPages = [
  'docs/kubernetes/index.md',
  'docs/kubernetes/guide/deployment-flow.md',
  'docs/kubernetes/concepts/resource-model.md',
  'docs/kubernetes/concepts/cluster-nodes.md',
  'docs/kubernetes/concepts/workloads.md',
  'docs/kubernetes/concepts/networking.md',
  'docs/kubernetes/concepts/config-storage.md',
  'docs/kubernetes/concepts/security.md',
  'docs/kubernetes/concepts/scheduling-resources.md',
  'docs/kubernetes/operations/health-lifecycle.md',
  'docs/kubernetes/operations/release-scaling.md',
  'docs/kubernetes/operations/troubleshooting.md',
  'docs/kubernetes/reference/concept-map.md',
]

describe('Kubernetes route migration', () => {
  it.each(movedPages)('publishes %s', (file) => {
    expect(existsSync(resolve(root, file))).toBe(true)
  })

  it.each(['guide', 'concepts', 'operations', 'reference'])(
    'removes the legacy docs/%s tree',
    (directory) => {
      expect(existsSync(resolve(root, 'docs', directory))).toBe(false)
    },
  )

  it('uses only /kubernetes paths in public Kubernetes Markdown', () => {
    for (const file of movedPages) {
      const source = readFileSync(resolve(root, file), 'utf8')
      expect(source).not.toMatch(/\]\(\/(?:concepts|guide|operations|reference)(?:\/|\))/)
      expect(source).not.toMatch(/\]\(\/\)/)
    }
  })

  it('scopes the existing sidebar to Kubernetes routes', () => {
    const config = readFileSync(resolve(root, 'docs/.vitepress/config.mts'), 'utf8')

    expect(config).toContain("sidebar: {\n      '/kubernetes/':")
    expect(config).toContain("link: '/kubernetes/'")
    expect(config).toContain("link: '/kubernetes/concepts/resource-model'")
    expect(config).toContain("link: '/kubernetes/operations/troubleshooting'")
    expect(config).toContain("link: '/kubernetes/reference/concept-map'")
  })
})
```

In the same step, append these production-route tests immediately before the final
`})` that closes the `production build` describe block in
`tests/build-output.test.ts`:

```ts
it('publishes the workbench and complete Kubernetes topic tree', () => {
  for (const page of [
    'index.html',
    'kubernetes/index.html',
    'kubernetes/guide/deployment-flow.html',
    'kubernetes/concepts/resource-model.html',
    'kubernetes/concepts/cluster-nodes.html',
    'kubernetes/concepts/workloads.html',
    'kubernetes/concepts/networking.html',
    'kubernetes/concepts/config-storage.html',
    'kubernetes/concepts/security.html',
    'kubernetes/concepts/scheduling-resources.html',
    'kubernetes/operations/health-lifecycle.html',
    'kubernetes/operations/release-scaling.html',
    'kubernetes/operations/troubleshooting.html',
    'kubernetes/reference/concept-map.html',
  ]) {
    expect(existsSync(resolve(dist, page)), `${page} must be built`).toBe(true)
  }
})

it('does not publish legacy Kubernetes routes', () => {
  for (const directory of ['guide', 'concepts', 'operations', 'reference']) {
    expect(existsSync(resolve(dist, directory))).toBe(false)
  }
})

it('renders the root as the handbook and Kubernetes as the active topic', () => {
  const home = readFileSync(resolve(dist, 'index.html'), 'utf8')
  const kubernetes = readFileSync(
    resolve(dist, 'kubernetes/index.html'),
    'utf8',
  )

  expect(home).toContain('应用开发者的云原生技术工作台')
  expect(home).toContain('href="/kubernetes/"')
  expect(home).toContain('Kubernetes')
  expect(kubernetes).toContain('Kubernetes 概念总览')
})
```

- [ ] **Step 2: Run the route contracts and observe RED**

Run:

```bash
npm test -- tests/kubernetes-routing.test.ts tests/build-output.test.ts
```

Expected: FAIL because the Kubernetes tree still lives directly below `docs/`, the
new homepage is absent, and the production build does not contain `/kubernetes/**`.

- [ ] **Step 3: Move the existing Markdown tree with Git history**

Run:

```bash
mkdir -p docs/kubernetes
git mv docs/index.md docs/kubernetes/index.md
git mv docs/guide docs/kubernetes/guide
git mv docs/concepts docs/kubernetes/concepts
git mv docs/operations docs/kubernetes/operations
git mv docs/reference docs/kubernetes/reference
```

Then rewrite root-absolute Markdown links in the moved public files with one bounded mechanical pass:

```bash
find docs/kubernetes -name '*.md' -print0 | xargs -0 perl -pi -e \
  's{\]\(/(concepts|guide|operations|reference)(?=/|\))}{](/kubernetes/$1}g; s{\]\(/\)}{](/kubernetes/)}g'
```

Run `rg -n '\]\(/(?:concepts|guide|operations|reference)(?:/|\))|\]\(/\)' docs/kubernetes` and require no matches.

- [ ] **Step 4: Register the homepage and create the new root page**

Modify `docs/.vitepress/theme/index.ts`:

```ts
import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'

import Layout from './Layout.vue'
import CloudNativeHome from './components/CloudNativeHome.vue'
import MermaidDiagram from './components/MermaidDiagram.vue'
import './styles.css'

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('CloudNativeHome', CloudNativeHome)
    app.component('MermaidDiagram', MermaidDiagram)
  },
} satisfies Theme
```

Create `docs/index.md`:

```md
---
layout: page
title: 云原生开发手册
description: 面向应用开发者的云原生技术工作台。
---

<CloudNativeHome />
```

- [ ] **Step 5: Scope and prefix the Kubernetes sidebar**

In `docs/.vitepress/config.mts`, replace the sidebar array with a path-scoped object. Keep the exact existing group names and item order, but use these links:

```ts
sidebar: {
  '/kubernetes/': [
    {
      text: '开始',
      items: [
        { text: '概念总览', link: '/kubernetes/' },
        {
          text: '发布与调谐之旅',
          link: '/kubernetes/guide/deployment-flow',
        },
      ],
    },
    {
      text: '核心概念',
      items: [
        {
          text: '资源对象与元数据',
          link: '/kubernetes/concepts/resource-model',
        },
        { text: '集群与节点', link: '/kubernetes/concepts/cluster-nodes' },
        { text: '工作负载', link: '/kubernetes/concepts/workloads' },
        { text: '网络与流量', link: '/kubernetes/concepts/networking' },
        {
          text: '配置与存储',
          link: '/kubernetes/concepts/config-storage',
        },
        { text: '身份与安全', link: '/kubernetes/concepts/security' },
        {
          text: '调度与资源',
          link: '/kubernetes/concepts/scheduling-resources',
        },
      ],
    },
    {
      text: '运行实践',
      items: [
        {
          text: '健康检查与生命周期',
          link: '/kubernetes/operations/health-lifecycle',
        },
        {
          text: '发布与扩缩容',
          link: '/kubernetes/operations/release-scaling',
        },
        {
          text: '系统化排障',
          link: '/kubernetes/operations/troubleshooting',
        },
      ],
    },
    {
      text: '速查',
      items: [
        {
          text: '概念关系速查',
          link: '/kubernetes/reference/concept-map',
        },
      ],
    },
  ],
},
```

- [ ] **Step 6: Update the existing content tests mechanically**

In `tests/content.test.ts`, replace every public Kubernetes fixture prefix as follows:

```text
docs/index.md                       → docs/kubernetes/index.md
docs/guide/                         → docs/kubernetes/guide/
docs/concepts/                      → docs/kubernetes/concepts/
docs/operations/                    → docs/kubernetes/operations/
docs/reference/                     → docs/kubernetes/reference/
/concepts/                          → /kubernetes/concepts/
/operations/                        → /kubernetes/operations/
/reference/                         → /kubernetes/reference/
/guide/                             → /kubernetes/guide/
```

Also change the root-absolute resolver assertion to:

```ts
expect(resolveRootAbsoluteHref('/kubernetes/concepts/workloads')?.target).toBe(
  resolve(docsRoot, 'kubernetes/concepts/workloads'),
)
```

Do not modify `docs/superpowers/**`; those historical specs and plans are excluded from the public build.

- [ ] **Step 7: Run the routing and content suites**

Run:

```bash
npm test -- tests/kubernetes-routing.test.ts tests/build-output.test.ts tests/content.test.ts tests/content-mermaid.test.ts tests/kubernetes-manifests.test.ts
```

Expected: PASS. The production build must publish all 13 moved Kubernetes pages and
none of the four legacy directory trees. Existing content assertions must still
validate the same prose, diagrams, examples, and manifests at their new paths.

- [ ] **Step 8: Commit the complete route migration**

```bash
git add docs tests/kubernetes-routing.test.ts tests/build-output.test.ts tests/content.test.ts
git diff --cached --check
git commit -m "refactor: move Kubernetes docs under topic route"
```

Before committing, require `git status --short` to show deletions/renames only for the old public directories and additions under `docs/kubernetes/`; `.superpowers/` must remain ignored.

### Task 3: Switch the site brand and global navigation

**Files:**
- Modify: `tests/appearance-integration.test.ts`
- Modify: `tests/github-pages.test.ts`
- Modify: `docs/.vitepress/config.mts`

- [ ] **Step 1: Replace the old brand assertions with failing cloud-native assertions**

Update the first two tests in `tests/appearance-integration.test.ts` to:

```ts
it('uses the cloud-native handbook brand without presenting Kubernetes as the site brand', async () => {
  const config = await readFile(
    resolve(process.cwd(), 'docs/.vitepress/config.mts'),
    'utf8',
  )

  expect(config).toContain("title: '云原生开发手册'")
  expect(config).toContain("siteTitle: '云原生开发手册'")
  expect(config).toContain(
    "description: '面向应用开发者的云原生技术工作台。'",
  )
  expect(config).not.toContain("logo: '/kubernetes-logo.svg'")
  expect(config).not.toContain("title: 'Kubernetes'")
  expect(config).not.toContain("siteTitle: 'Kubernetes'")
  expect(config).toContain("const siteBase = process.env.BASE_PATH || '/'")
  expect(config).toContain('base: siteBase')
})

it('keeps the localized document controls without a Kubernetes favicon', async () => {
  const config = await readFile(
    resolve(process.cwd(), 'docs/.vitepress/config.mts'),
    'utf8',
  )

  expect(config).toContain("outlineTitle: '本页目录'")
  expect(config).toContain("returnToTopLabel: '返回顶部'")
  expect(config).not.toContain('transformHead({ siteData })')
})
```

In `tests/github-pages.test.ts`, replace the last test with:

```ts
it('keeps the Kubernetes topic asset base-aware without a custom favicon hook', async () => {
  const config = await readFile(
    resolve(root, 'docs/.vitepress/config.mts'),
    'utf8',
  )
  const home = await readFile(
    resolve(root, 'docs/.vitepress/theme/components/CloudNativeHome.vue'),
    'utf8',
  )

  expect(config).toContain("const siteBase = process.env.BASE_PATH || '/'")
  expect(config).toContain('base: siteBase')
  expect(config).not.toContain('logoLink:')
  expect(config).not.toContain('transformHead({ siteData })')
  expect(home).toContain("withBase(topic.logo)")
  expect(home).toContain("withBase(topic.href)")
})
```

- [ ] **Step 2: Run the focused tests and observe RED**

Run:

```bash
npm test -- tests/appearance-integration.test.ts tests/github-pages.test.ts
```

Expected: FAIL because the config still uses the Kubernetes site title, logo, favicon, and old nav.

- [ ] **Step 3: Update the VitePress brand and navigation**

In `docs/.vitepress/config.mts`:

1. Change the top-level metadata to:

```ts
title: '云原生开发手册',
description: '面向应用开发者的云原生技术工作台。',
```

2. Remove the `transformHead` hook that installs the Kubernetes favicon.

3. Set the theme title and nav to:

```ts
siteTitle: '云原生开发手册',
nav: [
  { text: '首页', link: '/' },
  { text: '技术专题', link: '/#technologies' },
  { text: '学习路径', link: '/#paths' },
  { text: 'Kubernetes', link: '/kubernetes/' },
],
```

4. Remove `logo: '/kubernetes-logo.svg'`. Keep `docs/public/kubernetes-logo.svg`; the active Kubernetes topic still uses it.

Do not rename existing `--cloud-native-*` CSS variables or local-storage keys in this task. They are internal compatibility identifiers, and renaming them would create unrelated appearance-state risk.

- [ ] **Step 4: Run branding, homepage, and Pages tests**

Run:

```bash
npm test -- tests/appearance-integration.test.ts tests/cloud-native-home.test.ts tests/github-pages.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the site-level integration**

```bash
git add docs/.vitepress/config.mts tests/appearance-integration.test.ts tests/github-pages.test.ts
git diff --cached --check
git commit -m "feat: brand site as cloud native handbook"
```

### Task 4: Full verification and visual QA

**Files:**
- Modify only if verification finds a defect in files already covered by Tasks 1–3.
- Save user-facing screenshots outside the repository under `/Users/liufashi/Documents/Codex/2026-07-21/bang/outputs/`.

- [ ] **Step 1: Use the repository Node version**

Run:

```bash
source "$HOME/.nvm/nvm.sh"
nvm use
node --version
```

Expected: Node `v24.x`, selected from `.nvmrc`.

- [ ] **Step 2: Run every automated quality gate**

Run:

```bash
npm test
npm run typecheck
npm run build
npm run build -- --base=/cloud-native/
git diff --check
git status --short
```

Expected:

- All Vitest files pass with zero failures.
- `vue-tsc` exits `0`.
- Both builds exit `0`.
- The project-base build contains `/cloud-native/kubernetes/` links and `/cloud-native/kubernetes-logo.svg` only where the Kubernetes topic needs it.
- `git diff --check` is empty.
- No generated `dist`, cache, screenshot, or `.superpowers` file is tracked.

- [ ] **Step 3: Audit internal route references**

Run:

```bash
rg -n "href=\"/(concepts|guide|operations|reference)/|\]\(/(concepts|guide|operations|reference)/" docs tests
```

Expected: no matches in public docs, theme code, or active tests. Historical files under `docs/superpowers/**` may contain old paths and remain excluded from the public build.

- [ ] **Step 4: Verify the homepage in the in-app browser**

Start or reuse the local VitePress development server. Verify at desktop and `390x844` mobile viewports:

1. The root page has no Kubernetes sidebar and shows the workbench immediately.
2. Five path items, six domains, and 24 topic items render without overlap.
3. Only Kubernetes is an anchor and keyboard-focusable; the other 23 topics are not interactive.
4. Clicking Kubernetes opens `/kubernetes/` and shows the existing sidebar and overview.
5. Existing Mermaid diagrams render; full-screen pan, zoom, reset, and Escape still work.
6. Search opens the existing VitePress search dialog.
7. Light, dark, and system modes retain readable contrast across every domain tone.
8. The document root has no horizontal overflow; cards and long technology names wrap within their cells.
9. Browser console has no errors or warnings.

- [ ] **Step 5: Save final evidence screenshots**

Save at least:

```text
/Users/liufashi/Documents/Codex/2026-07-21/bang/outputs/cloud-native-home-desktop.png
/Users/liufashi/Documents/Codex/2026-07-21/bang/outputs/cloud-native-home-mobile.png
/Users/liufashi/Documents/Codex/2026-07-21/bang/outputs/kubernetes-topic-page.png
```

- [ ] **Step 6: Commit any verification fixes separately**

If verification required code changes, re-run the affected focused test and the full gate, then commit only those fixes:

```bash
git add --update -- docs/.vitepress docs/index.md docs/kubernetes tests
git diff --cached --check
git commit -m "fix: complete cloud native homepage verification"
```

If verification found no defect, do not create an empty commit.
