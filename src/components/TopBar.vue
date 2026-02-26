<script setup lang="ts">
import { computed } from 'vue'
import { useAudioPlayer } from '../composables/useAudioPlayer'
import { useSettings } from '../composables/useSettings'
import { settingsModalOpen } from '../modalState'
import appIcon from '../../app-icon.png'
import SquareButton from '@/components/SquareButton.vue'

const { stopAll, playingPaths } = useAudioPlayer()
const { settings, saveSettings } = useSettings()

function toggleTheme() {
  const next = settings.value.theme === 'dark' ? 'light' : 'dark'
  settings.value.theme = next
  saveSettings({ theme: next })
}

// Master volume: stored as 0–1 float, displayed as 0–100 integer
const masterPercent = computed({
  get: () => Math.round((settings.value.masterVolume ?? 1.0) * 100),
  set: (v) => { settings.value.masterVolume = v / 100 },
})

function onMasterChange() {
  saveSettings({ masterVolume: settings.value.masterVolume })
}
</script>

<template>
  <div class="flex items-center justify-between px-5 py-3 bg-bg-deepest border-b border-border shrink-0 gap-4">
    <!-- Logo lockup -->
    <div class="flex items-center gap-3 shrink-0">
      <img :src="appIcon" alt="" aria-hidden="true" class="h-9 w-auto" />
      <span class="font-display text-xl text-accent leading-none">
        Rum-Runner Rhapsody
      </span>
    </div>

    <!-- Master Volume (center) -->
    <div class="flex items-center gap-2.5 flex-1 max-w-xs">
      <span class="font-mono text-[10px] text-text-dim shrink-0 uppercase tracking-wider">Master Volume</span>
      <input
        type="range"
        min="0"
        max="100"
        v-model.number="masterPercent"
        @change="onMasterChange"
        class="flex-1"
      />
      <span class="font-mono text-[11px] text-text-secondary min-w-9 text-right shrink-0">{{ masterPercent }}%</span>
    </div>

    <!-- Controls -->
    <div class="flex gap-2 shrink-0">
      <!-- Stop All — always present to reserve layout space; invisible when idle -->
      <SquareButton
        icon="stop"
        variant="danger"
        title="Stop all sounds"
        :class="{ 'invisible pointer-events-none': playingPaths.size === 0 }"
        @click="stopAll"
      />
      <SquareButton
        :icon="settings.theme !== 'dark' ? 'sun-bright' : 'moon'"
        :title="settings.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
        @click="toggleTheme"
      />
      <SquareButton
        icon="gear"
        title="Settings"
        @click="settingsModalOpen = true"
      />
    </div>
  </div>
</template>

<style scoped>

input[type="range"] {
  -webkit-appearance: none;
  flex: 1;
  height: 4px;
  background: var(--color-bg-surface);
  border-radius: 2px;
  outline: none;
}
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px; height: 16px;
  border-radius: 50%;
  background: var(--color-accent);
  cursor: pointer;
  box-shadow: 0 0 6px var(--color-accent-glow);
  transition: box-shadow 0.15s;
}
input[type="range"]::-webkit-slider-thumb:hover {
  box-shadow: 0 0 12px var(--color-accent-glow);
}
</style>
