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
import AppSelect from './AppSelect.vue'
import ColorPalette from './ColorPalette.vue'
import KeybindCapture from './KeybindCapture.vue'
import { DEFAULT_ACCENT } from '../colorPalette'
import { isTypingConflict } from '../utils/hotkey'
import { useSoundManagement } from '../composables/useSoundManagement'

const { settings, saveSettings } = useSettings()
const { audioDevices, findMatchingDeviceId, cleanDeviceLabel, getDeviceLabel } = useAudioDevices()
const { brokenSources } = useStreamDeckImageErrors()
const { buildSections } = useSoundManagement()

const pickerErrorCount = ref(0)
const hasStreamDeckErrors = computed(() =>
  pickerErrorCount.value > 0 || brokenSources.value.includes('Default')
)

type Tab = 'app' | 'keybinds' | 'appearance' | 'playback' | 'devices' | 'streamdeck'
const activeTab = ref<Tab>('app')

const tabs = computed(() => [
  { id: 'app',        label: 'App'           },
  { id: 'appearance', label: 'Appearance'    },
  { id: 'devices',    label: 'Audio Devices' },
  { id: 'keybinds',   label: 'Keybinds'      },
  { id: 'playback',   label: 'Playback'      },
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

function onDeviceSelectChange(idx: number, newId: string): void {
  deviceSelectedIds.value[idx] = newId
  onDeviceChange(idx)
}

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

function onGlobalHotkeyChange(key: 'stop' | 'search', combo: string): void {
  settings.value.hotkeys = { ...settings.value.hotkeys, [key]: combo }
  saveSettings({ hotkeys: { ...settings.value.hotkeys } })
}

const soundNameMap = computed((): Record<string, string> => {
  const map: Record<string, string> = {}
  for (const section of buildSections()) {
    for (const sound of section.sounds) map[sound.key] = sound.name
  }
  return map
})

const soundCategoryMap = computed((): Record<string, { name: string; color: string }> => {
  const map: Record<string, { name: string; color: string }> = {}
  for (const section of buildSections()) {
    for (const sound of section.sounds) map[sound.key] = { name: section.displayName, color: section.color || '' }
  }
  return map
})

const soundShortcuts = computed(() => {
  const hidden = new Set(settings.value.hiddenSounds ?? [])
  return Object.entries(settings.value.soundHotkeys ?? {}).filter(([k, v]) => !!v && !hidden.has(k))
})

function onSoundHotkeyChange(soundKey: string, combo: string): void {
  if (!combo) { clearSoundHotkey(soundKey); return }
  if (settings.value.blockTypingConflicts && isTypingConflict(combo)) {
    showToast(`"${combo}" conflicts with typing — use Ctrl/Alt or disable the block below`, 'info')
    return
  }
  if (combo.toLowerCase() === (settings.value.hotkeys.stop || 'Escape').toLowerCase() ||
      combo.toLowerCase() === (settings.value.hotkeys.search || 'Space').toLowerCase()) {
    showToast(`"${combo}" conflicts with a global keybind`, 'info')
  } else {
    const conflict = Object.entries(settings.value.soundHotkeys ?? {}).find(([k, c]) => k !== soundKey && c.toLowerCase() === combo.toLowerCase())
    if (conflict) showToast(`"${combo}" is already assigned to "${soundNameMap.value[conflict[0]] || conflict[0]}"`, 'info')
  }
  const updated = { ...(settings.value.soundHotkeys ?? {}), [soundKey]: combo }
  settings.value.soundHotkeys = updated
  saveSettings({ soundHotkeys: updated })
}

function clearSoundHotkey(soundKey: string): void {
  const updated = { ...(settings.value.soundHotkeys ?? {}) }
  delete updated[soundKey]
  settings.value.soundHotkeys = updated
  saveSettings({ soundHotkeys: updated })
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

function setTheme(val: string) {
  settings.value.theme = val as 'dark' | 'light'
  saveSettings({ theme: val as 'dark' | 'light' })
}

function setAccentColor(hex: string) {
  settings.value.accentColor = hex
  saveSettings({ accentColor: hex })
}

function clearAccentColor() {
  settings.value.accentColor = ''
  saveSettings({ accentColor: '' })
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

        </div>

        <!-- ── KEYBINDS tab ── -->
        <div v-else-if="activeTab === 'keybinds'" class="space-y-5">
          <SettingRow
            label="Block typing keys"
            description="Prevents bare letters, digits, and Shift+key combinations from being assigned as hotkeys. These are captured system-wide and will interfere with typing in other apps. We strongly recommend keeping this on."
          >
            <ToggleSwitch
              :modelValue="settings.blockTypingConflicts"
              @update:modelValue="v => { settings.blockTypingConflicts = v; saveSettings({ blockTypingConflicts: v }) }"
            />
          </SettingRow>

          <div class="space-y-3">
            <div class="flex items-center gap-3 mb-4">
              <div class="w-0.5 h-3.5 bg-accent shrink-0" />
              <span class="text-sm uppercase tracking-widest text-text-primary">Global</span>
              <div class="flex-1 h-px bg-border-light" />
            </div>
            <SettingRow label="Stop All">
              <KeybindCapture
                :modelValue="settings.hotkeys.stop"
                :allow-delete="false"
                placeholder="Escape"
                @update:modelValue="onGlobalHotkeyChange('stop', $event)"
              />
            </SettingRow>
            <SettingRow label="Focus Search">
              <KeybindCapture
                :modelValue="settings.hotkeys.search"
                :allow-delete="false"
                placeholder="Space"
                @update:modelValue="onGlobalHotkeyChange('search', $event)"
              />
            </SettingRow>
          </div>

          <div class="space-y-3">
            <div class="flex items-center gap-3 mb-4">
              <div class="w-0.5 h-3.5 bg-accent shrink-0" />
              <span class="text-sm uppercase tracking-widest text-text-primary">Per-Sound</span>
              <div class="flex-1 h-px bg-border-light" />
            </div>
            <p class="text-xs text-text-secondary -mt-1">Set keybinds via right-clicking any sound button. Keybinds are saved per soundboard folder.</p>
            <template v-if="soundShortcuts.length > 0">
              <div
                v-for="[soundKey, combo] in soundShortcuts"
                :key="soundKey"
                class="flex items-center justify-between gap-4"
              >
                <div class="flex flex-col min-w-0 flex-1">
                  <div class="flex items-center gap-1.5 mb-0.5">
                    <span v-if="soundCategoryMap[soundKey]?.color"
                      class="w-1.5 h-1.5 rounded-full shrink-0"
                      :style="{ backgroundColor: soundCategoryMap[soundKey]?.color || 'transparent' }"
                    />
                    <span class="text-[10px] text-text-secondary truncate">{{ soundCategoryMap[soundKey]?.name }}</span>
                  </div>
                  <span class="text-sm text-text-primary truncate">{{ soundNameMap[soundKey] || soundKey }}</span>
                </div>
                <div class="shrink-0">
                  <KeybindCapture allow-delete
                    :modelValue="combo"
                    @update:modelValue="onSoundHotkeyChange(soundKey, $event)"
                  />
                </div>
              </div>
            </template>
            <p v-else class="text-xs text-text-dim">No per-sound keybinds assigned yet.</p>
          </div>
        </div>

        <!-- ── APPEARANCE tab ── -->
        <div v-else-if="activeTab === 'appearance'" class="space-y-6">
          <SettingRow label="Theme">
            <AppSelect
              class="min-w-35"
              :modelValue="settings.theme"
              :options="[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }]"
              @update:modelValue="setTheme"
            />
          </SettingRow>

          <div>
            <div class="text-sm text-text-secondary mb-3">Accent color</div>
            <ColorPalette
              :modelValue="settings.accentColor"
              :defaultValue="DEFAULT_ACCENT"
              @update:modelValue="setAccentColor"
            />
            <button
              v-if="settings.accentColor && settings.accentColor !== DEFAULT_ACCENT"
              class="mt-3 text-xs text-text-dim hover:text-text-secondary cursor-pointer transition-colors"
              @click="clearAccentColor"
            >Reset to default</button>
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
            <p class="text-xs text-text-secondary mt-1">
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
          <div class="bg-bg-surface-hover border border-border-light p-3 mb-4">
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
              class="flex flex-col gap-[5px] py-2 border-b border-border-light last:border-b-0"
            >
              <div class="flex items-center gap-2">
                <ToggleSwitch
                  :modelValue="device.enabled"
                  @update:modelValue="(val) => onDeviceEnabled(idx, val)"
                />
                <AppSelect
                  class="flex-1 min-w-0"
                  :modelValue="deviceSelectedIds[idx]"
                  :options="availableDevicesFor(idx).map(d => ({ value: d.deviceId, label: cleanDeviceLabel(d.label || `Device ${d.deviceId.slice(0, 8)}`) }))"
                  @update:modelValue="v => onDeviceSelectChange(idx, v)"
                />
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
            <button class="btn flex items-center gap-1.5" :disabled="!canAddDevice" :class="{ 'opacity-40 cursor-default': !canAddDevice }" @click="addDevice"><Icon name="plus" /> Add Device</button>
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
              class="text-xs text-text-secondary"
              :class="{ 'text-danger!': pluginState === 'error' }"
            >
              <template v-if="pluginState === 'error'">{{ pluginErrorMessage }}</template>
              <template v-else-if="pluginState === 'restarting'">{{ pluginRestartingStreamDeck ? '' : 'Please restart your Stream Deck.' }}</template>
              <template v-else-if="!['not-installed', 'installing', 'checking'].includes(pluginState)">v{{ pluginInstalledVersion }}</template>
            </span>
          </div>

          <hr class="border-border-light" />

          <div class="space-y-3">
            <SettingRow label="Grid Mode" description="Show sounds as a grid in the Stream Deck Plugin">
              <ToggleSwitch :modelValue="settings.streamDeckButtonMode" @update:modelValue="setStreamDeckButtonMode" />
            </SettingRow>

            <div class="mt-4">
              <h3 class="text-sm text-text-primary mb-1">Default Icons</h3>
              <p class="text-xs text-text-secondary mb-3">Override the icons for all Stream Deck buttons. Category icons always take priority when set and enabled.</p>
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
