<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useSettings } from '../composables/useSettings'
import { useAudioDevices } from '../composables/useAudioDevices'
import { showToast } from '../toastState'

const props = defineProps<{
  role: 'primary' | 'secondary'
}>()

const { settings, saveSettings } = useSettings()
const { audioDevices, findMatchingDeviceId, cleanDeviceLabel, getDeviceLabel } = useAudioDevices()

const label = computed(() =>
  props.role === 'primary' ? 'Monitor' : 'Output'
)

const deviceKey = computed((): 'primaryDevice' | 'secondaryDevice' =>
  props.role === 'primary' ? 'primaryDevice' : 'secondaryDevice'
)
const volumeKey = computed((): 'primaryVolume' | 'secondaryVolume' =>
  props.role === 'primary' ? 'primaryVolume' : 'secondaryVolume'
)
const enabledKey = computed((): 'primaryEnabled' | 'secondaryEnabled' =>
  props.role === 'primary' ? 'primaryEnabled' : 'secondaryEnabled'
)
const fallbackIndex = computed(() => props.role === 'primary' ? 0 : 1)

const selectedDeviceId = ref('')
const volumePercent = ref(100)
const enabled = ref(true)

// Sync from settings when they change (e.g. folder switch)
watch(() => settings.value[deviceKey.value], () => {
  selectedDeviceId.value = findMatchingDeviceId(settings.value[deviceKey.value], fallbackIndex.value)
}, { immediate: true })

watch(() => settings.value[volumeKey.value], (v) => {
  volumePercent.value = Math.round(v * 100)
}, { immediate: true })

watch(() => settings.value[enabledKey.value], (v) => {
  enabled.value = v
}, { immediate: true })

// Also re-match when devices list changes
watch(audioDevices, () => {
  selectedDeviceId.value = findMatchingDeviceId(settings.value[deviceKey.value], fallbackIndex.value)
})

let saveTimeout: ReturnType<typeof setTimeout> | null = null
function debouncedSave(): void {
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(() => {
    saveSettings({
      [deviceKey.value]: getDeviceLabel(selectedDeviceId.value),
      [volumeKey.value]: volumePercent.value / 100,
      [enabledKey.value]: enabled.value,
    })
  }, 200)
}

function onDeviceChange(): void {
  // Guard: prevent selecting the same device on both slots when alternatives exist.
  if (audioDevices.value.length > 1) {
    const otherRole = props.role === 'primary' ? 'secondary' : 'primary'
    const otherFallback = otherRole === 'primary' ? 0 : 1
    const otherDeviceKey: 'primaryDevice' | 'secondaryDevice' =
      otherRole === 'primary' ? 'primaryDevice' : 'secondaryDevice'
    const otherDeviceId = findMatchingDeviceId(settings.value[otherDeviceKey], otherFallback)
    if (selectedDeviceId.value === otherDeviceId) {
      const otherLabel = otherRole === 'primary' ? 'Monitor' : 'Output'
      showToast(`That device is already selected as the ${otherLabel} output. Choose a different device.`, 'info')
      // Revert — settings haven't been updated yet, so this restores the old selection
      selectedDeviceId.value = findMatchingDeviceId(settings.value[deviceKey.value], fallbackIndex.value)
      return
    }
  }
  settings.value[deviceKey.value] = getDeviceLabel(selectedDeviceId.value)
  debouncedSave()
}

function onVolumeInput(): void {
  settings.value[volumeKey.value] = volumePercent.value / 100
}

function onVolumeChange(): void {
  settings.value[volumeKey.value] = volumePercent.value / 100
  debouncedSave()
}

function onEnabledChange(): void {
  settings.value[enabledKey.value] = enabled.value
  debouncedSave()
}
</script>

<template>
  <div class="bg-bg-raised border border-border rounded-md px-3 pb-2 pt-1 w-full">
    <span class="text-[10px] font-semibold uppercase text-text-dim whitespace-nowrap mb-2">{{ label }}</span>
    <div class="flex items-center gap-3">
      <!-- Label + Toggle -->
      <label class="toggle">
        <input type="checkbox" v-model="enabled" @change="onEnabledChange" />
        <span class="toggle-track"></span>
        <span class="toggle-thumb"></span>
      </label>

      <!-- Divider -->
      <div class="w-px h-4 bg-border shrink-0"></div>

      <!-- Device select -->
      <div class="flex-1 min-w-0">
        <select class="device-select" v-model="selectedDeviceId" @change="onDeviceChange">
          <option
              v-for="d in audioDevices"
              :key="d.deviceId"
              :value="d.deviceId"
          >
            {{ cleanDeviceLabel(d.label || `Device ${d.deviceId.slice(0, 8)}`) }}
          </option>
        </select>
      </div>

      <!-- Volume -->
      <div class="flex items-center gap-2 shrink-0">
        <span class="font-mono text-[10px] text-text-dim">VOL</span>
        <input
            type="range"
            min="0"
            max="100"
            v-model.number="volumePercent"
            @input="onVolumeInput"
            @change="onVolumeChange"
            class="w-20"
        />
        <span class="font-mono text-[11px] text-text-secondary min-w-[36px] text-right">{{ volumePercent }}%</span>
      </div>
    </div>
  </div>
</template>
