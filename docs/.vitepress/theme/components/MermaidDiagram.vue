<script lang="ts">
let diagramSequence = 0
</script>

<script setup lang="ts">
import { useData } from 'vitepress'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps<{
  encodedSource: string
}>()

const container = ref<HTMLElement>()
const svg = ref('')
const errorMessage = ref('')
const renderedViewBoxWidth = ref(0)
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

async function renderDiagram(): Promise<void> {
  const generation = ++renderGeneration
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
    svg.value = ''
    renderedViewBoxWidth.value = 0
    errorMessage.value =
      error instanceof Error ? error.message : '无法渲染此图表。'
  }
}

onMounted(() => {
  active = true
  stopWatching = watch(isDark, () => void renderDiagram(), { immediate: true })
})

onUnmounted(() => {
  active = false
  renderGeneration += 1
  stopWatching?.()
})
</script>

<template>
  <figure class="mermaid-diagram">
    <div
      v-if="svg"
      ref="container"
      class="mermaid-diagram__canvas"
      :class="{ 'mermaid-diagram__canvas--wide': wideCanvasStyle }"
      :style="wideCanvasStyle"
      v-html="svg"
    />
    <pre v-else class="mermaid-diagram__source"><code>{{ source }}</code></pre>
    <figcaption v-if="errorMessage" class="mermaid-diagram__error" role="alert">
      图表渲染失败：{{ errorMessage }}
    </figcaption>
  </figure>
</template>

<style scoped>
.mermaid-diagram {
  margin: 24px 0;
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
</style>
