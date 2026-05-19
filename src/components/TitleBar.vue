<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAudioPlayer } from '@/composables/useAudioPlayer'
import { useSettings } from '@/composables/useSettings'
import { useShadowRecord } from '@/composables/useShadowRecord'
import { settingsModalOpen, settingsModalInitialTab, helpModalOpen } from '@/modalState'
import { clipEditorOpen, trimSidebarOpen } from '@/clipEditorState'
import WordmarkSvg from '@/assets/images/wordmark.svg'
import LogoSvg from '@/assets/images/logo.svg'
import Icon from '@/components/Icon.vue'
import Tooltip from '@/components/Tooltip.vue'


const { stopAll, playingPaths } = useAudioPlayer()
const { settings, saveSettings } = useSettings()
const { isRecording, isSaving, hasBuffer, saveClip } = useShadowRecord()

const canSave = computed(() => hasBuffer.value && !isSaving.value)

const shadowNotConfigured = computed(() => {
  if (isRecording.value) return false
  const hasDevice = !!settings.value.recordingInputDeviceLabel
  const hasFolder = !!settings.value.recordingFolder
  return (hasDevice || hasFolder) && !(hasDevice && hasFolder)
})

const saveTooltip = computed(() => {
  if (isSaving.value) return 'Saving…'
  if (!hasBuffer.value) return 'Buffering audio…'
  return settings.value.hotkeys?.saveClip ? `Save clip (${settings.value.hotkeys.saveClip})` : 'Save clip'
})

function openShadowSettings() {
  settingsModalInitialTab.value = 'shadowrecord'
  settingsModalOpen.value = true
}

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
    <div class="flex items-center gap-1.75 app-region-no-drag md:w-65 mx-auto">
      <span class="text-xs max-md:hidden text-text-primary font-medium uppercase tracking-[0.06em] whitespace-nowrap shrink-0">Master</span>
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

      <!-- Clip editor access — when recording folder is configured -->
      <Tooltip v-if="settings.recordingFolder" text="Clip Editor">
        <button
          class="wc-btn app-region-no-drag"
          :class="{ 'text-accent!': clipEditorOpen }"
          @click="clipEditorOpen ? (clipEditorOpen = false) : (trimSidebarOpen = false, clipEditorOpen = true)"
        >
          <Icon name="scissors" class="text-[13px]" />
        </button>
      </Tooltip>

      <!-- Shadow record: recording → combined dot + scissors save button -->
      <Tooltip v-if="isRecording" :text="saveTooltip">
        <button
          class="rec-combined-btn app-region-no-drag"
          :class="{ 'is-disabled': !canSave }"
          @click="saveClip"
        >
          <span class="rec-dot" />
          <Icon name="scissors" class="text-[12px] shrink-0" />
          <span class="rec-label">{{ isSaving ? 'Saving…' : 'Clip' }}</span>
        </button>
      </Tooltip>

      <!-- Shadow record: not configured → setup shortcut -->
      <Tooltip v-else-if="shadowNotConfigured" text="Recording not fully configured — click to set up">
        <button class="rec-setup-btn app-region-no-drag" @click="openShadowSettings">
          <span class="rec-setup-dot" />
          <Icon name="scissors" class="text-[12px] shrink-0" />
          <span class="rec-label">Clip</span>
        </button>
      </Tooltip>

      <Tooltip text="Stop all sounds">
        <button
          class="wc-btn text-danger! hover:bg-danger/20! app-region-no-drag"
          :class="{ 'invisible pointer-events-none': playingPaths.size === 0 }"
          @click="stopAll"
        >
          <Icon name="stop" />
        </button>
      </Tooltip>
      <Tooltip text="Help">
        <button class="wc-btn app-region-no-drag" @click="helpModalOpen = true">
          <Icon name="circle-question" class="text-base" />
        </button>
      </Tooltip>
      <Tooltip text="Settings">
        <button class="wc-btn app-region-no-drag" @click="settingsModalOpen = true">
          <Icon name="gear-solid" />
        </button>
      </Tooltip>

      <div class="w-px h-5 bg-border-light shrink-0 mx-1 self-center" aria-hidden="true" />

      <Tooltip text="Minimize">
        <button class="wc-btn app-region-no-drag" @click="minimize">
          <Icon name="window-minimize-solid" />
        </button>
      </Tooltip>
      <Tooltip text="Maximize / Restore">
        <button class="wc-btn app-region-no-drag" @click="toggleMaximize">
          <Icon v-if="isMaximized" name="window-restore" class="text-[15px]" />
          <Icon v-else name="window-maximize" class="text-[13px]" />
        </button>
      </Tooltip>
      <Tooltip text="Close">
        <button class="wc-btn app-region-no-drag hover:bg-[rgba(255,0,0,0.7)]! hover:text-white!" @click="close">
          <Icon name="xmark-solid" />
        </button>
      </Tooltip>
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

.rec-combined-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  height: 48px;
  padding: 0 10px;
  background: transparent;
  border: none;
  color: var(--color-danger);
  cursor: pointer;
  transition: background 0.12s;
  outline: none;
}
.rec-combined-btn:hover {
  background: rgba(255, 80, 64, 0.12);
}
.rec-combined-btn.is-disabled {
  opacity: 0.4;
  pointer-events: none;
}

.rec-label {
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
}

.rec-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
  animation: pulse 1.5s ease-in-out infinite;
}

.rec-setup-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  height: 48px;
  padding: 0 10px;
  background: transparent;
  border: none;
  color: var(--color-text-dim);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
  outline: none;
}
.rec-setup-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--color-text-secondary);
}

.rec-setup-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  border: 1.5px solid currentColor;
  flex-shrink: 0;
}
</style>
