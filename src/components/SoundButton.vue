<script setup>
import { computed } from 'vue'
import { useAudioPlayer } from '../composables/useAudioPlayer.js'

const props = defineProps({
  sound: { type: Object, required: true },
  animationDelay: { type: Number, default: 0 },
})

const { playSound, playingPaths } = useAudioPlayer()

const isPlaying = computed(() => playingPaths.value.has(props.sound.path))

function handleClick() {
  playSound(props.sound)
}
</script>

<template>
  <button
    class="relative bg-bg-raised border border-border rounded-md px-3.5 py-4.5 font-sans text-[13px] font-medium text-text-primary cursor-pointer text-center break-words transition-all duration-[120ms] outline-none overflow-hidden fade-in hover:-translate-y-px hover:border-accent-dim hover:shadow-md active:translate-y-0 active:bg-bg-surface-active"
    :class="{
      'border-accent shadow-[0_0_20px_var(--color-accent-glow)] sound-btn-playing': isPlaying,
    }"
    :style="{ animationDelay: `${animationDelay}ms` }"
    @click="handleClick"
  >
    {{ sound.name }}
  </button>
</template>
