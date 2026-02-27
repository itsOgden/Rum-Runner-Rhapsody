<script setup lang="ts">
import { ref, watch } from 'vue'
import { useSettings } from '../composables/useSettings'
import { settingsModalOpen } from '../modalState'

const { settings, saveSettings } = useSettings()

type PluginState =
  | 'checking'
  | 'not-installed'
  | 'up-to-date'
  | 'update-available'
  | 'installing'
  | 'restarting'
  | 'done'
  | 'error'

const pluginState = ref<PluginState>('checking')
const pluginErrorMessage = ref('')
const pluginBundledVersion = ref('')
const pluginInstalledVersion = ref<string | null>(null)
const pluginRestartingStreamDeck = ref(false)

async function checkPluginStatus() {
  pluginState.value = 'checking'
  try {
    const status = await window.api.getStreamDeckPluginStatus()
    pluginBundledVersion.value = status.bundledVersion
    pluginInstalledVersion.value = status.installedVersion
    if (!status.isInstalled) {
      pluginState.value = 'not-installed'
    } else if (status.needsUpdate) {
      pluginState.value = 'update-available'
    } else {
      pluginState.value = 'up-to-date'
    }
  } catch {
    pluginState.value = 'not-installed'
  }
}

watch(settingsModalOpen, (open) => { if (open) checkPluginStatus() })

// ── Auto-save handlers ──────────────────────────────────────────────────────

let hotkeyTimer: ReturnType<typeof setTimeout> | null = null
function onHotkeyInput() {
  if (hotkeyTimer) clearTimeout(hotkeyTimer)
  hotkeyTimer = setTimeout(() => {
    saveSettings({ hotkeys: { stop: settings.value.hotkeys.stop } })
  }, 300)
}

function setPlaybackMode(mode: 'overlap' | 'restart' | 'stop') {
  settings.value.playbackMode = mode
  saveSettings({ playbackMode: mode })
}

function setNormalize(e: Event) {
  const val = (e.target as HTMLInputElement).checked
  settings.value.normalize = val
  saveSettings({ normalize: val })
}

function setStreamDeckButtonMode(e: Event) {
  const val = (e.target as HTMLInputElement).checked
  settings.value.streamDeckButtonMode = val
  saveSettings({ streamDeckButtonMode: val })
}

function setCloseToTray(e: Event) {
  const val = (e.target as HTMLInputElement).checked
  settings.value.closeToTray = val
  saveSettings({ closeToTray: val })
}

// ── Plugin install ──────────────────────────────────────────────────────────

