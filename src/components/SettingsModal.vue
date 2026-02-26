<script setup lang="ts">
import { ref, watch } from 'vue'
import { useSettings } from '../composables/useSettings'
import { settingsModalOpen } from '../modalState'

const { settings, saveSettings } = useSettings()

const localHotkey = ref('Escape')
const localPlaybackMode = ref<'overlap' | 'restart' | 'stop'>('overlap')
const localNormalize = ref(false)
const localStreamDeckButtonMode = ref(true)

// Sync local state when modal opens
watch(settingsModalOpen, (open) => {
  if (open) {
    localHotkey.value = settings.value.hotkeys?.stop || 'Escape'
    localPlaybackMode.value = settings.value.playbackMode || 'stop'
    localNormalize.value = settings.value.normalize ?? false
    localStreamDeckButtonMode.value = settings.value.streamDeckButtonMode ?? true
  }
})

async function handleSave() {
  const hotkeys = { ...settings.value.hotkeys, stop: localHotkey.value }
  settings.value.hotkeys = hotkeys
  settings.value.playbackMode = localPlaybackMode.value
  settings.value.normalize = localNormalize.value
  settings.value.streamDeckButtonMode = localStreamDeckButtonMode.value
  await saveSettings({
    hotkeys,
    playbackMode: localPlaybackMode.value,
    normalize: localNormalize.value,
    streamDeckButtonMode: localStreamDeckButtonMode.value,
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
                :class="{ 'btn-accent': localPlaybackMode === 'stop' }"
                @click="localPlaybackMode = 'stop'"
            >Stop</button>
            <button
              class="flex-1 btn"
              :class="{ 'btn-accent': localPlaybackMode === 'restart' }"
              @click="localPlaybackMode = 'restart'"
            >Restart</button>
            <button
                class="flex-1 btn"
                :class="{ 'btn-accent': localPlaybackMode === 'overlap' }"
                @click="localPlaybackMode = 'overlap'"
            >Overlap</button>
          </div>
          <p class="text-[11px] text-text-dim mt-1.5 leading-relaxed">
            <template v-if="localPlaybackMode === 'overlap'">Clicking a playing sound adds a new simultaneous instance.</template>
            <template v-else-if="localPlaybackMode === 'restart'">Clicking a playing sound stops and restarts it.</template>
            <template v-else>Clicking a playing sound stops it. Clicking it again plays it from the start.</template>
          </p>
        </div>

        <!-- Normalize Volumes -->
        <div class="mb-4">
          <div class="flex items-center justify-between">
            <label class="text-xs font-semibold uppercase tracking-wider text-text-dim">
              Normalize Volumes
            </label>
            <label class="toggle">
              <input type="checkbox" v-model="localNormalize" />
              <span class="toggle-track"></span>
              <span class="toggle-thumb"></span>
            </label>
          </div>
          <p class="text-[11px] text-text-dim mt-1.5 leading-relaxed">
            Automatically balance loud and quiet sounds to a consistent level
          </p>
        </div>

        <!-- Stream Deck -->
        <div class="mb-4">
          <label class="block text-xs font-semibold uppercase tracking-wider text-text-dim mb-1.5">
            Stream Deck
          </label>
          <div class="flex items-center justify-between">
            <span class="text-sm text-text-primary">Button grid mode</span>
            <label class="toggle">
              <input type="checkbox" v-model="localStreamDeckButtonMode" />
              <span class="toggle-track"></span>
              <span class="toggle-thumb"></span>
            </label>
          </div>
          <p class="text-[11px] text-text-dim mt-1.5 leading-relaxed">
            Show sounds as a button grid in the Stream Deck PI instead of a dropdown
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

<style scoped>
/* ---- Toggle switch ---- */
.toggle { position: relative; width: 36px; height: 20px; cursor: pointer; display: inline-block; }
.toggle input { display: none; }
.toggle-track {
  position: absolute; inset: 0;
  background: var(--color-bg-surface);
  border-radius: 10px;
  border: 1px solid var(--color-border-light);
  transition: all 0.2s;
}
.toggle input:checked + .toggle-track {
  background: var(--color-accent);
  border-color: var(--color-accent);
}
.toggle-thumb {
  position: absolute; top: 3px; left: 3px;
  width: 14px; height: 14px;
  background: var(--color-text-secondary);
  border-radius: 50%;
  transition: all 0.2s;
}
.toggle input:checked ~ .toggle-thumb {
  left: 19px;
  background: var(--color-text-on-accent);
}

.modal-input {
  width: 100%;
  padding: 8px 12px;
  font-family: var(--font-mono);
  font-size: 13px;
  background: var(--color-bg-surface);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-sm);
  outline: none;
}
.modal-input:focus { border-color: var(--color-accent); }
</style>
