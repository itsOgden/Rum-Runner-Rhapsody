<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAudioPlayer } from '@/composables/useAudioPlayer'
import { useSettings } from '@/composables/useSettings'
import { settingsModalOpen, helpModalOpen } from '@/modalState'
import WordmarkSvg from '@/assets/images/wordmark.svg'
import LogoSvg from '@/assets/images/logo.svg'
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
  <div class="h-14 grid grid-cols-3 items-center bg-bg-deepest border-b border-border-light shrink-0 app-region-drag">

    <!-- Left: logo -->
    <div class="flex items-center gap-1 text-accent pl-3 pt-0.5">
<!--      <LogoSvg class="h-12" />-->
      <WordmarkSvg class="h-10" />
    </div>

    <!-- Center: master volume (1/3 column, matches search bar below) -->
    <div class="flex items-center gap-1.75 app-region-no-drag w-65 mx-auto">
      <span class="text-xs text-text-primary font-medium uppercase tracking-[0.06em] whitespace-nowrap shrink-0">Master</span>
      <input
        type="range"
        min="0"
        max="100"
        v-model.number="masterPercent"
        @change="onMasterChange"
        class="min-w-15"
      />
      <span class="text-xs text-text-primary font-medium min-w-8.5 text-right shrink-0">{{ masterPercent }}%</span>
    </div>

    <!-- Right: app controls + divider + window controls -->
    <div class="flex items-center justify-end">
      <button
        class="wc-btn text-danger! hover:bg-danger/20! app-region-no-drag"
        title="Stop all sounds"
        :class="{ 'invisible pointer-events-none': playingPaths.size === 0 }"
        @click="stopAll"
      >
        <Icon name="stop" />
      </button>
      <button class="wc-btn app-region-no-drag" title="Help" @click="helpModalOpen = true">
        <Icon name="circle-question" class="text-base" />
      </button>
      <button class="wc-btn app-region-no-drag" title="Settings" @click="settingsModalOpen = true">
        <Icon name="gear-solid" />
      </button>

      <div class="w-px h-5 bg-border-light shrink-0 mx-1 self-center" aria-hidden="true" />

      <button class="wc-btn app-region-no-drag" title="Minimize" @click="minimize">
        <Icon name="window-minimize-solid" />
      </button>
      <button class="wc-btn app-region-no-drag" title="Maximize / Restore" @click="toggleMaximize">
        <Icon v-if="isMaximized" name="window-restore" class="text-[15px]" />
        <Icon v-else name="window-maximize" class="text-[13px]" />
      </button>
      <button class="wc-btn app-region-no-drag hover:bg-[rgba(255,0,0,0.7)]! hover:text-white!" title="Close" @click="close">
        <Icon name="xmark-solid" />
      </button>
    </div>
  </div>
</template>

<style scoped>

/* Shared titlebar button — transparent, subtle hover */
.wc-btn {
  width: 32px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--color-text-primary);
  cursor: pointer;
  padding: 0;
  outline: none;
  transition: background 0.1s, color 0.1s;
  font-size: 14px;
}
.wc-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--color-text-primary);
}
</style>
