import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'

import Layout from './Layout.vue'
import CloudNativeHome from './components/CloudNativeHome.vue'
import MermaidDiagram from './components/MermaidDiagram.vue'
import './styles.css'

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('CloudNativeHome', CloudNativeHome)
    app.component('MermaidDiagram', MermaidDiagram)
  },
} satisfies Theme
