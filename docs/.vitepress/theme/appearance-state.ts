import { ref } from 'vue'

import { DEFAULT_COLOR, type AppearanceMode } from './appearance'

export const appearanceColor = ref(DEFAULT_COLOR)
export const appearanceMode = ref<AppearanceMode>('auto')
