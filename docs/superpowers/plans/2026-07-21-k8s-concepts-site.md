# K8s Concepts Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-ready, responsive VitePress documentation site that teaches Kubernetes concepts and their relationships to application developers.

**Architecture:** Markdown files provide the durable learning content, VitePress supplies navigation and local search, and a small custom Vue theme adds fluid layout plus persisted color and light/dark preferences. Pure appearance utilities are isolated from Vue so theme derivation and system-mode behavior can be tested without a browser.

**Tech Stack:** VitePress, Vue 3, TypeScript, Mermaid, lucide-vue-next, Vitest, jsdom, npm

---

## File Map

- `package.json`: scripts and dependencies.
- `.gitignore`: generated files, dependencies, and local cache exclusions.
- `docs/.vitepress/config.mts`: site metadata, navigation, search, sidebar, outline, Mermaid integration, and early appearance initialization.
- `docs/.vitepress/theme/index.ts`: custom theme registration.
- `docs/.vitepress/theme/Layout.vue`: VitePress layout slots.
- `docs/.vitepress/theme/appearance.ts`: color normalization, accent derivation, mode resolution, persistence, and DOM application.
- `docs/.vitepress/theme/components/AppearanceControl.vue`: appearance popover UI.
- `docs/.vitepress/theme/styles.css`: design tokens, fluid layout, responsive behavior, content components, and reduced-motion rules.
- `docs/index.md`: concept overview and primary relationship map.
- `docs/guide/deployment-flow.md`: end-to-end deployment and request path.
- `docs/concepts/*.md`: resource model, architecture, workloads, networking, storage, security, and scheduling.
- `docs/operations/*.md`: health, release/scaling, and troubleshooting.
- `docs/reference/concept-map.md`: relationship tables and command quick reference.
- `tests/appearance.test.ts`: pure appearance behavior tests.
- `tests/content.test.ts`: required-page, required-concept, and relative-link checks.
- `vitest.config.ts`: jsdom test environment and test inclusion.

### Task 1: Scaffold VitePress and establish the content contract

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `vitest.config.ts`
- Create: `tests/content.test.ts`
- Create: `docs/.vitepress/config.mts`
- Create: `docs/index.md`

- [ ] **Step 1: Create package metadata and install dependencies**

Create `package.json` with these scripts:

```json
{
  "name": "k8s-concepts-handbook",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vitepress dev docs --host 0.0.0.0",
    "build": "vitepress build docs",
    "preview": "vitepress preview docs --host 0.0.0.0",
    "test": "vitest run"
  }
}
```

Run:

```bash
npm install vitepress vue vitepress-plugin-mermaid mermaid lucide-vue-next
npm install -D vitest jsdom @vue/test-utils typescript
```

Expected: `package-lock.json` is created and npm reports no installation failure.

- [ ] **Step 2: Write the failing content contract test**

Create `tests/content.test.ts` with a required page list, a required concept map, and a relative Markdown link checker. The first assertions must require all 13 content pages and verify that `docs/index.md` mentions `Deployment`, `ReplicaSet`, `Pod`, `Service`, `ConfigMap`, `Secret`, and `PVC`.

```ts
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..')
const pages = [
  'docs/index.md',
  'docs/guide/deployment-flow.md',
  'docs/concepts/resource-model.md',
  'docs/concepts/cluster-nodes.md',
  'docs/concepts/workloads.md',
  'docs/concepts/networking.md',
  'docs/concepts/config-storage.md',
  'docs/concepts/security.md',
  'docs/concepts/scheduling-resources.md',
  'docs/operations/health-lifecycle.md',
  'docs/operations/release-scaling.md',
  'docs/operations/troubleshooting.md',
  'docs/reference/concept-map.md',
]

describe('documentation content contract', () => {
  it('contains every configured handbook page', () => {
    for (const page of pages) expect(existsSync(resolve(root, page)), page).toBe(true)
  })

  it('introduces the primary object relationship on the home page', () => {
    const home = readFileSync(resolve(root, 'docs/index.md'), 'utf8')
    for (const term of ['Deployment', 'ReplicaSet', 'Pod', 'Service', 'ConfigMap', 'Secret', 'PVC']) {
      expect(home).toContain(term)
    }
  })

  it('does not contain broken relative Markdown links', () => {
    for (const page of pages.filter((item) => existsSync(resolve(root, item)))) {
      const source = readFileSync(resolve(root, page), 'utf8')
      for (const [, href] of source.matchAll(/\[[^\]]+\]\((?!https?:|#)([^)]+)\)/g)) {
        const target = href.split('#')[0]
        if (target) expect(existsSync(resolve(dirname(resolve(root, page)), target)), `${page} -> ${href}`).toBe(true)
      }
    }
  })
})
```

