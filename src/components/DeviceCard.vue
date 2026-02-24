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

<style scoped>
/* ---- Toggle switch ---- */
.toggle { position: relative; width: 36px; height: 20px; cursor: pointer; }
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

/* ---- Select dropdown ---- */
.device-select {
  width: 100%;
  padding: 8px 10px;
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

/* ---- Volume slider ---- */
input[type="range"] {
  -webkit-appearance: none;
  flex: 1;
  height: 4px;
  background: var(--color-bg-surface);
  border-radius: 2px;
  outline: none;
}
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px; height: 16px;
  border-radius: 50%;
  background: var(--color-accent);
  cursor: pointer;
  box-shadow: 0 0 6px var(--color-accent-glow);
  transition: box-shadow 0.15s;
}
input[type="range"]::-webkit-slider-thumb:hover {
  box-shadow: 0 0 12px var(--color-accent-glow);
}
</style>
