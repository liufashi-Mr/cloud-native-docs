# Kubernetes Brand and Mermaid Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the old handbook brand with a local Kubernetes logo and add readable, accessible full-screen pan/zoom viewing to every Mermaid diagram.

**Architecture:** VitePress keeps ownership of the navbar brand through `themeConfig.logo`, `logoLink`, and `siteTitle`. Mermaid continues to render once in `MermaidDiagram.vue`; a focused `MermaidFullscreenViewer.vue` receives the rendered SVG, while pure transform helpers calculate fit, pan, and pointer-centered zoom without coupling geometry to Vue lifecycle code.

**Tech Stack:** VitePress 1.6, Vue 3, TypeScript, Mermaid, `@lucide/vue`, Vitest, Vue Test Utils, jsdom, in-app browser QA.

---

### Task 1: Replace the navbar brand

**Files:**
- Create: `docs/public/kubernetes-logo.svg`
- Modify: `docs/.vitepress/config.mts`
- Modify: `tests/appearance-integration.test.ts`

- [ ] **Step 1: Write the failing brand contract**

Add a test that reads the config and asserts the visible/global title, local logo, and homepage link:

```ts
it('uses the Kubernetes brand and links it to the handbook homepage', () => {
  expect(config).toContain("title: 'Kubernetes'")
  expect(config).toContain("siteTitle: 'Kubernetes'")
  expect(config).toContain("logo: '/kubernetes-logo.svg'")
  expect(config).toContain("logoLink: '/'")
  expect(config).not.toContain("title: 'K8s 概念手册'")
})
```

- [ ] **Step 2: Run the focused test and observe RED**

Run:

```bash
npm test -- tests/appearance-integration.test.ts
```

Expected: FAIL because the config still contains `K8s 概念手册` and has no local logo configuration.

- [ ] **Step 3: Add the official local asset and config**

Download the official Kubernetes repository logo as a build-time asset:

```bash
curl -L --fail --silent --show-error \
  https://raw.githubusercontent.com/kubernetes/kubernetes/master/logo/logo.svg \
  -o docs/public/kubernetes-logo.svg
```

Update only these fields in `docs/.vitepress/config.mts`; leave the remaining existing configuration unchanged:

```diff
-  title: 'K8s 概念手册',
+  title: 'Kubernetes',
@@
   themeConfig: {
+    logo: '/kubernetes-logo.svg',
+    logoLink: '/',
+    siteTitle: 'Kubernetes',
     nav: [
```

- [ ] **Step 4: Verify GREEN and build output**

Run:

```bash
npm test -- tests/appearance-integration.test.ts
npm run build
```

Expected: focused test PASS; build PASS; generated navbar assets reference the local logo and no runtime request to kubernetes.io is required.

- [ ] **Step 5: Commit the brand change**

```bash
git add docs/public/kubernetes-logo.svg docs/.vitepress/config.mts tests/appearance-integration.test.ts
git commit -m "feat: apply Kubernetes handbook brand"
```

### Task 2: Fix Mermaid HTML label clipping

**Files:**
- Modify: `docs/.vitepress/theme/components/MermaidDiagram.vue`
- Modify: `tests/mermaid-diagram.test.ts`

- [ ] **Step 1: Add a failing typography-isolation test**

Read the component source in the test and require deep rules that neutralize documentation paragraph typography inside Mermaid labels:

```ts
it('keeps Mermaid HTML labels within the dimensions Mermaid measured', () => {
  expect(componentSource).toMatch(
    /:deep\(\.label p\)[\s\S]*margin:\s*0[\s\S]*line-height:\s*inherit/,
  )
})
```

The selector must cover both node and edge HTML labels through Mermaid's shared `.label p` structure.

- [ ] **Step 2: Run the regression and observe RED**

Run:

```bash
npm test -- tests/mermaid-diagram.test.ts
```

Expected: FAIL because `.vp-doc` paragraph line-height still leaks into Mermaid's fixed-height `foreignObject`.

- [ ] **Step 3: Isolate generated label paragraphs**

Add to the scoped component styles:

```css
.mermaid-diagram :deep(.label p) {
  margin: 0;
  line-height: inherit;
}
```

This restores the `1.5` line height Mermaid used when calculating the `foreignObject` dimensions instead of changing diagram source or widening every label.

- [ ] **Step 4: Verify GREEN and inspect computed geometry**

Run:

```bash
npm test -- tests/mermaid-diagram.test.ts
```

Expected: PASS. During browser QA, the affected edge label must report `scrollHeight <= foreignObject height` and render the complete bilingual text.

