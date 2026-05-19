<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useSettings } from '../composables/useSettings'
import { useClipPlayer } from '../composables/useClipPlayer'
import { trimSidebarOpen, trimSidebarFile, clipEditStates } from '../clipEditorState'
import { showToast } from '../toastState'
import WaveformCanvas from './WaveformCanvas.vue'
import ClipPlaybackControls from './ClipPlaybackControls.vue'
import Icon from './Icon.vue'
import Tooltip from './Tooltip.vue'
import AppSelect from './AppSelect.vue'

const { settings, soundGroups, loadSounds } = useSettings()

const normalizeRef = computed(() => settings.value.normalize)
const masterVolumeRef = computed(() => settings.value.masterVolume ?? 1)
const {
  isLoading, isPlaying, duration, inPoint, outPoint, currentTime, loop,
  peaks, hasSelection, loadFile, play, pause, stop, seek, setIn, setOut, resetTrim, exportTrimmed, cleanup,
} = useClipPlayer(normalizeRef, masterVolumeRef)

function seekToInPoint() { stop(); seek(inPoint.value) }

// ── File identity ─────────────────────────────────────────────────────────────

const currentPath = ref<string | null>(null)
const displayName = computed(() => currentPath.value?.split(/[\\/]/).pop() ?? '')

watch(trimSidebarFile, async (path) => {
  if (path && path !== currentPath.value) {
    currentPath.value = path
    await loadFile(path)
  }
}, { immediate: true })

// ── Export state ──────────────────────────────────────────────────────────────

const exportFolder = ref('')
const exportFilename = ref('')
const deleteAfterExport = ref(false)
const isExporting = ref(false)

const categoryOptions = computed(() => {
  const renames = settings.value.sectionRenames || {}
  const colors = settings.value.categoryColors || {}
  const categoryOrder = settings.value.categoryOrder || []
  const hidden = new Set(settings.value.hiddenCategories || [])
  const groups = soundGroups.value.filter(g => !hidden.has(g.folderName))
  if (categoryOrder.length > 0) {
    const indexMap = new Map(categoryOrder.map((id, i) => [id, i]))
    groups.sort((a, b) => {
      const ia = indexMap.has(a.folderName) ? indexMap.get(a.folderName)! : Infinity
      const ib = indexMap.has(b.folderName) ? indexMap.get(b.folderName)! : Infinity
      return ia - ib
    })
  }
  return groups.map(g => ({
    value: g.folderPath,
    label: renames[g.folderName] ?? g.folderName,
    color: colors[g.folderName] || undefined,
  }))
})

watch(categoryOptions, (opts) => {
  if (opts.length > 0) {
    const valid = opts.some(o => o.value === exportFolder.value)
    if (!valid) exportFolder.value = opts[0].value
  } else {
    exportFolder.value = ''
  }
}, { immediate: true })

watch(displayName, (name) => {
  if (name) exportFilename.value = name.replace(/\.wav$/i, '')
})

// ── Export ────────────────────────────────────────────────────────────────────

async function doExport() {
  if (!currentPath.value || !exportFolder.value || !exportFilename.value.trim()) return
  isExporting.value = true
  try {
    const result = await exportTrimmed(exportFolder.value, exportFilename.value.trim())
    if (result.success) {
      showToast(`Exported: ${result.filename}`, 'info')
      await loadSounds()
      if (deleteAfterExport.value && currentPath.value) {
        await window.api.trashClipFile(currentPath.value)
      }
      trimSidebarOpen.value = false
    } else {
      showToast(`Export failed: ${result.error}`)
    }
  } finally {
    isExporting.value = false
  }
}

function saveStateToMap() {
  if (!currentPath.value || peaks.value.length === 0) return
  clipEditStates.set(currentPath.value, {
    filename: exportFilename.value,
    exportFolder: exportFolder.value,
    deleteAfterExport: deleteAfterExport.value,
    inPoint: inPoint.value,
    outPoint: outPoint.value,
    hasSelection: hasSelection.value,
  })
}

function close() {
  stop()
  trimSidebarOpen.value = false
  trimSidebarFile.value = null
}

onMounted(() => {
  document.addEventListener('keydown', onKey)
})
onUnmounted(() => {
  document.removeEventListener('keydown', onKey)
  saveStateToMap()
  cleanup()
})

function onKey(e: KeyboardEvent) {
  if (!trimSidebarOpen.value) return
  if (e.key === 'Escape') { close(); return }
  if (e.key === ' ') { e.preventDefault(); isPlaying.value ? stop() : play() }
}
</script>

