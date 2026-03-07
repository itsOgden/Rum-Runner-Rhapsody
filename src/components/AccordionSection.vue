<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import SoundButton from './SoundButton.vue'
import Icon from '@/components/Icon.vue'
import CategorySettingsModal from './CategorySettingsModal.vue'
import { useSoundManagement } from '../composables/useSoundManagement'
import { draggingSound, draggingSection } from '../dragState'
import type { SoundSection } from '../types'

const props = defineProps<{
  section: SoundSection
  density?: string
  filter?: string
}>()

const {
  showHidden,
  moveSound,
  isCollapsedSection,
  setCollapsedSection,
  pendingRenameId,
  pinnedSectionIds,
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
  return props.section.sounds.filter(s =>
    s.name.toLowerCase().includes(q) || s.filename.toLowerCase().includes(q)
  )
})

// ── Category settings modal ──────────────────────────────────────────────────

const categorySettingsOpen = ref(false)

// While the modal is open, keep this section in the rendered list even if hidden,
// so the modal component is not unmounted mid-interaction.
watch(categorySettingsOpen, (open) => {
  if (open) {
    pinnedSectionIds.value = new Set([...pinnedSectionIds.value, props.section.id])
  } else {
    const next = new Set(pinnedSectionIds.value)
    next.delete(props.section.id)
    pinnedSectionIds.value = next
  }
})

// ── Drag and drop ────────────────────────────────────────────────────────────

const isDropTarget = ref(false)
// Index within visibleSounds the cursor is over during a same-section drag
const dragOverSoundIndex = ref<number | null>(null)

// Section-level dragover: handles cross-section sound moves, category reorder,
// and acts as the fallback drop-acceptor for same-section reorders (so that
// dropping on the section header, gaps, or empty grid space still works).
function onDragOver(event: DragEvent): void {
  if (draggingSection.value) {
    // Accept the drag so AccordionSection is a clear drop target; visual feedback
    // is handled by the SoundGrid wrapper outline, not by isDropTarget here.
    event.preventDefault()
    return
  }
  if (!draggingSound.value) return
  // Accept same-section drags too — the per-sound wrappers are the primary
  // acceptors, but this fallback ensures drops on the header, body gaps, or
  // empty grid space don't get rejected and lose dragOverSoundIndex.
  event.preventDefault()
  if (draggingSound.value.fromSectionId !== props.section.id) {
    event.dataTransfer!.dropEffect = 'move'
    isDropTarget.value = true
  }
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

// ── Auto-open settings modal for newly-created categories ───────────────────

onMounted(() => {
  if (pendingRenameId.value === props.section.id) {
    pendingRenameId.value = null
    categorySettingsOpen.value = true
  }
})

const minCellSize = computed(() => props.density === 'compact' ? '150px' : '200px')
</script>

<template>
  <!-- Always show sections with no filter active; hide only if filter produces no matches -->
  <template v-if="!filter || visibleSounds.length > 0">

  <!-- Modal lives outside v-show so Teleport keeps it visible even when section is hidden -->
  <CategorySettingsModal
    :open="categorySettingsOpen"
    :section="section"
    @close="categorySettingsOpen = false"
  />

  <!-- Section content: hidden when isHidden (unless showHidden is on); dimmed when shown-while-hidden -->
  <div
    v-show="!section.isHidden || showHidden"
    class="mb-3 transition-opacity"
    :class="{ 'opacity-40': section.isHidden && showHidden }"
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

      <!-- Title -->
      <span class="font-display text-[15px] text-accent flex-1">{{ section.displayName }}</span>

      <span class="font-mono text-[11px] text-text-dim">{{ visibleSounds.length }}</span>

      <!-- Category settings button — collapses to zero width when not hovered -->
      <div
        class="w-0 overflow-hidden group-hover/hdr:w-4 transition-all duration-150 shrink-0"
        @click.stop
        @dragstart.stop
      >
        <button
          class="w-4 h-4 text-sm flex items-center cursor-pointer justify-center text-text-secondary hover:text-text-primary rounded opacity-0 group-hover/hdr:opacity-100 transition-opacity duration-150"
          title="Category settings"
          @click="categorySettingsOpen = true"
        ><Icon name="gear-solid" /></button>
      </div>
    </div>

    <!-- Body -->
    <div v-show="!isCollapsed" class="pt-2">
      <div
        class="grid gap-2 items-stretch rounded-sm transition-colors"
        :class="isDropTarget && 'outline-2 outline-accent outline-offset-2'"
        :style="{ gridTemplateColumns: `repeat(auto-fill, minmax(${minCellSize}, 1fr))` }"
      >
        <!-- Wrapper div enables per-slot dragover tracking for same-section reorder -->
        <div
          v-for="(sound, index) in visibleSounds"
          :key="sound.path"
          class="h-full"
          :class="dragOverSoundIndex === index && draggingSound?.fromSectionId === section.id && !filter
            ? 'outline-2 outline-accent rounded-md'
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
</template>
