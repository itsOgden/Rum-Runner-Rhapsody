<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useSettings } from '../composables/useSettings'
import { useSoundManagement } from '../composables/useSoundManagement'
import { filterQuery } from '../filterState'
import { draggingSection } from '../dragState'
import AccordionSection from './AccordionSection.vue'
import Icon from '@/components/Icon.vue'
import type { SoundSection } from '../types'

const { settings, soundGroups, soundCount, isLoadingSounds } = useSettings()
const { buildSections, addCategory, reorderCategories, showHidden } = useSoundManagement()

// ── Category reorder drag handling ───────────────────────────────────────────

const dragOverSectionId = ref<string | null>(null)

function onSectionWrapperDragOver(event: DragEvent, sectionId: string): void {
  if (!draggingSection.value) return
  event.preventDefault()
  dragOverSectionId.value = sectionId
}

function onSectionWrapperDragLeave(event: DragEvent): void {
  if (!(event.currentTarget as Element).contains(event.relatedTarget as Node | null)) {
    dragOverSectionId.value = null
  }
}

function onSectionDrop(sectionId: string): void {
  const draggedId = draggingSection.value?.id
  draggingSection.value = null
  dragOverSectionId.value = null
  if (!draggedId || draggedId === sectionId) return

  const currentOrder = sections.value.map(s => s.id)
  const fromIdx = currentOrder.indexOf(draggedId)
  const toIdx = currentOrder.indexOf(sectionId)
  if (fromIdx === -1 || toIdx === -1) return

  const newOrder = [...currentOrder]
  newOrder.splice(fromIdx, 1)
  newOrder.splice(toIdx, 0, draggedId)
  reorderCategories(newOrder)
}

// Count from raw sound groups so the "no matches" state is purely about
// the filter, not about hidden/moved sound state.
const filteredSoundCount = computed(() => {
  if (!filterQuery.value) return soundCount.value
  const q = filterQuery.value.toLowerCase()
  return soundGroups.value.reduce(
    (sum, g) => sum + g.sounds.filter(s =>
      s.name.toLowerCase().includes(q) || s.filename.toLowerCase().includes(q)
    ).length,
    0
  )
})

const sections = computed<SoundSection[]>(() => buildSections())

// ── Category quick-nav ────────────────────────────────────────────────────────
// Set to false to disable active-category highlight tracking entirely.
const ACTIVE_HIGHLIGHT_ENABLED = true

const scrollContainerRef = ref<HTMLElement | null>(null)
const activeSectionId = ref<string | null>(null)
// manualActiveSection: set on click, cleared only when natural tracking catches
// up to it or the user manually scrolls. Acts as a safety net so updateActiveSection
// can never overwrite a click-chosen highlight with a wrong scroll position.
const manualActiveSection = ref<string | null>(null)
// Plain boolean — only gates updateActiveSection, no template reactivity needed.
let scrollLocked = false
let scrollIdleTimer: ReturnType<typeof setTimeout> | null = null

const navSections = computed(() => {
  const base = sections.value.filter(s => !s.isHidden || showHidden.value)
  if (!filterQuery.value) return base
  const q = filterQuery.value.toLowerCase()
  return base.filter(s =>
    s.sounds.some(sound =>
      sound.name.toLowerCase().includes(q) || sound.filename.toLowerCase().includes(q)
    )
  )
})

function updateActiveSection(): void {
  if (!ACTIVE_HIGHLIGHT_ENABLED || scrollLocked) return
  const container = scrollContainerRef.value
  if (!container) return
  const containerTop = container.getBoundingClientRect().top
  let active: string | null = null
  for (const section of navSections.value) {
    const el = container.querySelector<HTMLElement>(`[data-section-id="${CSS.escape(section.id)}"]`)
    if (!el) continue
    if (el.getBoundingClientRect().top <= containerTop + 32) active = section.id
  }
  const natural = active ?? (navSections.value[0]?.id ?? null)
  if (manualActiveSection.value && natural !== manualActiveSection.value) return
  manualActiveSection.value = null
  activeSectionId.value = natural
}

function onScroll(): void {
  if (scrollLocked) {
    if (scrollIdleTimer) clearTimeout(scrollIdleTimer)
    scrollIdleTimer = setTimeout(() => {
      scrollLocked = false
      scrollIdleTimer = null
      updateActiveSection()
    }, 300)
    return
  }
  manualActiveSection.value = null
  updateActiveSection()
}