- [ ] **Step 3: Run the test and verify RED**

Run: `npm test -- tests/content.test.ts`

Expected: FAIL because the 12 non-home content pages do not exist.

- [ ] **Step 4: Add the smallest buildable VitePress baseline**

Create `.gitignore` with `node_modules/`, `docs/.vitepress/cache/`, `docs/.vitepress/dist/`, `.DS_Store`, and `.superpowers/`.

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { environment: 'jsdom', include: ['tests/**/*.test.ts'] },
})
```

Create `docs/.vitepress/config.mts` with `lang: 'zh-CN'`, title `K8s 概念手册`, local search, `outline: { level: [2, 3] }`, Chinese doc footer labels, and `withMermaid(defineConfig(...))`.

Create a temporary `docs/index.md` containing a title, a one-paragraph desired-state explanation, and the seven required relationship terms. Do not add empty placeholder pages yet; the content contract should remain red until Tasks 5-7 create real content.

- [ ] **Step 5: Verify the site builds while the content contract remains intentionally red**

Run: `npm run build`

Expected: PASS and output under `docs/.vitepress/dist`.

Run: `npm test -- tests/content.test.ts`

Expected: FAIL only for missing required content pages.

- [ ] **Step 6: Commit the scaffold**

```bash
git add package.json package-lock.json .gitignore vitest.config.ts tests/content.test.ts docs/.vitepress/config.mts docs/index.md
git commit -m "build: scaffold vitepress handbook"
```

### Task 2: Build the tested appearance state engine

**Files:**
- Create: `tests/appearance.test.ts`
- Create: `docs/.vitepress/theme/appearance.ts`

- [ ] **Step 1: Write failing tests for appearance behavior**

Test these exact behaviors:

```ts
import { describe, expect, it } from 'vitest'
import { deriveAccent, normalizeHex, resolveDarkMode } from '../docs/.vitepress/theme/appearance'

describe('appearance utilities', () => {
  it('normalizes valid colors and rejects malformed input', () => {
    expect(normalizeHex('#28755d')).toBe('#28755D')
    expect(normalizeHex('2b69a7')).toBe('#2B69A7')
    expect(normalizeHex('#xyzxyz')).toBeNull()
  })

  it('derives readable light and dark accents from a custom color', () => {
    expect(deriveAccent('#8FD8BC')).toEqual({ light: 'hsl(156 48% 36%)', dark: 'hsl(156 48% 68%)' })
  })

  it('resolves auto, light, and dark modes', () => {
    expect(resolveDarkMode('auto', true)).toBe(true)
    expect(resolveDarkMode('auto', false)).toBe(false)
    expect(resolveDarkMode('light', true)).toBe(false)
    expect(resolveDarkMode('dark', false)).toBe(true)
  })
})
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `npm test -- tests/appearance.test.ts`

Expected: FAIL because `appearance.ts` does not exist.

- [ ] **Step 3: Implement the pure appearance utilities**

Export:

```ts
export type AppearanceMode = 'auto' | 'light' | 'dark'
export const DEFAULT_COLOR = '#28755D'
export const PRESET_COLORS = ['#28755D', '#277A72', '#2B69A7', '#555DB0', '#76549A', '#A43F5A', '#AA493F', '#A85C28', '#8A6B1F', '#5B6670'] as const
export function normalizeHex(value: string): string | null
export function deriveAccent(value: string): { light: string; dark: string }
export function resolveDarkMode(mode: AppearanceMode, systemDark: boolean): boolean
export function applyAppearance(color: string, mode: AppearanceMode): void
export function loadAppearance(): { color: string; mode: AppearanceMode }
export function saveAppearance(color: string, mode: AppearanceMode): void
```

`deriveAccent` must convert RGB to HSL, clamp saturation to `34..72`, and output lightness `36%` for light mode and `68%` for dark mode. Browser-facing functions must guard `window`, `document`, `localStorage`, and `matchMedia` access.

- [ ] **Step 4: Run the tests and verify GREEN**

Run: `npm test -- tests/appearance.test.ts`

Expected: PASS with 3 tests.

