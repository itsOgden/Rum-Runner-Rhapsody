<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useAudioPlayer } from '../composables/useAudioPlayer'
import { useSoundManagement } from '../composables/useSoundManagement'
import { useSettings } from '../composables/useSettings'
import { showToast } from '../toastState'
import { activeDropdownId } from '../dropdownState'
import { draggingSound } from '../dragState'
import Icon from '@/components/Icon.vue'
import type { Sound } from '../types'
import {filterQuery} from "@/filterState";
import CircleButton from "@/components/CircleButton.vue";
import ToggleCircleButton from "@/components/ToggleCircleButton.vue";
import VolumeSlider from '@/components/VolumeSlider.vue'
import { CLIP_VOLUME_MAX_DB, setClipVolumeOffset } from '../composables/useAudioPlayer'

const props = defineProps<{
  sound: Sound
  sectionId?: string
  animationDelay?: number
}>()

const { playSound, playingPaths, previewSound, stopPreview, previewingPath } = useAudioPlayer()
const { hideSound, restoreSound, moveSound, resetSound, getSoundCategory, getAvailableCategories, renameSound } = useSoundManagement()
const { settings, saveSettings } = useSettings()

const playCount = computed(() => settings.value.playCounts?.[props.sound.key] ?? 0)
const playCountLabel = computed(() => {
  if (playCount.value === 0) return 'Never played'
  if (playCount.value === 1) return 'Played 1 time'
  return `Played ${playCount.value} times`
})

const isPlaying = computed(() => playingPaths.value.has(props.sound.path))
const isPreviewing = computed(() => previewingPath.value === props.sound.path)

function handleClick(): void {
  if (!isDragging.value) playSound(props.sound)
}

function handlePreviewClick(event: MouseEvent): void {
  event.stopPropagation()
  previewSound(props.sound)
}

function handleMouseLeave(): void {
  if (isPreviewing.value) stopPreview()
}

// ── Drag source ──────────────────────────────────────────────────────────────

const isDragging = ref(false)

function onDragStart(event: DragEvent): void {
  isDragging.value = true
  draggingSound.value = { ...props.sound, fromSectionId: props.sectionId ?? '' }
  event.dataTransfer!.effectAllowed = 'move'
  event.dataTransfer!.setData('text/plain', props.sound.key)
}