- [ ] **Step 5: Commit the clipping fix**

```bash
git add docs/.vitepress/theme/components/MermaidDiagram.vue tests/mermaid-diagram.test.ts
git commit -m "fix: preserve Mermaid label metrics"
```

### Task 3: Add pure diagram viewport geometry

**Files:**
- Create: `docs/.vitepress/theme/diagram-viewport.ts`
- Create: `tests/diagram-viewport.test.ts`

- [ ] **Step 1: Write failing fit, zoom, and pan tests**

Create tests for a fit transform and pointer-centered zoom:

```ts
import { fitDiagram, panDiagram, zoomDiagram } from '../docs/.vitepress/theme/diagram-viewport'

it('fits and centers a diagram inside the viewport', () => {
  expect(fitDiagram(1000, 700, 2000, 1000, 48)).toEqual({
    scale: 0.452,
    x: 48,
    y: 124,
  })
})

it('keeps the pointer over the same diagram coordinate while zooming', () => {
  expect(zoomDiagram({ scale: 1, x: 20, y: 30 }, 2, 120, 130)).toEqual({
    scale: 2,
    x: -80,
    y: -70,
  })
})

it('adds pointer movement to the current pan', () => {
  expect(panDiagram({ scale: 1, x: 20, y: 30 }, 15, -5)).toEqual({
    scale: 1,
    x: 35,
    y: 25,
  })
})
```

- [ ] **Step 2: Run the tests and observe RED**

Run:

```bash
npm test -- tests/diagram-viewport.test.ts
```

Expected: FAIL because the geometry module does not exist.

- [ ] **Step 3: Implement the geometry helpers**

Create `diagram-viewport.ts`:

```ts
export interface DiagramTransform {
  scale: number
  x: number
  y: number
}

export function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

export function fitDiagram(
  viewportWidth: number,
  viewportHeight: number,
  diagramWidth: number,
  diagramHeight: number,
  padding: number,
): DiagramTransform {
  const availableWidth = Math.max(1, viewportWidth - padding * 2)
  const availableHeight = Math.max(1, viewportHeight - padding * 2)
  const scale = Math.min(1, availableWidth / diagramWidth, availableHeight / diagramHeight)
  return {
    scale,
    x: (viewportWidth - diagramWidth * scale) / 2,
    y: (viewportHeight - diagramHeight * scale) / 2,
  }
}

export function zoomDiagram(
  current: DiagramTransform,
  requestedScale: number,
  anchorX: number,
  anchorY: number,
  minimumScale = 0.1,
  maximumScale = 4,
): DiagramTransform {
  const scale = clamp(requestedScale, minimumScale, maximumScale)
  const ratio = scale / current.scale
  return {
    scale,
    x: anchorX - (anchorX - current.x) * ratio,
    y: anchorY - (anchorY - current.y) * ratio,
  }
}

export function panDiagram(
  current: DiagramTransform,
  deltaX: number,
  deltaY: number,
): DiagramTransform {
  return { ...current, x: current.x + deltaX, y: current.y + deltaY }
}
```

- [ ] **Step 4: Verify GREEN**

Run:

```bash
npm test -- tests/diagram-viewport.test.ts
npm run typecheck
```

Expected: tests and typecheck PASS.

- [ ] **Step 5: Commit the geometry module**

```bash
git add docs/.vitepress/theme/diagram-viewport.ts tests/diagram-viewport.test.ts
git commit -m "feat: add diagram viewport geometry"
```

### Task 4: Build the accessible full-screen viewer

**Files:**
- Create: `docs/.vitepress/theme/components/MermaidFullscreenViewer.vue`
- Create: `tests/mermaid-fullscreen-viewer.test.ts`

- [ ] **Step 1: Write failing viewer behavior tests**

Mount the viewer with a fixed SVG and assert dialog semantics, controls, reset, drag, Escape, and scroll cleanup:

```ts
const svg = '<svg viewBox="0 0 1200 600"><text>diagram</text></svg>'

it('opens as a modal with pan and zoom controls', async () => {
  const wrapper = mount(MermaidFullscreenViewer, { props: { svg } })
  expect(wrapper.get('[role="dialog"]').attributes('aria-modal')).toBe('true')
  expect(wrapper.get('button[aria-label="放大图表"]')).toBeTruthy()
  expect(wrapper.get('button[aria-label="缩小图表"]')).toBeTruthy()
  expect(wrapper.get('button[aria-label="重置图表视图"]')).toBeTruthy()
  expect(wrapper.get('button[aria-label="关闭全屏图表"]')).toBeTruthy()
})

it('closes on Escape and restores body overflow on unmount', async () => {
  const wrapper = mount(MermaidFullscreenViewer, {
    attachTo: document.body,
    props: { svg },
  })
  expect(document.body.style.overflow).toBe('hidden')
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  expect(wrapper.emitted('close')).toHaveLength(1)
  wrapper.unmount()
  expect(document.body.style.overflow).toBe('')
})
```

