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
import { CLIP_VOLUME_MAX_DB, setClipVolumeOffset } from '../composables/useAudioPlayer'

const props = defineProps<{
  sound: Sound
  sectionId?: string
  density?: string
  animationDelay?: number
}>()

const { playSound, playingPaths } = useAudioPlayer()
const { hideSound, restoreSound, resetSound, getSoundCategory, renameSound } = useSoundManagement()
const { settings, saveSettings } = useSettings()

const compact = computed(() => props.density === 'compact')
const playCount = computed(() => settings.value.playCounts?.[props.sound.key] ?? 0)
const playCountLabel = computed(() => {
  if (playCount.value === 0) return 'Never played'
  if (playCount.value === 1) return 'Played 1 time'
  return `Played ${playCount.value} times`
})

const isPlaying = computed(() => playingPaths.value.has(props.sound.path))

function handleClick(): void {
  if (!isDragging.value) playSound(props.sound)
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
const confirmingReset = ref(false)

watch(activeDropdownId, (id) => {
  if (id !== dropdownId) {
    menuOpen.value = false
    confirmingReset.value = false
  }
})

const MENU_HEIGHT_ESTIMATE = 220
const menuRef = ref<HTMLElement | null>(null)

function getMenuItems(): HTMLButtonElement[] {
  return Array.from(menuRef.value?.querySelectorAll('button:not(:disabled)') ?? [])
}

function onMenuKeydown(e: KeyboardEvent): void {
  const items = getMenuItems()
  if (!items.length) return
  const idx = items.indexOf(document.activeElement as HTMLButtonElement)
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    const next = items[idx + 1] ?? items[0]
    next.focus()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    const prev = items[idx - 1] ?? items[items.length - 1]
    prev.focus()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    menuOpen.value = false
    confirmingReset.value = false
  }
}

const MENU_WIDTH = 224

