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
// Plain boolean — only gates updateActiveSection, no template reactivity needed.
let scrollLocked = false
let scrollIdleTimer: ReturnType<typeof setTimeout> | null = null

const navSections = computed(() =>
  sections.value.filter(s => !s.isHidden || showHidden.value)
)

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
  activeSectionId.value = active ?? (navSections.value[0]?.id ?? null)
}

function onScroll(): void {
  if (scrollLocked) {
    // Each scroll event restarts the idle timer; when scroll has been stable
    // for 150ms the lock releases and scroll-based tracking resumes.
    if (scrollIdleTimer) clearTimeout(scrollIdleTimer)
    scrollIdleTimer = setTimeout(() => {
      scrollLocked = false
      scrollIdleTimer = null
      updateActiveSection()
    }, 150)
    return
  }
  updateActiveSection()
}

function scrollToSection(sectionId: string): void {
  const container = scrollContainerRef.value
  if (!container) return
  const el = container.querySelector<HTMLElement>(`[data-section-id="${CSS.escape(sectionId)}"]`)
  if (!el) return
  if (ACTIVE_HIGHLIGHT_ENABLED) {
    activeSectionId.value = sectionId
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

    <!-- Category quick-nav — outside the scroll container so it never scrolls with content -->
    <nav
      v-if="settings.showCategorySidebar && !filterQuery && !isLoadingSounds && soundCount > 0"
      class="category-nav"
    >
      <button
        v-for="section in navSections"
        :key="section.id"
        class="category-nav-entry"
        :class="{ 'category-nav-entry-active': activeSectionId === section.id }"
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
        <div class="spinner"></div>
        <span class="text-[13px]">Scanning folder…</span>
      </div>

      <!-- Empty state — no sounds loaded -->
      <div
        v-else-if="soundCount === 0"
        class="flex flex-col items-center justify-center h-full text-text-dim text-center gap-3 px-10"
      >
        <div class="text-5xl opacity-30">&#x1F3B5;</div>
        <div class="text-base font-semibold text-text-secondary">No sounds loaded</div>
        <div class="text-[13px] max-w-xs leading-relaxed">
          Click "Browse…" to select a folder containing your audio files (WAV, MP3, OGG, FLAC, etc.)
        </div>
      </div>

      <!-- No-matches state — filter active but nothing matches -->
      <div
        v-else-if="filterQuery && filteredSoundCount === 0"
        class="flex flex-col items-center justify-center h-full text-text-dim text-center gap-2 px-10"
      >
        <div class="text-3xl opacity-30">&#x1F50D;</div>
        <div class="text-[13px]">No sounds match <span class="text-text-secondary font-mono">"{{ filterQuery }}"</span></div>
      </div>

      <!-- Sound grid -->
      <div v-else class="px-5 py-4">
        <!-- Wrapper div provides category-reorder drop target and drag opacity feedback -->
        <div
          v-for="section in sections"
          :key="section.id"
          :data-section-id="section.id"
          :class="{
            'outline-2 outline-accent rounded-sm': dragOverSectionId === section.id && draggingSection?.id !== section.id,
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
            class="btn text-[12px] w-full text-text-dim hover:text-text-secondary flex items-center justify-center gap-1.5"
            @click="addCategory"
          ><Icon name="plus" /> New Category</button>
        </div>
      </div>

    </div>

  </div>
</template>

<style scoped>
@keyframes spin {
  to { transform: rotate(360deg); }
}

.spinner {
  width: 22px;
  height: 22px;
  border: 2px solid var(--color-border-light);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* ── Category quick-nav sidebar ─────────────────────────────────────────── */

.category-nav {
  width: 90px;
  flex-shrink: 0;
  padding: 16px 4px 16px 6px;
  border-right: 1px solid var(--color-border);
  overflow-y: auto;
}

.category-nav-entry {
  display: block;
  width: 100%;
  padding: 3px 6px;
  text-align: left;
  font-size: 11px;
  font-family: var(--font-sans);
  color: var(--color-text-dim);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.7;
  transition: color 0.1s, background 0.1s;
}

.category-nav-entry:hover {
  color: var(--color-text-secondary);
  background: var(--color-bg-surface-hover);
}

.category-nav-entry-active {
  color: var(--color-accent);
  font-weight: 600;
}

.category-nav-entry-active:hover {
  color: var(--color-accent);
}
</style>
