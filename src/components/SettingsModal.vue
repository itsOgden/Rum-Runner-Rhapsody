<script setup lang="ts">
import { ref, watch } from 'vue'
import { useSettings } from '../composables/useSettings'
import { settingsModalOpen } from '../modalState'

const { settings, saveSettings } = useSettings()

const localHotkey = ref('Escape')
const localPlaybackMode = ref<'overlap' | 'restart' | 'stop'>('overlap')

// Sync local state when modal opens
watch(settingsModalOpen, (open) => {
  if (open) {
    localHotkey.value = settings.value.stopHotkey || 'Escape'
    localPlaybackMode.value = settings.value.playbackMode || 'overlap'
  }
})

async function handleSave() {
  settings.value.stopHotkey = localHotkey.value
  settings.value.playbackMode = localPlaybackMode.value
  await saveSettings({
    stopHotkey: localHotkey.value,
    playbackMode: localPlaybackMode.value,
  })
  settingsModalOpen.value = false
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="settingsModalOpen"
      class="fixed inset-0 bg-black/60 backdrop-blur-xs z-[100] flex justify-center items-center"
      @click.self="settingsModalOpen = false"
    >
      <div class="bg-bg-raised border border-border rounded-lg p-7 w-[420px] shadow-lg">
        <div class="text-lg font-bold mb-5 text-text-primary">Settings</div>

        <!-- Stop-All Hotkey -->
        <div class="mb-4">
          <label class="block text-xs font-semibold uppercase tracking-wider text-text-dim mb-1.5">
            Stop-All Hotkey
          </label>
          <input
            type="text"
            class="modal-input"
            placeholder="e.g. Escape, F1"
            v-model="localHotkey"
          />
        </div>

        <!-- Playback Mode -->
        <div class="mb-4">
          <label class="block text-xs font-semibold uppercase tracking-wider text-text-dim mb-1.5">
            Playback Mode
          </label>
          <div class="flex gap-2">
            <button
              class="flex-1 btn"
              :class="{ 'btn-accent': localPlaybackMode === 'overlap' }"
              @click="localPlaybackMode = 'overlap'"
            >Overlap</button>
            <button
              class="flex-1 btn"
              :class="{ 'btn-accent': localPlaybackMode === 'restart' }"
              @click="localPlaybackMode = 'restart'"
            >Restart</button>
            <button
              class="flex-1 btn"
              :class="{ 'btn-accent': localPlaybackMode === 'stop' }"
              @click="localPlaybackMode = 'stop'"
            >Stop</button>
          </div>
          <p class="text-[11px] text-text-dim mt-1.5 leading-relaxed">
            <template v-if="localPlaybackMode === 'overlap'">Clicking a playing sound adds a new simultaneous instance.</template>
            <template v-else-if="localPlaybackMode === 'restart'">Clicking a playing sound stops and restarts it.</template>
            <template v-else>Clicking a playing sound stops it. Clicking it again plays it from the start.</template>
          </p>
        </div>

        <!-- Actions -->
        <div class="flex justify-end gap-2 mt-6">
          <button class="btn" @click="settingsModalOpen = false">Cancel</button>
          <button class="btn btn-accent" @click="handleSave">Save</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
