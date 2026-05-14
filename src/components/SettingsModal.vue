<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useSettings } from '../composables/useSettings'
import { useAudioDevices } from '../composables/useAudioDevices'
import { settingsModalOpen, helpModalOpen, helpModalInitialTab } from '../modalState'
import { useStreamDeckImageErrors } from '../composables/useStreamDeckImageErrors'
import { showToast } from '../toastState'
import BaseModal from './BaseModal.vue'
import ModalTabs from './ModalTabs.vue'
import ToggleSwitch from './ToggleSwitch.vue'
import StreamDeckImagePicker from './StreamDeckImagePicker.vue'
import Icon from '@/components/Icon.vue'
import SettingRow from './SettingRow.vue'

const { settings, saveSettings } = useSettings()
const { audioDevices, findMatchingDeviceId, cleanDeviceLabel, getDeviceLabel } = useAudioDevices()
const { brokenSources } = useStreamDeckImageErrors()

const pickerErrorCount = ref(0)
const hasStreamDeckErrors = computed(() =>
  pickerErrorCount.value > 0 || brokenSources.value.includes('Default')
)

type Tab = 'app' | 'playback' | 'devices' | 'streamdeck'
const activeTab = ref<Tab>('app')

const tabs = computed(() => [
  { id: 'app',        label: 'App'           },
  { id: 'playback',   label: 'Playback'      },
  { id: 'devices',    label: 'Audio Devices' },
  { id: 'streamdeck', label: 'Stream Deck', badge: hasStreamDeckErrors.value },
] as Array<{ id: Tab; label: string; badge?: boolean }>)

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

function availableDevicesFor(idx: number) {
  const otherIds = new Set(deviceSelectedIds.value.filter((_, i) => i !== idx))
  return audioDevices.value.filter(d => !otherIds.has(d.deviceId))
}

const canAddDevice = computed(() =>
  audioDevices.value.length > settings.value.devices.length
)

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

function setNormalize(val: boolean) {
  settings.value.normalize = val
  saveSettings({ normalize: val })
}

function setStreamDeckButtonMode(val: boolean) {
  settings.value.streamDeckButtonMode = val
  saveSettings({ streamDeckButtonMode: val })
}

function setCloseToTray(val: boolean) {
  settings.value.closeToTray = val
  saveSettings({ closeToTray: val })
}

function setAutoStart(val: boolean) {
  settings.value.autoStart = val
  saveSettings({ autoStart: val })
}

function setLaunchMinimized(val: boolean) {
  settings.value.launchMinimized = val
  saveSettings({ launchMinimized: val })
}

function setTheme(e: Event) {
  const val = (e.target as HTMLSelectElement).value as 'dark' | 'light'
  settings.value.theme = val
  saveSettings({ theme: val })
}

