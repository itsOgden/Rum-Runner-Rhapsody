<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import SoundButton from './SoundButton.vue'
import Icon from '@/components/Icon.vue'
import { useSoundManagement } from '../composables/useSoundManagement'
import { activeDropdownId } from '../dropdownState'
import { draggingSound, draggingSection } from '../dragState'
import type { SoundSection } from '../types'

const props = defineProps<{
  section: SoundSection
  density?: string
  filter?: string
}>()

const {
  renameCategory,
  deleteCategory,
  moveSound,
  isCollapsedSection,
  setCollapsedSection,
  restoreSection,
  hideSection,
  unhideSection,
  pendingRenameId,
  reorderSoundsInSection,
} = useSoundManagement()

// ── Collapse — initialize from persisted settings ──────────────────────────

const collapsed = ref(isCollapsedSection(props.section.id))

// Sections are re-keyed on folder change, so this watch handles edge cases.
watch(() => props.section.id, id => { collapsed.value = isCollapsedSection(id) })

const isCollapsed = computed(() => collapsed.value && !props.filter)

function toggleCollapse(): void {
  if (!props.filter) {
    collapsed.value = !collapsed.value
    setCollapsedSection(props.section.id, collapsed.value)
  }
}

// ── Visible sounds (search filter applied here) ────────────────────────────

const visibleSounds = computed(() => {
  if (!props.filter) return props.section.sounds
  const q = props.filter.toLowerCase()
  return props.section.sounds.filter(s => s.name.toLowerCase().includes(q))
})

// ── Header ⋯ menu ───────────────────────────────────────────────────────────

const headerDropdownId = `section-${Math.random().toString(36).slice(2)}`
const headerMenuOpen = ref(false)
const headerMenuPos = ref({ x: 0, y: 0 })

// Close when another dropdown opens
watch(activeDropdownId, (id) => {
  if (id !== headerDropdownId) headerMenuOpen.value = false
})

function openHeaderMenu(event: MouseEvent): void {
  event.stopPropagation()
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  headerMenuPos.value = { x: rect.right - 150, y: rect.bottom + 4 }
  activeDropdownId.value = headerDropdownId
  headerMenuOpen.value = true
  const close = () => {
    headerMenuOpen.value = false
    document.removeEventListener('click', close)
  }
  document.addEventListener('click', close)
}

// ── Inline rename ───────────────────────────────────────────────────────────

const isEditing = ref(false)
const editingName = ref('')
const renameInputEl = ref<HTMLInputElement | null>(null)

function startRename(): void {
  headerMenuOpen.value = false
  editingName.value = props.section.displayName
  isEditing.value = true
  nextTick(() => renameInputEl.value?.select())
}

function confirmRename(): void {
  if (editingName.value.trim()) renameCategory(props.section.id, editingName.value)
  isEditing.value = false
}

function cancelRename(): void {
  isEditing.value = false
}

// ── Section actions ─────────────────────────────────────────────────────────

function handleDelete(): void {
  headerMenuOpen.value = false
  deleteCategory(props.section.id)
}

function handleRestoreSection(): void {
  headerMenuOpen.value = false
  restoreSection(props.section.id)
}

function handleHideSection(): void {
  headerMenuOpen.value = false
  hideSection(props.section.id)
}

function handleUnhideSection(): void {
  headerMenuOpen.value = false
  unhideSection(props.section.id)
}

// ── Drag and drop ────────────────────────────────────────────────────────────

const isDropTarget = ref(false)
// Index within visibleSounds the cursor is over during a same-section drag
const dragOverSoundIndex = ref<number | null>(null)

// Section-level dragover: handles cross-section sound moves and category reorder.
// Same-section sound reorders are handled by the per-sound wrapper divs.
function onDragOver(event: DragEvent): void {
  if (draggingSection.value) {
    // Accept the drag so AccordionSection is a clear drop target; visual feedback
    // is handled by the SoundGrid wrapper outline, not by isDropTarget here.
    event.preventDefault()
    return
  }
  if (!draggingSound.value) return
  if (draggingSound.value.fromSectionId === props.section.id) return
  event.preventDefault()
  event.dataTransfer!.dropEffect = 'move'
  isDropTarget.value = true
}

function onDragLeave(event: DragEvent): void {
  if (!(event.currentTarget as Element).contains(event.relatedTarget as Node | null)) {
    isDropTarget.value = false
    dragOverSoundIndex.value = null
  }
}

function onDrop(event: DragEvent): void {
  event.preventDefault()
  // No stopPropagation — section-reorder drops must bubble up to SoundGrid's handler.
  isDropTarget.value = false
  const sound = draggingSound.value
  draggingSound.value = null
  if (!sound) return // Section drag — let the event bubble to SoundGrid's onSectionDrop

  if (sound.fromSectionId === props.section.id) {
    // Same-section: reorder if a valid target index was tracked
    const idx = dragOverSoundIndex.value
    dragOverSoundIndex.value = null
    if (idx !== null && !props.filter) {
      const keys = visibleSounds.value.map(s => s.key)
      const fromIdx = keys.indexOf(sound.key)
      if (fromIdx !== -1 && fromIdx !== idx) {
        keys.splice(fromIdx, 1)
        keys.splice(idx, 0, sound.key)
        reorderSoundsInSection(props.section.id, keys)
      }
    }
  } else {
    dragOverSoundIndex.value = null
    moveSound(sound.key, props.section.id)
  }
}

