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
      class="fixed inset-0 bg-black/60 backdrop-blur-xs z-100 flex justify-center items-center"
      @click.self="settingsModalOpen = false"
    >
      <div class="bg-bg-raised border border-border rounded-lg p-7 w-105 shadow-lg">
        <div class="text-lg font-bold mb-2 text-text-primary">Settings</div>

        <!-- ── KEYBINDS ──────────────────────────────────────── -->
        <div class="settings-section">
          <h3 class="settings-section-header">Keybinds</h3>
          <div class="settings-row">
            <div class="settings-row-label">Stop All</div>
            <div class="settings-row-control">
              <input
                type="text"
                class="modal-input"
                placeholder="Escape"
                v-model="localHotkey"
              />
            </div>
          </div>
        </div>

        <!-- ── PLAYBACK ──────────────────────────────────────── -->
        <div class="settings-section">
          <h3 class="settings-section-header">Playback</h3>

          <div class="settings-row-label mb-2">Playback mode</div>
          <div class="flex gap-2">
            <button class="flex-1 btn" :class="{ 'btn-accent': localPlaybackMode === 'stop' }" @click="localPlaybackMode = 'stop'">Stop</button>
            <button class="flex-1 btn" :class="{ 'btn-accent': localPlaybackMode === 'restart' }" @click="localPlaybackMode = 'restart'">Restart</button>
            <button class="flex-1 btn" :class="{ 'btn-accent': localPlaybackMode === 'overlap' }" @click="localPlaybackMode = 'overlap'">Overlap</button>
          </div>
          <p class="settings-description mt-1">
            <template v-if="localPlaybackMode === 'overlap'">Clicking a playing sound adds a new simultaneous instance.</template>
            <template v-else-if="localPlaybackMode === 'restart'">Clicking a playing sound stops and restarts it.</template>
            <template v-else>Clicking a playing sound stops it. Clicking it again plays it from the start.</template>
          </p>

          <div class="settings-row mt-4">
            <div class="settings-row-label">Normalize volumes</div>
            <div class="settings-row-control">
              <label class="toggle">
                <input type="checkbox" v-model="localNormalize" />
                <span class="toggle-track"></span>
                <span class="toggle-thumb"></span>
              </label>
            </div>
          </div>
          <p class="settings-description">Automatically balance loud and quiet sounds to a consistent level</p>
        </div>

        <!-- ── STREAM DECK ───────────────────────────────────── -->
        <div class="settings-section">
          <h3 class="settings-section-header">Stream Deck</h3>
          <div class="settings-row">
            <div class="settings-row-label">Button grid mode</div>
            <div class="settings-row-control">
              <label class="toggle">
                <input type="checkbox" v-model="localStreamDeckButtonMode" />
                <span class="toggle-track"></span>
                <span class="toggle-thumb"></span>
              </label>
            </div>
          </div>
          <p class="settings-description">Show sounds as a grid in the Stream Deck Plugin</p>
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
/* ---- Section layout ---- */
.settings-section + .settings-section {
  margin-top: 1.5rem;
}

.settings-section-header {
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text-dim);
  margin-bottom: 0.75rem;
  margin-top: 1rem;
  border-bottom: 1px solid var(--color-border);
}

.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.settings-row-label {
  font-size: 13px;
  color: var(--color-text-primary);
  font-weight: 400;
}

.settings-row-control { flex-shrink: 0; }

.settings-description {
  font-size: 12px;
  color: var(--color-text-dim);
  line-height: 1.5;
}

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

/* ---- Inputs ---- */
.modal-input {
  width: 100px;
  padding: 6px 10px 6px 8px;
  font-family: var(--font-mono);
  font-size: 12px;
  background: var(--color-bg-surface);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-sm);
  outline: none;
  text-align: center;
}
.modal-input:focus { border-color: var(--color-accent); }
</style>
