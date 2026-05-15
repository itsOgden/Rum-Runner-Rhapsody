<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSettings } from '../composables/useSettings'
import { useAudioDevices } from '../composables/useAudioDevices'
import { useSoundManagement } from '../composables/useSoundManagement'
import { useStreamDeckImageErrors } from '../composables/useStreamDeckImageErrors'
import { filterQuery } from '../filterState'
import type { FolderRemoveResult } from '../types'
import CircleButton from '@/components/CircleButton.vue'
import Icon from '@/components/Icon.vue'
import SoundboardModal from '@/components/SoundboardModal.vue'

const { settings, onFolderChanged, saveSettings, loadSounds } = useSettings()
const { refreshDevices } = useAudioDevices()
const { showHidden, resetSessionState } = useSoundManagement()
const { scanAll } = useStreamDeckImageErrors()

// ── Display name helpers ──────────────────────────────────────────────────────

function folderBasename(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path
}

function getDisplayName(path: string): string {
  return settings.value.folderDisplayNames[path] || folderBasename(path)
}

const activeDisplayName = computed(() =>
  settings.value.soundFolder ? getDisplayName(settings.value.soundFolder) : null
)

// ── Soundboard edit modal ─────────────────────────────────────────────────────

const soundboardModalOpen = ref(false)

// ── Folder switcher dropdown ──────────────────────────────────────────────────

const dropdownOpen = ref(false)
const triggerRef = ref<HTMLButtonElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const dropdownPos = ref({ x: 0, y: 0, minWidth: 0 })
let outsideHandler: ((e: MouseEvent) => void) | null = null

function removeOutsideHandler() {
  if (outsideHandler) {
    document.removeEventListener('mousedown', outsideHandler)
    outsideHandler = null
  }
}

function openDropdown() {
  removeOutsideHandler()
  if (!triggerRef.value) return
  const rect = triggerRef.value.getBoundingClientRect()
  const itemCount = settings.value.savedFolders.length + 1
  const est = Math.min(itemCount * 36 + 8, 280)
  const y = rect.bottom + 2 + est > window.innerHeight ? rect.top - est - 2 : rect.bottom + 2
  dropdownPos.value = { x: rect.left, y, minWidth: Math.max(rect.width, 240) }
  dropdownOpen.value = true
  outsideHandler = (e: MouseEvent) => {
    if (!menuRef.value?.contains(e.target as Node) && !triggerRef.value?.contains(e.target as Node)) {
      closeDropdown()
    }
  }
  setTimeout(() => document.addEventListener('mousedown', outsideHandler!), 0)
}

function closeDropdown() {
  removeOutsideHandler()
  dropdownOpen.value = false
}

function toggleDropdown() {
  dropdownOpen.value ? closeDropdown() : openDropdown()
}

async function handleSwitch(path: string) {
  closeDropdown()
  if (path === settings.value.soundFolder) return
  filterQuery.value = ''
  resetSessionState()
  const result = await window.api.switchFolder(path)
  if (result) await onFolderChanged(result)
}

async function handleAddFolder() {
  closeDropdown()
  const result = await window.api.pickFolder()
  if (result) {
    filterQuery.value = ''
    resetSessionState()
    await onFolderChanged(result)
  }
}

function handlePencilClick(e: MouseEvent) {
  e.stopPropagation()
  closeDropdown()
  soundboardModalOpen.value = true
}

function toggleShowHidden() {
  showHidden.value = !showHidden.value
}

async function handleRefresh() {
  await refreshDevices()
  await loadSounds()
  await scanAll(settings.value)
}

function setDensity(val: 'loose' | 'compact') {
  if (settings.value.density === val) return
  settings.value.density = val
  saveSettings({ density: val })
}

// ── Space → focus search ──────────────────────────────────────────────────────

const searchInputEl = ref<HTMLInputElement | null>(null)

function onGlobalKeydown(e: KeyboardEvent): void {
  if (e.code !== settings.value.hotkeys.search) return
  const target = e.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
  e.preventDefault()
  searchInputEl.value?.focus()
}

onMounted(() => document.addEventListener('keydown', onGlobalKeydown))
onUnmounted(() => {
  document.removeEventListener('keydown', onGlobalKeydown)
  removeOutsideHandler()
})
</script>

