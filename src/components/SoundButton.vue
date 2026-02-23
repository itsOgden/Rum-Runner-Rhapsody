<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useAudioPlayer } from '../composables/useAudioPlayer.js'
import { useSoundManagement } from '../composables/useSoundManagement.js'
import { activeDropdownId } from '../dropdownState.js'
import { draggingSound } from '../dragState.js'

const props = defineProps({
  sound: { type: Object, required: true },
  sectionId: { type: String, default: '' },
  animationDelay: { type: Number, default: 0 },
})

const { playSound, playingPaths } = useAudioPlayer()
const { hideSound, restoreSound, moveSound, resetSound, getSoundCategory, getAvailableCategories, renameSound } = useSoundManagement()

const isPlaying = computed(() => playingPaths.value.has(props.sound.path))

function handleClick() {
  if (!isDragging.value) playSound(props.sound)
}

// ── Drag source ──────────────────────────────────────────────────────────────

const isDragging = ref(false)

function onDragStart(event) {
  isDragging.value = true
  draggingSound.value = { ...props.sound, fromSectionId: props.sectionId }
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', props.sound.key)
}

function onDragEnd() {
  isDragging.value = false
  // draggingSound is cleared by the drop target (or here as a fallback)
  draggingSound.value = null
}

// ── ⋯ Menu ──────────────────────────────────────────────────────────────────

const dropdownId = `sound-${Math.random().toString(36).slice(2)}`
const menuOpen = ref(false)
const menuPos = ref({ x: 0, y: 0 })
const showMoveList = ref(false)

// Close when another dropdown opens
watch(activeDropdownId, (id) => {
  if (id !== dropdownId) {
    menuOpen.value = false
    showMoveList.value = false
  }
})

// Estimated menu height for viewport flip calculation
const MENU_HEIGHT_ESTIMATE = 220

function openMenu(event) {
  event.stopPropagation()
  showMoveList.value = false
  const rect = event.currentTarget.getBoundingClientRect()
  let x = rect.right - 180
  let y = rect.bottom + 4
  if (x < 4) x = 4
  // Flip upward if menu would overflow viewport bottom
  if (y + MENU_HEIGHT_ESTIMATE > window.innerHeight) {
    y = rect.top - MENU_HEIGHT_ESTIMATE - 4
    if (y < 4) y = 4
  }
  menuPos.value = { x, y }
  activeDropdownId.value = dropdownId
  menuOpen.value = true
  const close = () => {
    menuOpen.value = false
    showMoveList.value = false
    document.removeEventListener('click', close)
  }
  document.addEventListener('click', close)
}

function handleHide() {
  menuOpen.value = false
  hideSound(props.sound.key)
}

function handleRestore() {
  menuOpen.value = false
  restoreSound(props.sound.key)
}

function handleMove(categoryId) {
  menuOpen.value = false
  moveSound(props.sound.key, categoryId)
}

function handleReset() {
  menuOpen.value = false
  resetSound(props.sound.key)
}

// isMoved: sound has been explicitly placed into a different category
const isMoved = computed(() => !!getSoundCategory(props.sound.key))

// Available targets for "Move to…" — excludes the section the sound is already in
const availableCategories = computed(() => getAvailableCategories(props.sectionId))

// ── Inline rename ────────────────────────────────────────────────────────────

const isRenaming = ref(false)
const renamingValue = ref('')
const renameInputEl = ref(null)

function startRename() {
  menuOpen.value = false
  renamingValue.value = props.sound.name
  isRenaming.value = true
  nextTick(() => renameInputEl.value?.select())
}

function confirmRename() {
  if (isRenaming.value) {
    renameSound(props.sound.key, renamingValue.value)
    isRenaming.value = false
  }
}

function cancelRename() {
  isRenaming.value = false
}
</script>

