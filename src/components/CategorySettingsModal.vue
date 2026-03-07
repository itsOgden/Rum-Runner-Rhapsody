<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import BaseModal from './BaseModal.vue'
import StreamDeckImagePicker from './StreamDeckImagePicker.vue'
import { useSoundManagement } from '../composables/useSoundManagement'
import { useSettings } from '../composables/useSettings'
import type { SoundSection } from '../types'

const props = defineProps<{
  open: boolean
  section: SoundSection
}>()

const emit = defineEmits<{
  close: []
}>()

const { renameCategory, deleteCategory, hideSection, unhideSection, restoreSection } = useSoundManagement()
const { settings, saveSettings } = useSettings()

type Tab = 'general' | 'streamdeck'
const activeTab = ref<Tab>('general')
const tabs: { id: Tab; label: string }[] = [
  { id: 'general',    label: 'General'      },
  { id: 'streamdeck', label: 'Stream Deck'  },
]

// ── Rename ───────────────────────────────────────────────────────────────────

const editingName = ref('')
const nameInputEl = ref<HTMLInputElement | null>(null)

watch(() => props.open, (open) => {
  if (open) {
    editingName.value = props.section.displayName
    nextTick(() => nameInputEl.value?.select())
  }
})


function commitRename(): void {
  const trimmed = editingName.value.trim()
  if (trimmed && trimmed !== props.section.displayName) {
    renameCategory(props.section.id, trimmed)
  }
}

function handleClose(): void {
  commitRename()
  emit('close')
}

// ── Actions ──────────────────────────────────────────────────────────────────

function handleToggleHide(): void {
  if (props.section.isHidden) {
    unhideSection(props.section.id)
  } else {
    hideSection(props.section.id)
  }
}

function handleRestore(): void {
  restoreSection(props.section.id)
  editingName.value = props.section.id  // folder sections revert to their folder name (= section.id)
}

function handleDelete(): void {
  deleteCategory(props.section.id)
  emit('close')
}

// ── Stream Deck images ────────────────────────────────────────────────────────

const imageEntry = computed(() => {
  const map = settings.value.categoryStreamDeckImages || {}
  return map[props.section.id] || {}
})

const idleImagePath = computed(() => imageEntry.value.idle || null)
const playingImagePath = computed(() => imageEntry.value.playing || null)

function saveImages(idle: string | null, playing: string | null): void {
  // Spread each entry value individually to produce fully plain objects — the values
  // inside settings.value.categoryStreamDeckImages are reactive Proxies and cannot
  // be serialized by Electron IPC (Structured Clone), so a shallow top-level spread
  // is not enough.
  const map: Record<string, { idle?: string; playing?: string }> = {}
  for (const [k, v] of Object.entries(settings.value.categoryStreamDeckImages || {})) {
    map[k] = { ...v }
  }
  if (!idle && !playing) {
    delete map[props.section.id]
  } else {
    const entry: { idle?: string; playing?: string } = {}
    if (idle) entry.idle = idle
    if (playing) entry.playing = playing
    map[props.section.id] = entry
  }
  // Update local reactive state immediately so computed previews update without waiting for IPC round-trip
  settings.value.categoryStreamDeckImages = map
  saveSettings({ categoryStreamDeckImages: map })
}

function onIdleImageChange(path: string | null): void {
  // Clearing idle also clears playing (playing requires idle)
  saveImages(path, path ? playingImagePath.value : null)
}

function onPlayingImageChange(path: string | null): void {
  saveImages(idleImagePath.value, path)
}
</script>

<template>
  <BaseModal :open="open" :title="editingName || section.displayName" width="480px" @close="handleClose">

    <!-- ── Body: tab list + content ── -->
    <div class="flex">

      <!-- Tab list -->
      <nav class="tab-list">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="tab-btn"
          :class="{ 'tab-btn-active': activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </nav>

      <!-- Content -->
      <div class="tab-content">

        <!-- ── GENERAL tab ── -->
        <div v-if="activeTab === 'general'">
          <div class="settings-section">
            <div class="settings-row">
              <div class="settings-row-label">Name</div>
              <div class="settings-row-control">
                <input
                  ref="nameInputEl"
                  v-model="editingName"
                  type="text"
                  class="modal-input name-input"
                  placeholder="Category name"
                  @keydown.enter.prevent="handleClose"
                  @keydown.escape.prevent="handleClose"
                />
              </div>
            </div>
          </div>

          <div class="settings-section">
            <div class="settings-row">
              <div class="settings-row-label">Hide</div>
              <div class="settings-row-control">
                <label class="toggle">
                  <input type="checkbox" :checked="section.isHidden" @change="handleToggleHide" />
                  <span class="toggle-track"></span>
                  <span class="toggle-thumb"></span>
                </label>
              </div>
            </div>
            <p class="settings-description">Hidden categories are not shown in the sound list</p>
          </div>

          <div v-if="!section.isCustom" class="settings-section">
            <hr class="section-divider" />
            <div class="flex justify-end mt-3">
              <button class="btn" @click="handleRestore">Restore defaults</button>
            </div>
          </div>
        </div>

        <!-- ── STREAM DECK tab ── -->
        <div v-else-if="activeTab === 'streamdeck'">
          <div class="settings-section">
            <div class="settings-row-label">Custom Icons</div>
            <p class="settings-description mb-3">Optional icons for this category's Stream Deck buttons.</p>
            <StreamDeckImagePicker
              :idle-path="idleImagePath"
              :playing-path="playingImagePath"
              :default-idle-path="null"
              :default-playing-path="null"
              @update:idle-path="onIdleImageChange"
              @update:playing-path="onPlayingImageChange"
            />
          </div>
        </div>

      </div>
    </div>

    <!-- ── Footer: destructive action (custom categories only) ── -->
    <div v-if="section.isCustom" class="modal-footer flex justify-end">
      <button class="btn btn-danger" @click="handleDelete">Delete category</button>
    </div>

  </BaseModal>
</template>

<style scoped>
/* ---- Tab list (left panel) ---- */
.tab-list {
  width: 120px;
  flex-shrink: 0;
  background: var(--color-bg-surface);
  border-right: 1px solid var(--color-border);
  padding: 8px 0;
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
  min-height: 200px;
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
  margin-top: 6px;
}

/* ---- Footer ---- */
.modal-footer {
  padding: 12px 20px;
  border-top: 1px solid var(--color-border);
}

.section-divider {
  border: none;
  border-top: 1px solid var(--color-border);
  margin: 0;
}

/* ---- Name input ---- */
.modal-input {
  padding: 6px 10px 6px 8px;
  font-family: var(--font-sans);
  font-size: 12px;
  background: var(--color-bg-surface);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-sm);
  outline: none;
}
.modal-input:focus { border-color: var(--color-accent); }
.name-input { width: 160px; }

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
</style>
