<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const MIN_WIDTH = 220
const MAX_WIDTH = 380
const STEP = 12
const STORAGE_KEY = 'cloud-native-sidebar-width'
const LEGACY_STORAGE_KEY = 'k8s-sidebar-width'

const width = ref(280)
const dragging = ref(false)
let activePointerId: number | null = null

function clampWidth(value: number): number {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(value)))
}

function validStoredWidth(value: string | null): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= MIN_WIDTH && parsed <= MAX_WIDTH
    ? parsed
    : null
}

function readStoredItem(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function persistStoredItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Persistence is optional; the current width still applies in memory.
  }
}

function removeStoredItem(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // Persistence is optional; resetting still updates the current page.
  }
}

function applyWidth(value: number, persist = true): void {
  width.value = clampWidth(value)
  document.documentElement.style.setProperty(
    '--cloud-native-sidebar-width',
    `${width.value}px`,
  )
  if (persist) persistStoredItem(STORAGE_KEY, String(width.value))
}

function readInitialWidth(): void {
  const current = validStoredWidth(readStoredItem(STORAGE_KEY))
  if (current !== null) {
    applyWidth(current, false)
    return
  }

  const legacy = validStoredWidth(readStoredItem(LEGACY_STORAGE_KEY))
  if (legacy !== null) {
    applyWidth(legacy, false)
    persistStoredItem(STORAGE_KEY, String(legacy))
    if (readStoredItem(STORAGE_KEY) === String(legacy)) {
      removeStoredItem(LEGACY_STORAGE_KEY)
    }
    return
  }
  width.value = clampWidth(Math.min(296, Math.max(232, window.innerWidth * 0.19)))
}

function startDrag(event: PointerEvent): void {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  activePointerId = event.pointerId
  dragging.value = true
  document.documentElement.classList.add('cloud-native-sidebar-resizing')
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  event.preventDefault()
}

function moveDrag(event: PointerEvent): void {
  if (!dragging.value || event.pointerId !== activePointerId) return
  applyWidth(event.clientX)
}

function stopDrag(event: PointerEvent): void {
  if (event.pointerId !== activePointerId) return
  activePointerId = null
  dragging.value = false
  document.documentElement.classList.remove('cloud-native-sidebar-resizing')
  try {
    ;(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId)
  } catch {
    // Pointer capture may already be released by the browser.
  }
}

function resizeByKeyboard(event: KeyboardEvent): void {
  const current = width.value
  if (event.key === 'ArrowLeft') {
    applyWidth(current - STEP)
  } else if (event.key === 'ArrowRight') {
    applyWidth(current + STEP)
  } else if (event.key === 'Home') {
    applyWidth(MIN_WIDTH)
  } else if (event.key === 'End') {
    applyWidth(MAX_WIDTH)
  } else {
    return
  }
  event.preventDefault()
}

function resetWidth(): void {
  removeStoredItem(STORAGE_KEY)
  document.documentElement.style.removeProperty('--cloud-native-sidebar-width')
  width.value = clampWidth(Math.min(296, Math.max(232, window.innerWidth * 0.19)))
}

onMounted(readInitialWidth)
onUnmounted(() => {
  activePointerId = null
  document.documentElement.classList.remove('cloud-native-sidebar-resizing')
})
</script>

<template>
  <div
    class="k8s-sidebar-resize-handle"
    :class="{ 'k8s-sidebar-resize-handle--dragging': dragging }"
    role="separator"
    aria-label="调整侧边栏宽度"
    aria-orientation="vertical"
    :aria-valuemin="MIN_WIDTH"
    :aria-valuemax="MAX_WIDTH"
    :aria-valuenow="width"
    tabindex="0"
    @dblclick="resetWidth"
    @keydown="resizeByKeyboard"
    @pointerdown="startDrag"
    @pointermove="moveDrag"
    @pointerup="stopDrag"
    @pointercancel="stopDrag"
    @lostpointercapture="stopDrag"
  />
</template>

<style scoped>
.k8s-sidebar-resize-handle {
  position: fixed;
  z-index: 26;
  top: var(--vp-nav-height);
  bottom: 0;
  left: calc(var(--cloud-native-sidebar-width) - 5px);
  width: 10px;
  cursor: col-resize;
  touch-action: none;
}

.k8s-sidebar-resize-handle::after {
  position: absolute;
  top: 12px;
  right: 4px;
  bottom: 12px;
  left: 4px;
  border-radius: 2px;
  background: transparent;
  content: '';
  transition: background-color 120ms ease, width 120ms ease, left 120ms ease;
}

.k8s-sidebar-resize-handle:hover::after,
.k8s-sidebar-resize-handle:focus-visible::after,
.k8s-sidebar-resize-handle--dragging::after {
  right: 3px;
  left: 3px;
  background: var(--vp-c-brand-1);
}

.k8s-sidebar-resize-handle:focus-visible {
  outline: none;
}

@media (max-width: 1099px) {
  .k8s-sidebar-resize-handle {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .k8s-sidebar-resize-handle::after {
    transition: none;
  }
}
</style>
