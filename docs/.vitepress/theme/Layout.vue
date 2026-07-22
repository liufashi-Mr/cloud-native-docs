<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'

import AppearanceControl from './components/AppearanceControl.vue'
import BackToTop from './components/BackToTop.vue'
import SidebarResizeHandle from './components/SidebarResizeHandle.vue'
</script>

<template>
  <DefaultTheme.Layout>
    <template #nav-bar-content-after>
      <div class="k8s-appearance-slot k8s-appearance-slot--desktop">
        <AppearanceControl />
      </div>
    </template>
    <template #nav-screen-content-after>
      <div class="k8s-appearance-slot k8s-appearance-slot--mobile">
        <AppearanceControl />
      </div>
    </template>
  </DefaultTheme.Layout>
  <BackToTop />
  <SidebarResizeHandle />
</template>
