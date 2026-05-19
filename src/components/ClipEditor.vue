<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useSettings } from '../composables/useSettings'
import { useClipLibrary, type ClipFile } from '../composables/useClipLibrary'
import { useClipPlayer } from '../composables/useClipPlayer'
import { clipEditorOpen, clipEditStates, trimSidebarFile, type ClipEditState } from '../clipEditorState'
import { showToast } from '../toastState'
import WaveformCanvas from './WaveformCanvas.vue'
import ClipPlaybackControls from './ClipPlaybackControls.vue'
import Icon from './Icon.vue'
import Tooltip from './Tooltip.vue'
import AppSelect from './AppSelect.vue'

const { settings, soundGroups, loadSounds } = useSettings()
const lib = useClipLibrary()

const normalizeRef = computed(() => settings.value.normalize)
const masterVolumeRef = computed(() => settings.value.masterVolume ?? 1)
const {
  isLoading, isPlaying, duration, inPoint, outPoint, currentTime, loop,
  peaks, hasSelection, loadFile, play, pause, stop, seek, setIn, setOut, resetTrim, exportTrimmed, cleanup,
} = useClipPlayer(normalizeRef, masterVolumeRef)

// ── Per-clip state helpers ─────────────────────────────────────────────────────

function saveCurrentClipState() {
  const clip = lib.selectedClip.value
  if (!clip) return
  if (peaks.value.length === 0) return
  clipEditStates.set(clip.path, {
    filename: exportFilename.value,
    exportFolder: exportFolder.value,
    deleteAfterExport: deleteAfterExport.value,
    inPoint: inPoint.value,
    outPoint: outPoint.value,
    hasSelection: hasSelection.value,
  })
}

async function loadFileAndRestoreState(clip: ClipFile) {
  await loadFile(clip.path)
  const saved = clipEditStates.get(clip.path)
  if (saved) {
    exportFilename.value = saved.filename
    exportFolder.value = saved.exportFolder
    deleteAfterExport.value = saved.deleteAfterExport
    if (saved.hasSelection) {
      setIn(saved.inPoint)
      setOut(saved.outPoint)
    }
  } else {
    exportFilename.value = clip.filename.replace(/\.wav$/i, '')
  }
}

// ── Sort ─────────────────────────────────────────────────────────────────────

type ClipSort = 'newest' | 'oldest' | 'alpha' | 'alpha-desc'
const clipSort = ref<ClipSort>('newest')
const sortOptions = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'alpha', label: 'A → Z' },
  { value: 'alpha-desc', label: 'Z → A' },
]
const sortedClips = computed(() => {
  const arr = [...lib.clips.value]
  switch (clipSort.value) {
    case 'oldest':     return arr.sort((a, b) => a.mtime - b.mtime)
    case 'alpha':      return arr.sort((a, b) => a.filename.localeCompare(b.filename))
    case 'alpha-desc': return arr.sort((a, b) => b.filename.localeCompare(a.filename))
    default:           return arr.sort((a, b) => b.mtime - a.mtime)
  }
})

// ── File list & selection ─────────────────────────────────────────────────────

async function selectClip(clip: ClipFile) {
  confirmingClipPath.value = null
  saveCurrentClipState()
  stop()
  lib.selectClip(clip)
  await loadFileAndRestoreState(clip)
}

onMounted(async () => {
  await lib.refresh()
  if (sortedClips.value.length > 0) {
    const fromSidebar = trimSidebarFile.value
      ? sortedClips.value.find(c => c.path === trimSidebarFile.value)
      : undefined
    await selectClip(fromSidebar ?? sortedClips.value[0])
  }
  document.addEventListener('keydown', onKey)
})
onUnmounted(() => {
  document.removeEventListener('keydown', onKey)
  saveCurrentClipState()
  cleanup()
})

// ── Filename input focus tracking ─────────────────────────────────────────────

const filenameFocused = ref(false)

// ── Inline list delete ────────────────────────────────────────────────────────

const confirmingClipPath = ref<string | null>(null)

async function doListDelete(clip: ClipFile) {
  const wasSelected = lib.selectedClip.value?.path === clip.path
  confirmingClipPath.value = null
  clipEditStates.delete(clip.path)
  const ok = await lib.deleteClip(clip)
  if (!ok) {
    showToast('Could not move file to Recycle Bin')
  } else if (wasSelected) {
    const next = lib.selectedClip.value
    if (next) await loadFileAndRestoreState(next)
    else { stop(); peaks.value = []; duration.value = 0 }
  }
}