<template>
  <!-- Outer wrapper: provides the hover group, full height, and fade-in animation -->
  <div
    class="group/btn relative fade-in h-full"
    :style="{ animationDelay: `${animationDelay}ms` }"
  >
    <!-- Inline rename input (replaces button label) -->
    <div
      v-if="isRenaming"
      class="w-full h-full bg-bg-raised border border-accent rounded-md px-3.5 py-2 flex items-center"
      @click.stop
    >
      <input
        ref="renameInputEl"
        v-model="renamingValue"
        class="w-full bg-transparent text-[13px] text-text-primary outline-none text-center"
        @keydown.enter.prevent="confirmRename"
        @keydown.escape.prevent="cancelRename"
        @blur="confirmRename"
      />
    </div>

    <!-- Main play button -->
    <button
      v-else
      draggable="true"
      class="relative w-full h-full bg-bg-raised border rounded-md px-3.5 py-4.5 font-sans text-[13px] font-medium cursor-pointer text-center break-words transition-all duration-[120ms] outline-none overflow-hidden hover:-translate-y-px hover:border-accent-dim hover:shadow-md active:translate-y-0 active:bg-bg-surface-active"
      :class="[
        isPlaying
          ? 'border-accent shadow-[0_0_20px_var(--color-accent-glow)] sound-btn-playing text-text-primary'
          : 'border-border text-text-primary',
        sound.isHidden ? 'opacity-40' : '',
        isDragging ? 'opacity-50' : '',
      ]"
      @click="handleClick"
      @dragstart="onDragStart"
      @dragend="onDragEnd"
    >{{ sound.name }}</button>

    <!-- ⋯ trigger — floats in top-right corner, visible on group hover -->
    <div v-if="!isRenaming" class="absolute top-1 right-1 z-10" @click.stop>
      <button
        class="opacity-0 group-hover/btn:opacity-100 text-[11px] text-text-secondary hover:text-text-primary bg-bg-surface/80 rounded px-1 py-0.5 leading-none transition-opacity"
        @click="openMenu"
        title="Sound options"
      >⋯</button>
    </div>

    <!-- Sound ⋯ menu (teleported to avoid scroll-container clipping) -->
    <Teleport to="body">
      <div
        v-if="menuOpen"
        class="fixed bg-bg-raised border border-border rounded-md shadow-lg z-[500] py-1 min-w-[180px]"
        :style="{ left: menuPos.x + 'px', top: menuPos.y + 'px' }"
        @click.stop
      >
        <!-- Rename -->
        <button
          class="w-full text-left px-3 py-1.5 text-[12px] text-text-secondary hover:bg-bg-surface hover:text-text-primary"
          @click="startRename"
        >Rename</button>

        <!-- Hide / Restore -->
        <button
          v-if="!sound.isHidden"
          class="w-full text-left px-3 py-1.5 text-[12px] text-text-secondary hover:bg-bg-surface hover:text-text-primary"
          @click="handleHide"
        >Hide</button>
        <button
          v-else
          class="w-full text-left px-3 py-1.5 text-[12px] text-text-secondary hover:bg-bg-surface hover:text-text-primary"
          @click="handleRestore"
        >Restore</button>

        <!-- Move to… -->
        <template v-if="!showMoveList">
          <button
            class="w-full text-left px-3 py-1.5 text-[12px] text-text-secondary hover:bg-bg-surface hover:text-text-primary flex items-center justify-between"
            @click.stop="showMoveList = true"
          >
            <span>Move to…</span>
            <span class="text-text-dim text-[10px]">›</span>
          </button>
        </template>
        <template v-else>
          <div class="border-t border-border">
            <div class="px-3 py-1 text-[10px] text-text-dim uppercase tracking-wider">Move to</div>
            <div style="max-height: 240px; overflow-y: auto;">
              <button
                v-for="cat in availableCategories"
                :key="cat.id"
                class="w-full text-left px-3 py-1.5 text-[12px] text-text-secondary hover:bg-bg-surface hover:text-text-primary"
                @click="handleMove(cat.id)"
              >{{ cat.name }}</button>
            </div>
            <button
              class="w-full text-left px-3 py-1 text-[11px] text-text-dim hover:bg-bg-surface border-t border-border"
              @click.stop="showMoveList = false"
            >← Back</button>
          </div>
        </template>

        <!-- Reset to original — only when sound has been moved -->
        <button
          v-if="isMoved"
          class="w-full text-left px-3 py-1.5 text-[12px] text-text-secondary hover:bg-bg-surface hover:text-text-primary border-t border-border"
          @click="handleReset"
        >Reset to original</button>
      </div>
    </Teleport>
  </div>
</template>
