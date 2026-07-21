<script setup lang="ts">
import { Monitor, Moon, Palette, Sun } from '@lucide/vue'
import { useData } from 'vitepress'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useId,
  useTemplateRef,
} from 'vue'

import {
  DEFAULT_COLOR,
  PRESET_COLORS,
  applyAppearance,
  loadAppearance,
  normalizeHex,
  resolveDarkMode,
  saveAppearance,
  type AppearanceMode,
} from '../appearance'
import { appearanceColor as color, appearanceMode as mode } from '../appearance-state'

const { isDark } = useData()
const control = useTemplateRef<HTMLElement>('control')
const trigger = useTemplateRef<HTMLButtonElement>('trigger')
const popoverId = useId()
const open = ref(false)
const displayColor = computed(() => normalizeHex(color.value) ?? DEFAULT_COLOR)

let mediaQuery: MediaQueryList | null = null

function getSystemDark(): boolean {
  return mode.value === 'auto' ? (mediaQuery?.matches ?? false) : false
}

function applyCurrent(persist: boolean, systemDark = getSystemDark()): void {
  applyAppearance(color.value, mode.value)
  isDark.value = resolveDarkMode(mode.value, systemDark)
  if (persist) saveAppearance(color.value, mode.value)
}

function togglePopover(): void {
  open.value = !open.value
}

function closePopover(restoreFocus = false): void {
  if (!open.value) return
  open.value = false
  if (restoreFocus) void nextTick(() => trigger.value?.focus())
}

function selectColor(nextColor: string): void {
  color.value = normalizeHex(nextColor) ?? DEFAULT_COLOR
  applyCurrent(true)
}

function selectMode(nextMode: AppearanceMode): void {
  mode.value = nextMode
  applyCurrent(true)
}

function handleCustomColor(event: Event): void {
  selectColor((event.target as HTMLInputElement).value)
}

function handleDocumentClick(event: MouseEvent): void {
  if (open.value && !control.value?.contains(event.target as Node)) {
    closePopover()
  }
}

function handleDocumentKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') closePopover(true)
}

function handleSystemModeChange(event: MediaQueryListEvent): void {
  if (mode.value === 'auto') applyCurrent(false, event.matches)
}

function createMediaQuery(): MediaQueryList | null {
  if (typeof window === 'undefined') return null

  try {
    return typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null
  } catch {
    return null
  }
}

onMounted(() => {
  const saved = loadAppearance()
  color.value = saved.color
  mode.value = saved.mode
  mediaQuery = createMediaQuery()
  mediaQuery?.addEventListener('change', handleSystemModeChange)
  document.addEventListener('click', handleDocumentClick)
  document.addEventListener('keydown', handleDocumentKeydown)
  applyCurrent(false)
})

onBeforeUnmount(() => {
  mediaQuery?.removeEventListener('change', handleSystemModeChange)
  document.removeEventListener('click', handleDocumentClick)
  document.removeEventListener('keydown', handleDocumentKeydown)
})
</script>

<template>
  <div ref="control" class="k8s-appearance">
    <button
      ref="trigger"
      class="k8s-appearance__trigger"
      type="button"
      aria-label="外观设置"
      title="外观设置"
      aria-haspopup="dialog"
      :aria-controls="popoverId"
      :aria-expanded="open"
      @click="togglePopover"
    >
      <Palette :size="18" aria-hidden="true" />
      <span
        class="k8s-appearance__current-color"
        :style="{ '--current-color': displayColor }"
        aria-hidden="true"
      />
    </button>

    <div
      v-if="open"
      :id="popoverId"
      class="k8s-appearance__popover"
      role="dialog"
      aria-label="外观设置"
    >
      <p class="k8s-appearance__label">主题色</p>
      <div class="k8s-appearance__swatches">
        <button
          v-for="preset in PRESET_COLORS"
          :key="preset"
          class="k8s-appearance__swatch"
          type="button"
          :data-color="preset"
          :style="{ '--swatch-color': preset }"
          :aria-label="`主题色 ${preset}`"
          :title="preset"
          :aria-pressed="displayColor === preset"
          @click="selectColor(preset)"
        />
      </div>

      <label class="k8s-appearance__custom">
        <input
          type="color"
          :value="displayColor"
          aria-label="自定义主题色"
          title="自定义主题色"
          @input="handleCustomColor"
        />
        <span>自定义颜色</span>
        <code>{{ displayColor }}</code>
      </label>

      <p class="k8s-appearance__label">明暗模式</p>
      <div class="k8s-appearance__modes" role="group" aria-label="明暗模式">
        <button
          type="button"
          data-mode="auto"
          :aria-pressed="mode === 'auto'"
          title="跟随系统"
          @click="selectMode('auto')"
        >
          <Monitor :size="16" aria-hidden="true" />
          <span>跟随系统</span>
        </button>
        <button
          type="button"
          data-mode="light"
          :aria-pressed="mode === 'light'"
          title="浅色"
          @click="selectMode('light')"
        >
          <Sun :size="16" aria-hidden="true" />
          <span>浅色</span>
        </button>
        <button
          type="button"
          data-mode="dark"
          :aria-pressed="mode === 'dark'"
          title="深色"
          @click="selectMode('dark')"
        >
          <Moon :size="16" aria-hidden="true" />
          <span>深色</span>
        </button>
      </div>
    </div>
  </div>
</template>
