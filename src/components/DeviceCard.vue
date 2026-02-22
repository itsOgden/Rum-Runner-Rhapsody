<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useSettings } from '../composables/useSettings.js'
import { useAudioDevices } from '../composables/useAudioDevices.js'

const props = defineProps({
  role: { type: String, required: true },
})

const { settings, saveSettings } = useSettings()
const { audioDevices, findMatchingDeviceId, cleanDeviceLabel, getDeviceLabel } = useAudioDevices()

const label = computed(() =>
  props.role === 'primary' ? '\u{1F3A7} Primary \u2014 Headphones' : '\u{1F50A} Secondary \u2014 VB-Cable'
)

const deviceKey = computed(() => `${props.role}Device`)
const volumeKey = computed(() => `${props.role}Volume`)
const enabledKey = computed(() => `${props.role}Enabled`)

const selectedDeviceId = ref('')
const volumePercent = ref(100)
const enabled = ref(true)

// Sync from settings when they change (e.g. folder switch)
watch(() => settings.value[deviceKey.value], () => {
  selectedDeviceId.value = findMatchingDeviceId(settings.value[deviceKey.value])
}, { immediate: true })

watch(() => settings.value[volumeKey.value], (v) => {
  volumePercent.value = Math.round(v * 100)
}, { immediate: true })

watch(() => settings.value[enabledKey.value], (v) => {
  enabled.value = v
}, { immediate: true })

// Also re-match when devices list changes
watch(audioDevices, () => {
  selectedDeviceId.value = findMatchingDeviceId(settings.value[deviceKey.value])
})

let saveTimeout = null
function debouncedSave() {
  clearTimeout(saveTimeout)
  saveTimeout = setTimeout(() => {
    saveSettings({
      [deviceKey.value]: getDeviceLabel(selectedDeviceId.value),
      [volumeKey.value]: volumePercent.value / 100,
      [enabledKey.value]: enabled.value,
    })
  }, 200)
}

function onDeviceChange() {
  settings.value[deviceKey.value] = getDeviceLabel(selectedDeviceId.value)
  debouncedSave()
}

function onVolumeInput() {
  settings.value[volumeKey.value] = volumePercent.value / 100
}

function onVolumeChange() {
  settings.value[volumeKey.value] = volumePercent.value / 100
  debouncedSave()
}

function onEnabledChange() {
  settings.value[enabledKey.value] = enabled.value
  debouncedSave()
}
</script>

<template>
  <div class="flex-1 bg-bg-raised border border-border rounded-md p-3.5">
    <!-- Header -->
    <div class="flex items-center justify-between mb-2.5">
      <span class="text-[11px] font-semibold tracking-[1.5px] uppercase text-text-dim">{{ label }}</span>
      <label class="toggle">
        <input type="checkbox" v-model="enabled" @change="onEnabledChange" />
        <span class="toggle-track"></span>
        <span class="toggle-thumb"></span>
      </label>
    </div>

    <!-- Device select -->
    <select class="device-select" v-model="selectedDeviceId" @change="onDeviceChange">
      <option
        v-for="d in audioDevices"
        :key="d.deviceId"
        :value="d.deviceId"
      >
        {{ cleanDeviceLabel(d.label || `Device ${d.deviceId.slice(0, 8)}`) }}
      </option>
    </select>

    <!-- Volume -->
    <div class="flex items-center gap-2.5 mt-2.5">
      <span class="font-mono text-[11px] text-text-dim min-w-[30px]">VOL</span>
      <input
        type="range"
        min="0"
        max="100"
        v-model.number="volumePercent"
        @input="onVolumeInput"
        @change="onVolumeChange"
      />
      <span class="font-mono text-[11px] text-text-secondary min-w-[36px] text-right">{{ volumePercent }}%</span>
    </div>
  </div>
</template>