- [ ] **Step 5: Commit the appearance engine**

```bash
git add tests/appearance.test.ts docs/.vitepress/theme/appearance.ts
git commit -m "feat: add appearance state engine"
```

### Task 3: Add the appearance popover and theme integration

**Files:**
- Create: `docs/.vitepress/theme/components/AppearanceControl.vue`
- Create: `docs/.vitepress/theme/Layout.vue`
- Create: `docs/.vitepress/theme/index.ts`
- Modify: `docs/.vitepress/config.mts`
- Test: `tests/appearance.test.ts`

- [ ] **Step 1: Add a failing persistence test**

Use a real jsdom `localStorage` to assert that `saveAppearance('#2B69A7', 'dark')` and `loadAppearance()` round-trip both values. Clear storage before each test.

- [ ] **Step 2: Run the persistence test and verify RED**

Run: `npm test -- tests/appearance.test.ts`

Expected: FAIL until browser persistence is implemented.

- [ ] **Step 3: Implement the Vue control**

`AppearanceControl.vue` must:

- Render one compact top-bar button using Lucide `Palette` and the current color dot.
- Open a popover with the 10 preset swatches, an `<input type="color">`, and a three-button segmented mode control using `Monitor`, `Sun`, and `Moon` icons.
- Use `aria-expanded`, `aria-pressed`, `aria-label`, `title`, and `role="dialog"` where appropriate.
- Close on outside click and Esc.
- Call `applyAppearance` and `saveAppearance` immediately after changes.
- Subscribe to `matchMedia('(prefers-color-scheme: dark)')` only while mounted and only reapply when mode is `auto`.

Create `Layout.vue`:

```vue
<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import AppearanceControl from './components/AppearanceControl.vue'

const { Layout } = DefaultTheme
</script>

<template>
  <Layout>
    <template #nav-bar-content-after><AppearanceControl /></template>
    <template #nav-screen-content-after><AppearanceControl mobile /></template>
  </Layout>
</template>
```

Create `theme/index.ts` by extending `DefaultTheme`, registering `Layout`, and importing `styles.css` after the default theme CSS.

- [ ] **Step 4: Add early appearance initialization**

Set VitePress `appearance: false` and add an inline head script that reads `k8s-theme-color` and `k8s-theme-mode`, applies the validated color variables, and adds `.dark` before content renders. The fallback is default green plus system mode.

- [ ] **Step 5: Run tests and build**

Run: `npm test -- tests/appearance.test.ts && npm run build`

Expected: all appearance tests PASS; VitePress build PASS with no Vue warnings.

- [ ] **Step 6: Commit the integrated control**

```bash
git add docs/.vitepress/config.mts docs/.vitepress/theme tests/appearance.test.ts
git commit -m "feat: add configurable appearance control"
```

### Task 4: Implement fluid and responsive visual design

**Files:**
- Create: `docs/.vitepress/theme/styles.css`
- Modify: `docs/.vitepress/theme/components/AppearanceControl.vue`

- [ ] **Step 1: Add failing structure assertions**

Extend `tests/content.test.ts` to require `styles.css` to contain:

```ts
for (const contract of [
  '--k8s-accent',
  'clamp(',
  '@media (max-width: 1099px)',
  '@media (max-width: 767px)',
  'prefers-reduced-motion',
  'overflow-x: auto',
]) expect(styles).toContain(contract)
```

- [ ] **Step 2: Run the style contract and verify RED**

Run: `npm test -- tests/content.test.ts`

Expected: FAIL because `styles.css` is missing.

- [ ] **Step 3: Implement styles**

Define neutral light/dark tokens, `--k8s-accent`, `--k8s-accent-dark`, `--k8s-accent-soft`, code colors, line colors, and muted text colors. Override VitePress container maximum widths so the page is fluid. Use `clamp()` for sidebar, outline, and content padding.

Add explicit responsive rules:

- Desktop: left sidebar + fluid main + right outline.
- `<= 1099px`: hide the right outline and keep or toggle the sidebar.
- `<= 767px`: use VitePress mobile menu, hide text labels on compact icon controls, stack diagrams and comparison columns.
- `.vp-doc table`, `.vp-doc div[class*='language-']`, and Mermaid wrappers must use local horizontal overflow without causing page-level overflow.
- `@media (prefers-reduced-motion: reduce)` must remove nonessential transitions.

Style content semantics rather than wrapping sections in decorative cards. Use callouts, thin rules, and relationship diagrams as the primary visual assets.

