import { ref } from 'vue'

// The sound being dragged, or null when no drag is active.
export const draggingSound = ref(null)

// The section being dragged (for category reorder), or null when idle.
// Shape: { id: string }
export const draggingSection = ref(null)
