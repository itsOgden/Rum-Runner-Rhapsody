<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAudioPlayer } from '../composables/useAudioPlayer'
import { useSettings } from '../composables/useSettings'
import { settingsModalOpen } from '../modalState'
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

function toggleTheme() {
  const next = settings.value.theme === 'dark' ? 'light' : 'dark'
  settings.value.theme = next
  saveSettings({ theme: next })
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
  <div class="titlebar">
    <!-- Left: app icon + title — inherits drag -->
    <div class="titlebar-left">
      <img :src="appIcon" alt="" aria-hidden="true" class="titlebar-icon" />
      <span class="titlebar-title">Rum-Runner Rhapsody</span>
    </div>

    <!-- Center: master volume — no-drag -->
    <div class="titlebar-center">
      <span class="volume-label">Master</span>
      <input
        type="range"
        min="0"
        max="100"
        v-model.number="masterPercent"
        @change="onMasterChange"
        class="volume-slider"
      />
      <span class="volume-value">{{ masterPercent }}%</span>
    </div>

    <!-- Right A: app controls — no-drag -->
    <div class="titlebar-app-controls">
      <button
        class="wc-btn text-danger! hover:bg-danger/20!"
        title="Stop all sounds"
        :class="{ 'invisible pointer-events-none': playingPaths.size === 0 }"
        @click="stopAll"
      >
        <Icon name="stop" />
      </button>
      <button
        class="wc-btn"
        :title="settings.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
        @click="toggleTheme"
      >
        <Icon :name="settings.theme !== 'dark' ? 'sun-bright-solid' : 'moon'" />
      </button>
      <button class="wc-btn" title="Settings" @click="settingsModalOpen = true">
        <Icon name="gear-solid" />
      </button>
    </div>

    <!-- Divider — inherits drag -->
    <div class="titlebar-divider" aria-hidden="true"></div>

    <!-- Right B: window controls — no-drag -->
    <div class="titlebar-wincontrols">
      <button class="wc-btn" title="Minimize" @click="minimize">
        <Icon name="window-minimize-solid" />
      </button>
      <button class="wc-btn" title="Maximize / Restore" @click="toggleMaximize">
        <Icon v-if="isMaximized" class="wc-restore-icon" name="window-restore" />
        <Icon v-else class="wc-maximize-icon" name="window-maximize" />
      </button>
      <button class="wc-btn wc-hover-red" title="Close" @click="close">
        <Icon name="xmark-solid" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.titlebar {
  height: 40px;
  display: flex;
  align-items: center;
  padding: 0 0 0 12px;
  background: var(--color-bg-deepest);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
  -webkit-app-region: drag;
  gap: 6px;
}

/* ── Left ── */
.titlebar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.titlebar-icon {
  width: 15px;
  height: 15px;
  object-fit: contain;
  pointer-events: none;
}

.titlebar-title {
  font-family: var(--font-display);
  font-size: 15px;
  color: var(--color-accent);
  line-height: 1;
  white-space: nowrap;
  pointer-events: none;
}

/* ── Center: volume ── */
.titlebar-center {
  display: flex;
  align-items: center;
  gap: 7px;
  flex: 1;
  max-width: 280px;
  margin: 0 auto;
  -webkit-app-region: no-drag;
}

.volume-label {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--color-text-dim);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  white-space: nowrap;
  flex-shrink: 0;
}

.volume-slider {
  -webkit-appearance: none;
  flex: 1;
  height: 4px;
  background: var(--color-bg-surface);
  border-radius: 2px;
  outline: none;
  min-width: 60px;
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--color-accent);
  cursor: pointer;
  box-shadow: 0 0 6px var(--color-accent-glow);
  transition: box-shadow 0.15s;
}

.volume-slider::-webkit-slider-thumb:hover {
  box-shadow: 0 0 12px var(--color-accent-glow);
}

.volume-value {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-text-secondary);
  min-width: 34px;
  text-align: right;
  flex-shrink: 0;
}

/* ── Right A: app controls ── */
.titlebar-app-controls {
  display: flex;
  align-items: stretch;
  flex-shrink: 0;
  height: 40px;
  -webkit-app-region: no-drag;
}

/* ── Divider ── */
.titlebar-divider {
  width: 1px;
  height: 20px;
  background: var(--color-border);
  flex-shrink: 0;
  margin: 0 4px;
  align-self: center;
}

/* ── Shared button style (app controls + window controls) ── */
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
  line-height: 1;
  padding: 0;
  outline: none;
  transition: background 0.1s, color 0.1s;
}

.wc-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--color-text-primary);
}

/* ── Right B: window controls ── */
.titlebar-wincontrols {
  display: flex;
  align-items: stretch;
  flex-shrink: 0;
  height: 40px;
  -webkit-app-region: no-drag;
}

.wc-hover-red:hover {
  background: rgba(255, 0, 0, 0.7);
  color: #fff;
}

.wc-maximize-icon {
  font-size: 13px;
}

.wc-restore-icon {
  font-size: 15px;
}
</style>
