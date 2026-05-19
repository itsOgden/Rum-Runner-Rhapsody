<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

const TIMELINE_H = 22

const props = defineProps<{
  peaks: Array<{ min: number; max: number }>
  duration: number
  inPoint: number
  outPoint: number
  currentTime: number
  isPlaying: boolean
  accentColor?: string
}>()

const emit = defineEmits<{
  seek: [time: number]
  setIn: [time: number]
  setOut: [time: number]
}>()

const rootEl = ref<HTMLDivElement | null>(null)
const waveCanvas = ref<HTMLCanvasElement | null>(null)
const timeCanvas = ref<HTMLCanvasElement | null>(null)

// CSS-pixel dimensions (no dpr scaling — desktop Electron)
const waveW = ref(0)
const waveH = ref(0)

const inPx = computed(() => {
  if (!waveW.value || props.duration <= 0) return 0
  return (props.inPoint / props.duration) * waveW.value
})
const outPx = computed(() => {
  if (!waveW.value || props.duration <= 0) return waveW.value
  return (props.outPoint / props.duration) * waveW.value
})
const playheadPx = computed(() => {
  if (!waveW.value || props.duration <= 0) return 0
  return (props.currentTime / props.duration) * waveW.value
})

// Local drag state for lag-free visual feedback (no Vue prop roundtrip per pixel)
const _dragHandleInPx = ref<number | null>(null)
const _dragHandleOutPx = ref<number | null>(null)
const _dragRangeInPx = ref<number | null>(null)
const _dragRangeOutPx = ref<number | null>(null)

const effectiveInPx = computed(() => {
  if (_dragHandleInPx.value !== null) return _dragHandleInPx.value
  if (_dragRangeInPx.value !== null) return _dragRangeInPx.value
  return inPx.value
})
const effectiveOutPx = computed(() => {
  if (_dragHandleOutPx.value !== null) return _dragHandleOutPx.value
  if (_dragRangeOutPx.value !== null) return _dragRangeOutPx.value
  return outPx.value
})

// Width of non-selected regions (for dim overlay divs)
const leftDimW = computed(() => effectiveInPx.value)
const rightDimW = computed(() => Math.max(0, waveW.value - effectiveOutPx.value))

// ── Color helpers ─────────────────────────────────────────────────────────────

function getAccentHex(): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim() || '#F9B71D'
}

function hexToRgba(hex: string, a: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}

// ── Canvas drawing ────────────────────────────────────────────────────────────

function drawWaveform() {
  const canvas = waveCanvas.value
  if (!canvas || props.peaks.length === 0) return
  const ctx = canvas.getContext('2d')!
  const w = waveW.value; const h = waveH.value
  if (w === 0 || h === 0) return

  const accent = getAccentHex()

  ctx.fillStyle = '#161616'
  ctx.fillRect(0, 0, w, h)

  const num = props.peaks.length
  const cx = h * 0.5
  const maxAmp = h * 0.46

  ctx.fillStyle = hexToRgba(accent, 0.78)
  for (let x = 0; x < w; x++) {
    const idx = Math.min(num - 1, Math.floor((x / w) * num))
    const { min, max } = props.peaks[idx]
    const top = cx - max * maxAmp
    const bh = Math.max(1, (cx - min * maxAmp) - top)
    ctx.fillRect(x, top, 1, bh)
  }

  // Center line
  ctx.fillStyle = hexToRgba(accent, 0.12)
  ctx.fillRect(0, cx - 0.5, w, 1)
}

function niceInterval(duration: number): number {
  const targets = [0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300]
  const rough = duration / 10
  for (const iv of targets) if (rough <= iv) return iv
  return 300
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = (s % 60).toFixed(m > 0 ? 0 : 1)
  return m > 0 ? `${m}:${sec.padStart(2, '0')}` : `${sec}s`
}

function drawTimeline() {
  const canvas = timeCanvas.value
  if (!canvas || props.duration <= 0) return
  const ctx = canvas.getContext('2d')!
  const w = waveW.value; const h = TIMELINE_H
  if (w === 0) return

  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, w, h)

  const iv = niceInterval(props.duration)
  ctx.font = '9px monospace'
  ctx.textAlign = 'center'

  for (let t = 0; t <= props.duration + 0.001; t += iv) {
    const x = (t / props.duration) * w
    const major = Math.abs(Math.round(t / iv) % 5) === 0 || iv >= 5
    ctx.fillStyle = major ? '#5A5857' : '#282828'
    ctx.fillRect(x, 0, 1, major ? 7 : 4)
    if (major) {
      ctx.fillStyle = '#5A5857'
      ctx.fillText(formatTime(t), x, h - 3)
    }
  }
}

