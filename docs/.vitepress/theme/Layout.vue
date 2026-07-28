<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import { useSidebar } from 'vitepress/theme'

import AppearanceControl from './components/AppearanceControl.vue'
import BackToTop from './components/BackToTop.vue'
import SidebarResizeHandle from './components/SidebarResizeHandle.vue'

const { hasSidebar } = useSidebar()
</script>

<template>
  <DefaultTheme.Layout>
    <template #nav-bar-content-after>
      <div class="cloud-native-appearance-slot cloud-native-appearance-slot--desktop">
        <AppearanceControl />
      </div>
    </template>
    <template #nav-screen-content-after>
      <div class="cloud-native-appearance-slot cloud-native-appearance-slot--mobile">
        <AppearanceControl />
      </div>
    </template>
  </DefaultTheme.Layout>
  <BackToTop />
  <SidebarResizeHandle v-if="hasSidebar" />
</template>
