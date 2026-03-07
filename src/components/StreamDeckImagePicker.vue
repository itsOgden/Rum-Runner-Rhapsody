<script setup lang="ts">
import { ref, watch, computed, onUnmounted } from 'vue'

const props = defineProps<{
  idlePath: string | null
  playingPath: string | null
  defaultIdlePath: string | null
  defaultPlayingPath: string | null
  stopPath?: string | null
  defaultStopPath?: string | null
}>()

const emit = defineEmits<{
  'update:idlePath': [string | null]
  'update:playingPath': [string | null]
  'update:stopPath': [string | null]
}>()

const previewIdle = ref<string | null>(null)
const previewPlaying = ref<string | null>(null)
const previewStop = ref<string | null>(null)

async function loadBlobUrl(path: string | null): Promise<string | null> {
  if (!path) return null
  const ab = await window.api.readSoundFile(path)
  if (!ab) return null
  const ext = path.split('.').pop()?.toLowerCase()
  const mime = ext === 'png' ? 'image/png' : 'image/jpeg'
  return URL.createObjectURL(new Blob([ab], { type: mime }))
}

watch(
  () => [props.idlePath, props.defaultIdlePath] as const,
  async ([path, fallback]) => {
    const old = previewIdle.value
    previewIdle.value = await loadBlobUrl(path ?? fallback)
    if (old) URL.revokeObjectURL(old)
  },
  { immediate: true }
)

watch(
  () => [props.playingPath, props.defaultPlayingPath] as const,
  async ([path, fallback]) => {
    const old = previewPlaying.value
    previewPlaying.value = await loadBlobUrl(path ?? fallback)
    if (old) URL.revokeObjectURL(old)
  },
  { immediate: true }
)

watch(
  () => [props.stopPath ?? null, props.defaultStopPath ?? null] as const,
  async ([path, fallback]) => {
    const old = previewStop.value
    previewStop.value = await loadBlobUrl(path ?? fallback)
    if (old) URL.revokeObjectURL(old)
  },
  { immediate: true }
)

onUnmounted(() => {
  if (previewIdle.value) URL.revokeObjectURL(previewIdle.value)
  if (previewPlaying.value) URL.revokeObjectURL(previewPlaying.value)
  if (previewStop.value) URL.revokeObjectURL(previewStop.value)
})

const playingDisabled = computed(() => !props.idlePath)

async function pickIdle(): Promise<void> {
  const path = await window.api.pickImage()
  if (path) emit('update:idlePath', path)
}

async function pickPlaying(): Promise<void> {
  if (playingDisabled.value) return
  const path = await window.api.pickImage()
  if (path) emit('update:playingPath', path)
}

function clearIdle(e: MouseEvent): void {
  e.stopPropagation()
  emit('update:idlePath', null)
  if (props.playingPath) emit('update:playingPath', null)
}

function clearPlaying(e: MouseEvent): void {
  e.stopPropagation()
  emit('update:playingPath', null)
}

async function pickStop(): Promise<void> {
  const path = await window.api.pickImage()
  if (path) emit('update:stopPath', path)
}

function clearStop(e: MouseEvent): void {
  e.stopPropagation()
  emit('update:stopPath', null)
}
</script>

<template>
  <div class="picker">

    <!-- Idle slot -->
    <div class="slot">
      <div class="slot-label">Idle</div>
      <div class="slot-preview" role="button" tabindex="0" @click="pickIdle" @keydown.enter="pickIdle">
        <img v-if="previewIdle" :src="previewIdle" class="preview-img" draggable="false"  alt=""/>
        <div v-else class="preview-empty">
          <span class="preview-empty-text">Select Icon</span>
        </div>
        <button v-if="idlePath" class="clear-btn" title="Clear override" @click="clearIdle">×</button>
        <div class="pick-overlay"><span>Change Icon</span></div>
      </div>
    </div>

    <!-- Playing slot -->
    <div class="slot" :class="{ 'slot-disabled': playingDisabled }">
      <div class="slot-label">Playing</div>
      <div class="slot-preview" role="button" :tabindex="playingDisabled ? -1 : 0" @click="pickPlaying" @keydown.enter="pickPlaying">
        <img v-if="previewPlaying" :src="previewPlaying" class="preview-img" draggable="false"  alt="" />
        <div v-else class="preview-empty">
          <span class="preview-empty-text">{{ playingDisabled ? 'Select Idle First' : 'Select Icon' }}</span>
        </div>
        <button v-if="playingPath" class="clear-btn" title="Clear override" @click="clearPlaying">×</button>
        <div v-if="!playingDisabled" class="pick-overlay"><span>Change Icon</span></div>
      </div>
    </div>

    <!-- Stop slot (optional — only rendered when stopPath prop is provided or explicitly null) -->
    <div v-if="stopPath !== undefined || defaultStopPath !== undefined" class="slot">
      <div class="slot-label">Stop</div>
      <div class="slot-preview" role="button" tabindex="0" @click="pickStop" @keydown.enter="pickStop">
        <img v-if="previewStop" :src="previewStop" class="preview-img" draggable="false" alt="" />
        <div v-else class="preview-empty">
          <span class="preview-empty-text">Select Icon</span>
        </div>
        <button v-if="stopPath" class="clear-btn" title="Clear override" @click="clearStop">×</button>
        <div class="pick-overlay"><span>Change Icon</span></div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.picker {
  display: flex;
  gap: 20px;
}

.slot {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.slot-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--color-text-dim);
  letter-spacing: 0.04em;
}

.slot-preview {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--color-border-light);
  background: var(--color-bg-surface);
  cursor: pointer;
  outline: none;
}

.slot-preview:hover .pick-overlay,
.slot-preview:focus-visible .pick-overlay {
  opacity: 1;
}

.slot-preview:focus-visible {
  border-color: var(--color-accent);
}

.preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.preview-empty {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
}

.preview-empty-text {
  font-size: 11px;
  color: var(--color-text-dim);
  text-align: center;
  line-height: 1.4;
}

/* Hover overlay shown on top of images */
.pick-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  opacity: 0;
  transition: opacity 0.15s;
  pointer-events: none;
}

.pick-overlay span {
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* × clear button anchored to top-right */
.clear-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  border: none;
  color: #fff;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  z-index: 1;
  transition: background 0.1s;
}

.clear-btn:hover {
  background: var(--color-danger);
}

/* Disabled state for Playing slot */
.slot-disabled {
  opacity: 0.45;
  pointer-events: none;
}
</style>
