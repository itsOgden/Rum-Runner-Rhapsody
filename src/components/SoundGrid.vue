<script setup>
import { useSettings } from '../composables/useSettings.js'
import AccordionSection from './AccordionSection.vue'

const { settings, soundGroups, soundCount } = useSettings()
</script>

<template>
  <div class="flex-1 overflow-y-auto px-5 py-4">
    <!-- Empty state -->
    <div
      v-if="soundCount === 0"
      class="flex flex-col items-center justify-center h-full text-text-dim text-center gap-3 px-10"
    >
      <div class="text-5xl opacity-30">&#x1F3B5;</div>
      <div class="text-base font-semibold text-text-secondary">No sounds loaded</div>
      <div class="text-[13px] max-w-xs leading-relaxed">
        Click "Browse..." to select a folder containing your audio files (WAV, MP3, OGG, FLAC, etc.)
      </div>
    </div>

    <!-- Accordion sections -->
    <AccordionSection
      v-for="group in soundGroups"
      :key="group.folderPath"
      :group="group"
      :columns="settings.columns || 4"
    />
  </div>
</template>
