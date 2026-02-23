import { ref } from 'vue'

// Tracks the ID of the currently open ⋯ dropdown.
// Setting this to a new value causes all other dropdowns to close.
export const activeDropdownId = ref(null)
