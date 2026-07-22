# Diagram Container Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn every inline Mermaid diagram into the approved lightweight framed tool surface with a 24px top-right full-screen action while correcting SVG ID collisions and reactive source updates.

**Architecture:** `MermaidDiagram.vue` owns rendering, source/theme reactivity, and the inline framed shell. A new pure `svg-id-namespace.ts` module clones trusted Mermaid SVG markup for the Teleported viewer while rewriting document-level IDs and their local references. `MermaidFullscreenViewer.vue` continues to own modal interaction and consumes only the namespaced copy.

**Tech Stack:** Vue 3, VitePress 1.6, TypeScript, Mermaid 11, `@lucide/vue`, Vitest, Vue Test Utils, jsdom.

---

### Task 1: Namespace IDs in the full-screen SVG copy

**Files:**
- Create: `docs/.vitepress/theme/svg-id-namespace.ts`
- Create: `tests/svg-id-namespace.test.ts`
- Modify: `docs/.vitepress/theme/components/MermaidFullscreenViewer.vue`
- Modify: `tests/mermaid-fullscreen-viewer.test.ts`

- [ ] **Step 1: Write failing SVG reference tests**

Create tests with a realistic SVG containing `id`, `url(#...)`, `href`, `xlink:href`, `aria-labelledby`, `aria-describedby`, inline style, and a `<style>` rule:

