<script setup>
import { ref } from 'vue'
import SoundButton from './SoundButton.vue'

defineProps({
  group: { type: Object, required: true },
  columns: { type: Number, default: 4 },
})

const collapsed = ref(false)
</script>

<template>
  <div class="mb-3">
    <!-- Header -->
    <div
      class="flex items-center gap-2 px-3 py-2 bg-bg-raised border border-border rounded-sm cursor-pointer select-none transition-colors hover:bg-bg-surface-hover hover:border-border-light"
      @click="collapsed = !collapsed"
    >
      <span
        class="text-[10px] text-text-dim transition-transform duration-200"
        :class="{ '-rotate-90': collapsed }"
      >&#x25BC;</span>
      <span class="font-mono text-xs font-semibold text-text-secondary flex-1">
        {{ group.folderName }}
      </span>
      <span class="font-mono text-[11px] text-text-dim">{{ group.sounds.length }}</span>
    </div>

    <!-- Body -->
    <div v-show="!collapsed" class="pt-2">
      <div
        class="grid gap-2"
        :style="{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }"
      >
        <SoundButton
          v-for="(sound, index) in group.sounds"
          :key="sound.path"
          :sound="sound"
          :animation-delay="index * 25"
        />
      </div>
    </div>
  </div>
</template>
