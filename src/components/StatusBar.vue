<script setup lang="ts">
import { useSettings } from '../composables/useSettings'
import { useAudioPlayer } from '../composables/useAudioPlayer'

const { settings, soundCount } = useSettings()
const { statusText } = useAudioPlayer()
</script>

<template>
  <div class="flex items-center justify-between px-5 py-1.5 bg-bg-deepest border-t border-border shrink-0">
    <span class="font-mono text-[11px] text-text-dim">{{ statusText }}</span>
    <span class="font-mono text-[11px] text-text-dim">
      <span class="text-accent">{{ soundCount }}</span>
      sounds &middot; Press
      <span class="text-accent">{{ settings.stopHotkey || 'Esc' }}</span>
      to stop
    </span>
  </div>
</template>