// ── Export ────────────────────────────────────────────────────────────────────

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

const canExport = computed(() =>
  !!exportFolder.value && !!exportFilename.value.trim() && peaks.value.length > 0 && !isExporting.value && hasSelection.value
)

async function doExport() {
  if (!canExport.value) return
  isExporting.value = true
  try {
    const result = await exportTrimmed(exportFolder.value, exportFilename.value.trim())
    if (result.success) {
      showToast(`Exported: ${result.filename}`, 'info')
      const clip = lib.selectedClip.value
      if (deleteAfterExport.value && clip) {
        clipEditStates.delete(clip.path)
        await lib.deleteClip(clip)
        await loadSounds()
        const next = lib.selectedClip.value
        if (next) await loadFileAndRestoreState(next)
        else { stop(); peaks.value = []; duration.value = 0 }
      } else {
        // Clear state so the next interaction starts fresh
        if (clip) clipEditStates.delete(clip.path)
        await loadSounds()
        resetTrim()
        if (clip) exportFilename.value = clip.filename.replace(/\.wav$/i, '')
      }
    } else {
      showToast(`Export failed: ${result.error}`)
    }
  } finally {
    isExporting.value = false
  }
}

// ── Reset ─────────────────────────────────────────────────────────────────────

function resetClipState() {
  const clip = lib.selectedClip.value
  if (!clip) return
  clipEditStates.delete(clip.path)
  resetTrim()
  exportFilename.value = clip.filename.replace(/\.wav$/i, '')
}

// ── Seek helper ───────────────────────────────────────────────────────────────

function seekToInPoint() { stop(); seek(inPoint.value) }

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) return '0.00s'
  const m = Math.floor(s / 60)
  const sec = (s % 60).toFixed(2)
  return m > 0 ? `${m}:${sec.padStart(5, '0')}` : `${sec}s`
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(mtime: number): string {
  const d = new Date(mtime)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const metaLabel = computed(() => {
  if (!lib.selectedClip.value) return ''
  return `${formatTime(duration.value)} · 48 kHz · 16-bit`
})

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (confirmingClipPath.value) { confirmingClipPath.value = null; return }
    close(); return
  }
  if (filenameFocused.value) return
  if (e.key === ' ') { e.preventDefault(); isPlaying.value ? stop() : play() }
}

function close() {
  stop()
  saveCurrentClipState()
  clipEditorOpen.value = false
}
</script>

