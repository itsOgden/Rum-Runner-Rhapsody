<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useAudioPlayer } from '../composables/useAudioPlayer'
import { useSoundManagement } from '../composables/useSoundManagement'
import { useSettings } from '../composables/useSettings'
import { activeDropdownId } from '../dropdownState'
import { draggingSound } from '../dragState'
import Icon from '@/components/Icon.vue'
import type { Sound } from '../types'
import CircleButton from '@/components/CircleButton.vue'
import ToggleCircleButton from '@/components/ToggleCircleButton.vue'
import VolumeSlider from '@/components/VolumeSlider.vue'
import MenuItem from '@/components/MenuItem.vue'
import { CLIP_VOLUME_MAX_DB, setClipVolumeOffset } from '../composables/useAudioPlayer'

const props = defineProps<{
  sound: Sound
  sectionId?: string
  density?: string
  animationDelay?: number
}>()

const { playSound, playingPaths, previewSound, stopPreview, previewingPath } = useAudioPlayer()
const { hideSound, restoreSound, moveSound, resetSound, getSoundCategory, getAvailableCategories, renameSound } = useSoundManagement()
const { settings, saveSettings } = useSettings()

const compact = computed(() => props.density === 'compact')
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
  draggingSound.value = null
}

const btnClasses = computed(() => [
  props.sound.isHidden ? 'opacity-40' : '',
  isDragging.value ? 'opacity-50' : '',
  compact.value ? 'py-2.5 px-2 min-h-12' : 'px-3.5 py-4.5',
  'text-text-primary',
  'btn-spin',
  isPlaying.value ? 'btn-spin-playing' : '',
])

// ── ⋯ Menu ──────────────────────────────────────────────────────────────────

const dropdownId = `sound-${Math.random().toString(36).slice(2)}`
const menuOpen = ref(false)
const menuPos = ref({ x: 0, y: 0 })
const showMoveList = ref(false)

watch(activeDropdownId, (id) => {
  if (id !== dropdownId) {
    menuOpen.value = false
    showMoveList.value = false
  }
})

const MENU_HEIGHT_ESTIMATE = 300

