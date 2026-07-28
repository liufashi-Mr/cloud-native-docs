<script setup lang="ts">
import { ArrowUp } from '@lucide/vue'
import { onMounted, onUnmounted, ref } from 'vue'

const visible = ref(false)
const showAfter = 320

function updateVisibility(): void {
  visible.value = window.scrollY > showAfter
}

function scrollToTop(): void {
  window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
}

onMounted(() => {
  updateVisibility()
  window.addEventListener('scroll', updateVisibility, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', updateVisibility)
})
</script>

<template>
  <Transition name="cloud-native-back-to-top">
    <button
      v-if="visible"
      class="cloud-native-back-to-top"
      type="button"
      aria-label="返回顶部"
      title="返回顶部"
      @click="scrollToTop"
    >
      <ArrowUp :size="20" aria-hidden="true" />
    </button>
  </Transition>
</template>

<style scoped>
.cloud-native-back-to-top {
  position: fixed;
  z-index: 30;
  right: calc(16px + env(safe-area-inset-right));
  bottom: calc(16px + env(safe-area-inset-bottom));
  display: inline-grid;
  width: 44px;
  height: 44px;
  align-items: center;
  justify-content: center;
  padding: 0;
  color: var(--vp-c-text-1);
  background: color-mix(in srgb, var(--vp-c-bg-elv) 94%, transparent);
  border: 1px solid var(--vp-c-divider);
  border-radius: 50%;
  box-shadow: var(--vp-shadow-2);
  cursor: pointer;
  backdrop-filter: blur(8px);
}

.cloud-native-back-to-top:hover {
  color: var(--vp-c-brand-1);
  background: var(--vp-c-bg-soft);
  border-color: var(--vp-c-brand-1);
}

.cloud-native-back-to-top:focus-visible {
  outline: 3px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}

.cloud-native-back-to-top-enter-active,
.cloud-native-back-to-top-leave-active {
  transition:
    opacity 160ms ease,
    transform 160ms ease;
}

.cloud-native-back-to-top-enter-from,
.cloud-native-back-to-top-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@media (max-width: 480px) {
  .cloud-native-back-to-top {
    right: calc(12px + env(safe-area-inset-right));
    bottom: calc(12px + env(safe-area-inset-bottom));
  }
}

@media (prefers-reduced-motion: reduce) {
  .cloud-native-back-to-top-enter-active,
  .cloud-native-back-to-top-leave-active {
    transition: none;
  }
}
</style>
