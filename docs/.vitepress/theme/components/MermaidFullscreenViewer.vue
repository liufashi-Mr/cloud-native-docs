<script setup lang="ts">
import { RotateCcw, X, ZoomIn, ZoomOut } from '@lucide/vue'
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  useId,
  watch,
} from 'vue'

import {
  fitDiagram,
  panDiagram,
  zoomDiagram,
  type DiagramTransform,
} from '../diagram-viewport'

const props = defineProps<{
  svg: string
}>()

const emit = defineEmits<{
  close: []
}>()

const titleId = `mermaid-fullscreen-viewer-${useId()}`
const viewport = ref<HTMLElement>()
const toolbar = ref<HTMLElement>()
const closeButton = ref<HTMLButtonElement>()
const transform = ref<DiagramTransform>({ scale: 1, x: 0, y: 0 })
const fittedScale = ref(1)
const diagramSize = ref({ width: 1000, height: 600 })
const isDragging = ref(false)

let activePointerId: number | null = null
let lastPointerX = 0
let lastPointerY = 0
let previousBodyOverflow = ''

const surfaceStyle = computed(() => ({
  width: `${diagramSize.value.width}px`,
  height: `${diagramSize.value.height}px`,
  transform: `translate(${transform.value.x}px, ${transform.value.y}px) scale(${transform.value.scale})`,
}))

function positiveSvgLength(value: string | null): number | undefined {
  if (!value) return undefined
  const match = value.trim().match(/^([+]?(?:\d+(?:\.\d*)?|\.\d+))(?:px)?$/i)
  if (!match) return undefined

  const parsed = Number(match[1])
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function parseDiagramSize(svg: string): { width: number; height: number } {
  const fallback = { width: 1000, height: 600 }

  try {
    const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml')
    const root = parsed.documentElement
    if (root.localName.toLowerCase() !== 'svg') return fallback

    const viewBox = root
      .getAttribute('viewBox')
      ?.trim()
      .split(/[\s,]+/)
      .map(Number)
    if (
      viewBox?.length === 4 &&
      Number.isFinite(viewBox[2]) &&
      Number.isFinite(viewBox[3]) &&
      viewBox[2] > 0 &&
      viewBox[3] > 0
    ) {
      return { width: viewBox[2], height: viewBox[3] }
    }

    const width = positiveSvgLength(root.getAttribute('width'))
    const height = positiveSvgLength(root.getAttribute('height'))
    if (width && height) return { width, height }
  } catch {
    return fallback
  }

  return fallback
}

function fitToView(): void {
  const element = viewport.value
  if (!element) return

  const nextTransform = fitDiagram(
    element.clientWidth,
    element.clientHeight,
    diagramSize.value.width,
    diagramSize.value.height,
    48,
  )
  transform.value = nextTransform
  fittedScale.value = nextTransform.scale
}

function zoomAt(requestedScale: number, anchorX: number, anchorY: number): void {
  transform.value = zoomDiagram(
    transform.value,
    requestedScale,
    anchorX,
    anchorY,
    fittedScale.value / 2,
    4,
  )
}

function zoomFromCenter(multiplier: number): void {
  const element = viewport.value
  if (!element) return

  zoomAt(
    transform.value.scale * multiplier,
    element.clientWidth / 2,
    element.clientHeight / 2,
  )
}

function handleWheel(event: WheelEvent): void {
  const element = viewport.value
  if (!element || event.deltaY === 0) return

  event.preventDefault()
  const bounds = element.getBoundingClientRect()
  zoomAt(
    transform.value.scale * (event.deltaY < 0 ? 1.2 : 1 / 1.2),
    event.clientX - bounds.left,
    event.clientY - bounds.top,
  )
}

function handlePointerDown(event: PointerEvent): void {
  if (activePointerId !== null) return
  if (event.pointerType === 'mouse' && event.button !== 0) return

  activePointerId = event.pointerId
  lastPointerX = event.clientX
  lastPointerY = event.clientY
  isDragging.value = true
  event.currentTarget instanceof HTMLElement &&
    event.currentTarget.setPointerCapture(event.pointerId)
}

function handlePointerMove(event: PointerEvent): void {
  if (event.pointerId !== activePointerId) return

  transform.value = panDiagram(
    transform.value,
    event.clientX - lastPointerX,
    event.clientY - lastPointerY,
  )
  lastPointerX = event.clientX
  lastPointerY = event.clientY
}

function finishPointer(event: PointerEvent, releaseCapture: boolean): void {
  if (event.pointerId !== activePointerId) return

  activePointerId = null
  isDragging.value = false
  if (releaseCapture && event.currentTarget instanceof HTMLElement) {
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // Pointer capture can already be released by the browser on cancellation.
    }
  }
}

function focusableToolbarButtons(): HTMLButtonElement[] {
  if (!toolbar.value) return []
  return Array.from(toolbar.value.querySelectorAll<HTMLButtonElement>('button'))
}

function handleDocumentKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    emit('close')
    return
  }
  if (event.key !== 'Tab') return

  const controls = focusableToolbarButtons()
  const first = controls[0]
  const last = controls.at(-1)
  if (!first || !last) return

  const activeElement = document.activeElement
  if (event.shiftKey && (activeElement === first || !toolbar.value?.contains(activeElement))) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && (activeElement === last || !toolbar.value?.contains(activeElement))) {
    event.preventDefault()
    first.focus()
  }
}