// Per-sound-wrapper dragover: tracks hover index for same-section reordering.
function onSoundWrapperDragOver(event: DragEvent, index: number): void {
  if (!draggingSound.value) return
  if (draggingSection.value) return
  if (props.filter) return // No reordering while filtered
  if (draggingSound.value.fromSectionId !== props.section.id) return
  event.preventDefault()
  dragOverSoundIndex.value = index
}

// ── Section header drag (for category reorder) ───────────────────────────────

function onHeaderDragStart(event: DragEvent): void {
  draggingSection.value = { id: props.section.id }
  event.dataTransfer!.effectAllowed = 'move'
  event.dataTransfer!.setData('text/plain', props.section.id)
}

function onHeaderDragEnd(): void {
  draggingSection.value = null
}

// ── Auto-enter rename mode for newly-created categories ─────────────────────

onMounted(() => {
  if (pendingRenameId.value === props.section.id) {
    pendingRenameId.value = null
    startRename()
  }
})

const minCellSize = computed(() => props.density === 'compact' ? '150px' : '200px')
</script>

<template>
  <!-- Always show sections with no filter active; hide only if filter produces no matches -->
  <div
    v-if="!filter || visibleSounds.length > 0"
    class="mb-3 transition-opacity"
    :class="{ 'opacity-40': section.isHidden }"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <!-- Header — draggable for category reorder when no filter is active -->
    <div
      class="group/hdr flex items-center gap-2 px-3 py-2 bg-bg-raised border border-border rounded-sm select-none transition-colors"
      :class="[
        !filter && 'cursor-grab hover:bg-bg-surface-hover hover:border-border-light',
        isDropTarget && 'border-accent bg-bg-surface-hover',
      ]"
      :draggable="!filter"
      @dragstart="onHeaderDragStart"
      @dragend="onHeaderDragEnd"
      @click="toggleCollapse"
    >
      <!-- Collapse chevron (hidden during filter) -->
      <Icon
        v-if="!filter"
        name="chevron-down-light"
        class="text-text-dim transition-transform duration-200 shrink-0"
        :class="{ '-rotate-90': isCollapsed }"
      />

      <!-- Title or rename input -->
      <input
        v-if="isEditing"
        ref="renameInputEl"
        v-model="editingName"
        class="flex-1 bg-transparent text-[15px] text-accent font-display border-b border-accent outline-none"
        @keydown.enter.prevent="confirmRename"
        @keydown.escape.prevent="cancelRename"
        @blur="confirmRename"
        @click.stop
        @dragstart.stop
      />
      <span v-else class="font-display text-[15px] text-accent flex-1">{{ section.displayName }}</span>

      <span class="font-mono text-[11px] text-text-dim">{{ visibleSounds.length }}</span>

      <!-- ⋯ button -->
      <div class="relative" @click.stop @dragstart.stop>
        <button
          class="opacity-0 group-hover/hdr:opacity-100 text-text-secondary hover:text-text-primary px-1 leading-none transition-opacity"
          @click="openHeaderMenu"
          title="Category options"
        ><Icon name="ellipsis-solid" /></button>
      </div>
    </div>

    <!-- Header ⋯ menu (teleported to avoid overflow clipping) -->
    <Teleport to="body">
      <div
        v-if="headerMenuOpen"
        class="fixed bg-bg-raised border border-border rounded-md shadow-lg z-[500] py-1 min-w-[140px]"
        :style="{ left: headerMenuPos.x + 'px', top: headerMenuPos.y + 'px' }"
        @click.stop
      >
        <button
          class="w-full text-left px-3 py-1.5 text-[12px] text-text-secondary hover:bg-bg-surface hover:text-text-primary"
          @click="startRename"
        >Rename</button>

        <!-- Hide / Unhide section (all sections) -->
        <button
          v-if="!section.isHidden"
          class="w-full text-left px-3 py-1.5 text-[12px] text-text-secondary hover:bg-bg-surface hover:text-text-primary"
          @click="handleHideSection"
        >Hide category</button>
        <button
          v-else
          class="w-full text-left px-3 py-1.5 text-[12px] text-text-secondary hover:bg-bg-surface hover:text-text-primary"
          @click="handleUnhideSection"
        >Unhide category</button>

        <!-- Restore defaults — original folder sections only -->
        <button
          v-if="!section.isCustom"
          class="w-full text-left px-3 py-1.5 text-[12px] text-text-secondary hover:bg-bg-surface hover:text-text-primary border-t border-border"
          @click="handleRestoreSection"
        >Restore defaults</button>
        <!-- Delete — custom categories only -->
        <button
          v-if="section.isCustom"
          class="w-full text-left px-3 py-1.5 text-[12px] text-danger hover:bg-bg-surface border-t border-border"
          @click="handleDelete"
        >Delete</button>
      </div>
    </Teleport>

    <!-- Body -->
    <div v-show="!isCollapsed" class="pt-2">
      <div
        class="grid gap-2 items-stretch rounded-sm transition-colors"
        :class="isDropTarget && 'outline outline-2 outline-accent outline-offset-2'"
        :style="{ gridTemplateColumns: `repeat(auto-fill, minmax(${minCellSize}, 1fr))` }"
      >
        <!-- Wrapper div enables per-slot dragover tracking for same-section reorder -->
        <div
          v-for="(sound, index) in visibleSounds"
          :key="sound.path"
          class="h-full"
          :class="dragOverSoundIndex === index && draggingSound?.fromSectionId === section.id && !filter
            ? 'outline outline-2 outline-accent rounded-md'
            : ''"
          @dragover="onSoundWrapperDragOver($event, index)"
        >
          <SoundButton
            :sound="sound"
            :section-id="section.id"
            :animation-delay="index * 25"
          />
        </div>
      </div>
    </div>
  </div>
</template>
