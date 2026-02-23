<script setup>
import { ref, computed } from 'vue'
import { useSettings } from '../composables/useSettings.js'
import { useSoundManagement } from '../composables/useSoundManagement.js'
import { filterQuery } from '../filterState.js'
import { draggingSection } from '../dragState.js'
import AccordionSection from './AccordionSection.vue'

const { settings, soundGroups, soundCount, isLoadingSounds } = useSettings()
const { buildSections, addCategory, reorderCategories } = useSoundManagement()

// ── Category reorder drag handling ───────────────────────────────────────────

const dragOverSectionId = ref(null)

function onSectionWrapperDragOver(event, sectionId) {
  if (!draggingSection.value) return
  event.preventDefault()
  dragOverSectionId.value = sectionId
}

function onSectionWrapperDragLeave(event) {
  if (!event.currentTarget.contains(event.relatedTarget)) {
    dragOverSectionId.value = null
  }
}

function onSectionDrop(sectionId) {
  const draggedId = draggingSection.value?.id
  draggingSection.value = null
  dragOverSectionId.value = null
  if (!draggedId || draggedId === sectionId) return

  const currentOrder = sections.value.map(s => s.id)
  const fromIdx = currentOrder.indexOf(draggedId)
  const toIdx = currentOrder.indexOf(sectionId)
  if (fromIdx === -1 || toIdx === -1) return

  const newOrder = [...currentOrder]
  newOrder.splice(fromIdx, 1)
  newOrder.splice(toIdx, 0, draggedId)
  reorderCategories(newOrder)
}

// Count from raw sound groups so the "no matches" state is purely about
// the filter, not about hidden/moved sound state.
const filteredSoundCount = computed(() => {
  if (!filterQuery.value) return soundCount.value
  const q = filterQuery.value.toLowerCase()
  return soundGroups.value.reduce(
    (sum, g) => sum + g.sounds.filter(s => s.name.toLowerCase().includes(q)).length,
    0
  )
})

const sections = computed(() => buildSections())
</script>

<template>
  <div class="flex-1 overflow-y-auto px-5 py-4">
    <!-- Loading state -->
    <div
      v-if="isLoadingSounds"
      class="flex flex-col items-center justify-center h-full text-text-dim gap-3"
    >
      <div class="spinner"></div>
      <span class="text-[13px]">Scanning folder…</span>
    </div>

    <!-- Empty state — no sounds loaded -->
    <div
      v-else-if="soundCount === 0"
      class="flex flex-col items-center justify-center h-full text-text-dim text-center gap-3 px-10"
    >
      <div class="text-5xl opacity-30">&#x1F3B5;</div>
      <div class="text-base font-semibold text-text-secondary">No sounds loaded</div>
      <div class="text-[13px] max-w-xs leading-relaxed">
        Click "Browse…" to select a folder containing your audio files (WAV, MP3, OGG, FLAC, etc.)
      </div>
    </div>

    <!-- No-matches state — filter active but nothing matches -->
    <div
      v-else-if="filterQuery && filteredSoundCount === 0"
      class="flex flex-col items-center justify-center h-full text-text-dim text-center gap-2 px-10"
    >
      <div class="text-3xl opacity-30">&#x1F50D;</div>
      <div class="text-[13px]">No sounds match <span class="text-text-secondary font-mono">"{{ filterQuery }}"</span></div>
    </div>

    <!-- Accordion sections -->
    <template v-else>
      <!-- Wrapper div provides category-reorder drop target and drag opacity feedback -->
      <div
        v-for="section in sections"
        :key="section.id"
        :class="{
          'outline outline-2 outline-accent rounded-sm': dragOverSectionId === section.id && draggingSection?.id !== section.id,
          'opacity-50': draggingSection?.id === section.id,
        }"
        @dragover="onSectionWrapperDragOver($event, section.id)"
        @dragleave="onSectionWrapperDragLeave($event)"
        @drop.prevent="onSectionDrop(section.id)"
      >
        <AccordionSection
          :section="section"
          :density="settings.density || 'loose'"
          :filter="filterQuery"
        />
      </div>

      <!-- New Category -->
      <div class="mt-2">
        <button
          class="btn text-[12px] w-full text-text-dim hover:text-text-secondary"
          @click="addCategory"
        >+ New Category</button>
      </div>
    </template>
  </div>
</template>
