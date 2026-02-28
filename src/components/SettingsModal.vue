<script setup lang="ts">
import { ref, watch } from 'vue'
import { useSettings } from '../composables/useSettings'
import { settingsModalOpen } from '../modalState'
import BaseModal from './BaseModal.vue'

const { settings, saveSettings } = useSettings()

type Tab = 'app' | 'playback' | 'streamdeck'
const activeTab = ref<Tab>('app')

const tabs: { id: Tab; label: string }[] = [
  { id: 'app',         label: 'App'          },
  { id: 'playback',    label: 'Playback'     },
  { id: 'streamdeck',  label: 'Stream Deck'  },
]

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

function setTheme(e: Event) {
  const val = (e.target as HTMLSelectElement).value as 'dark' | 'light'
  settings.value.theme = val
  saveSettings({ theme: val })
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
  <BaseModal :open="settingsModalOpen" title="Settings" width="560px" @close="settingsModalOpen = false">

    <!-- ── Body: tab list + content ──────────────────────────────────── -->
    <div class="flex">

          <!-- Tab list -->
          <nav class="tab-list">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              class="tab-btn"
              :class="{ 'tab-btn-active': activeTab === tab.id }"
              @click="activeTab = tab.id"
            >
              {{ tab.label }}
            </button>
          </nav>

          <!-- Content -->
          <div class="tab-content">

            <!-- ── APP tab: Keybinds + Window ── -->
            <div v-if="activeTab === 'app'">
              <div class="settings-section">
                <div class="settings-row">
                  <div class="settings-row-label">Theme</div>
                  <div class="settings-row-control">
                    <select class="modal-select" :value="settings.theme" @change="setTheme">
                      <option value="dark">Dark</option>
                      <option value="light">Light</option>
                    </select>
                  </div>
                </div>
                <div class="settings-row mt-3">
                  <div class="settings-row-label">Close to notification tray</div>
                  <div class="settings-row-control">
                    <label class="toggle">
                      <input type="checkbox" :checked="settings.closeToTray" @change="setCloseToTray" />
                      <span class="toggle-track"></span>
                      <span class="toggle-thumb"></span>
                    </label>
                  </div>
                </div>
                <p class="settings-description">Keep running in the notification tray when the window is closed</p>
              </div>
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

            </div>

            <!-- ── PLAYBACK tab ── -->
            <div v-else-if="activeTab === 'playback'">
              <div class="settings-section">
                <div class="settings-row-label mb-2">Playback mode</div>
                <div class="flex gap-2">
                  <button class="flex-1 btn" :class="{ 'btn-accent': settings.playbackMode === 'stop' }" @click="setPlaybackMode('stop')">Stop</button>
                  <button class="flex-1 btn" :class="{ 'btn-accent': settings.playbackMode === 'restart' }" @click="setPlaybackMode('restart')">Restart</button>
                  <button class="flex-1 btn" :class="{ 'btn-accent': settings.playbackMode === 'overlap' }" @click="setPlaybackMode('overlap')">Overlap</button>
                </div>
                <p class="settings-description mt-1">
                  <template v-if="settings.playbackMode === 'overlap'">Clicking a playing sound adds a new simultaneous instance.</template>
                  <template v-else-if="settings.playbackMode === 'restart'">Clicking a playing sound restarts it.</template>
                  <template v-else>Clicking a playing sound stops it. Clicking it again restarts it.</template>
                </p>

                <div class="settings-row mt-4">
                  <div class="settings-row-label">Normalize volume</div>
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
            </div>

            <!-- ── STREAM DECK tab ── -->
            <div v-else-if="activeTab === 'streamdeck'">
              <div class="settings-section">
                <div class="settings-row">
                  <div class="settings-row-label">Grid Mode</div>
                  <div class="settings-row-control">
                    <label class="toggle">
                      <input type="checkbox" :checked="settings.streamDeckButtonMode" @change="setStreamDeckButtonMode" />
                      <span class="toggle-track"></span>
                      <span class="toggle-thumb"></span>
                    </label>
                  </div>
                </div>
                <p class="settings-description">Show sounds as a grid in the Stream Deck Plugin</p>

                <div class="plugin-install-section">
                <div class="settings-row gap-2! flex items-end flex-wrap">
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

          </div>
        </div>
  </BaseModal>
</template>

<style scoped>
/* ---- Tab list (left panel) ---- */
.tab-list {
  width: 120px;
  flex-shrink: 0;
  background: var(--color-bg-surface);
  border-right: 1px solid var(--color-border);
  padding: 8px 0;
}

.tab-btn {
  display: block;
  width: 100%;
  text-align: left;
  padding: 10px 16px;
  font-family: var(--font-sans);
  font-size: 13px;
  background: transparent;
  border: none;
  border-left: 2px solid transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
  outline: none;
}

.tab-btn:hover {
  background: var(--color-bg-surface-hover);
  color: var(--color-text-primary);
}

.tab-btn-active {
  color: var(--color-text-primary);
  background: var(--color-bg-surface-hover);
  border-left-color: var(--color-accent);
}

/* ---- Tab content (right panel) ---- */
.tab-content {
  flex: 1;
  padding: 20px 24px 28px;
  min-height: 280px;
}

/* First section header in a tab panel needs no top margin */
.tab-content > div > .settings-section:first-child .settings-section-header {
  margin-top: 0;
}

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

/* ---- Plugin install divider ---- */
.plugin-install-section {
  border-top: 1px solid var(--color-border);
  margin-top: 1rem;
  padding-top: 1rem;
}

/* ---- Select ---- */
.modal-select {
  padding: 6px 8px;
  font-size: 12px;
  min-width: 140px;
  background: var(--color-bg-surface);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-sm);
  outline: none;
  cursor: pointer;
}
.modal-select:focus { border-color: var(--color-accent); }

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
