<script setup>
import { ref, computed } from 'vue'
import SoundButton from './SoundButton.vue'

const props = defineProps({
  group: { type: Object, required: true },
  density: { type: String, default: 'loose' },
  filter: { type: String, default: '' },
})

const collapsed = ref(false)

const visibleSounds = computed(() => {
  if (!props.filter) return props.group.sounds
  const q = props.filter.toLowerCase()
  return props.group.sounds.filter(s => s.name.toLowerCase().includes(q))
})

// When a filter is active, always expand; otherwise respect the user's collapsed state
const isCollapsed = computed(() => collapsed.value && !props.filter)

function toggleCollapse() {
  if (!props.filter) collapsed.value = !collapsed.value
}

const minCellSize = computed(() => props.density === 'compact' ? '150px' : '200px')
</script>

<template>
  <div v-if="!filter || visibleSounds.length > 0" class="mb-3">
    <!-- Header -->
    <div :class="!filter && 'cursor-pointer transition-colors hover:bg-bg-surface-hover hover:border-border-light'"
      class="flex items-center gap-2 px-3 py-2 bg-bg-raised border border-border rounded-sm select-none"
      @click="toggleCollapse"
    >
      <span v-if="!filter"
        class="text-[10px] text-text-dim transition-transform duration-200"
        :class="{ '-rotate-90': isCollapsed }"
      >&#x25BC;</span>
      <span class="font-display text-sm text-accent flex-1">
        {{ group.folderName }}
      </span>
      <span class="font-mono text-[11px] text-text-dim">{{ visibleSounds.length }}</span>
    </div>

    <!-- Body -->
    <div v-show="!isCollapsed" class="pt-2">
      <div
        class="grid gap-2"
        :style="{ gridTemplateColumns: `repeat(auto-fill, minmax(${minCellSize}, 1fr))` }"
      >
        <SoundButton
          v-for="(sound, index) in visibleSounds"
          :key="sound.path"
          :sound="sound"
          :animation-delay="index * 25"
        />
      </div>
    </div>
  </div>
</template>