<template>
  <div class="clip-sidebar">

    <!-- Header -->
    <div class="flex items-center gap-2 px-3 h-10 border-b border-border-light shrink-0 bg-bg-surface-active">
      <span class="text-[9px] font-medium tracking-[0.14em] uppercase text-accent-text shrink-0">Clip</span>
      <span class="text-xs text-text-secondary truncate flex-1 font-mono">{{ displayName }}</span>
      <div class="flex items-center gap-1 shrink-0">
        <Tooltip text="Close (Esc)">
          <button class="sidebar-icon-btn" @click="close">
            <Icon name="xmark-solid" />
          </button>
        </Tooltip>
      </div>
    </div>

    <!-- Waveform -->
    <div class="waveform-area shrink-0">
      <div v-if="isLoading" class="flex items-center justify-center h-full text-xs text-text-dim">
        Loading…
      </div>
      <WaveformCanvas
        v-else-if="peaks.length > 0"
        :peaks="peaks" :duration="duration"
        :inPoint="inPoint" :outPoint="outPoint"
        :currentTime="currentTime" :isPlaying="isPlaying"
        :accentColor="settings.accentColor"
        class="h-full w-full"
        @seek="seek" @setIn="setIn" @setOut="setOut"
      />
      <div v-else class="flex items-center justify-center h-full text-xs text-text-dim">
        No audio loaded
      </div>
    </div>

    <!-- Controls + time display -->
    <ClipPlaybackControls
      :compact="true"
      :isPlaying="isPlaying"
      :loop="loop"
      :hasAudio="peaks.length > 0"
      :inPoint="inPoint"
      :outPoint="outPoint"
      @play="play"
      @pause="pause"
      @stop="stop"
      @seekToIn="seekToInPoint"
      @update:loop="val => loop = val"
      @reset="resetTrim"
    />

    <!-- Export section (scrollable) -->
    <div class="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3">

      <div class="export-group">
        <label class="export-label">Save to</label>
        <AppSelect
          v-if="categoryOptions.length > 0"
          v-model="exportFolder"
          :options="categoryOptions"
        />
        <div v-else class="text-xs text-text-dim">No soundboard folders — add one in Settings</div>
      </div>

      <div class="export-group">
        <label class="export-label">Filename</label>
        <input
          v-model="exportFilename"
          class="export-input"
          placeholder="clip-name"
          spellcheck="false"
        />
      </div>

      <label class="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" v-model="deleteAfterExport" class="hidden" />
        <div class="checkbox-box" :class="{ checked: deleteAfterExport }">
          <Icon v-if="deleteAfterExport" name="xmark-solid" class="text-[9px]" />
        </div>
        <span class="text-xs text-text-secondary">Delete original after export</span>
      </label>
    </div>

    <!-- Footer: Export button -->
    <div class="shrink-0 p-3 border-t border-border-light">
      <button
        class="btn btn-accent w-full text-sm"
        :disabled="!exportFolder || !exportFilename.trim() || isExporting || peaks.length === 0"
        @click="doExport"
      >
        {{ isExporting ? 'Exporting…' : 'Export Clip' }}
      </button>
    </div>

  </div>
</template>

<style scoped>
.clip-sidebar {
  width: 320px;
  flex-shrink: 0;
  height: 100%;
  background: var(--color-bg-raised);
  border-left: 1px solid var(--color-border-light);
  display: flex;
  flex-direction: column;
}

.trim-sidebar-enter-active,
.trim-sidebar-leave-active {
  transition: width 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}
.trim-sidebar-enter-from,
.trim-sidebar-leave-to {
  width: 0 !important;
}

.waveform-area {
  height: 130px;
  background: var(--color-bg-raised);
  border-bottom: 1px solid var(--color-border-light);
}

/* Icon buttons in header */
.sidebar-icon-btn {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--color-text-dim);
  cursor: pointer;
  border-radius: 3px;
  font-size: 13px;
  transition: color 0.1s, background 0.1s;
}
.sidebar-icon-btn:hover {
  color: var(--color-text-primary);
  background: var(--color-bg-surface);
}

/* Export form */
.export-group { display: flex; flex-direction: column; gap: 5px; }
.export-label {
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
}
.export-input {
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 300;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-light);
  color: var(--color-text-primary);
  padding: 5px 8px;
  outline: none;
  width: 100%;
  letter-spacing: 0.02em;
}
.export-input:focus { border-color: var(--color-accent); }
.export-input::placeholder { color: var(--color-text-dim); }

/* Checkbox */
.checkbox-box {
  width: 14px;
  height: 14px;
  border: 1px solid var(--color-border-light);
  background: var(--color-bg-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--color-accent);
  transition: border-color 0.1s;
}
.checkbox-box.checked {
  border-color: var(--color-accent);
  background: var(--color-accent-glow);
}

/* Disabled export button */
button[disabled] {
  opacity: 0.4;
  pointer-events: none;
}
</style>
