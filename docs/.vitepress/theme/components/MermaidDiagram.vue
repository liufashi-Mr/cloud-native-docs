<script lang="ts">
let diagramSequence = 0
</script>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'

const props = defineProps<{
  encodedSource: string
}>()

const container = ref<HTMLElement>()
const svg = ref('')
const errorMessage = ref('')
let active = true

const source = computed(() => {
  try {
    return decodeURIComponent(props.encodedSource)
  } catch {
    return props.encodedSource
  }
})

onMounted(async () => {
  try {
    const { default: mermaid } = await import('mermaid')
    mermaid.initialize({
      securityLevel: 'strict',
      startOnLoad: false,
    })

    const result = await mermaid.render(
      `mermaid-diagram-${++diagramSequence}`,
      source.value,
    )
    if (!active) return

    svg.value = result.svg
    await nextTick()
    if (active && container.value) result.bindFunctions?.(container.value)
  } catch (error) {
    if (!active) return
    errorMessage.value =
      error instanceof Error ? error.message : '无法渲染此图表。'
  }
})

onUnmounted(() => {
  active = false
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
