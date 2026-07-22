<script lang="ts">
let diagramSequence = 0
</script>

<script setup lang="ts">
import { Maximize2 } from '@lucide/vue'
import { useData } from 'vitepress'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

import MermaidFullscreenViewer from './MermaidFullscreenViewer.vue'

const props = defineProps<{
  encodedSource: string
}>()

const figure = ref<HTMLElement>()
const container = ref<HTMLElement>()
const fullscreenTrigger = ref<HTMLButtonElement>()
const svg = ref('')
const errorMessage = ref('')
const renderedViewBoxWidth = ref(0)
const viewerOpen = ref(false)
const { isDark } = useData()
let active = false
let renderGeneration = 0
let stopWatching: (() => void) | undefined

const wideCanvasStyle = computed(() => {
  if (renderedViewBoxWidth.value <= 960) return undefined

  return {
    '--mermaid-intrinsic-width': `${Math.min(renderedViewBoxWidth.value, 2000)}px`,
  }
})

const source = computed(() => {
  try {
    return decodeURIComponent(props.encodedSource)
  } catch {
    return props.encodedSource
  }
})

function renderedSvgViewBoxWidth(): number {
  const renderedSvg = container.value?.querySelector('svg')
  if (!renderedSvg) return 0

  const nativeWidth = renderedSvg.viewBox?.baseVal?.width
  if (Number.isFinite(nativeWidth) && nativeWidth > 0) return nativeWidth

  const values = renderedSvg
    .getAttribute('viewBox')
    ?.trim()
    .split(/[\s,]+/)
    .map(Number)
  const attributeWidth = values?.length === 4 ? values[2] : 0
  return Number.isFinite(attributeWidth) && attributeWidth > 0
    ? attributeWidth
    : 0
}

function openViewer(): void {
  if (svg.value) viewerOpen.value = true
}

function closeViewer(): void {
  if (!viewerOpen.value) return

  viewerOpen.value = false
  void nextTick(() => fullscreenTrigger.value?.focus())
}

async function renderDiagram(): Promise<void> {
  const generation = ++renderGeneration
  errorMessage.value = ''
  const theme = isDark.value ? 'dark' : 'default'

  try {
    const { default: mermaid } = await import('mermaid')
    if (!active || generation !== renderGeneration) return

    mermaid.initialize({
      securityLevel: 'strict',
      startOnLoad: false,
      theme,
    })

    const result = await mermaid.render(
      `mermaid-diagram-${++diagramSequence}`,
      source.value,
    )
    if (!active || generation !== renderGeneration) return

    svg.value = result.svg
    errorMessage.value = ''
    await nextTick()
    if (active && generation === renderGeneration && container.value) {
      renderedViewBoxWidth.value = renderedSvgViewBoxWidth()
      result.bindFunctions?.(container.value)
    }
  } catch (error) {
    if (!active || generation !== renderGeneration) return
    const wasViewerOpen = viewerOpen.value
    viewerOpen.value = false
    svg.value = ''
    renderedViewBoxWidth.value = 0
    errorMessage.value =
      error instanceof Error ? error.message : '无法渲染此图表。'
    if (wasViewerOpen) {
      await nextTick()
      if (active && generation === renderGeneration) {
        figure.value?.focus({ preventScroll: true })
      }
    }
  }
}

onMounted(() => {
  active = true
  stopWatching = watch([isDark, source], () => void renderDiagram(), {
    immediate: true,
  })
})

onUnmounted(() => {
  active = false
  renderGeneration += 1
  stopWatching?.()
})
</script>

<template>
  <figure ref="figure" class="mermaid-diagram" tabindex="-1">
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
    <pre v-else class="mermaid-diagram__source"><code>{{ source }}</code></pre>
    <figcaption v-if="errorMessage" class="mermaid-diagram__error" role="alert">
      图表渲染失败：{{ errorMessage }}
    </figcaption>
  </figure>
  <MermaidFullscreenViewer
    v-if="viewerOpen && svg"
    :svg="svg"
    @close="closeViewer"
  />
</template>

<style scoped>
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

.mermaid-diagram__fullscreen {
  position: absolute;
  z-index: 2;
  top: 8px;
  right: 8px;
  display: inline-grid;
  place-items: center;
  width: 24px;
  height: 24px;
  padding: 0;
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 5px;
  box-shadow: 0 1px 4px rgb(15 23 42 / 12%);
  cursor: pointer;
  transition:
    color 120ms ease,
    background-color 120ms ease,
    border-color 120ms ease;
}

.mermaid-diagram__fullscreen:hover {
  color: var(--vp-c-text-1);
  background: var(--vp-c-default-soft);
  border-color: var(--vp-c-text-3);
}

.mermaid-diagram__fullscreen:focus-visible {
  outline: 3px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}

.mermaid-diagram__viewport {
  box-sizing: border-box;
  max-width: 100%;
  padding: 40px 16px 16px;
  overflow-x: auto;
}

.mermaid-diagram__canvas {
  min-width: max-content;
  text-align: center;
}

.mermaid-diagram__canvas--wide {
  width: var(--mermaid-intrinsic-width);
  min-width: var(--mermaid-intrinsic-width);
}

.mermaid-diagram :deep(.label p) {
  margin: 0;
  line-height: inherit;
}

.mermaid-diagram__source {
  margin: 0;
  white-space: pre-wrap;
}

.mermaid-diagram__error {
  margin-top: 8px;
  color: var(--vp-c-danger-1);
  font-size: 14px;
}

@media (prefers-reduced-motion: reduce) {
  .mermaid-diagram__fullscreen {
    transition: none;
  }
}
</style>
