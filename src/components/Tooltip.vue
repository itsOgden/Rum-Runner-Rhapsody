<script setup lang="ts">
import { ref, nextTick, onUnmounted } from 'vue'

const props = withDefaults(defineProps<{
  text?: string
  delay?: number
}>(), { delay: 400 })

const tooltipEl = ref<HTMLElement | null>(null)
const visible = ref(false)
const pos = ref({ x: 0, y: 0 })
let timer: ReturnType<typeof setTimeout> | null = null
let mx = 0
let my = 0

const CURSOR_OFFSET = 16
const SCREEN_GAP = 8

function computePos(): void {
  const el = tooltipEl.value
  const tw = el ? el.offsetWidth  : 200
  const th = el ? el.offsetHeight : 28
  const vw = window.innerWidth
  const vh = window.innerHeight

  // Default: below-right of cursor
  let x = mx + CURSOR_OFFSET
  let y = my + CURSOR_OFFSET

  // Flip left if overflowing right edge
  if (x + tw + SCREEN_GAP > vw) x = mx - tw - CURSOR_OFFSET
  // Flip above if overflowing bottom edge
  if (y + th + SCREEN_GAP > vh) y = my - th - CURSOR_OFFSET

  // Hard clamp so it never leaves the viewport
  pos.value = {
    x: Math.max(SCREEN_GAP, Math.min(x, vw - tw - SCREEN_GAP)),
    y: Math.max(SCREEN_GAP, Math.min(y, vh - th - SCREEN_GAP)),
  }
}

async function scheduleShow(e: MouseEvent): Promise<void> {
  if (!props.text) return
  mx = e.clientX
  my = e.clientY
  clearTimer()
  timer = setTimeout(async () => {
    visible.value = true
    await nextTick()
    computePos()
  }, props.delay)
}

function onMove(e: MouseEvent): void {
  mx = e.clientX
  my = e.clientY
  if (visible.value) computePos()
}

function hide(): void {
  clearTimer()
  visible.value = false
}

function clearTimer(): void {
  if (timer !== null) { clearTimeout(timer); timer = null }
}

onUnmounted(hide)
</script>

<template>
  <span style="display:contents" @mouseenter="scheduleShow" @mousemove="onMove" @mouseleave="hide">
    <slot />
  </span>
  <Teleport to="body">
    <Transition name="rrr-tt">
      <div
        v-if="visible && text"
        ref="tooltipEl"
        class="rrr-tooltip"
        :style="{ left: pos.x + 'px', top: pos.y + 'px' }"
      >{{ text }}</div>
    </Transition>
  </Teleport>
</template>
