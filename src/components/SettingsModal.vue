<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useSettings } from '../composables/useSettings'
import { useAudioDevices } from '../composables/useAudioDevices'
import { settingsModalOpen, helpModalOpen, helpModalInitialTab } from '../modalState'
import { useStreamDeckImageErrors } from '../composables/useStreamDeckImageErrors'
import { showToast } from '../toastState'
import BaseModal from './BaseModal.vue'
import StreamDeckImagePicker from './StreamDeckImagePicker.vue'
import Icon from "@/components/Icon.vue";

const { settings, saveSettings } = useSettings()
const { audioDevices, findMatchingDeviceId, cleanDeviceLabel, getDeviceLabel } = useAudioDevices()
const { brokenSources } = useStreamDeckImageErrors()

// Track errors reported by the picker while the Stream Deck tab is open.
// Fall back to the global scan so the icon is also visible before the tab is visited.
const pickerErrorCount = ref(0)
const hasStreamDeckErrors = computed(() =>
  pickerErrorCount.value > 0 || brokenSources.value.includes('Default')
)

type Tab = 'app' | 'playback' | 'devices' | 'streamdeck'
const activeTab = ref<Tab>('app')

const tabs: { id: Tab; label: string }[] = [
  { id: 'app',         label: 'App'          },
  { id: 'playback',    label: 'Playback'     },
  { id: 'devices',     label: 'Audio Devices'},
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

watch(settingsModalOpen, (open) => {
  if (open) {
    checkPluginStatus()
    syncAllDeviceState()
  }
})

// ── Device management ───────────────────────────────────────────────────────

const deviceSelectedIds = ref<string[]>([])
const deviceVolumes = ref<number[]>([])

function plainDevice(d: { label: string; volume: number; enabled: boolean }) {
  return { label: d.label, volume: d.volume, enabled: d.enabled }
}

function syncAllDeviceState() {
  deviceSelectedIds.value = settings.value.devices.map((d, i) => findMatchingDeviceId(d.label, i))
  deviceVolumes.value = settings.value.devices.map(d => Math.round((d.volume ?? 1.0) * 100))
}

function syncDeviceIds() {
  deviceSelectedIds.value = settings.value.devices.map((d, i) => findMatchingDeviceId(d.label, i))
}

watch(() => settings.value.devices.map(d => d.label).join('|'), syncDeviceIds)
watch(audioDevices, syncDeviceIds)
watch(() => settings.value.devices.length, syncAllDeviceState)

function onDeviceChange(idx: number): void {
  const newId = deviceSelectedIds.value[idx]
  if (audioDevices.value.length > 1) {
    for (let i = 0; i < settings.value.devices.length; i++) {
      if (i === idx) continue
      if (newId === findMatchingDeviceId(settings.value.devices[i].label, i)) {
        showToast(`That device is already used as Output ${i + 1}. Choose a different device.`, 'info')
        deviceSelectedIds.value[idx] = findMatchingDeviceId(settings.value.devices[idx].label, idx)
        return
      }
    }
  }
  const newLabel = getDeviceLabel(newId)
  const updated = settings.value.devices.map((d, i) =>
    i === idx ? { label: newLabel, volume: d.volume, enabled: d.enabled } : plainDevice(d)
  )
  settings.value.devices = updated
  saveSettings({ devices: updated })
}

function onDeviceEnabled(idx: number, val: boolean): void {
  const updated = settings.value.devices.map((d, i) =>
    i === idx ? { label: d.label, volume: d.volume, enabled: val } : plainDevice(d)
  )
  settings.value.devices = updated
  saveSettings({ devices: updated })
}

function onVolumeInput(idx: number): void {
  const vol = (deviceVolumes.value[idx] ?? 100) / 100
  settings.value.devices = settings.value.devices.map((d, i) =>
    i === idx ? { label: d.label, volume: vol, enabled: d.enabled } : plainDevice(d)
  )
}

let deviceVolSaveTimeout: ReturnType<typeof setTimeout> | null = null
function onVolumeChange(idx: number): void {
  onVolumeInput(idx)
  if (deviceVolSaveTimeout) clearTimeout(deviceVolSaveTimeout)
  deviceVolSaveTimeout = setTimeout(() => {
    saveSettings({ devices: settings.value.devices.map(plainDevice) })
  }, 200)
}

function addDevice(): void {
  const usedIds = new Set(deviceSelectedIds.value)
  const unused = audioDevices.value.find(d => !usedIds.has(d.deviceId))
  const newLabel = unused ? cleanDeviceLabel(unused.label) : (audioDevices.value[0] ? cleanDeviceLabel(audioDevices.value[0].label) : '')
  const updated = [...settings.value.devices.map(plainDevice), { label: newLabel, volume: 1.0, enabled: true }]
  settings.value.devices = updated
  saveSettings({ devices: updated })
}

function removeDevice(idx: number): void {
  if (settings.value.devices.length <= 1) return
  const updated = settings.value.devices.filter((_, i) => i !== idx).map(plainDevice)
  settings.value.devices = updated
  saveSettings({ devices: updated })
}

function openVbCableHelp(): void {
  helpModalInitialTab.value = 'audio-setup'
  settingsModalOpen.value = false
  helpModalOpen.value = true
}

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

function setAutoStart(e: Event) {
  const val = (e.target as HTMLInputElement).checked
  settings.value.autoStart = val
  saveSettings({ autoStart: val })
}

function setLaunchMinimized(e: Event) {
  const val = (e.target as HTMLInputElement).checked
  settings.value.launchMinimized = val
  saveSettings({ launchMinimized: val })
}

function setTheme(e: Event) {
  const val = (e.target as HTMLSelectElement).value as 'dark' | 'light'
  settings.value.theme = val
  saveSettings({ theme: val })
}

function setShowCategorySidebar(e: Event) {
  const val = (e.target as HTMLInputElement).checked
  settings.value.showCategorySidebar = val
  saveSettings({ showCategorySidebar: val })
}

// ── Stream Deck default images ──────────────────────────────────────────────

const defaultIdlePath = computed(() => settings.value.streamDeckDefaultImages?.idle || null)
const defaultPlayingPath = computed(() => settings.value.streamDeckDefaultImages?.playing || null)
const defaultStopPath = computed(() => settings.value.streamDeckDefaultImages?.stop || null)

function saveDefaultImages(idle: string | null, playing: string | null, stop: string | null): void {
  const entry: { idle?: string; playing?: string; stop?: string } = {}
  if (idle) entry.idle = idle
  if (playing) entry.playing = playing
  if (stop) entry.stop = stop
  settings.value.streamDeckDefaultImages = entry
  saveSettings({ streamDeckDefaultImages: { ...entry } })
}

function onDefaultIdleChange(path: string | null): void {
  saveDefaultImages(path, path ? defaultPlayingPath.value : null, defaultStopPath.value)
}

function onDefaultPlayingChange(path: string | null): void {
  saveDefaultImages(defaultIdlePath.value, path, defaultStopPath.value)
}

function onDefaultStopChange(path: string | null): void {
  saveDefaultImages(defaultIdlePath.value, defaultPlayingPath.value, path)
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
  <BaseModal :open="settingsModalOpen" title="Settings" width="600px" @close="settingsModalOpen = false">

    <!-- ── Body: tab list + content ──────────────────────────────────── -->
    <div class="flex flex-1 min-h-0">

          <!-- Tab list -->
          <nav class="tab-list">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              class="tab-btn"
              :class="{ 'tab-btn-active': activeTab === tab.id }"
              @click="activeTab = tab.id"
            >
              {{ tab.label }}<Icon v-if="tab.id === 'streamdeck' && hasStreamDeckErrors" name="triangle-exclamation" class="text-[10px] text-danger ml-1" />
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
                <div class="settings-row mt-3">
                  <div class="settings-row-label">Start with Windows</div>
                  <div class="settings-row-control">
                    <label class="toggle">
                      <input type="checkbox" :checked="settings.autoStart" @change="setAutoStart" />
                      <span class="toggle-track"></span>
                      <span class="toggle-thumb"></span>
                    </label>
                  </div>
                </div>
                <p class="settings-description">Start the app automatically when you start your PC</p>
                <div v-show="settings.autoStart" class="settings-row mt-3">
                  <div class="settings-row-label">Start minimized</div>
                  <div class="settings-row-control">
                    <label class="toggle">
                      <input type="checkbox" :checked="settings.launchMinimized" @change="setLaunchMinimized" />
                      <span class="toggle-track"></span>
                      <span class="toggle-thumb"></span>
                    </label>
                  </div>
                </div>
                <p v-show="settings.autoStart" class="settings-description">Start in the system tray instead of opening the window</p>
                <div class="settings-row mt-3">
                  <div class="settings-row-label">Show category sidebar</div>
                  <div class="settings-row-control">
                    <label class="toggle">
                      <input type="checkbox" :checked="settings.showCategorySidebar" @change="setShowCategorySidebar" />
                      <span class="toggle-track"></span>
                      <span class="toggle-thumb"></span>
                    </label>
                  </div>
                </div>
                <p class="settings-description">Show the category quick-nav sidebar in the sound list</p>
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

            <!-- ── DEVICES tab ── -->
            <div v-else-if="activeTab === 'devices'">
              <div class="bg-bg-surface border border-border rounded-md p-3 mb-4">
                <p class="text-[12px] text-text-secondary leading-relaxed">
                  Sounds play on all enabled devices at the same time. Typically you'll add your headphones or speakers to hear sounds locally, and a virtual cable to route audio into Discord, OBS, or any other app.
                </p>
                <button class="btn mt-2 flex items-center gap-1.5 text-[12px] self-start" @click="openVbCableHelp">
                  How to set up a virtual cable
                  <Icon name="chevron-down-solid" class="text-[10px] -rotate-90" />
                </button>
              </div>
              <div class="settings-section">
                <div class="device-list">
                  <div v-for="(device, idx) in settings.devices" :key="idx" class="device-row">
                    <div class="device-row-top">
                      <label class="toggle">
                        <input type="checkbox" :checked="device.enabled" @change="(e) => onDeviceEnabled(idx, (e.target as HTMLInputElement).checked)" />
                        <span class="toggle-track"></span>
                        <span class="toggle-thumb"></span>
                      </label>
                      <select class="device-select" v-model="deviceSelectedIds[idx]" @change="onDeviceChange(idx)">
                        <option v-for="d in audioDevices" :key="d.deviceId" :value="d.deviceId">
                          {{ cleanDeviceLabel(d.label || `Device ${d.deviceId.slice(0, 8)}`) }}
                        </option>
                      </select>
                      <button
                        class="device-remove-btn"
                        :disabled="settings.devices.length <= 1"
                        @click="removeDevice(idx)"
                        title="Remove device"
                      ><Icon name="xmark-solid" /></button>
                    </div>
                    <div class="device-row-vol">
                      <input
                        type="range" min="0" max="100"
                        v-model.number="deviceVolumes[idx]"
                        @input="onVolumeInput(idx)"
                        @change="onVolumeChange(idx)"
                        class="device-vol-slider"
                      />
                      <span class="device-vol-value">{{ deviceVolumes[idx] ?? 100 }}%</span>
                    </div>
                  </div>
                </div>
                <button class="btn mt-3" @click="addDevice">+ Add Device</button>
              </div>
            </div>

            <!-- ── STREAM DECK tab ── -->
            <div v-else-if="activeTab === 'streamdeck'">

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
              <div class="plugin-install-section"></div>
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

                <div class="settings-section mt-4">
                  <h3 class="settings-row-label">Default Icons</h3>
                  <p class="settings-description mb-3">Override the icons for all Stream Deck buttons. Category icons always take priority when set and enabled.</p>
                  <StreamDeckImagePicker
                    :idle-path="defaultIdlePath"
                    :playing-path="defaultPlayingPath"
                    :stop-path="defaultStopPath"
                    :default-idle-path="null"
                    :default-playing-path="null"
                    :default-stop-path="null"
                    @update:idle-path="onDefaultIdleChange"
                    @update:playing-path="onDefaultPlayingChange"
                    @update:stop-path="onDefaultStopChange"
                    @errors="n => pickerErrorCount = n"
                  />
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
  width: 140px;
  flex-shrink: 0;
  background: var(--color-bg-surface);
  border-right: 1px solid var(--color-border);
  padding: 8px 0;
  overflow-y: auto;
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
  min-height: 0;
  overflow-y: auto;
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
  line-height: 1;
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

/* ---- Device list ---- */
.device-list {
  display: flex;
  flex-direction: column;
}

.device-row {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 8px 0;
  border-bottom: 1px solid var(--color-border);
}

.device-row:last-child { border-bottom: none; }

.device-row-top {
  display: flex;
  align-items: center;
  gap: 8px;
}

.device-row-vol {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-left: 44px; /* indent to align under the select */
}

.device-select {
  flex: 1;
  min-width: 0;
  padding: 6px 28px 6px 10px;
  font-family: var(--font-sans);
  font-size: 13px;
  background: var(--color-bg-surface);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-sm);
  outline: none;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%238891a8'%3E%3Cpath d='M6 8L1 3h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
}
.device-select:focus { border-color: var(--color-accent); }
.device-select option { background: var(--color-bg-surface); color: var(--color-text-primary); }

.device-vol-slider {
  -webkit-appearance: none;
  flex: 1;
  height: 4px;
  background: var(--color-bg-surface);
  border-radius: 2px;
  outline: none;
}
.device-vol-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--color-accent);
  cursor: pointer;
  box-shadow: 0 0 6px var(--color-accent-glow);
  transition: box-shadow 0.15s;
}
.device-vol-slider::-webkit-slider-thumb:hover {
  box-shadow: 0 0 12px var(--color-accent-glow);
}

.device-vol-value {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-text-secondary);
  min-width: 32px;
  text-align: right;
  flex-shrink: 0;
}

.device-remove-btn {
  background: none;
  border: none;
  color: var(--color-text-dim);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: var(--radius-sm);
  transition: color 0.15s;
  flex-shrink: 0;
}
.device-remove-btn:hover:not(:disabled) { color: var(--color-danger); }
.device-remove-btn:disabled { opacity: 0.25; cursor: default; }

</style>