Add focused tests that dispatch pointer movement and wheel events, then assert the surface transform changes and reset restores its initial transform.

- [ ] **Step 2: Run the viewer suite and observe RED**

Run:

```bash
npm test -- tests/mermaid-fullscreen-viewer.test.ts
```

Expected: FAIL because the viewer component does not exist.

- [ ] **Step 3: Implement the modal and controls**

Create a teleported dialog using `X`, `ZoomIn`, `ZoomOut`, and `RotateCcw` from `@lucide/vue`. The component must:

```ts
const props = defineProps<{ svg: string }>()
const emit = defineEmits<{ close: [] }>()
const viewport = ref<HTMLElement>()
const closeButton = ref<HTMLButtonElement>()
const transform = ref<DiagramTransform>({ scale: 1, x: 0, y: 0 })
const dragging = ref(false)
const activePointerId = ref<number>()
const previousPointer = ref({ x: 0, y: 0 })

function close() {
  emit('close')
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') close()
}

function startDrag(event: PointerEvent) {
  dragging.value = true
  activePointerId.value = event.pointerId
  previousPointer.value = { x: event.clientX, y: event.clientY }
  viewport.value?.setPointerCapture(event.pointerId)
}

function handlePointerMove(event: PointerEvent) {
  if (!dragging.value || event.pointerId !== activePointerId.value) return
  transform.value = panDiagram(
    transform.value,
    event.clientX - previousPointer.value.x,
    event.clientY - previousPointer.value.y,
  )
  previousPointer.value = { x: event.clientX, y: event.clientY }
}

function stopDrag(event: PointerEvent) {
  if (event.pointerId !== activePointerId.value) return
  dragging.value = false
  activePointerId.value = undefined
  viewport.value?.releasePointerCapture(event.pointerId)
}
```

Render the surface with a single transform:

```vue
<div
  ref="viewport"
  class="mermaid-viewer__viewport"
  @pointerdown="startDrag"
  @pointermove="handlePointerMove"
  @pointerup="stopDrag"
  @pointercancel="stopDrag"
  @wheel.prevent="handleWheel"
>
  <div
    class="mermaid-viewer__surface"
    :style="{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }"
    v-html="svg"
  />
</div>
```

On mount, parse the rendered SVG viewBox, call `fitDiagram`, focus the close button, attach resize and keydown listeners, and lock `document.body.style.overflow`. Restore the prior overflow and remove listeners on unmount. Keep scale between the fitted scale divided by two and `4`.

Use a fixed toolbar, high-contrast theme tokens, `touch-action: none`, `cursor: grab/grabbing`, and reduced-motion CSS. Add a visually hidden dialog title and trap `Tab` navigation within the toolbar controls.

- [ ] **Step 4: Verify viewer GREEN**

Run:

```bash
npm test -- tests/diagram-viewport.test.ts tests/mermaid-fullscreen-viewer.test.ts
npm run typecheck
```

Expected: viewer, geometry, and typecheck PASS.

- [ ] **Step 5: Commit the viewer**

```bash
git add docs/.vitepress/theme/components/MermaidFullscreenViewer.vue docs/.vitepress/theme/diagram-viewport.ts tests/mermaid-fullscreen-viewer.test.ts
git commit -m "feat: add draggable full-screen diagram viewer"
```

### Task 5: Integrate the viewer with Mermaid diagrams

**Files:**
- Modify: `docs/.vitepress/theme/components/MermaidDiagram.vue`
- Modify: `tests/mermaid-diagram.test.ts`

- [ ] **Step 1: Add failing integration tests**

Extend the Mermaid component tests:

