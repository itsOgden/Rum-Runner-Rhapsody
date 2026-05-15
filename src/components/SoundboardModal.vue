<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import BaseModal from './BaseModal.vue'
import ModalTabs from './ModalTabs.vue'
import { useSettings } from '../composables/useSettings'
import { useSoundManagement } from '../composables/useSoundManagement'
import { filterQuery } from '../filterState'
import type { FolderRemoveResult } from '../types'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const { settings, saveSettings, loadSounds, onFolderChanged } = useSettings()
const { resetSessionState } = useSoundManagement()

const tabs = [{ id: 'general', label: 'General' }]
const activeTab = ref('general')

const currentPath = computed(() => settings.value.soundFolder)
const currentBasename = computed(() => {
  if (!currentPath.value) return ''
  return currentPath.value.split(/[\\/]/).filter(Boolean).pop() ?? currentPath.value
})

const editingName = ref('')
const nameInputEl = ref<HTMLInputElement | null>(null)
const showConfirm = ref(false)
const removing = ref(false)

watch(() => props.open, (open) => {
  if (open) {
    editingName.value = currentPath.value
      ? (settings.value.folderDisplayNames[currentPath.value] ?? '')
      : ''
    showConfirm.value = false
    nextTick(() => nameInputEl.value?.select())
  }
})

function commitRename(): void {
  if (!currentPath.value) return
  const newNames = { ...settings.value.folderDisplayNames }
  const trimmed = editingName.value.trim()
  if (trimmed) {
    newNames[currentPath.value] = trimmed
  } else {
    delete newNames[currentPath.value]
  }
  settings.value.folderDisplayNames = newNames
  saveSettings({ folderDisplayNames: newNames })
}

function handleClose(): void {
  commitRename()
  emit('close')
}


async function confirmRemove(): Promise<void> {
  if (!currentPath.value || removing.value) return
  removing.value = true
  try {
    const result: FolderRemoveResult = await window.api.removeFolder(currentPath.value)
    settings.value.savedFolders = result.savedFolders
    filterQuery.value = ''
    resetSessionState()
    if (result.switched) {
      await onFolderChanged(result.switched)
    } else {
      settings.value.soundFolder = ''
      Object.assign(settings.value, {
        hiddenSounds: [], hiddenCategories: [], sectionRenames: {}, customCategories: [],
        movedSounds: {}, collapsedCategories: [], soundNames: {}, soundOrder: {},
        categoryOrder: [], playCounts: {}, soundVolumes: {}, categoryStreamDeckImages: {},
      })
      await loadSounds()
    }
    emit('close')
  } finally {
    removing.value = false
    showConfirm.value = false
  }
}

const modalTitle = computed(() => {
  if (!currentPath.value) return 'No soundboard'
  const trimmed = editingName.value.trim()
  return trimmed || currentBasename.value
})
</script>

<template>
  <BaseModal :open="open" size="sm" :title="modalTitle" label="Soundboard" @close="handleClose">
    <div class="flex flex-1 min-h-0">

      <ModalTabs :tabs="tabs" v-model="activeTab" />

      <div class="flex-1 pt-5 px-6 pb-7 min-h-0 overflow-y-auto">

        <!-- ── GENERAL tab ── -->
        <div v-if="activeTab === 'general'" class="space-y-6">

          <!-- Name -->
          <div class="flex items-center justify-between gap-4">
            <div class="text-sm text-text-primary">Name</div>
            <input
              ref="nameInputEl"
              v-model="editingName"
              type="text"
              class="w-40 px-2 py-1.5 font-sans text-xs bg-bg-surface text-text-primary border border-border-light rounded-sm outline-none focus:border-accent focus:shadow-[0_0_6px_var(--color-accent-glow)] transition-all"
              :placeholder="currentBasename"
              @keydown.enter.prevent="handleClose"
              @keydown.escape.prevent="handleClose"
            />
          </div>

          <!-- Location -->
          <div class="space-y-1.5">
            <div class="text-sm text-text-primary">Location</div>
            <p class="text-xs text-text-secondary font-mono break-all leading-relaxed select-text">
              {{ currentPath || '—' }}
            </p>
          </div>

        </div>
      </div>
    </div>

    <!-- Footer: remove soundboard -->
    <div class="flex justify-end shrink-0 px-5 py-3 border-t border-border-light gap-3">
      <template v-if="!showConfirm">
        <button class="btn btn-danger" @click="showConfirm = true">Remove soundboard</button>
      </template>
      <template v-else>
        <span class="text-xs text-text-secondary self-center mr-auto">Files will not be deleted.</span>
        <button class="btn" @click="showConfirm = false">Cancel</button>
        <button class="btn btn-danger" :disabled="removing" @click="confirmRemove">
          {{ removing ? 'Removing…' : 'Remove' }}
        </button>
      </template>
    </div>

  </BaseModal>
</template>