function setShowCategorySidebar(val: boolean) {
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
  <BaseModal :open="settingsModalOpen" title="Settings" @close="settingsModalOpen = false">
    <div class="flex flex-1 min-h-0">

      <ModalTabs :tabs="tabs" v-model="activeTab" />

      <div class="flex-1 pt-5 px-6 pb-7 min-h-0 overflow-y-auto">

        <!-- ── APP tab ── -->
        <div v-if="activeTab === 'app'" class="space-y-6">
          <div class="space-y-3">
            <SettingRow label="Theme">
              <select
                class="px-2 py-1.5 text-xs min-w-[140px] bg-bg-surface text-text-primary border border-border-light rounded-sm outline-none cursor-pointer focus:border-accent"
                :value="settings.theme"
                @change="setTheme"
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </SettingRow>

            <SettingRow label="Close to notification tray" description="Keep running in the notification tray when the window is closed">
              <ToggleSwitch :modelValue="settings.closeToTray" @update:modelValue="setCloseToTray" />
            </SettingRow>

            <SettingRow label="Start with Windows" description="Start the app automatically when you start your PC">
              <ToggleSwitch :modelValue="settings.autoStart" @update:modelValue="setAutoStart" />
            </SettingRow>

            <SettingRow v-if="settings.autoStart" label="Start minimized" description="Start in the system tray instead of opening the window">
              <ToggleSwitch :modelValue="settings.launchMinimized" @update:modelValue="setLaunchMinimized" />
            </SettingRow>

            <SettingRow label="Show category sidebar" description="Show the category quick-nav sidebar in the sound list">
              <ToggleSwitch :modelValue="settings.showCategorySidebar" @update:modelValue="setShowCategorySidebar" />
            </SettingRow>
          </div>

          <div>
            <h3 class="text-sm font-semibold uppercase text-text-dim mb-3 pb-0 border-b border-border">Keybinds</h3>
            <SettingRow label="Stop All">
              <input
                type="text"
                class="w-[100px] px-2 py-1.5 text-xs bg-bg-surface text-text-primary border border-border-light rounded-sm outline-none text-center focus:border-accent"
                placeholder="Escape"
                v-model="settings.hotkeys.stop"
                @input="onHotkeyInput"
              />
            </SettingRow>
          </div>
        </div>

        <!-- ── PLAYBACK tab ── -->
        <div v-else-if="activeTab === 'playback'" class="space-y-6">
          <div class="space-y-3">
            <div class="text-sm text-text-primary mb-2">Playback mode</div>
            <div class="flex gap-2">
              <button class="flex-1 btn" :class="{ 'btn-accent': settings.playbackMode === 'stop' }" @click="setPlaybackMode('stop')">Stop</button>
              <button class="flex-1 btn" :class="{ 'btn-accent': settings.playbackMode === 'restart' }" @click="setPlaybackMode('restart')">Restart</button>
              <button class="flex-1 btn" :class="{ 'btn-accent': settings.playbackMode === 'overlap' }" @click="setPlaybackMode('overlap')">Overlap</button>
            </div>
            <p class="text-xs text-text-dim mt-1">
              <template v-if="settings.playbackMode === 'overlap'">Clicking a playing sound adds a new simultaneous instance.</template>
              <template v-else-if="settings.playbackMode === 'restart'">Clicking a playing sound restarts it.</template>
              <template v-else>Clicking a playing sound stops it. Clicking it again restarts it.</template>
            </p>

            <SettingRow label="Normalize volume" description="Automatically balance loud and quiet sounds to a consistent level" class="mt-4">
              <ToggleSwitch :modelValue="settings.normalize" @update:modelValue="setNormalize" />
            </SettingRow>
          </div>
        </div>

        <!-- ── DEVICES tab ── -->
        <div v-else-if="activeTab === 'devices'">
          <div class="bg-bg-surface border border-border rounded-md p-3 mb-4">
            <p class="text-xs text-text-secondary leading-relaxed">
              Sounds play on all enabled devices at the same time. Typically you'll add your headphones or speakers to hear sounds locally, and a virtual cable to route audio into Discord, OBS, or any other app.
            </p>
            <button class="btn mt-2 flex items-center gap-1.5 text-xs self-start" @click="openVbCableHelp">
              How to set up a virtual cable
              <Icon name="chevron-down-solid" class="text-[10px] -rotate-90" />
            </button>
          </div>

          <div class="flex flex-col">
            <div
              v-for="(device, idx) in settings.devices"
              :key="idx"
              class="flex flex-col gap-[5px] py-2 border-b border-border last:border-b-0"
            >
              <div class="flex items-center gap-2">
                <ToggleSwitch
                  :modelValue="device.enabled"
                  @update:modelValue="(val) => onDeviceEnabled(idx, val)"
                />
                <select
                  class="flex-1 min-w-0 px-2.5 py-1.5 pr-7 font-sans text-sm bg-bg-surface text-text-primary border border-border-light rounded-sm outline-none cursor-pointer appearance-none focus:border-accent bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20width=%2712%27%20height=%2712%27%20fill=%27%238891a8%27%3E%3Cpath%20d=%27M6%208L1%203h10z%27/%3E%3C/svg%3E')] bg-no-repeat bg-[right_10px_center]"
                  v-model="deviceSelectedIds[idx]"
                  @change="onDeviceChange(idx)"
                >
                  <option v-for="d in availableDevicesFor(idx)" :key="d.deviceId" :value="d.deviceId" class="bg-bg-surface text-text-primary">
                    {{ cleanDeviceLabel(d.label || `Device ${d.deviceId.slice(0, 8)}`) }}
                  </option>
                </select>
                <button
                  class="text-text-dim text-lg leading-none cursor-pointer p-[2px_4px] rounded-sm bg-transparent border-none transition-colors shrink-0 hover:text-danger disabled:opacity-25 disabled:cursor-default"
                  :disabled="settings.devices.length <= 1"
                  @click="removeDevice(idx)"
                  title="Remove device"
                ><Icon name="xmark-solid" /></button>
              </div>
              <div class="flex items-center gap-1.5 pl-11">
                <input
                  type="range" min="0" max="100"
                  v-model.number="deviceVolumes[idx]"
                  @input="onVolumeInput(idx)"
                  @change="onVolumeChange(idx)"
                />
                <span class="text-xs text-text-secondary min-w-[32px] text-right shrink-0">{{ deviceVolumes[idx] ?? 100 }}%</span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-3 mt-3">
            <button class="btn" :disabled="!canAddDevice" :class="{ 'opacity-40 cursor-default': !canAddDevice }" @click="addDevice">+ Add Device</button>
            <span v-if="!canAddDevice" class="text-xs text-text-dim">No unused devices available</span>
          </div>
        </div>

        <!-- ── STREAM DECK tab ── -->
        <div v-else-if="activeTab === 'streamdeck'" class="space-y-4">
          <div class="flex items-end gap-2 flex-wrap">
            <button
              class="btn self-end"
              :class="{
                'btn-danger': pluginState === 'error',
                'btn-accent': ['not-installed', 'update-available'].includes(pluginState),
                'opacity-50 cursor-default': !['not-installed', 'update-available', 'error'].includes(pluginState),
              }"
              :disabled="!['not-installed', 'update-available', 'error'].includes(pluginState)"
              @click="handleInstallPlugin"
            >
              <template v-if="pluginState === 'checking'">
                <span class="inline-block w-[11px] h-[11px] rounded-full border-[1.5px] border-current border-t-transparent animate-spin align-middle mr-[5px]" />Checking for Updates
              </template>
              <template v-else-if="pluginState === 'installing' && pluginInstalledVersion && pluginBundledVersion !== pluginInstalledVersion">
                <span class="inline-block w-[11px] h-[11px] rounded-full border-[1.5px] border-current border-t-transparent animate-spin align-middle mr-[5px]" />Updating Plugin
              </template>
              <template v-else-if="pluginState === 'installing'">
                <span class="inline-block w-[11px] h-[11px] rounded-full border-[1.5px] border-current border-t-transparent animate-spin align-middle mr-[5px]" />Installing Plugin
              </template>
              <template v-else-if="['up-to-date', 'done'].includes(pluginState)">Installed</template>
              <template v-else-if="pluginState === 'restarting'">
                <span class="inline-block w-[11px] h-[11px] rounded-full border-[1.5px] border-current border-t-transparent animate-spin align-middle mr-[5px]" />Restarting Stream Deck
              </template>
              <template v-else-if="pluginState === 'update-available'">Update Available (v{{ pluginBundledVersion }})</template>
              <template v-else-if="pluginState === 'error'">Installation Failed</template>
              <template v-else>Install Plugin</template>
            </button>
            <span
              class="text-xs text-text-dim"
              :class="{ 'text-danger!': pluginState === 'error' }"
            >
              <template v-if="pluginState === 'error'">{{ pluginErrorMessage }}</template>
              <template v-else-if="pluginState === 'restarting'">{{ pluginRestartingStreamDeck ? '' : 'Please restart your Stream Deck.' }}</template>
              <template v-else-if="!['not-installed', 'installing', 'checking'].includes(pluginState)">v{{ pluginInstalledVersion }}</template>
            </span>
          </div>

          <hr class="border-border" />

          <div class="space-y-3">
            <SettingRow label="Grid Mode" description="Show sounds as a grid in the Stream Deck Plugin">
              <ToggleSwitch :modelValue="settings.streamDeckButtonMode" @update:modelValue="setStreamDeckButtonMode" />
            </SettingRow>

            <div class="mt-4">
              <h3 class="text-sm text-text-primary mb-1">Default Icons</h3>
              <p class="text-xs text-text-dim mb-3">Override the icons for all Stream Deck buttons. Category icons always take priority when set and enabled.</p>
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