async function handleInstallPlugin(): Promise<void> {
  pluginState.value = 'installing'
  const [result] = await Promise.all([
    window.api.installStreamDeckPlugin(),
    new Promise<void>(resolve => setTimeout(resolve, 1500)),
  ])
  if (result.success) {
    pluginRestartingStreamDeck.value = result.restartingStreamDeck
    pluginState.value = 'restarting'
    setTimeout(() => { pluginState.value = 'done' }, 2000)
    const status = await window.api.getStreamDeckPluginStatus()
    pluginInstalledVersion.value = status.installedVersion
  } else {
    pluginState.value = 'error'
    pluginErrorMessage.value = result.message
  }
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
        <div class="flex items-center justify-between mb-2">
          <div class="text-lg font-bold text-text-primary">Settings</div>
          <button class="close-btn" @click="settingsModalOpen = false">×</button>
        </div>

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
                v-model="settings.hotkeys.stop"
                @input="onHotkeyInput"
              />
            </div>
          </div>
        </div>

        <!-- ── WINDOW ───────────────────────────────────────── -->
        <div class="settings-section">
          <h3 class="settings-section-header">Window</h3>
          <div class="settings-row">
            <div class="settings-row-label">Close to notification tray</div>
            <div class="settings-row-control">
              <label class="toggle">
                <input type="checkbox" :checked="settings.closeToTray" @change="setCloseToTray" />
                <span class="toggle-track"></span>
                <span class="toggle-thumb"></span>
              </label>
            </div>
          </div>
          <p class="settings-description">Keeps RRR running in the notification area when the window is closed</p>
        </div>

        <!-- ── PLAYBACK ──────────────────────────────────────── -->
        <div class="settings-section">
          <h3 class="settings-section-header">Playback</h3>

          <div class="settings-row-label mb-2">Playback mode</div>
          <div class="flex gap-2">
            <button class="flex-1 btn" :class="{ 'btn-accent': settings.playbackMode === 'stop' }" @click="setPlaybackMode('stop')">Stop</button>
            <button class="flex-1 btn" :class="{ 'btn-accent': settings.playbackMode === 'restart' }" @click="setPlaybackMode('restart')">Restart</button>
            <button class="flex-1 btn" :class="{ 'btn-accent': settings.playbackMode === 'overlap' }" @click="setPlaybackMode('overlap')">Overlap</button>
          </div>
          <p class="settings-description mt-1">
            <template v-if="settings.playbackMode === 'overlap'">Clicking a playing sound adds a new simultaneous instance.</template>
            <template v-else-if="settings.playbackMode === 'restart'">Clicking a playing sound stops and restarts it.</template>
            <template v-else>Clicking a playing sound stops it. Clicking it again plays it from the start.</template>
          </p>

          <div class="settings-row mt-4">
            <div class="settings-row-label">Normalize volumes</div>
            <div class="settings-row-control">
              <label class="toggle">
                <input type="checkbox" :checked="settings.normalize" @change="setNormalize" />
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
                <input type="checkbox" :checked="settings.streamDeckButtonMode" @change="setStreamDeckButtonMode" />
                <span class="toggle-track"></span>
                <span class="toggle-thumb"></span>
              </label>
            </div>
          </div>
          <p class="settings-description">Show sounds as a grid in the Stream Deck Plugin</p>

          <div class="settings-row gap-2! flex items-end mt-3 flex-wrap">
            <button
                class="btn self-end"
                :class="{
                  'btn-danger': pluginState === 'error',
                  'btn-accent': ['not-installed', 'update-available'].includes(pluginState),
                  'plugin-btn-muted': !['not-installed', 'update-available', 'error'].includes(pluginState),
                }"
                :disabled="!['not-installed', 'update-available', 'error'].includes(pluginState)"
                @click="handleInstallPlugin"
            >
              <template v-if="pluginState === 'checking'">
                <span class="btn-spinner" />Checking for Updates
              </template>
              <template v-else-if="pluginState === 'installing' && pluginInstalledVersion && pluginBundledVersion !== pluginInstalledVersion">
                <span class="btn-spinner" />Updating Plugin
              </template>
              <template v-else-if="pluginState === 'installing'">
                <span class="btn-spinner" />Installing Plugin
              </template>
              <template v-else-if="['up-to-date', 'done'].includes(pluginState)">Installed</template>
              <template v-else-if="pluginState === 'restarting'">
                <span class="btn-spinner" />Restarting Stream Deck
              </template>
              <template v-else-if="pluginState === 'update-available'">Update Available (v{{pluginBundledVersion}})</template>
              <template v-else-if="pluginState === 'error'">Installation Failed</template>
              <template v-else>Install Plugin</template>
            </button>
            <span
                class="settings-description"
                :style="pluginState === 'error' && 'color: #f87171'"
            >
              <template v-if="pluginState === 'error'">{{ pluginErrorMessage }}</template>
              <template v-else-if="pluginState === 'restarting'">{{ pluginRestartingStreamDeck ? '' : 'Please restart your Stream Deck.' }}</template>
              <template v-else-if="!['not-installed', 'installing', 'checking'].includes(pluginState)">v{{ pluginInstalledVersion }}</template>
            </span>
          </div>
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

/* ---- Close button ---- */
.close-btn {
  background: none;
  border: none;
  color: var(--color-text-dim);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  padding: 0 2px;
  border-radius: 4px;
  transition: color 0.15s;
}
.close-btn:hover { color: var(--color-text-primary); }

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

/* ---- Plugin install button states ---- */
.plugin-btn-muted {
  opacity: 0.5;
  cursor: default;
}

.btn-spinner {
  display: inline-block;
  width: 11px;
  height: 11px;
  border: 1.5px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: btn-spin 0.65s linear infinite;
  vertical-align: middle;
  margin-right: 5px;
}

@keyframes btn-spin {
  to { transform: rotate(360deg); }
}
</style>