- [ ] **Step 4: Run tests and build**

Run: `npm test -- tests/content.test.ts && npm run build`

Expected: style assertions PASS; content test still fails only for missing pages; build PASS.

- [ ] **Step 5: Commit the responsive theme**

```bash
git add docs/.vitepress/theme/styles.css docs/.vitepress/theme/components/AppearanceControl.vue tests/content.test.ts
git commit -m "feat: add fluid responsive documentation theme"
```

### Task 5: Write the overview and deployment journey

**Files:**
- Replace: `docs/index.md`
- Create: `docs/guide/deployment-flow.md`
- Modify: `docs/.vitepress/config.mts`

- [ ] **Step 1: Write the overview page**

Include these sections with complete Chinese explanations:

- Kubernetes in one sentence: desired state plus reconciliation.
- Object anatomy: `apiVersion`, `kind`, `metadata`, `spec`, `status`.
- Four relationship diagrams: workload, request path, application dependencies, control loop.
- A compact relationship table with relation verbs.
- A minimal Deployment + Service YAML example.
- Common misconceptions: Pod is not a stable server, Service does not run containers, Secret is not encrypted by default, Namespace is not a hard security boundary.
- Links to every next-step section.

- [ ] **Step 2: Write the deployment-flow page**

Trace this exact sequence with a Mermaid sequence diagram and numbered prose:

```text
Developer -> kubectl -> API Server -> admission/auth -> etcd
Deployment Controller -> ReplicaSet -> Pod
Scheduler -> Node
kubelet -> container runtime
readiness probe -> EndpointSlice
Ingress/Gateway -> Service -> ready Pod
```

Include `kubectl apply`, `get`, `describe`, `logs`, and `rollout status` commands at the stage where each becomes useful.

- [ ] **Step 3: Configure navigation for the two pages**

Add `开始` sidebar entries for `/` and `/guide/deployment-flow` and top navigation links for `概念`, `运行实践`, and `速查`.

- [ ] **Step 4: Run focused validation**

Run: `npm test -- tests/content.test.ts && npm run build`

Expected: home relationship assertions PASS; missing-page failures remain for Tasks 6-7; build PASS.

- [ ] **Step 5: Commit the learning path**

```bash
git add docs/index.md docs/guide/deployment-flow.md docs/.vitepress/config.mts
git commit -m "docs: add overview and deployment journey"
```

### Task 6: Write the core concept chapters

**Files:**
- Create: `docs/concepts/resource-model.md`
- Create: `docs/concepts/cluster-nodes.md`
- Create: `docs/concepts/workloads.md`
- Create: `docs/concepts/networking.md`
- Create: `docs/concepts/config-storage.md`
- Create: `docs/concepts/security.md`
- Create: `docs/concepts/scheduling-resources.md`
- Modify: `docs/.vitepress/config.mts`

- [ ] **Step 1: Write resource model and cluster chapters**

`resource-model.md` must explain scope, names, UIDs, Namespace, Label/Selector, Annotation, OwnerReference, Finalizer, spec/status, generation, and resourceVersion with a relationship table.

`cluster-nodes.md` must explain API Server, etcd, Controller Manager, Scheduler, Node, kubelet, kube-proxy, container runtime, CNI, and CSI with one control-plane-to-node Mermaid diagram.

- [ ] **Step 2: Write workload and networking chapters**

`workloads.md` must compare Pod, ReplicaSet, Deployment, StatefulSet, DaemonSet, Job, and CronJob by identity, update strategy, storage expectation, and common use case. Include workload ownership diagrams and minimal YAML.

`networking.md` must explain Pod IP, Service types, selectors, EndpointSlice, CoreDNS, Ingress, Gateway API, CNI, and NetworkPolicy. Include the full request path and explain why selector mismatches create Services without endpoints.

- [ ] **Step 3: Write configuration, storage, security, and scheduling chapters**

`config-storage.md` must compare ConfigMap and Secret injection, Volume lifetime, PV/PVC binding, StorageClass provisioning, access modes, reclaim policy, and CSI.

`security.md` must map Subject → RoleBinding → Role → API Resource and cover ServiceAccount, Role, ClusterRole, RoleBinding, ClusterRoleBinding, SecurityContext, Pod Security Standards, least privilege, and Secret caveats.

