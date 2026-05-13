<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAudioPlayer } from '../composables/useAudioPlayer'
import { useSettings } from '../composables/useSettings'
import { settingsModalOpen, helpModalOpen } from '../modalState'
import appIcon from '../../app-icon.png'
import Icon from '@/components/Icon.vue'

const { stopAll, playingPaths } = useAudioPlayer()
const { settings, saveSettings } = useSettings()

const isMaximized = ref(false)

const masterPercent = computed({
  get: () => Math.round((settings.value.masterVolume ?? 1.0) * 100),
  set: (v) => { settings.value.masterVolume = v / 100 },
})

function onMasterChange() {
  saveSettings({ masterVolume: settings.value.masterVolume })
}

function minimize() { window.api.windowMinimize() }
function toggleMaximize() { window.api.windowMaximize() }
function close() { window.api.windowClose() }

onMounted(async () => {
  isMaximized.value = await window.api.windowIsMaximized()
  window.api.onWindowMaximized((val: boolean) => { isMaximized.value = val })
})
</script>

<template>
  <div class="h-10 flex items-center pl-3 gap-1.5 bg-bg-deepest border-b border-border shrink-0 app-region-drag">

    <!-- Left: app icon + title -->
    <div class="flex items-center gap-2 shrink-0 pointer-events-none">
      <img :src="appIcon" alt="" aria-hidden="true" class="w-[15px] h-[15px] object-contain" />
      <span class="font-display text-[15px] text-accent leading-none whitespace-nowrap">Rum-Runner Rhapsody</span>
    </div>

    <!-- Center: master volume -->
    <div class="flex items-center gap-[7px] flex-1 max-w-[280px] mx-auto app-region-no-drag">
      <span class="font-mono text-[10px] text-text-dim uppercase tracking-[0.06em] whitespace-nowrap shrink-0">Master</span>
      <input
        type="range"
        min="0"
        max="100"
        v-model.number="masterPercent"
        @change="onMasterChange"
        class="min-w-[60px]"
      />
      <span class="font-mono text-[11px] text-text-secondary min-w-[34px] text-right shrink-0">{{ masterPercent }}%</span>
    </div>

    <!-- Right A: app controls -->
    <div class="flex items-stretch shrink-0 h-10 app-region-no-drag">
      <button
        class="wc-btn text-danger! hover:bg-danger/20!"
        title="Stop all sounds"
        :class="{ 'invisible pointer-events-none': playingPaths.size === 0 }"
        @click="stopAll"
      >
        <Icon name="stop" />
      </button>
      <button class="wc-btn" title="Help" @click="helpModalOpen = true">
        <Icon name="circle-question" class="text-base" />
      </button>
      <button class="wc-btn" title="Settings" @click="settingsModalOpen = true">
        <Icon name="gear-solid" />
      </button>
    </div>

    <!-- Divider -->
    <div class="w-px h-5 bg-border shrink-0 mx-1 self-center" aria-hidden="true" />

    <!-- Right B: window controls -->
    <div class="flex items-stretch shrink-0 h-10 app-region-no-drag">
      <button class="wc-btn" title="Minimize" @click="minimize">
        <Icon name="window-minimize-solid" />
      </button>
      <button class="wc-btn" title="Maximize / Restore" @click="toggleMaximize">
        <Icon v-if="isMaximized" name="window-restore" class="text-[15px]" />
        <Icon v-else name="window-maximize" class="text-[13px]" />
      </button>
      <button class="wc-btn hover:bg-[rgba(255,0,0,0.7)]! hover:text-white!" title="Close" @click="close">
        <Icon name="xmark-solid" />
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Shared titlebar button — 32×40px, transparent, subtle hover */
.wc-btn {
  width: 32px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 13px;
  padding: 0;
  outline: none;
  transition: background 0.1s, color 0.1s;
}
.wc-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--color-text-primary);
}
</style>
