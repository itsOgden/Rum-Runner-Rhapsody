<script setup>
import { computed } from 'vue'
import { useSettings } from '../composables/useSettings.js'
import { filterQuery } from '../filterState.js'
import AccordionSection from './AccordionSection.vue'

const { settings, soundGroups, soundCount, isLoadingSounds } = useSettings()

const filteredSoundCount = computed(() => {
  if (!filterQuery.value) return soundCount.value
  const q = filterQuery.value.toLowerCase()
  return soundGroups.value.reduce(
    (sum, g) => sum + g.sounds.filter(s => s.name.toLowerCase().includes(q)).length,
    0
  )
})
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
      <AccordionSection
        v-for="group in soundGroups"
        :key="group.folderPath"
        :group="group"
        :columns="settings.columns || 4"
        :filter="filterQuery"
      />
    </template>
  </div>
</template>