<template>
  <div class="flex flex-col h-full bg-bg-base">

    <!-- ── Header ─────────────────────────────────────────────────────────── -->
    <div class="h-10 flex items-center gap-3 px-3 border-b border-border-light bg-bg-raised shrink-0">
      <Tooltip text="Back to Soundboard (Esc)">
        <button class="hdr-btn flex items-center gap-1.5" @click="close">
          <Icon name="backward-step-solid" class="text-[11px]" />
          <span class="text-xs font-medium">Soundboard</span>
        </button>
      </Tooltip>
      <div class="w-px h-4 bg-border-light shrink-0" />
      <span class="font-display text-sm tracking-wide text-accent-text uppercase">Clip Editor</span>
      <div class="flex-1" />
      <span class="text-xs text-text-secondary">{{ lib.clips.value.length }} clip{{ lib.clips.value.length !== 1 ? 's' : '' }}</span>
      <Tooltip text="Open clips folder">
        <button class="hdr-btn" @click="lib.revealFolder()">
          <Icon name="folder-open-rrr" class="text-sm" />
        </button>
      </Tooltip>
      <Tooltip text="Refresh">
        <button class="hdr-btn" @click="lib.refresh()">
          <Icon name="arrow-rotate-right-rrr" class="text-sm" />
        </button>
      </Tooltip>
    </div>

    <!-- ── Three-column layout ────────────────────────────────────────────── -->
    <div class="flex flex-1 min-h-0">

      <!-- Left panel: file list -->
      <div class="clip-list-panel flex flex-col">
        <div class="panel-heading flex items-center gap-2 pr-2">
          <span class="flex-1">Saved Clips</span>
          <span class="text-[10px] text-text-dim">Sort:</span>
          <AppSelect v-model="clipSort" :options="sortOptions" variant="ghost" />
        </div>
        <div class="flex-1 overflow-y-auto">
          <div v-if="lib.isLoading.value" class="px-3 py-4 text-xs text-text-dim">Loading…</div>
          <div v-else-if="lib.clips.value.length === 0" class="px-3 py-4 text-xs text-text-dim">
            No clips yet. Save one using the <span class="text-accent-text">Clip</span> button.
          </div>
          <div
            v-for="clip in sortedClips"
            :key="clip.path"
            role="button"
            tabindex="0"
            class="clip-row"
            :class="{ 'clip-row--active': lib.selectedClip.value?.path === clip.path }"
            @click="confirmingClipPath !== clip.path && selectClip(clip)"
            @keydown.enter.prevent="confirmingClipPath !== clip.path && selectClip(clip)"
          >
            <template v-if="confirmingClipPath === clip.path">
              <div class="clip-confirm">
                <span class="clip-confirm-text">Move to Recycle Bin?</span>
                <div class="clip-confirm-actions">
                  <button class="clip-confirm-cancel" @click.stop="confirmingClipPath = null">Cancel</button>
                  <button class="clip-confirm-delete" @click.stop="doListDelete(clip)">Delete</button>
                </div>
              </div>
            </template>
            <template v-else>
              <span class="clip-filename">{{ clip.filename }}</span>
              <div class="flex items-center justify-between">
                <span class="clip-meta">{{ formatSize(clip.size) }}</span>
                <span class="clip-meta">{{ formatDate(clip.mtime) }}</span>
              </div>
              <button class="clip-delete-btn" tabindex="-1" @click.stop="confirmingClipPath = clip.path">
                <Icon name="xmark-solid" class="text-[9px]" />
              </button>
            </template>
          </div>
        </div>
      </div>

      <!-- Center panel: waveform + controls -->
      <div class="flex flex-1 min-w-0 flex-col border-l border-r border-border-light">

        <!-- Clip title -->
        <div class="px-4 py-2.5 border-b border-border-light shrink-0 bg-bg-raised">
          <div v-if="lib.selectedClip.value" class="flex items-baseline gap-3">
            <span class="font-display text-base text-text-primary truncate">{{ lib.selectedClip.value.filename }}</span>
            <span class="text-xs text-text-secondary shrink-0">{{ metaLabel }}</span>
          </div>
          <div v-else class="text-sm text-text-dim">Select a clip from the list</div>
        </div>

        <!-- Waveform area -->
        <div class="flex-1 min-h-0 p-4">
          <div v-if="isLoading" class="h-full flex items-center justify-center text-sm text-text-dim">
            Loading…
          </div>
          <div v-else-if="peaks.length === 0" class="h-full flex items-center justify-center text-sm text-text-dim">
            {{ lib.selectedClip.value ? 'No audio data' : 'Select a clip' }}
          </div>
          <WaveformCanvas
            v-else
            :peaks="peaks" :duration="duration"
            :inPoint="inPoint" :outPoint="outPoint"
            :currentTime="currentTime" :isPlaying="isPlaying"
            :accentColor="settings.accentColor"
            class="h-full w-full"
            @seek="seek" @setIn="setIn" @setOut="setOut"
          />
        </div>

        <!-- Playback controls + time display -->
        <ClipPlaybackControls
          :isPlaying="isPlaying"
          :loop="loop"
          :hasAudio="peaks.length > 0"
          :inPoint="inPoint"
          :outPoint="outPoint"
          :disabled="filenameFocused"
          @play="play"
          @pause="pause"
          @stop="stop"
          @seekToIn="seekToInPoint"
          @update:loop="val => loop = val"
          @reset="resetClipState"
        />
      </div>

      <!-- Right panel: export -->
      <div class="export-panel flex flex-col">
        <div class="panel-heading">Export</div>

        <div class="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-4">

          <div class="export-group">
            <label class="export-label">Save to Category</label>
            <AppSelect
              v-if="categoryOptions.length > 0"
              v-model="exportFolder"
              :options="categoryOptions"
            />
            <div v-else class="text-xs text-text-dim">No soundboard loaded</div>
          </div>

          <div class="export-group">
            <label class="export-label">Filename</label>
            <input
              v-model="exportFilename"
              class="export-input"
              placeholder="clip-name"
              spellcheck="false"
              @focus="filenameFocused = true"
              @blur="filenameFocused = false"
            />
            <span class="text-[11px] text-text-secondary">.wav</span>
          </div>

          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" v-model="deleteAfterExport" class="hidden" />
            <div class="checkbox-box" :class="{ checked: deleteAfterExport }">
              <Icon v-if="deleteAfterExport" name="xmark-solid" class="text-[9px]" />
            </div>
            <span class="text-xs text-text-secondary">Delete original after export</span>
          </label>

          <div v-if="!hasSelection && peaks.length > 0" class="text-[10px] text-text-dim leading-relaxed">
            Drag on the waveform to select a region, then export.
          </div>

        </div>

        <!-- Export button -->
        <div class="p-3 border-t border-border-light shrink-0">
          <button
            class="btn btn-accent w-full"
            :disabled="!canExport"
            @click="doExport"
          >
            {{ isExporting ? 'Exporting…' : 'Export Clip' }}
          </button>
        </div>

      </div>
    </div>
  </div>

