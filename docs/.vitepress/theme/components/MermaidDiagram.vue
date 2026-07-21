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
const { isDark } = useData()
let active = false
let renderGeneration = 0
let stopWatching: (() => void) | undefined

const source = computed(() => {
  try {
    return decodeURIComponent(props.encodedSource)
  } catch {
    return props.encodedSource
  }
})

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
      result.bindFunctions?.(container.value)
    }
  } catch (error) {
    if (!active || generation !== renderGeneration) return
    svg.value = ''
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