function openMenu(event: MouseEvent): void {
  event.preventDefault()
  event.stopPropagation()
  confirmingReset.value = false
  let x = event.clientX
  let y = event.clientY + 4
  if (x + MENU_WIDTH > window.innerWidth) x = window.innerWidth - MENU_WIDTH - 4
  if (x < 4) x = 4
  if (y + MENU_HEIGHT_ESTIMATE > window.innerHeight) {
    y = event.clientY - MENU_HEIGHT_ESTIMATE - 4
    if (y < 4) y = 4
  }
  menuPos.value = { x, y }
  activeDropdownId.value = dropdownId
  menuOpen.value = true
  const close = () => {
    menuOpen.value = false
    confirmingReset.value = false
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

function handleReset(): void {
  menuOpen.value = false
  resetSound(props.sound.key)
}

function handleResetPlayCount(): void {
  const newCounts = { ...(settings.value.playCounts ?? {}), [props.sound.key]: 0 }
  settings.value.playCounts = newCounts
  saveSettings({ playCounts: newCounts })
  confirmingReset.value = false
}

const isMoved = computed(() => !!getSoundCategory(props.sound.key))

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
  if (open) {
    localVolumeOffset.value = settings.value.soundVolumes?.[props.sound.key] ?? 0
    nextTick(() => (menuRef.value as HTMLElement)?.focus())
  } else {
    confirmingReset.value = false
  }
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
    :class="{ 'z-2': isPlaying, 'sbtn-playing': isPlaying }"
    :style="{ animationDelay: `${animationDelay ?? 0}ms` }"
    @contextmenu.prevent="openMenu"
  >
    <!-- Inline rename input (replaces button label) -->
    <div
      v-if="isRenaming"
      class="w-full h-full bg-bg-raised border border-accent px-3.5 py-2 flex items-center"
      @click.stop
      @contextmenu.stop
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
      <div v-if="isPlaying" class="btn-spin-ring pointer-events-none" />

      <button
        draggable="true"
        class="relative w-full h-full bg-bg-raised font-sans text-sm cursor-pointer text-center wrap-break-word transition-all duration-120 outline-none"
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

    <!-- Sound ⋯ menu (teleported to avoid scroll-container clipping) -->
    <Teleport to="body">
      <Transition name="sound-menu">
      <div
        v-if="menuOpen"
        ref="menuRef"
        tabindex="-1"
        class="sound-menu fixed z-500 w-56 bg-bg-raised border border-border-light outline-none"
        :style="{ left: menuPos.x + 'px', top: menuPos.y + 'px' }"
        @click.stop
        @keydown="onMenuKeydown"
      >
        <!-- Header: sound name + play count -->
        <div class="bg-bg-deepest px-3 pt-2.5 pb-2 border-b border-border-light">
          <div class="text-sm font-medium text-text-primary truncate mb-1.5" :title="sound.name">{{ sound.name }}</div>
          <template v-if="!confirmingReset">
            <div class="flex items-center justify-between">
              <span class="text-xs text-text-secondary select-none">{{ playCountLabel }}</span>
              <button
                v-if="playCount > 0"
                class="text-xs text-text-secondary hover:text-danger cursor-pointer transition-colors"
                title="Reset play count"
                @click="confirmingReset = true"
              >reset</button>
            </div>
          </template>
          <template v-else>
            <div class="flex items-center justify-between gap-2">
              <span class="text-[11px] text-text-secondary select-none">Clear count?</span>
              <div class="flex gap-1.5">
                <button
                  class="text-[10px] px-1.5 py-0.5 text-danger border border-danger/40 hover:bg-danger/10 cursor-pointer"
                  @click="handleResetPlayCount"
                >Yes</button>
                <button
                  class="text-[10px] px-1.5 py-0.5 text-text-dim border border-border-light hover:bg-bg-surface cursor-pointer"
                  @click="confirmingReset = false"
                >No</button>
              </div>
            </div>
          </template>
        </div>

        <!-- Actions -->
        <div class="py-1">
          <button v-if="!sound.isHidden" class="sound-menu-item w-full text-left px-4 py-2 text-sm text-text-secondary cursor-pointer" @click="handleHide">Hide</button>
          <button v-else class="sound-menu-item w-full text-left px-4 py-2 text-sm text-text-secondary cursor-pointer" @click="handleRestore">Unhide</button>
          <button class="sound-menu-item w-full text-left px-4 py-2 text-sm text-text-secondary cursor-pointer" @click="startRename">Rename</button>
          <button v-if="isMoved" class="sound-menu-item w-full text-left px-4 py-2 text-sm text-text-secondary cursor-pointer" @click="handleReset">Reset to original</button>
        </div>

        <!-- Volume Offset -->
        <div class="border-t border-border-light px-3 pt-2 pb-3">
          <div class="text-[10px] uppercase tracking-widest text-text-secondary mb-2">Volume Offset</div>
          <VolumeSlider
            :modelValue="localVolumeOffset"
            :min="-CLIP_VOLUME_MAX_DB"
            :max="CLIP_VOLUME_MAX_DB"
            :step="1"
            unit=" dB"
            @update:modelValue="onVolumeInput"
            @change="handleVolumeChange"
          />
          <div v-if="localVolumeOffset !== 0" class="flex justify-end mt-1.5">
            <button
              class="text-xs text-text-secondary hover:text-text-primary cursor-pointer transition-colors"
              @click="resetVolumeOffset"
            >reset</button>
          </div>
        </div>
      </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.sound-menu-enter-active { transition: opacity 0.1s ease, transform 0.1s ease; }
.sound-menu-enter-from { opacity: 0; transform: scale(0.97) translateY(-3px); transform-origin: top; }
.sound-menu-leave-active { transition: opacity 0.08s ease; }
.sound-menu-leave-to { opacity: 0; }

.sound-menu {
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}
.sound-menu :deep(input[type="range"] ~ span) {
  font-size: 11px;
}

.sound-menu-item {
  position: relative;
  transition: background 0.1s ease, color 0.1s ease;
}
.sound-menu-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 15%;
  bottom: 15%;
  width: 2px;
  background: var(--color-accent);
  transform: scaleY(0);
  transition: transform 0.12s ease;
  transform-origin: center;
}
.sound-menu-item:hover {
  background: var(--color-bg-surface);
  color: var(--color-text-primary);
}
.sound-menu-item:hover::before {
  transform: scaleY(1);
}

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
  color: var(--color-accent-text) !important;
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
/* Ambient gold halo — extends 12px outside, blurred, pulses in sync with btn-spin-glow */
.sbtn-playing::after {
  content: '';
  position: absolute;
  inset: -12px;
  background: rgb(from var(--color-accent) r g b / 0.14);
  filter: blur(22px);
  z-index: -1;
  pointer-events: none;
  animation: btn-ambient-pulse 5s ease-in-out infinite;
}
@keyframes btn-ambient-pulse {
  0%, 100% { opacity: 0.6; }
  50%       { opacity: 1; }
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