function handleResize(): void {
  diagramSize.value = parseDiagramSize(props.svg)
  fitToView()
}

watch(
  () => props.svg,
  async (svg) => {
    diagramSize.value = parseDiagramSize(svg)
    await nextTick()
    fitToView()
  },
)

onMounted(() => {
  previousBodyOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  diagramSize.value = parseDiagramSize(props.svg)
  window.addEventListener('resize', handleResize)
  document.addEventListener('keydown', handleDocumentKeydown)
  fitToView()
  void nextTick(() => closeButton.value?.focus())
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  document.removeEventListener('keydown', handleDocumentKeydown)
  document.body.style.overflow = previousBodyOverflow
})
</script>

<template>
  <Teleport to="body">
    <section
      class="mermaid-fullscreen-viewer"
      :class="{ 'mermaid-fullscreen-viewer--dragging': isDragging }"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
    >
      <h2 :id="titleId" class="mermaid-fullscreen-viewer__sr-only">全屏图表</h2>

      <div
        ref="viewport"
        class="mermaid-fullscreen-viewer__viewport"
        @wheel="handleWheel"
        @pointerdown="handlePointerDown"
        @pointermove="handlePointerMove"
        @pointerup="finishPointer($event, true)"
        @pointercancel="finishPointer($event, true)"
        @lostpointercapture="finishPointer($event, false)"
      >
        <div
          class="mermaid-fullscreen-viewer__surface"
          :style="surfaceStyle"
          v-html="props.svg"
        />
      </div>

      <div
        ref="toolbar"
        class="mermaid-fullscreen-viewer__toolbar"
        role="toolbar"
        aria-label="图表视图控制"
      >
        <button type="button" aria-label="放大图表" @click="zoomFromCenter(1.2)">
          <ZoomIn aria-hidden="true" />
        </button>
        <button type="button" aria-label="缩小图表" @click="zoomFromCenter(1 / 1.2)">
          <ZoomOut aria-hidden="true" />
        </button>
        <button type="button" aria-label="重置图表视图" @click="fitToView">
          <RotateCcw aria-hidden="true" />
        </button>
        <button
          ref="closeButton"
          type="button"
          aria-label="关闭全屏图表"
          @click="emit('close')"
        >
          <X aria-hidden="true" />
        </button>
      </div>
    </section>
  </Teleport>
</template>

<style scoped>
.mermaid-fullscreen-viewer {
  position: fixed;
  z-index: 1000;
  inset: 0;
  overflow: hidden;
  color: #17191c;
  background: rgba(248, 250, 252, 0.98);
  color-scheme: light;
}

:global(.dark) .mermaid-fullscreen-viewer {
  color: #f5f7fa;
  background: rgba(14, 17, 21, 0.98);
  color-scheme: dark;
}

.mermaid-fullscreen-viewer__sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.mermaid-fullscreen-viewer__viewport {
  position: absolute;
  inset: 0;
  overflow: hidden;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.mermaid-fullscreen-viewer--dragging .mermaid-fullscreen-viewer__viewport {
  cursor: grabbing;
}

.mermaid-fullscreen-viewer__surface {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
  transition: transform 120ms ease-out;
  will-change: transform;
  pointer-events: none;
}

.mermaid-fullscreen-viewer--dragging .mermaid-fullscreen-viewer__surface {
  transition: none;
}

.mermaid-fullscreen-viewer__surface :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
}

.mermaid-fullscreen-viewer__toolbar {
  position: fixed;
  z-index: 1;
  top: calc(12px + env(safe-area-inset-top));
  right: calc(12px + env(safe-area-inset-right));
  display: flex;
  gap: 4px;
  padding: 4px;
  background: #ffffff;
  border: 1px solid #5c6570;
  border-radius: 8px;
  box-shadow: 0 4px 18px rgba(15, 23, 42, 0.2);
}

:global(.dark) .mermaid-fullscreen-viewer__toolbar {
  background: #20252b;
  border-color: #a7b0ba;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.55);
}

.mermaid-fullscreen-viewer__toolbar button {
  display: inline-grid;
  flex: 0 0 40px;
  place-items: center;
  width: 40px;
  height: 40px;
  padding: 0;
  color: inherit;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
}

.mermaid-fullscreen-viewer__toolbar button:hover {
  background: #e4e9ef;
  border-color: #8b95a1;
}

:global(.dark) .mermaid-fullscreen-viewer__toolbar button:hover {
  background: #3a424b;
  border-color: #c2c8cf;
}

.mermaid-fullscreen-viewer__toolbar button:focus-visible {
  outline: 3px solid #0069c2;
  outline-offset: 1px;
}

.mermaid-fullscreen-viewer__toolbar button :deep(svg) {
  width: 22px;
  height: 22px;
  stroke-width: 2.25;
}

@media (max-width: 480px) {
  .mermaid-fullscreen-viewer__toolbar {
    top: auto;
    right: auto;
    bottom: calc(12px + env(safe-area-inset-bottom));
    left: 50%;
    max-width: calc(100vw - 24px);
    transform: translateX(-50%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .mermaid-fullscreen-viewer__surface {
    transition: none;
  }
}
</style>
