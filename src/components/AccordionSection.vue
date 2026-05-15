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

// ── Accordion transition (height 0 ↔ content height) ─────────────────────────

function onBeforeEnter(el: Element): void {
  const div = el as HTMLElement
  div.style.height = '0'
  div.style.overflow = 'hidden'
}

function onEnter(el: Element, done: () => void): void {
  const div = el as HTMLElement
  div.offsetHeight // force reflow so height:0 is committed before transition
  div.style.transition = 'height 0.26s cubic-bezier(0.16, 1, 0.3, 1)'
  div.style.height = `${div.scrollHeight}px`
  div.addEventListener('transitionend', (e: Event) => {
    if ((e as TransitionEvent).propertyName === 'height') done()
  }, { once: true })
}

function onAfterEnter(el: Element): void {
  const div = el as HTMLElement
  div.style.height = ''
  div.style.overflow = ''
  div.style.transition = ''
}

function onLeave(el: Element, done: () => void): void {
  const div = el as HTMLElement
  div.style.height = `${div.offsetHeight}px`
  div.style.overflow = 'hidden'
  div.offsetHeight // force reflow
  div.style.transition = 'height 0.2s ease-in'
  div.style.height = '0'
  div.addEventListener('transitionend', (e: Event) => {
    if ((e as TransitionEvent).propertyName === 'height') done()
  }, { once: true })
}

function onAfterLeave(el: Element): void {
  const div = el as HTMLElement
  // Clear only the inline styles we added — do NOT use cssText = '' because
  // v-show sets display:none as an inline style and cssText would wipe it,
  // causing the section to snap back open.
  div.style.height = ''
  div.style.overflow = ''
  div.style.transition = ''
}
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

  <!-- Section content -->
  <div
    v-show="!section.isHidden || showHidden"
    class="mb-3 transition-opacity"
    :class="{ 'opacity-40': section.isHidden && showHidden }"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <!-- Header — left-click collapses, drag to reorder, right-click for settings -->
    <div
      class="group/hdr flex items-center gap-1.5 px-1.5 py-2.5 select-none transition-colors duration-100"
      :class="!filter && 'cursor-grab hover:bg-bg-raised'"
      :draggable="!filter"
      @dragstart="onHeaderDragStart"
      @dragend="onHeaderDragEnd"
      @click="toggleCollapse"
      @contextmenu.prevent="!filter && (categorySettingsOpen = true)"
    >
      <!-- Drag grip — CSS dot grid, reveals on hover -->
      <span
        v-if="!filter"
        class="drag-grip opacity-0 group-hover/hdr:opacity-100 transition-opacity duration-150 shrink-0"
      />

      <!-- Collapse chevron -->
      <Icon
        v-if="!filter"
        name="chevron-down-light"
        class="text-[10px] text-text-secondary transition-transform duration-200 shrink-0"
        :class="{ '-rotate-90': isCollapsed }"
      />

      <!-- Category color dot (always reserves space; transparent when no color set) -->
      <span
        v-if="!filter"
        class="w-1.5 h-1.5 rounded-full shrink-0 transition-colors duration-150"
        :style="{ backgroundColor: section.color || 'transparent' }"
      />

      <!-- Title -->
      <span class="font-display text-base text-text-primary flex-1 min-w-0 truncate leading-none">{{ section.displayName }}</span>

      <!-- Pencil — hover-reveal, opens category settings modal -->
      <button
        v-if="!filter"
        class="opacity-0 group-hover/hdr:opacity-100 cursor-pointer transition-opacity duration-150 text-text-dim hover:text-text-secondary shrink-0"
        title="Edit category"
        @click.stop="categorySettingsOpen = true"
      >
        <Icon name="pencil" class="text-[11px]" />
      </button>

      <!-- Count -->
      <span class="text-xs text-text-secondary tabular-nums shrink-0">{{ visibleSounds.length }}</span>
    </div>

    <!-- Separator -->
    <div class="h-px mb-2 transition-colors duration-150" :class="isDropTarget ? 'bg-accent' : 'bg-border-light'" />

    <!-- Body -->
    <Transition
      @before-enter="onBeforeEnter"
      @enter="onEnter"
      @after-enter="onAfterEnter"
      @leave="onLeave"
      @after-leave="onAfterLeave"
    >
      <div v-show="!isCollapsed" class="pt-0.5">
        <div
          class="grid gap-x-2 gap-y-2.5 items-stretch transition-colors"
          :class="isDropTarget && 'outline-2 outline-accent outline-offset-2'"
          :style="{ gridTemplateColumns: `repeat(auto-fill, minmax(${minCellSize}, 1fr))` }"
        >
          <!-- Wrapper div enables per-slot dragover tracking for same-section reorder -->
          <div
            v-for="(sound, index) in visibleSounds"
            :key="sound.path"
            class="h-full"
            :class="dragOverSoundIndex === index && draggingSound?.fromSectionId === section.id && !filter
              ? 'outline-2 outline-accent'
              : ''"
            @dragover="onSoundWrapperDragOver($event, index)"
          >
            <SoundButton
              :sound="sound" :density="density"
              :section-id="section.id"
              :animation-delay="index * 8"
            />
          </div>
        </div>
      </div>
    </Transition>
  </div>

  </template>
</template>

<style scoped>
/* 2×3 dot grid drag handle — classic grip indicator, no icon needed */
.drag-grip {
  display: inline-block;
  width: 6px;
  height: 10px;
  background-image: radial-gradient(circle, var(--color-text-dim) 1px, transparent 1px);
  background-size: 3px 3.5px;
  background-repeat: repeat;
  flex-shrink: 0;
}
</style>