function scrollToSection(sectionId: string): void {
  const container = scrollContainerRef.value
  if (!container) return
  const el = container.querySelector<HTMLElement>(`[data-section-id="${CSS.escape(sectionId)}"]`)
  if (!el) return
  if (ACTIVE_HIGHLIGHT_ENABLED) {
    activeSectionId.value = sectionId
    manualActiveSection.value = sectionId
    scrollLocked = true
    if (scrollIdleTimer) clearTimeout(scrollIdleTimer)
  }
  const offset = container.scrollTop + el.getBoundingClientRect().top - container.getBoundingClientRect().top - 8
  container.scrollTo({ top: offset, behavior: 'smooth' })
}

onMounted(() => {
  scrollContainerRef.value?.addEventListener('scroll', onScroll, { passive: true })
  updateActiveSection()
})

onUnmounted(() => {
  scrollContainerRef.value?.removeEventListener('scroll', onScroll)
  if (scrollIdleTimer) clearTimeout(scrollIdleTimer)
})

watch(navSections, () => nextTick(updateActiveSection))
</script>

<template>
  <div class="flex flex-1 min-h-0">

    <!-- Category quick-nav — fixed sibling outside scroll container -->
    <nav
      v-if="settings.showCategorySidebar && !isLoadingSounds && soundCount > 0 && navSections.length > 0"
      class="w-36 shrink-0 py-2 border-r border-border-light overflow-y-auto bg-bg-raised"
    >
      <button
        v-for="section in navSections"
        :key="section.id"
        class="block w-full py-1.5 pr-2 pl-3 text-left text-xs cursor-pointer truncate leading-[1.6] transition-colors duration-100 border-l-2"
        :class="activeSectionId === section.id
          ? 'text-accent-text font-medium border-accent bg-accent/10'
          : 'text-text-secondary border-transparent hover:text-text-primary hover:bg-bg-raised'"
        :title="section.displayName"
        @click="scrollToSection(section.id)"
      >{{ section.displayName }}</button>
    </nav>

    <!-- Scrollable content area -->
    <div class="flex-1 overflow-y-auto min-w-0" ref="scrollContainerRef">

      <!-- Loading state -->
      <div
        v-if="isLoadingSounds"
        class="flex flex-col items-center justify-center h-full text-text-dim gap-3"
      >
        <div class="w-5.5 h-5.5 rounded-full border-2 border-border-light border-t-accent animate-spin" />
        <span class="text-sm">Scanning folder…</span>
      </div>

      <!-- Empty state — no sounds loaded -->
      <div
        v-else-if="soundCount === 0"
        class="flex flex-col items-center justify-center h-full text-text-dim text-center gap-3 px-10"
      >
        <Icon name="folder-open" class="text-[40px] text-text-dim opacity-40" />
        <div class="text-base font-semibold text-text-secondary">No sounds loaded</div>
        <div class="text-sm text-text-secondary max-w-xs leading-relaxed">
          Click "Browse…" to select a folder containing your audio files (WAV, MP3, OGG, FLAC, etc.)
        </div>
      </div>

      <!-- No-matches state — filter active but nothing matches -->
      <div
        v-else-if="filterQuery && filteredSoundCount === 0"
        class="flex flex-col items-center justify-center h-full text-text-dim text-center gap-2 px-10"
      >
        <div class="text-sm text-text-secondary">No sounds match <span class="text-text-primary">"{{ filterQuery }}"</span></div>
      </div>

      <!-- Sound grid -->
      <div v-else class="px-5 py-4">
        <div
          v-for="section in sections"
          :key="section.id"
          :data-section-id="section.id"
          :class="{
            'outline-2 outline-accent': dragOverSectionId === section.id && draggingSection?.id !== section.id,
            'opacity-50': draggingSection?.id === section.id,
          }"
          @dragover="onSectionWrapperDragOver($event, section.id)"
          @dragleave="onSectionWrapperDragLeave($event)"
          @drop.prevent="onSectionDrop(section.id)"
        >
          <AccordionSection
            :section="section"
            :density="settings.density || 'loose'"
            :filter="filterQuery"
          />
        </div>

        <!-- New Category -->
        <div class="mt-2">
          <button
            class="w-full py-2 text-sm text-text-secondary border border-dashed border-border-light hover:border-text-dim hover:text-text-primary flex items-center justify-center gap-1.5 transition-colors cursor-pointer bg-transparent outline-none"
            @click="addCategory"
          ><Icon name="plus" /> New Category</button>
        </div>
      </div>

    </div>

  </div>
</template>