```ts
it('opens the already-rendered SVG without rerendering Mermaid', async () => {
  mermaid.render.mockResolvedValue({
    svg: '<svg viewBox="0 0 1200 600"><text>diagram</text></svg>',
  })
  const wrapper = mount(MermaidDiagram, {
    attachTo: document.body,
    props: { encodedSource: encodeURIComponent('flowchart LR\nA --> B') },
  })
  await flushPromises()

  await wrapper.get('button[aria-label="全屏查看图表"]').trigger('click')

  expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()
  expect(mermaid.render).toHaveBeenCalledTimes(1)
})

it('restores focus to the full-screen trigger after closing', async () => {
  const trigger = wrapper.get('button[aria-label="全屏查看图表"]')
  await trigger.trigger('click')
  await wrapper.getComponent(MermaidFullscreenViewer).vm.$emit('close')
  await nextTick()
  expect(document.activeElement).toBe(trigger.element)
})
```

- [ ] **Step 2: Run the integration suite and observe RED**

Run:

```bash
npm test -- tests/mermaid-diagram.test.ts
```

Expected: FAIL because rendered figures have no full-screen trigger or viewer.

- [ ] **Step 3: Add the trigger and viewer state**

Import `Maximize2` and `MermaidFullscreenViewer`, then add:

```ts
const viewerOpen = ref(false)
const fullscreenTrigger = ref<HTMLButtonElement>()

function closeViewer() {
  viewerOpen.value = false
  void nextTick(() => fullscreenTrigger.value?.focus())
}
```

Render the icon button only after SVG success and pass the existing SVG string to the viewer:

```vue
<button
  v-if="svg"
  ref="fullscreenTrigger"
  class="mermaid-diagram__fullscreen"
  type="button"
  aria-label="全屏查看图表"
  title="全屏查看图表"
  @click="viewerOpen = true"
>
  <Maximize2 :size="18" aria-hidden="true" />
</button>
<MermaidFullscreenViewer
  v-if="viewerOpen"
  :svg="svg"
  @close="closeViewer"
/>
```

Position the trigger inside the figure without covering labels, keep a stable 36px hit target, and preserve existing inline horizontal scrolling.

- [ ] **Step 4: Verify integration GREEN**

Run:

```bash
npm test -- tests/mermaid-diagram.test.ts tests/mermaid-fullscreen-viewer.test.ts
npm run typecheck
```

Expected: all focused tests PASS and opening the viewer does not call `mermaid.render` again.

- [ ] **Step 5: Commit the integration**

```bash
git add docs/.vitepress/theme/components/MermaidDiagram.vue tests/mermaid-diagram.test.ts
git commit -m "feat: open Mermaid diagrams in full screen"
```

### Task 6: Full verification and browser QA

**Files:**
- Modify only if defects are found: `docs/.vitepress/theme/**`, `tests/**/*.ts`

- [ ] **Step 1: Run the complete automated suite**

Run:

```bash
npm test
npm run typecheck
npm run build
git diff --check
```

Expected: all tests PASS; typecheck and build exit 0. The existing lazy Mermaid `>500 kB` chunk warning remains accepted.

- [ ] **Step 2: Start or reuse the project dev server**

Run:

```bash
npm run dev -- --port 41737
```

Expected: the VitePress site is reachable on loopback. If `41737` is already serving this project, reuse it.

- [ ] **Step 3: Verify the brand in the in-app browser**

At desktop and 390px mobile widths verify:

- the local Kubernetes logo appears left of `Kubernetes`;
- the brand fits without clipping or shifting navigation;
- its link is exactly `/` and returns to the handbook homepage;
- no request to kubernetes.io is made for navigation or the image.

- [ ] **Step 4: Verify the clipping regression**

Open the homepage request-path diagram and inspect the `publishes through API Server 通过 API Server 发布` label. Confirm the entire label and background render, and inspect that the label paragraph `scrollHeight` does not exceed its Mermaid `foreignObject` height.

- [ ] **Step 5: Verify full-screen interaction**

Test one simple diagram and the master concept map at desktop and mobile widths:

- open and close using buttons;
- close with `Escape` and confirm trigger focus restoration;
- drag with mouse and touch-equivalent pointer input;
- zoom in, zoom out, wheel zoom, and reset;
- confirm the diagram stays visible and no page-level overflow appears;
- confirm background scrolling is locked only while the viewer is open;
- switch light/dark modes and reopen without stale colors;
- inspect the console for errors or hydration warnings.

Capture updated desktop and mobile screenshots in `/Users/liufashi/Documents/Codex/2026-07-21/bang/outputs`.

- [ ] **Step 6: Fix defects with focused regression tests and commit**

If browser QA finds a defect, first add the smallest failing automated regression, implement the focused fix, rerun the complete suite, and commit:

```bash
git add docs/.vitepress/theme tests
git commit -m "fix: harden full-screen diagram interaction"
```

If no tracked files change, do not create an empty commit.