function openMenu(event: MouseEvent): void {
  event.stopPropagation()
  showMoveList.value = false
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  let x = rect.right - 180
  let y = rect.bottom + 4
  if (x < 4) x = 4
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

const isMoved = computed(() => !!getSoundCategory(props.sound.key))
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
    class="group/btn relative animate-fade-in h-full sbtn"
    :class="{ 'z-[2]': isPlaying }"
    :style="{ animationDelay: `${animationDelay ?? 0}ms` }"
    @mouseleave="handleMouseLeave"
  >
    <!-- Inline rename input (replaces button label) -->
    <div
      v-if="isRenaming"
      class="w-full h-full bg-bg-raised border border-accent rounded-sm px-3.5 py-2 flex items-center"
      @click.stop
    >
      <input
        ref="renameInputEl"
        v-model="renamingValue"
        class="w-full bg-transparent text-sm text-text-primary outline-none text-center"
        @keydown.enter.prevent="confirmRename"
        @keydown.escape.prevent="cancelRename"
        @blur="confirmRename"
      />
    </div>

    <!-- Spinning comet ring (DOM-first so button stacks on top) + button -->
    <template v-else>
      <div v-if="isPlaying" class="rounded-sm btn-spin-ring pointer-events-none" />

      <button
        draggable="true"
        class="relative w-full h-full rounded-sm bg-bg-raised font-sans text-sm cursor-pointer text-center wrap-break-word transition-all duration-120 outline-none"
        :class="btnClasses"
        @click="handleClick"
        @dragstart="onDragStart"
        @dragend="onDragEnd"
      >
        {{ sound.name }}
      </button>
    </template>

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
        class="fixed bg-bg-raised border border-border rounded-md shadow-lg z-500 py-1 min-w-45"
        :style="{ left: menuPos.x + 'px', top: menuPos.y + 'px' }"
        @click.stop
      >
        <!-- Play count + reset -->
        <div class="px-3 flex justify-between items-center py-1.5 border-b border-border">
          <div class="text-sm text-text-dim select-none">{{ playCountLabel }}</div>
          <CircleButton v-if="playCount > 0" icon="xmark" @click="handleResetPlayCount" no-colors class="-mr-1.5 text-text-primary hover:border hover:border-danger hover:text-danger" title="Reset play count" />
        </div>

        <!-- Hide / Restore -->
        <MenuItem v-if="!sound.isHidden" @click="handleHide">Hide</MenuItem>
        <MenuItem v-else @click="handleRestore">Restore</MenuItem>

        <!-- Rename -->
        <MenuItem @click="startRename">Rename</MenuItem>

        <!-- Move to… -->
        <template v-if="!showMoveList">
          <MenuItem @click.stop="showMoveList = true">
            <span>Move to…</span>
            <Icon name="chevron-down-solid" />
          </MenuItem>
        </template>
        <template v-else>
          <div class="border-t border-border">
            <div class="px-3 py-1 text-sm text-text-dim uppercase tracking-wider">Move to</div>
            <div class="max-h-60 overflow-y-auto">
              <MenuItem v-for="cat in availableCategories" :key="cat.id" @click="handleMove(cat.id)">{{ cat.name }}</MenuItem>
            </div>
            <button
              class="w-full flex items-center gap-1 text-left px-3 py-1 text-sm cursor-pointer hover:bg-bg-surface border-t border-border"
              @click.stop="showMoveList = false"
            ><Icon name="chevron-down-solid" class="rotate-90 text-[9px]" /> Back</button>
          </div>
        </template>

        <!-- Reset to original — only when sound has been moved -->
        <MenuItem v-if="isMoved" top-border @click="handleReset">Reset</MenuItem>

        <!-- Volume Offset -->
        <div class="border-t border-border px-3 pt-2 pb-2">
          <div class="text-sm text-text-secondary mb-1.5">Volume Offset</div>
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
            class="mt-1.5 px-2.5 py-0.75 text-sm bg-bg-surface-active border border-border rounded text-text-secondary cursor-pointer transition-colors hover:border-accent hover:text-text-primary"
            @click="resetVolumeOffset"
          >Reset</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* Outer wrapper handles lift so ring + button move together */
.sbtn {
  transition: transform 0.09s ease;
}
.sbtn:hover {
  transform: translateY(-2px) !important;
}
.sbtn:active {
  transform: translateY(2px) !important;
}

.btn-spin {
  box-shadow: 0 3px 0 var(--color-border-light);
  transition: box-shadow 0.12s ease, color 0.15s, background 0.12s;
}
.btn-spin:hover {
  background: var(--color-bg-surface) !important;
  box-shadow: 0 4px 0 var(--color-text-dim);
}
.btn-spin:active {
  box-shadow: 0 1px 0 var(--color-border-light) !important;
}
.btn-spin-playing {
  color: var(--color-accent) !important;
  animation: btn-spin-glow 5s ease-in-out infinite;
}
@keyframes btn-spin-glow {
  0%, 100% {
    box-shadow: 0 4px 0 var(--color-accent), 0 0 12px var(--color-accent-glow);
  }
  50% {
    box-shadow: 0 4px 0 var(--color-accent), 0 0 26px rgb(from var(--color-accent) r g b / 0.38);
  }
}

/* Spinning comet ring — rendered before button in DOM so button stacks on top.
   overflow:hidden clips the rotating ::before to the ring's border strip. */
.btn-spin-ring {
  position: absolute;
  inset: -1px;
  overflow: hidden;
  z-index: 0;
}
.btn-spin-ring::before {
  content: '';
  position: absolute;
  /* Square so it fully covers the ring at every rotation angle.
     A non-square (200%w × 200%h) fails to cover the ring's horizontal
     extent at ~90° because the shorter side doesn't reach far enough. */
  width: 200%;
  aspect-ratio: 1;
  top: 50%;
  left: 50%;
  translate: -50% -50%;
  background: conic-gradient(from 0deg,
    transparent 0deg,
    var(--color-accent) 50deg,
    rgb(from var(--color-accent) r g b / 0.15) 90deg,
    transparent 120deg
  );
  animation: btn-spin-rotate 2.5s linear infinite;
}
@keyframes btn-spin-rotate {
  /* Peak starts at bottom (6 o'clock). Top/bottom edges are ~2× faster than the
     sides so the comet cruises across the wide face and eases through the corners.
     Corner angles: ~65° from top/bottom → sides span 44°, top/bottom span 136° each. */
  0%   { transform: rotate(130deg); }  /* peak at bottom                          */
  15%  { transform: rotate(198deg); }  /* peak at lower-left corner  (fast base)  */
  35%  { transform: rotate(242deg); }  /* peak at upper-left corner  (slow side)  */
  65%  { transform: rotate(378deg); }  /* peak at upper-right corner (fast top)   */
  85%  { transform: rotate(422deg); }  /* peak at lower-right corner (slow side)  */
  100% { transform: rotate(490deg); }  /* peak back at bottom (130 + 360)         */
}
</style>