```ts
import { describe, expect, it } from 'vitest'
import { namespaceSvgIds } from '../docs/.vitepress/theme/svg-id-namespace'

describe('namespaceSvgIds', () => {
  it('rewrites SVG ids and every local reference', () => {
    const source = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
      <style>#node { clip-path: url(#clip); }</style>
      <defs><marker id="arrow"/><clipPath id="clip"/></defs>
      <title id="title">Graph</title><desc id="description">Description</desc>
      <path id="node" marker-end="url(#arrow)" style="clip-path:url(#clip)" aria-labelledby="title description"/>
      <use href="#node" xlink:href="#node" aria-describedby="description"/>
    </svg>`

    const result = namespaceSvgIds(source, 'viewer-7')

    expect(result).toContain('id="viewer-7-arrow"')
    expect(result).toContain('url(#viewer-7-arrow)')
    expect(result).toContain('href="#viewer-7-node"')
    expect(result).toContain('xlink:href="#viewer-7-node"')
    expect(result).toContain('aria-labelledby="viewer-7-title viewer-7-description"')
    expect(result).toContain('#viewer-7-node')
  })

  it('returns malformed or id-free input unchanged', () => {
    expect(namespaceSvgIds('<svg><text>plain</text></svg>', 'viewer')).toBe(
      '<svg><text>plain</text></svg>',
    )
    expect(namespaceSvgIds('not svg', 'viewer')).toBe('not svg')
  })
})
```

- [ ] **Step 2: Run the test and observe RED**

Run:

```bash
npm test -- tests/svg-id-namespace.test.ts
```

Expected: FAIL because `svg-id-namespace.ts` does not exist.

- [ ] **Step 3: Implement the pure namespace helper**

Implement a DOM-based clone that returns the original string when parsing fails or no IDs exist. Sanitize the namespace, prefix every ID, rewrite URL fragments in all attributes, rewrite `href`/`xlink:href`, rewrite ARIA IDREF lists, and rewrite matching selectors and `url()` references in `<style>` text.

```ts
const ARIA_IDREFS = new Set(['aria-labelledby', 'aria-describedby'])

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function namespaceSvgIds(svg: string, namespace: string): string {
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml')
  const root = document.documentElement
  if (root.localName !== 'svg' || document.querySelector('parsererror')) return svg

  const prefix = `${namespace.replace(/[^A-Za-z0-9_-]/g, '-')}-`
  const ids = new Map<string, string>()
  root.querySelectorAll<SVGElement>('[id]').forEach((element) => {
    const id = element.id
    const nextId = `${prefix}${id}`
    ids.set(id, nextId)
    element.id = nextId
  })
  if (ids.size === 0) return svg

  const replaceUrlReferences = (value: string) =>
    value.replace(/url\(\s*(['"]?)#([^)'"\s]+)\1\s*\)/g, (match, quote, id) =>
      ids.has(id) ? `url(${quote}#${ids.get(id)}${quote})` : match,
    )

  root.querySelectorAll('*').forEach((element) => {
    for (const attribute of Array.from(element.attributes)) {
      let value = replaceUrlReferences(attribute.value)
      if ((attribute.localName === 'href' || attribute.name === 'xlink:href') && value.startsWith('#')) {
        value = `#${ids.get(value.slice(1)) ?? value.slice(1)}`
      } else if (ARIA_IDREFS.has(attribute.name)) {
        value = value.split(/\s+/).map((id) => ids.get(id) ?? id).join(' ')
      }
      element.setAttributeNS(attribute.namespaceURI, attribute.name, value)
    }
  })

  root.querySelectorAll('style').forEach((style) => {
    let css = replaceUrlReferences(style.textContent ?? '')
    for (const [id, nextId] of ids) {
      css = css.replace(new RegExp(`#${escapeRegExp(id)}(?=[^A-Za-z0-9_-]|$)`, 'g'), `#${nextId}`)
    }
    style.textContent = css
  })

  return new XMLSerializer().serializeToString(root)
}
```

- [ ] **Step 4: Integrate the namespaced copy into the viewer**

Compute a stable viewer copy and render it instead of `props.svg`:

```ts
import { namespaceSvgIds } from '../svg-id-namespace'

const viewerSvg = computed(() => namespaceSvgIds(props.svg, titleId))
```

```vue
<div
  class="mermaid-fullscreen-viewer__surface"
  :style="surfaceStyle"
  v-html="viewerSvg"
/>
```

Extend the viewer test with an SVG containing IDs. Mount the inline SVG in `document.body`, mount the viewer, and assert `document.querySelectorAll('[id="arrow"]')` has length one while the viewer contains a distinct prefixed ID whose marker reference resolves to it.

- [ ] **Step 5: Verify and commit**

Run:

```bash
npm test -- tests/svg-id-namespace.test.ts tests/mermaid-fullscreen-viewer.test.ts
npm run typecheck
git diff --check
```

Expected: all tests PASS; no duplicate IDs remain in the test document.

Commit:

```bash
git add docs/.vitepress/theme/svg-id-namespace.ts \
  docs/.vitepress/theme/components/MermaidFullscreenViewer.vue \
  tests/svg-id-namespace.test.ts tests/mermaid-fullscreen-viewer.test.ts
git commit -m "fix: isolate full-screen SVG references"
```

### Task 2: Rerender when the encoded source changes

**Files:**
- Modify: `docs/.vitepress/theme/components/MermaidDiagram.vue`
- Modify: `tests/mermaid-diagram.test.ts`

- [ ] **Step 1: Write failing source-update and race tests**

Add one test that calls `wrapper.setProps()` and expects a second Mermaid render with the new decoded source. Add a second test with deferred old/new renders and resolve the old promise last:

```ts
it('rerenders when encodedSource changes and ignores the stale result', async () => {
  const first = deferred<{ svg: string }>()
  const second = deferred<{ svg: string }>()
  mermaid.render
    .mockImplementationOnce(() => first.promise)
    .mockImplementationOnce(() => second.promise)

  const wrapper = mount(MermaidDiagram, {
    props: { encodedSource: encodeURIComponent('flowchart LR\nA --> B') },
  })
  await flushPromises()
  await wrapper.setProps({
    encodedSource: encodeURIComponent('flowchart LR\nC --> D'),
  })
  await flushPromises()

  expect(mermaid.render.mock.calls[1][1]).toBe('flowchart LR\nC --> D')
  second.resolve({ svg: '<svg data-source="new"></svg>' })
  await flushPromises()
  first.resolve({ svg: '<svg data-source="old"></svg>' })
  await flushPromises()
  expect(wrapper.get('svg').attributes('data-source')).toBe('new')
})
```

Also keep a viewer open during `setProps()` and assert its SVG updates after the single new Mermaid render.

- [ ] **Step 2: Run the focused test and observe RED**

Run:

```bash
npm test -- tests/mermaid-diagram.test.ts
```

Expected: FAIL because only `isDark` is watched.

- [ ] **Step 3: Watch theme and decoded source together**

Replace the single-source watcher:

```ts
stopWatching = watch(
  [isDark, source],
  () => void renderDiagram(),
  { immediate: true },
)
```

Keep the existing `renderGeneration` checks unchanged so both theme and source races reject stale results.

- [ ] **Step 4: Verify and commit**

Run:

```bash
npm test -- tests/mermaid-diagram.test.ts
npm run typecheck
git diff --check
```

Commit:

```bash
git add docs/.vitepress/theme/components/MermaidDiagram.vue tests/mermaid-diagram.test.ts
git commit -m "fix: react to Mermaid source changes"
```

### Task 3: Apply the approved lightweight diagram container

**Files:**
- Modify: `docs/.vitepress/theme/components/MermaidDiagram.vue`
- Modify: `tests/mermaid-diagram.test.ts`

- [ ] **Step 1: Write failing structure and style contracts**

Require a shell containing both the fixed action and the viewport, while the action is not inside the viewport. Assert the source CSS has no `overflow-x` on `.mermaid-diagram`, has `overflow-x: auto` only on `.mermaid-diagram__viewport`, and defines the approved dimensions:

```ts
expect(wrapper.get('.mermaid-diagram__shell').find(triggerSelector).exists()).toBe(true)
expect(wrapper.get('.mermaid-diagram__viewport').find(triggerSelector).exists()).toBe(false)

const figureRule = componentSource.match(/\.mermaid-diagram\s*\{([^}]*)\}/)?.[1]
const buttonRule = componentSource.match(/\.mermaid-diagram__fullscreen\s*\{([^}]*)\}/)?.[1]
expect(figureRule).not.toMatch(/overflow-x/)
expect(buttonRule).toMatch(/width:\s*24px/)
expect(buttonRule).toMatch(/height:\s*24px/)
expect(buttonRule).toMatch(/border-radius:\s*5px/)
expect(componentSource).toContain('<Maximize2 :size="14"')
```

Also assert the shell has an 8px radius, token-based border/background, and enough top padding in the viewport to keep the action out of the diagram content box.

- [ ] **Step 2: Run the test and observe RED**

Run:

```bash
npm test -- tests/mermaid-diagram.test.ts
```

Expected: FAIL because the current detached action row and 40px button remain.

- [ ] **Step 3: Replace the detached action row with one shell**

Use this template structure:

```vue
<div v-if="svg" class="mermaid-diagram__shell">
  <button
    ref="fullscreenTrigger"
    class="mermaid-diagram__fullscreen"
    type="button"
    aria-label="全屏查看图表"
    title="全屏查看图表"
    @click="openViewer"
  >
    <Maximize2 :size="14" aria-hidden="true" />
  </button>
  <div class="mermaid-diagram__viewport">
    <div
      ref="container"
      class="mermaid-diagram__canvas"
      :class="{ 'mermaid-diagram__canvas--wide': wideCanvasStyle }"
      :style="wideCanvasStyle"
      v-html="svg"
    />
  </div>
</div>
```

Apply the approved CSS, preserving the existing wide-canvas and label-metric rules:

```css
.mermaid-diagram {
  margin: 24px 0;
}

.mermaid-diagram__shell {
  position: relative;
  overflow: hidden;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
}

.mermaid-diagram__viewport {
  box-sizing: border-box;
  max-width: 100%;
  padding: 40px 16px 16px;
  overflow-x: auto;
}

.mermaid-diagram__fullscreen {
  position: absolute;
  z-index: 2;
  top: 8px;
  right: 8px;
  display: inline-grid;
  width: 24px;
  height: 24px;
  padding: 0;
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 5px;
  box-shadow: 0 1px 4px rgb(15 23 42 / 12%);
}
```

Retain token-based hover and a 3px `:focus-visible` outline. In reduced motion, remove the button transition. Do not add a visible toolbar label.

- [ ] **Step 4: Verify and commit**

Run:

```bash
npm test -- tests/mermaid-diagram.test.ts tests/mermaid-fullscreen-viewer.test.ts
npm run typecheck
npm run build
git diff --check
```

Expected: the focused tests and build PASS; the existing large Mermaid chunk warning may remain.

Commit:

```bash
git add docs/.vitepress/theme/components/MermaidDiagram.vue tests/mermaid-diagram.test.ts
git commit -m "style: frame Mermaid diagrams"
```

### Task 4: Refine the full-screen operation bar

**Files:**
- Modify: `docs/.vitepress/theme/components/MermaidFullscreenViewer.vue`
- Modify: `tests/mermaid-fullscreen-viewer.test.ts`

- [ ] **Step 1: Write failing toolbar style contracts**

Read the component source in a focused test and assert the approved compact segmented contract: toolbar radius `7px`, padding `3px`, gap `2px`, each button `30px`, icon size `16px`, a close-button divider, separate dark-mode surface, and reduced-motion transition removal. Also assert the desktop top-right and mobile bottom-centered safe-area rules remain present.

```ts
const toolbarRule = componentSource.match(
  /\.mermaid-fullscreen-viewer__toolbar\s*\{([^}]*)\}/,
)?.[1]
const buttonRule = componentSource.match(
  /\.mermaid-fullscreen-viewer__toolbar button\s*\{([^}]*)\}/,
)?.[1]