<template>
  <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-1.5 bg-bg-base border-b border-border-light shrink-0 md:grid md:grid-cols-3 md:gap-3">

    <!-- Left: soundboard switcher + controls -->
    <div class="flex items-center gap-1.5">

      <!-- Trigger with inline pencil -->
      <div class="group/sb">
        <button
          ref="triggerRef"
          class="soundboard-trigger flex items-center gap-2 h-9 px-3 outline-none cursor-pointer max-w-[260px] min-w-50"
          :class="{ 'is-open': dropdownOpen }"
          :title="settings.soundFolder || 'No soundboard selected'"
          @click="toggleDropdown"
          @contextmenu.prevent="handlePencilClick"
        >
          <span class="flex-1 min-w-0 text-left">
            <span
              class="block truncate font-display text-sm leading-none tracking-wide"
              :class="activeDisplayName ? 'text-text-on-accent' : 'text-text-on-accent/50'"
            >{{ activeDisplayName ?? 'No soundboard' }}</span>
          </span>
          <!-- Pencil — appears on hover, left of chevron -->
          <span
            v-if="settings.soundFolder"
            class="opacity-0 group-hover/sb:opacity-100 transition-opacity duration-150 flex items-center shrink-0"
            @click.stop="handlePencilClick"
          >
            <Icon name="pencil-solid" class="text-[10px] text-text-on-accent/70 hover:text-text-on-accent" />
          </span>
          <Icon
            name="chevron-down-solid"
            class="text-[9px] shrink-0 transition-transform duration-200 text-text-on-accent/60"
            :class="{ 'rotate-180': dropdownOpen }"
          />
        </button>
      </div>

      <!-- Refresh (accent-colored, always visible) -->
      <button
        class="toolbar-icon-btn !text-accent hover:!text-accent"
        title="Refresh devices and sounds"
        @click="handleRefresh"
      >
        <Icon name="arrow-rotate-right" />
      </button>

    </div>

    <!-- Center: search -->
    <div class="relative flex items-center w-full order-last md:order-0 md:w-96 max-w-full md:mx-auto">
      <input
        ref="searchInputEl"
        type="text"
        v-model="filterQuery"
        placeholder="Search sounds…"
        class="w-full font-sans text-sm bg-bg-surface border border-border-light pl-3 pr-7 h-9 text-text-primary placeholder:text-text-dim outline-none focus:border-accent focus:shadow-[0_0_6px_var(--color-accent-glow)] transition-all"
      />
      <CircleButton
        v-if="filterQuery"
        icon="xmark-solid"
        title="Clear search"
        class="absolute right-2"
        @click="filterQuery = ''"
      />
    </div>

    <!-- Right: view controls -->
    <div class="flex items-center gap-3 ml-auto md:ml-0 md:justify-end text-xs select-none">

      <!-- Density -->
      <div class="flex items-center gap-1.5">
        <button
          class="transition-colors cursor-pointer outline-none"
          :class="settings.density !== 'compact' ? 'text-accent-text font-medium' : 'text-text-dim hover:text-text-secondary'"
          @click="setDensity('loose')"
        >Loose</button>
        <span class="text-text-dim">·</span>
        <button
          class="transition-colors cursor-pointer outline-none"
          :class="settings.density === 'compact' ? 'text-accent-text font-medium' : 'text-text-dim hover:text-text-secondary'"
          @click="setDensity('compact')"
        >Compact</button>
      </div>

      <!-- Divider -->
      <span class="w-px h-3.5 bg-border-light shrink-0" aria-hidden="true" />

      <!-- Show hidden toggle -->
      <button
        class="flex items-center gap-1 transition-colors cursor-pointer outline-none"
        :class="showHidden ? 'text-accent-text' : 'text-text-dim hover:text-text-secondary'"
        :title="showHidden ? 'Hide hidden sounds' : 'Show hidden sounds'"
        @click="toggleShowHidden"
      >
        <span class="text-[11px] w-3.5 flex items-center"><Icon :name="showHidden ? 'eye' : 'eye-slash'" /></span>
        Show hidden
      </button>

    </div>

  </div>

  <!-- Folder switcher dropdown (teleported) -->
  <Teleport to="body">
    <Transition name="folder-dropdown">
      <div
        v-if="dropdownOpen"
        ref="menuRef"
        class="fixed z-500 bg-bg-raised border border-border-light shadow-lg py-1 overflow-y-auto"
        :style="{ left: dropdownPos.x + 'px', top: dropdownPos.y + 'px', minWidth: dropdownPos.minWidth + 'px', maxHeight: '280px' }"
        @click.stop
      >
        <!-- Saved folder items (no × — management is in the edit modal) -->
        <div
          v-for="folder in settings.savedFolders"
          :key="folder"
          class="folder-item flex items-center gap-1 pl-3 pr-3 cursor-pointer"
          :class="folder === settings.soundFolder
            ? 'text-accent bg-bg-surface folder-item--active'
            : 'text-text-secondary hover:bg-bg-surface hover:text-text-primary'"
          @click="handleSwitch(folder)"
        >
          <span class="flex-1 py-2 text-sm font-sans truncate text-left" :title="folder">
            {{ getDisplayName(folder) }}
          </span>
        </div>

        <!-- Divider + add folder -->
        <div v-if="settings.savedFolders.length > 0" class="my-1 border-t border-border-light" />
        <button
          class="folder-item w-full flex items-center gap-2 px-3 py-2 text-sm font-sans text-text-dim hover:text-text-primary hover:bg-bg-surface outline-none cursor-pointer transition-colors text-left"
          @click="handleAddFolder"
        >
          <Icon name="plus" class="text-[11px]" />
          Add folder…
        </button>
      </div>
    </Transition>
  </Teleport>

  <!-- Soundboard edit modal -->
  <SoundboardModal :open="soundboardModalOpen" @close="soundboardModalOpen = false" />
</template>

<style scoped>
/* ── Soundboard trigger — accent filled button ── */
.soundboard-trigger {
  background: var(--color-accent);
  border: 1px solid var(--color-accent);
  transition: box-shadow 0.2s ease;
}

.soundboard-trigger:hover {
  box-shadow: 0 0 14px 4px var(--color-accent-glow), 0 0 6px 1px var(--color-accent);
}

.soundboard-trigger.is-open {
  box-shadow: 0 0 18px 6px var(--color-accent-glow), 0 0 8px 2px var(--color-accent);
}

/* ── Dropdown animation ── */
.folder-dropdown-enter-active { transition: opacity 0.1s ease, transform 0.1s ease; }
.folder-dropdown-enter-from { opacity: 0; transform: translateY(-4px) scale(0.98); transform-origin: top; }
.folder-dropdown-leave-active { transition: opacity 0.08s ease; }
.folder-dropdown-leave-to { opacity: 0; }

/* ── Folder items — accent left bar design language ── */
.folder-item {
  position: relative;
}
.folder-item::before {
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
.folder-item:hover::before {
  transform: scaleY(1);
}
.folder-item--active::before {
  transform: scaleY(1);
  transition: none;
}
</style>