function resize() {
  if (!rootEl.value) return
  const w = rootEl.value.offsetWidth
  const h = rootEl.value.offsetHeight
  waveW.value = w
  waveH.value = Math.max(0, h - TIMELINE_H)

  if (waveCanvas.value) { waveCanvas.value.width = w; waveCanvas.value.height = waveH.value }
  if (timeCanvas.value) { timeCanvas.value.width = w; timeCanvas.value.height = TIMELINE_H }
  drawWaveform()
  drawTimeline()
}

// ── Handle drag (fine-tune in/out points) ─────────────────────────────────────

let _handleType: 'in' | 'out' | null = null

function startHandleDrag(e: MouseEvent, type: 'in' | 'out') {
  if (e.button !== 0) return
  e.preventDefault()
  _handleType = type
  document.addEventListener('mousemove', onHandleDragMove)
  document.addEventListener('mouseup', onHandleDragEnd)
  document.addEventListener('mousedown', onDragRightClick)
}

function onHandleDragMove(e: MouseEvent) {
  if (!_handleType || !rootEl.value || props.duration <= 0) return
  const rect = rootEl.value.getBoundingClientRect()
  const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
  if (_handleType === 'in') {
    const maxX = (_dragHandleOutPx.value ?? outPx.value) - 2
    _dragHandleInPx.value = Math.min(x, maxX)
  } else {
    const minX = (_dragHandleInPx.value ?? inPx.value) + 2
    _dragHandleOutPx.value = Math.max(x, minX)
  }
}

function onHandleDragEnd() {
  if (_handleType && waveW.value > 0 && props.duration > 0) {
    if (_handleType === 'in' && _dragHandleInPx.value !== null) {
      emit('setIn', (_dragHandleInPx.value / waveW.value) * props.duration)
    } else if (_handleType === 'out' && _dragHandleOutPx.value !== null) {
      emit('setOut', (_dragHandleOutPx.value / waveW.value) * props.duration)
    }
  }
  _dragHandleInPx.value = null
  _dragHandleOutPx.value = null
  _handleType = null
  document.removeEventListener('mousemove', onHandleDragMove)
  document.removeEventListener('mouseup', onHandleDragEnd)
  document.removeEventListener('mousedown', onDragRightClick)
}

// ── Range drag (click-drag to set selection) ──────────────────────────────────

let _rangeDragging = false
let _rangeDragStartX = 0
let _rangeDragStartTime = 0
let _rangeDragHasMoved = false

function onDragRightClick(e: MouseEvent) {
  if (e.button !== 0) {
    if (_rangeDragging) {
      _rangeDragging = false
      document.removeEventListener('mousemove', onRangeDragMove)
      document.removeEventListener('mouseup', onRangeDragEnd)
      document.removeEventListener('mousedown', onDragRightClick)
    }
    if (_handleType) {
      onHandleDragEnd()
    }
  }
}

function onWaveMousedown(e: MouseEvent) {
  if (e.button !== 0) return
  if (!rootEl.value || props.duration <= 0) return
  const rect = rootEl.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  _rangeDragging = true
  _rangeDragStartX = x
  _rangeDragStartTime = Math.max(0, Math.min((x / rect.width) * props.duration, props.duration))
  _rangeDragHasMoved = false
  document.addEventListener('mousemove', onRangeDragMove)
  document.addEventListener('mouseup', onRangeDragEnd)
  document.addEventListener('mousedown', onDragRightClick)
}

function onRangeDragMove(e: MouseEvent) {
  if (!_rangeDragging || !rootEl.value || props.duration <= 0) return
  const rect = rootEl.value.getBoundingClientRect()
  const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
  if (!_rangeDragHasMoved && Math.abs(x - _rangeDragStartX) >= 5) {
    _rangeDragHasMoved = true
  }
  if (_rangeDragHasMoved) {
    if (x >= _rangeDragStartX) {
      _dragRangeInPx.value = _rangeDragStartX
      _dragRangeOutPx.value = x
    } else {
      _dragRangeInPx.value = x
      _dragRangeOutPx.value = _rangeDragStartX
    }
  }
}