expect(toolbarRule).toMatch(/border-radius:\s*7px/)
expect(toolbarRule).toMatch(/padding:\s*3px/)
expect(toolbarRule).toMatch(/gap:\s*2px/)
expect(buttonRule).toMatch(/flex-basis:\s*30px/)
expect(buttonRule).toMatch(/width:\s*30px/)
expect(buttonRule).toMatch(/height:\s*30px/)
expect(componentSource).toContain('<ZoomIn aria-hidden="true" />')
expect(componentSource).toMatch(/close[^}]*border-left|border-left[^}]*(close|toolbar)/s)
expect(componentSource).toContain('prefers-reduced-motion')
```

- [ ] **Step 2: Run the test and observe RED**

```bash
npm test -- tests/mermaid-fullscreen-viewer.test.ts
```

Expected: FAIL because the current viewer uses 40px controls, 4px padding, 4px gaps, and a larger radius.

- [ ] **Step 3: Apply the compact segmented toolbar**

Keep the existing four controls and labels, but adjust the CSS:

```css
.mermaid-fullscreen-viewer__toolbar {
  display: flex;
  gap: 2px;
  padding: 3px;
  background: #fff;
  border: 1px solid #cbd3dc;
  border-radius: 7px;
  box-shadow: 0 4px 14px rgb(15 23 42 / 12%);
}

