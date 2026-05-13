<script setup lang="ts">
import { computed } from 'vue'
import { useSettings } from '../composables/useSettings'
import { useAudioPlayer } from '../composables/useAudioPlayer'
import { useStreamDeckImageErrors } from '../composables/useStreamDeckImageErrors'
import Icon from './Icon.vue'

const { settings, soundCount } = useSettings()
const { statusText } = useAudioPlayer()
const { brokenCount, brokenSources } = useStreamDeckImageErrors()

const brokenWarning = computed(() => {
  const n = brokenCount.value
  if (!n) return ''
  if(!['Ready', 'Stopped'].includes(statusText.value)) return ''
  const label = n === 1 ? 'image' : 'images'
  if (!brokenSources.value.length) return `${n} Stream Deck ${label} missing`
  const shown = brokenSources.value.slice(0, 3)
  const rest = brokenSources.value.length - shown.length
  const names = rest > 0 ? [...shown, '…'].join(', ') : shown.join(', ')
  return `${n} Stream Deck ${label} missing (${names})`
})
</script>

<template>
  <div class="flex items-center justify-between px-5 py-1.5 bg-bg-deepest border-t border-border shrink-0">
    <div class="flex items-center gap-3">
      <span class="font-mono text-[11px] text-text-dim">{{ statusText }}</span>
      <span v-if="brokenWarning" class="flex items-center gap-1 font-mono text-[11px] text-danger">
        <Icon name="triangle-exclamation" class="shrink-0" />
        {{ brokenWarning }}
      </span>
    </div>
    <span class="font-mono text-[11px] text-text-dim">
      <span class="text-accent">{{ soundCount }}</span>
      sounds &middot; Press
      <span class="text-accent">{{ settings.hotkeys?.stop || 'Esc' }}</span>
      to stop
    </span>
  </div>
</template>