function onRangeDragEnd(e: MouseEvent) {
  if (!_rangeDragging) return
  if (!_rangeDragHasMoved && rootEl.value && props.duration > 0) {
    const rect = rootEl.value.getBoundingClientRect()
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
    emit('seek', (x / rect.width) * props.duration)
  } else if (_rangeDragHasMoved && waveW.value > 0 && props.duration > 0) {
    const inPxFinal = _dragRangeInPx.value
    const outPxFinal = _dragRangeOutPx.value
    if (inPxFinal !== null && outPxFinal !== null) {
      emit('setIn', (inPxFinal / waveW.value) * props.duration)
      emit('setOut', (outPxFinal / waveW.value) * props.duration)
    }
  }
  _dragRangeInPx.value = null
  _dragRangeOutPx.value = null
  _rangeDragging = false
  document.removeEventListener('mousemove', onRangeDragMove)
  document.removeEventListener('mouseup', onRangeDragEnd)
  document.removeEventListener('mousedown', onDragRightClick)
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

let _ro: ResizeObserver | null = null

onMounted(() => {
  _ro = new ResizeObserver(resize)
  if (rootEl.value) _ro.observe(rootEl.value)
  resize()
})

onUnmounted(() => {
  _ro?.disconnect()
  document.removeEventListener('mousemove', onHandleDragMove)
  document.removeEventListener('mouseup', onHandleDragEnd)
  document.removeEventListener('mousemove', onRangeDragMove)
  document.removeEventListener('mouseup', onRangeDragEnd)
  document.removeEventListener('mousedown', onDragRightClick)
})

// Redraw peaks when data or accent color changes (not on in/out — those drive divs)
watch(() => props.peaks, drawWaveform, { deep: true })
watch(() => props.accentColor, drawWaveform)
watch(() => props.duration, drawTimeline)
</script>

<template>
  <div ref="rootEl" class="relative select-none overflow-hidden" style="cursor: crosshair" @contextmenu.prevent>
    <!-- Waveform canvas (peaks only — redraws only on peaks/color change) -->
    <canvas
      ref="waveCanvas"
      class="absolute top-0 left-0"
      :style="{ width: waveW + 'px', height: waveH + 'px' }"
      @mousedown.prevent="onWaveMousedown"
    />

    <!-- Dim overlay left of selection -->
    <div
      v-if="duration > 0 && leftDimW > 0"
      class="pointer-events-none absolute top-0 left-0"
      :style="{ width: leftDimW + 'px', height: waveH + 'px', background: 'rgba(0,0,0,0.72)' }"
    />

    <!-- Dim overlay right of selection -->
    <div
      v-if="duration > 0 && rightDimW > 0"
      class="pointer-events-none absolute top-0 right-0"
      :style="{ width: rightDimW + 'px', height: waveH + 'px', background: 'rgba(0,0,0,0.72)' }"
    />

    <!-- Playhead -->
    <div
      v-if="duration > 0 && (isPlaying || currentTime > 0)"
      class="playhead-line pointer-events-none absolute top-0"
      :style="{ left: playheadPx + 'px', height: waveH + 'px' }"
    />

    <!-- In handle -->
    <div
      v-if="duration > 0"
      class="handle handle-in absolute top-0"
      :style="{ left: effectiveInPx + 'px', height: waveH + 'px' }"
      @mousedown.stop.prevent="(e) => startHandleDrag(e, 'in')"
    />

    <!-- Out handle -->
    <div
      v-if="duration > 0"
      class="handle handle-out absolute top-0"
      :style="{ left: effectiveOutPx + 'px', height: waveH + 'px' }"
      @mousedown.stop.prevent="(e) => startHandleDrag(e, 'out')"
    />

    <!-- Timeline canvas -->
    <canvas
      ref="timeCanvas"
      class="absolute left-0"
      :style="{ bottom: 0, width: waveW + 'px', height: TIMELINE_H + 'px', cursor: 'default' }"
    />
  </div>
</template>

<style scoped>
.playhead-line {
  width: 1px;
  background: rgba(255, 255, 255, 0.75);
  transform: translateX(0);
  box-shadow: 0 0 4px rgba(255,255,255,0.3);
}

/* 2px accent vertical line */
.handle {
  width: 2px;
  background: var(--color-accent);
  cursor: ew-resize;
  z-index: 10;
  transform: translateX(-1px);
}

/* Diamond cap at top */
.handle::before {
  content: '';
  position: absolute;
  top: -6px;
  left: -5px;
  width: 12px;
  height: 12px;
  background: var(--color-accent);
  transform: rotate(45deg);
  border-radius: 2px;
}

/* Widen hit area */
.handle::after {
  content: '';
  position: absolute;
  inset: 0;
  left: -7px;
  right: -7px;
}
</style>
