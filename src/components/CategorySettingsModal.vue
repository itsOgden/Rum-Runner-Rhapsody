<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import BaseModal from './BaseModal.vue'
import ModalTabs from './ModalTabs.vue'
import ToggleSwitch from './ToggleSwitch.vue'
import Icon from './Icon.vue'
import StreamDeckImagePicker from './StreamDeckImagePicker.vue'
import { useSoundManagement } from '../composables/useSoundManagement'
import { useSettings } from '../composables/useSettings'
import { useStreamDeckImageErrors } from '../composables/useStreamDeckImageErrors'
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
const { brokenSources } = useStreamDeckImageErrors()

const pickerErrorCount = ref(0)
const hasStreamDeckErrors = computed(() =>
  pickerErrorCount.value > 0 || brokenSources.value.includes(props.section.displayName)
)

type Tab = 'general' | 'streamdeck'
const activeTab = ref<Tab>('general')

const tabs = computed(() => [
  { id: 'general',    label: 'General'     },
  { id: 'streamdeck', label: 'Stream Deck', badge: hasStreamDeckErrors.value },
] as Array<{ id: Tab; label: string; badge?: boolean }>)

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

function handleToggleHide(val: boolean): void {
  if (val) {
    hideSection(props.section.id)
  } else {
    unhideSection(props.section.id)
  }
}

function handleRestore(): void {
  restoreSection(props.section.id)
  editingName.value = props.section.id
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
  settings.value.categoryStreamDeckImages = map
  saveSettings({ categoryStreamDeckImages: map })
}

function onIdleImageChange(path: string | null): void {
  saveImages(path, path ? playingImagePath.value : null)
}

function onPlayingImageChange(path: string | null): void {
  saveImages(idleImagePath.value, path)
}
</script>

<template>
  <BaseModal :open="open" size="sm" :title="editingName || section.displayName" @close="handleClose">
    <div class="flex flex-1 min-h-0">

      <ModalTabs :tabs="tabs" v-model="activeTab" />

      <div class="flex-1 pt-5 px-6 pb-7 min-h-0 overflow-y-auto">

        <!-- ── GENERAL tab ── -->
        <div v-if="activeTab === 'general'" class="space-y-6">
          <div class="flex items-center justify-between gap-4">
            <div class="text-[13px] text-text-primary">Name</div>
            <input
              ref="nameInputEl"
              v-model="editingName"
              type="text"
              class="w-40 px-2 py-1.5 font-sans text-[12px] bg-bg-surface text-text-primary border border-border-light rounded-sm outline-none focus:border-accent"
              placeholder="Category name"
              @keydown.enter.prevent="handleClose"
              @keydown.escape.prevent="handleClose"
            />
          </div>

          <div class="space-y-1.5">
            <div class="flex items-center justify-between gap-4">
              <div class="text-[13px] text-text-primary">Hide</div>
              <ToggleSwitch :modelValue="section.isHidden" @update:modelValue="handleToggleHide" />
            </div>
            <p class="text-[12px] text-text-dim">Hidden categories are not shown in the sound list</p>
          </div>

          <template v-if="!section.isCustom">
            <hr class="border-border" />
            <div class="flex justify-end">
              <button class="btn" @click="handleRestore">Restore defaults</button>
            </div>
          </template>
        </div>

        <!-- ── STREAM DECK tab ── -->
        <div v-else-if="activeTab === 'streamdeck'" class="space-y-3">
          <div class="text-[13px] text-text-primary">Custom Icons</div>
          <p class="text-[12px] text-text-dim">Optional icons for this category's Stream Deck buttons.</p>
          <StreamDeckImagePicker
            :idle-path="idleImagePath"
            :playing-path="playingImagePath"
            :default-idle-path="null"
            :default-playing-path="null"
            @update:idle-path="onIdleImageChange"
            @update:playing-path="onPlayingImageChange"
            @errors="n => pickerErrorCount = n"
          />
        </div>

      </div>
    </div>

    <!-- Footer: destructive action (custom categories only) -->
    <div v-if="section.isCustom" class="flex justify-end shrink-0 px-5 py-3 border-t border-border">
      <button class="btn btn-danger" @click="handleDelete">Delete category</button>
    </div>

  </BaseModal>
</template>
