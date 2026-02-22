<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import SoundButton from './SoundButton.vue'
import { useSoundManagement } from '../composables/useSoundManagement.js'

const props = defineProps({
  section: { type: Object, required: true },
  density: { type: String, default: 'loose' },
  filter: { type: String, default: '' },
})

const { renameCategory, deleteCategory, isCollapsedSection, setCollapsedSection } = useSoundManagement()

// ── Collapse — initialise from persisted settings ──────────────────────────

const collapsed = ref(isCollapsedSection(props.section.id))

// Sections are re-keyed on folder change, so this watch handles edge cases.
watch(() => props.section.id, id => { collapsed.value = isCollapsedSection(id) })

const isCollapsed = computed(() => collapsed.value && !props.filter)

function toggleCollapse() {
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

const headerMenuOpen = ref(false)
const headerMenuPos = ref({ x: 0, y: 0 })

function openHeaderMenu(event) {
  event.stopPropagation()
  const rect = event.currentTarget.getBoundingClientRect()
  headerMenuPos.value = { x: rect.right - 150, y: rect.bottom + 4 }
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
const renameInputEl = ref(null)

function startRename() {
  headerMenuOpen.value = false
  editingName.value = props.section.displayName
  isEditing.value = true
  nextTick(() => renameInputEl.value?.select())
}

function confirmRename() {
  if (editingName.value.trim()) renameCategory(props.section.id, editingName.value)
  isEditing.value = false
}

function cancelRename() {
  isEditing.value = false
}

// ── Delete custom category ──────────────────────────────────────────────────

function handleDelete() {
  headerMenuOpen.value = false
  deleteCategory(props.section.id)
}

const minCellSize = computed(() => props.density === 'compact' ? '150px' : '200px')
</script>

<template>
  <!-- Always show sections with no filter active; hide only if filter produces no matches -->
  <div v-if="!filter || visibleSounds.length > 0" class="mb-3">
    <!-- Header -->
    <div
      class="group/hdr flex items-center gap-2 px-3 py-2 bg-bg-raised border border-border rounded-sm select-none"
      :class="!filter && 'cursor-pointer transition-colors hover:bg-bg-surface-hover hover:border-border-light'"
      @click="toggleCollapse"
    >
      <!-- Collapse arrow (hidden during filter) -->
      <span
        v-if="!filter"
        class="text-[10px] text-text-dim transition-transform duration-200"
        :class="{ '-rotate-90': isCollapsed }"
      >&#x25BC;</span>

      <!-- Title or rename input -->
      <input
        v-if="isEditing"
        ref="renameInputEl"
        v-model="editingName"
        class="flex-1 bg-transparent text-sm text-accent font-display border-b border-accent outline-none"
        @keydown.enter.prevent="confirmRename"
        @keydown.escape.prevent="cancelRename"
        @blur="confirmRename"
        @click.stop
      />
      <span v-else class="font-display text-sm text-accent flex-1">{{ section.displayName }}</span>

      <span class="font-mono text-[11px] text-text-dim">{{ visibleSounds.length }}</span>

      <!-- ⋯ button -->
      <div class="relative" @click.stop>
        <button
          class="opacity-0 group-hover/hdr:opacity-100 text-[14px] text-text-dim hover:text-text-primary px-1 leading-none transition-opacity"
          @click="openHeaderMenu"
          title="Section options"
        >⋯</button>
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
        <button
          v-if="section.isCustom"
          class="w-full text-left px-3 py-1.5 text-[12px] text-danger hover:bg-bg-surface"
          @click="handleDelete"
        >Delete</button>
      </div>
    </Teleport>

    <!-- Body -->
    <div v-show="!isCollapsed" class="pt-2">
      <div
        class="grid gap-2"
        :style="{ gridTemplateColumns: `repeat(auto-fill, minmax(${minCellSize}, 1fr))` }"
      >
        <SoundButton
          v-for="(sound, index) in visibleSounds"
          :key="sound.path"
          :sound="sound"
          :section-id="section.id"
          :animation-delay="index * 25"
        />
      </div>
    </div>
  </div>
</template>