</template>

<style scoped>
/* ── Left panel ────────────────────────────────────────────────────────────── */
.clip-list-panel {
  width: 234px;
  flex-shrink: 0;
  background: var(--color-bg-base);
  border-right: 1px solid var(--color-border-light);
}

.panel-heading {
  padding: 8px 12px;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
  border-bottom: 1px solid var(--color-border-light);
  background: var(--color-bg-raised);
}

.clip-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  min-height: 50px;
  padding: 7px 12px;
  padding-right: 28px;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--color-border);
  text-align: left;
  cursor: pointer;
  transition: background 0.1s;
  position: relative;
  outline: none;
  user-select: none;
}
.clip-row::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--color-accent);
  transform: scaleY(0);
  transition: transform 0.1s;
}
.clip-row:hover { background: var(--color-bg-surface); }
.clip-row:hover::before { transform: scaleY(1); }
.clip-row--active { background: var(--color-bg-surface); }
.clip-row--active::before { transform: scaleY(1); }

.clip-filename {
  font-size: 12px;
  font-family: var(--font-mono);
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.clip-meta {
  font-size: 11px;
  color: var(--color-text-secondary);
}

/* ── Right panel ────────────────────────────────────────────────────────────── */
.export-panel {
  width: 220px;
  flex-shrink: 0;
  background: var(--color-bg-base);
}

/* ── Header buttons ─────────────────────────────────────────────────────────── */
.hdr-btn {
  height: 28px;
  padding: 0 8px;
  display: flex;
  align-items: center;
  background: transparent;
  border: none;
  color: var(--color-text-dim);
  cursor: pointer;
  font-size: 12px;
  transition: color 0.1s, background 0.1s;
  border-radius: 2px;
}
.hdr-btn:hover {
  color: var(--color-text-primary);
  background: var(--color-bg-surface);
}

/* ── Export form ────────────────────────────────────────────────────────────── */
.export-group { display: flex; flex-direction: column; gap: 5px; }
.export-label {
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.12em;
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

button[disabled] {
  opacity: 0.4;
  pointer-events: none;
}

/* ── Inline list delete ─────────────────────────────────────────────────────── */
.clip-delete-btn {
  position: absolute;
  top: 50%;
  right: 6px;
  transform: translateY(-50%);
  opacity: 0;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--color-text-dim);
  cursor: pointer;
  transition: opacity 0.1s, color 0.1s;
  padding: 0;
}
.clip-row:hover .clip-delete-btn { opacity: 1; }
.clip-delete-btn:hover { color: var(--color-danger); }

.clip-confirm {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0;
}
.clip-confirm-text {
  font-size: 10px;
  color: var(--color-text-secondary);
  line-height: 1.3;
}
.clip-confirm-actions {
  display: flex;
  gap: 4px;
}
.clip-confirm-cancel,
.clip-confirm-delete {
  flex: 1;
  padding: 2px 6px;
  font-size: 10px;
  font-weight: 300;
  font-family: var(--font-sans);
  border: 1px solid var(--color-border-light);
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
}
.clip-confirm-cancel {
  background: var(--color-bg-surface);
  color: var(--color-text-secondary);
}
.clip-confirm-cancel:hover { background: var(--color-bg-surface-hover); color: var(--color-text-primary); }
.clip-confirm-delete {
  background: rgba(255, 80, 64, 0.08);
  color: var(--color-danger);
  border-color: rgba(255, 80, 64, 0.25);
}
.clip-confirm-delete:hover { background: rgba(255, 80, 64, 0.15); }
</style>
