import { ref } from 'vue'
import type { Sound } from './types'

export interface DraggingSound extends Sound {
  fromSectionId: string
}

export interface DraggingSection {
  id: string
}

export const draggingSound = ref<DraggingSound | null>(null)
export const draggingSection = ref<DraggingSection | null>(null)