.mermaid-fullscreen-viewer__toolbar button {
  display: inline-grid;
  flex: 0 0 30px;
  width: 30px;
  height: 30px;
  place-items: center;
  border-radius: 5px;
}

.mermaid-fullscreen-viewer__toolbar button :deep(svg) {
  width: 16px;
  height: 16px;
}

.mermaid-fullscreen-viewer__toolbar button:last-child {
  margin-left: 3px;
  border-left: 1px solid #d7dde5;
  border-radius: 0 5px 5px 0;
}
```

Use `#252b32` and `#606a75` for the dark toolbar surface/border and a high-contrast dark focus ring already established by the viewer quality fix. Keep the existing safe-area placement and `@media (prefers-reduced-motion: reduce)` rule.

- [ ] **Step 4: Verify and commit**

```bash
npm test -- tests/mermaid-fullscreen-viewer.test.ts
npm run typecheck
git diff --check
```

Commit:

```bash
git add docs/.vitepress/theme/components/MermaidFullscreenViewer.vue \
  tests/mermaid-fullscreen-viewer.test.ts
git commit -m "style: refine full-screen toolbar"
```

### Task 5: Browser verification

**Files:**
- Modify only if defects are found: `docs/.vitepress/theme/components/MermaidDiagram.vue`
- Modify only if defects are found: `docs/.vitepress/theme/components/MermaidFullscreenViewer.vue`

- [ ] **Step 1: Run the complete automated suite**

```bash
npm test
npm run typecheck
npm run build
git diff --check
```

Expected: all commands exit zero; only the accepted Mermaid chunk warning remains.

- [ ] **Step 2: Verify in a real browser**

At desktop `1440×900` and mobile `390×844`, verify in light, dark, and system modes:

- the shell uses an 8px radius and quiet token-based background;
- the 24px action remains at the shell's top-right and never overlaps a label;
- a wide chart has exactly one local horizontal scrollbar and no page overflow;
- the previously clipped bilingual label satisfies `scrollHeight <= foreignObject height`;
- full-screen open, mouse/touch-equivalent pan, wheel/control zoom, reset, Escape, focus restoration, and body scroll lock work;
- inline and full-screen SVG IDs are unique and every `url(#...)` target resolves inside its own SVG;
- updating theme rerenders without console errors.

- [ ] **Step 3: Commit browser-only fixes if required**

```bash
git add docs/.vitepress/theme/components/MermaidDiagram.vue \
  docs/.vitepress/theme/components/MermaidFullscreenViewer.vue tests/
git commit -m "fix: refine diagram container behavior"
```

Skip this commit when browser QA finds no defect.