function onDragEnd(): void {
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
const MENU_HEIGHT_ESTIMATE = 300

function openMenu(event: MouseEvent): void {
  event.stopPropagation()
  showMoveList.value = false
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
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

function handleHide(): void {
  menuOpen.value = false
  hideSound(props.sound.key)
}

function handleRestore(): void {
  menuOpen.value = false
  restoreSound(props.sound.key)
}

function handleMove(categoryId: string): void {
  menuOpen.value = false
  moveSound(props.sound.key, categoryId)
}

function handleReset(): void {
  menuOpen.value = false
  resetSound(props.sound.key)
}

function handleResetPlayCount(): void {
  const newCounts = { ...(settings.value.playCounts ?? {}), [props.sound.key]: 0 }
  settings.value.playCounts = newCounts
  saveSettings({ playCounts: newCounts })
}

// isMoved: sound has been explicitly placed into a different category
const isMoved = computed(() => !!getSoundCategory(props.sound.key))

// Available targets for "Move to…" — excludes the section the sound is already in
const availableCategories = computed(() => getAvailableCategories(props.sectionId ?? null))

// ── Inline rename ────────────────────────────────────────────────────────────

const isRenaming = ref(false)
const renamingValue = ref('')
const renameInputEl = ref<HTMLInputElement | null>(null)

function startRename(): void {
  menuOpen.value = false
  renamingValue.value = props.sound.name
  isRenaming.value = true
  nextTick(() => renameInputEl.value?.select())
}

function confirmRename(): void {
  if (isRenaming.value) {
    renameSound(props.sound.key, renamingValue.value)
    isRenaming.value = false
  }
}

function cancelRename(): void {
  isRenaming.value = false
}

// ── Per-clip volume offset ───────────────────────────────────────────────────

const localVolumeOffset = ref(0)

watch(menuOpen, (open) => {
  if (open) localVolumeOffset.value = settings.value.soundVolumes?.[props.sound.key] ?? 0
})

function onVolumeInput(value: number): void {
  localVolumeOffset.value = value
  setClipVolumeOffset(props.sound.key, value)
}

function handleVolumeChange(value: number): void {
  const newVolumes = { ...settings.value.soundVolumes, [props.sound.key]: value }
  settings.value.soundVolumes = newVolumes
  saveSettings({ soundVolumes: newVolumes })
}

function resetVolumeOffset(): void {
  onVolumeInput(0)
  handleVolumeChange(0)
}
</script>

<template>
  <!-- Outer wrapper: provides the hover group, full height, and fade-in animation -->
  <div
    class="group/btn relative fade-in h-full"
    :style="{ animationDelay: `${animationDelay ?? 0}ms` }"
    @mouseleave="handleMouseLeave"
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
      <ToggleCircleButton
          icon="ellipsis-solid"
          title="Sound options"
          @click="openMenu"
      />
    </div>

    <!-- Preview trigger — floats in bottom-right corner, visible on group hover -->
    <div v-if="!isRenaming" class="absolute bottom-1.5 right-1 z-10" @click.stop>
      <ToggleCircleButton
          icon="headphones-simple-solid"
          title="Preview (monitor output only)"
          :enabled="isPreviewing"
          @click="handlePreviewClick"
      />
    </div>

    <!-- Sound ⋯ menu (teleported to avoid scroll-container clipping) -->
    <Teleport to="body">
      <div
        v-if="menuOpen"
        class="fixed menu-parent bg-bg-raised border border-border rounded-md shadow-lg z-500 py-1 min-w-45"
        :style="{ left: menuPos.x + 'px', top: menuPos.y + 'px' }"
        @click.stop
      >
        <!-- Play count info + Reset — grouped at top with divider below -->
        <div class="px-3 flex justify-between items-center py-1.5 border-b border-border">
          <div class="text-[11px] text-text-dim select-none">{{ playCountLabel }}</div>
<!--          <button class="text-xs" v-if="playCount > 0" @click="handleResetPlayCount" title="Reset play count">-->
<!--            <Icon name="xmark" />-->
<!--          </button>-->
          <CircleButton v-if="playCount > 0" icon="xmark" @click="handleResetPlayCount" no-colors class="-mr-1.5 text-text-primary hover:border hover:border-danger hover:text-danger" title="Reset play count" />
        </div>

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

        <!-- Rename -->
        <button
          class="w-full text-left px-3 py-1.5 text-[12px] text-text-secondary hover:bg-bg-surface hover:text-text-primary"
          @click="startRename"
        >Rename</button>

        <!-- Move to… -->
        <template v-if="!showMoveList">
          <button
            class="w-full text-left px-3 py-1.5 text-[12px] text-text-secondary hover:bg-bg-surface hover:text-text-primary flex items-center justify-between"
            @click.stop="showMoveList = true"
          >
            <span>Move to…</span>
            <Icon name="chevron-down-solid" />
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
              class="w-full flex items-center gap-1 text-left px-3 py-1 text-[11px] cursor-pointer hover:bg-bg-surface border-t border-border"
              @click.stop="showMoveList = false"
            ><Icon name="chevron-down-solid" class="rotate-90 text-[9px]" /> Back</button>
          </div>
        </template>

        <!-- Reset to original — only when sound has been moved -->
        <button
          v-if="isMoved"
          class="w-full text-left px-3 py-1.5 text-[12px] text-text-secondary hover:bg-bg-surface hover:text-text-primary border-t border-border"
          @click="handleReset"
        >Reset</button>

        <!-- Volume Offset -->
        <div class="border-t border-border px-3 pt-2 pb-2">
          <div class="text-[11px] text-text-secondary mb-1.5">Volume Offset</div>
          <VolumeSlider
            :modelValue="localVolumeOffset"
            :min="-CLIP_VOLUME_MAX_DB"
            :max="CLIP_VOLUME_MAX_DB"
            :step="1"
            unit=" dB"
            @update:modelValue="onVolumeInput"
            @change="handleVolumeChange"
          />
          <button
            v-if="localVolumeOffset !== 0"
            class="reset-btn mt-1.5"
            @click="resetVolumeOffset"
          >Reset</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes playing-bar {
  0% { width: 14px; opacity: 0.6; }
  100% { width: 28px; opacity: 1; }
}

.fade-in {
  animation: fadeIn 0.25s ease forwards;
}
.menu-parent button{
  cursor: pointer;
}
.reset-btn {
  display: inline-block;
  padding: 3px 10px;
  font-size: 11px;
  background: var(--color-bg-surface-active);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: border-color 0.12s, color 0.12s;
}
.reset-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-text-primary);
}
.sound-btn-playing::after {
  content: '';
  position: absolute;
  bottom: 6px;
  left: 50%;
  transform: translateX(-50%);
  width: 20px; height: 3px;
  background: var(--color-accent);
  border-radius: 2px;
  animation: playing-bar 0.8s ease-in-out infinite alternate;
}
</style>