`scheduling-resources.md` must cover requests, limits, QoS, scheduler filtering/scoring, NodeSelector, node/pod affinity, taints/tolerations, PriorityClass, preemption, topology spread, and PDB.

- [ ] **Step 4: Add all seven pages to sidebar navigation**

Use a `核心概念` sidebar group in the same order as the file list. Every page must include links to its nearest prerequisite and next topic.

- [ ] **Step 5: Run validation**

Run: `npm test -- tests/content.test.ts && npm run build`

Expected: failures remain only for the four operations/reference pages; build PASS.

- [ ] **Step 6: Commit the core handbook**

```bash
git add docs/concepts docs/.vitepress/config.mts
git commit -m "docs: add core kubernetes concept chapters"
```

### Task 7: Write operations, troubleshooting, and the relationship reference

**Files:**
- Create: `docs/operations/health-lifecycle.md`
- Create: `docs/operations/release-scaling.md`
- Create: `docs/operations/troubleshooting.md`
- Create: `docs/reference/concept-map.md`
- Modify: `docs/.vitepress/config.mts`

- [ ] **Step 1: Write health and lifecycle**

Explain startup, readiness, and liveness probe responsibilities; postStart/preStop; SIGTERM; terminationGracePeriodSeconds; readiness gates; and Pod phases versus container states. Include a complete probe YAML and a probe-choice table.

- [ ] **Step 2: Write release and scaling**

Explain rolling update, maxUnavailable/maxSurge, rollout status/history/undo, HPA metric flow, VPA recommendation/control, Cluster Autoscaler node capacity, and PDB limitations. Include the relation `metrics → HPA → workload replicas → Pods`.

- [ ] **Step 3: Write the troubleshooting decision path**

Use this ordered diagnostic flow:

```text
resource accepted -> Pod created -> Pod scheduled -> image/container started
-> Pod ready -> EndpointSlice populated -> Service reachable -> ingress route reachable
```

For every stage include observable status, likely causes, and exact `kubectl` commands. Cover `Pending`, `ImagePullBackOff`, `CrashLoopBackOff`, failed probes, empty endpoints, DNS, and NetworkPolicy.

- [ ] **Step 4: Write the relationship reference**

Create tables with columns: object, scope, who creates/manages it, what it selects/references, lifetime, and primary command. Include workload, networking, storage, security, and autoscaling objects. Add a Mermaid master map with labeled edges.

- [ ] **Step 5: Complete navigation and verify GREEN**

Add `运行实践` and `速查` sidebar groups, then run:

```bash
npm test -- tests/content.test.ts
npm run build
```

Expected: all tests PASS and build PASS.

- [ ] **Step 6: Commit the completed content set**

```bash
git add docs/operations docs/reference docs/.vitepress/config.mts
git commit -m "docs: add operations and relationship reference"
```

### Task 8: Final verification and visual QA

**Files:**
- Modify if defects are found: `docs/.vitepress/theme/**`, `docs/**/*.md`, `tests/**/*.ts`

- [ ] **Step 1: Run the complete automated suite**

Run:

```bash
npm test
npm run build
```

Expected: all Vitest tests PASS; VitePress production build exits 0 without warnings.

- [ ] **Step 2: Start the development server**

Run: `npm run dev`

Expected: VitePress prints a reachable local URL. Keep the session running for user review.

- [ ] **Step 3: Verify desktop behavior in the browser**

At a wide viewport confirm: fluid content uses available width, left navigation and right outline are visible, local search opens, Mermaid diagrams render, and there is no page-level horizontal overflow.

Open appearance settings and verify: all 10 presets, custom color input, auto/light/dark modes, outside click, Esc close, and persisted state after reload.

- [ ] **Step 4: Verify tablet and mobile behavior**

At tablet width confirm the right outline is hidden and navigation remains usable. At mobile width confirm the menu opens as a drawer, the appearance control remains reachable, the drawer closes via overlay and Esc, content does not overlap, diagrams stack or scroll locally, and code/table overflow stays inside the component.

- [ ] **Step 5: Inspect browser console and screenshots**

Capture desktop and mobile screenshots, inspect them for clipped text, low contrast, blank diagrams, or overlapping controls, and inspect console logs for errors or hydration warnings. Fix any defect with a focused failing regression test when practical, then rerun `npm test && npm run build`.

- [ ] **Step 6: Commit final verification fixes**

```bash
git add .
git commit -m "test: verify responsive handbook experience"
```

If no files changed during QA, do not create an empty commit.
