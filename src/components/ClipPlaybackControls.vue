<script setup lang="ts">
import { computed } from 'vue'
import Icon from './Icon.vue'
import Tooltip from './Tooltip.vue'

const props = defineProps<{
  isPlaying: boolean
  loop: boolean
  hasAudio: boolean
  inPoint: number
  outPoint: number
  disabled?: boolean
  compact?: boolean
}>()

const emit = defineEmits<{
  play: []
  pause: []
  stop: []
  seekToIn: []
  'update:loop': [boolean]
  reset: []
}>()

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) return '0.00s'
  const m = Math.floor(s / 60)
  const sec = (s % 60).toFixed(2)
  return m > 0 ? `${m}:${sec.padStart(5, '0')}` : `${sec}s`
}

const selectionDur = computed(() => Math.max(0, props.outPoint - props.inPoint))
</script>

<template>
  <div
    class="shrink-0 bg-bg-raised"
    :class="compact
      ? 'px-3 py-2.5 border-b border-border-light'
      : 'px-4 py-3 border-t border-border-light'"
  >
    <!-- Buttons -->
    <div class="flex items-center mb-2" :class="compact ? 'gap-1.5' : 'gap-2'">
      <Tooltip text="Skip to in-point">
        <button class="ctrl-btn" :class="{ 'ctrl-btn--sm': compact }" :disabled="disabled" @click="emit('seekToIn')">
          <Icon name="backward-step-solid" class="text-[11px]" />
        </button>
      </Tooltip>

      <Tooltip :text="isPlaying ? 'Pause' : 'Play'">
        <button
          class="ctrl-btn"
          :class="[{ 'ctrl-btn--sm': compact }, !compact && 'ctrl-btn--wide']"
          :disabled="!hasAudio || disabled"
          @click="isPlaying ? emit('pause') : emit('play')"
          @keydown.space.prevent
        >
          <Icon :name="isPlaying ? 'pause-solid' : 'play-solid'" class="text-[11px]" />
        </button>
      </Tooltip>

      <Tooltip text="Stop">
        <button class="ctrl-btn" :class="{ 'ctrl-btn--sm': compact }" :disabled="!isPlaying || disabled" @click="emit('stop')">
          <Icon name="stop" class="text-[12px]" />
        </button>
      </Tooltip>

      <Tooltip text="Loop selection">
        <button
          class="ctrl-btn"
          :class="[{ 'ctrl-btn--sm': compact }, loop && 'ctrl-btn--active']"
          :disabled="disabled"
          @click="emit('update:loop', !loop)"
        >
          <Icon name="arrow-rotate-right-rrr" class="text-[12px]" />
        </button>
      </Tooltip>

      <div class="flex-1" />

      <Tooltip text="Reset trim">
        <button class="reset-btn" :disabled="disabled" @click="emit('reset')">Reset</button>
      </Tooltip>
    </div>

    <!-- Time display -->
    <div class="flex gap-3 font-mono" :class="compact ? 'text-[10px] text-text-dim' : 'text-xs text-text-secondary'">
      <span>In: <span class="text-text-secondary">{{ formatTime(inPoint) }}</span></span>
      <span>Out: <span class="text-text-secondary">{{ formatTime(outPoint) }}</span></span>
      <span class="ml-auto text-text-secondary">{{ formatTime(selectionDur) }}</span>
    </div>
  </div>
</template>

<style scoped>
.ctrl-btn {
  width: 32px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-light);
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 12px;
  transition: background 0.1s, color 0.1s, border-color 0.1s;
  outline: none;
}
.ctrl-btn--sm { width: 30px; height: 28px; }
.ctrl-btn--wide { width: 44px; }
.ctrl-btn:hover:not(:disabled) {
  background: var(--color-bg-surface-hover);
  color: var(--color-text-primary);
  border-color: var(--color-text-dim);
}
.ctrl-btn--active {
  background: var(--color-accent-glow);
  border-color: var(--color-accent);
  color: var(--color-accent);
}
.ctrl-btn:disabled {
  opacity: 0.35;
  pointer-events: none;
}
.reset-btn {
  background: transparent;
  border: none;
  font-size: 10px;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-family: var(--font-sans);
  font-weight: 300;
  transition: color 0.1s;
  padding: 2px 4px;
}
.reset-btn:hover:not(:disabled) { color: var(--color-text-primary); }
.reset-btn:disabled { opacity: 0.35; pointer-events: none; }
</style>
