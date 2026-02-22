<script setup>
import { ref, watch } from 'vue'
import { useSettings } from '../composables/useSettings.js'
import { settingsModalOpen } from '../modalState.js'

const { settings, saveSettings } = useSettings()

const localColumns = ref(4)
const localHotkey = ref('Escape')

// Sync local state when modal opens
watch(settingsModalOpen, (open) => {
  if (open) {
    localColumns.value = settings.value.columns || 4
    localHotkey.value = settings.value.stopHotkey || 'Escape'
  }
})

async function handleSave() {
  settings.value.columns = localColumns.value
  settings.value.stopHotkey = localHotkey.value
  await saveSettings({ columns: localColumns.value, stopHotkey: localHotkey.value })
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

        <!-- Grid Columns -->
        <div class="mb-4">
          <label class="block text-xs font-semibold uppercase tracking-wider text-text-dim mb-1.5">
            Grid Columns
          </label>
          <input
            type="number"
            class="modal-input"
            min="1"
            max="10"
            v-model.number="localColumns"
          />
        </div>

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

        <!-- Actions -->
        <div class="flex justify-end gap-2 mt-6">
          <button class="btn" @click="settingsModalOpen = false">Cancel</button>
          <button class="btn btn-accent" @click="handleSave">Save</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
