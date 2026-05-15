<script setup lang="ts">
import { ref, watch, computed, onUnmounted } from 'vue'
import ImagePickerSlot from './ImagePickerSlot.vue'

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
  'errors': [count: number]
}>()

const previewIdle = ref<string | null>(null)
const previewPlaying = ref<string | null>(null)
const previewStop = ref<string | null>(null)

const idleError = ref<string | null>(null)
const playingError = ref<string | null>(null)
const stopError = ref<string | null>(null)

async function tryLoadBlobUrl(path: string): Promise<string | null> {
  const ab = await window.api.readSoundFile(path)
  if (!ab) return null
  const ext = path.split('.').pop()?.toLowerCase()
  const mime = ext === 'png' ? 'image/png' : ext === 'svg' ? 'image/svg+xml' : 'image/jpeg'
  return URL.createObjectURL(new Blob([ab], { type: mime }))
}

function errorFilename(path: string): string {
  return path.split(/[/\\]/).pop() ?? path
}

watch(
  () => [props.idlePath, props.defaultIdlePath] as const,
  async ([path, fallback]) => {
    const old = previewIdle.value
    const effective = path ?? fallback
    if (!effective) {
      previewIdle.value = null
      idleError.value = null
    } else {
      const url = await tryLoadBlobUrl(effective)
      previewIdle.value = url
      idleError.value = url ? null : errorFilename(effective)
    }
    if (old) URL.revokeObjectURL(old)
  },
  { immediate: true }
)

watch(
  () => [props.playingPath, props.defaultPlayingPath] as const,
  async ([path, fallback]) => {
    const old = previewPlaying.value
    const effective = path ?? fallback
    if (!effective) {
      previewPlaying.value = null
      playingError.value = null
    } else {
      const url = await tryLoadBlobUrl(effective)
      previewPlaying.value = url
      playingError.value = url ? null : errorFilename(effective)
    }
    if (old) URL.revokeObjectURL(old)
  },
  { immediate: true }
)

watch(
  () => [props.stopPath ?? null, props.defaultStopPath ?? null] as const,
  async ([path, fallback]) => {
    const old = previewStop.value
    const effective = path ?? fallback
    if (!effective) {
      previewStop.value = null
      stopError.value = null
    } else {
      const url = await tryLoadBlobUrl(effective)
      previewStop.value = url
      stopError.value = url ? null : errorFilename(effective)
    }
    if (old) URL.revokeObjectURL(old)
  },
  { immediate: true }
)

onUnmounted(() => {
  if (previewIdle.value) URL.revokeObjectURL(previewIdle.value)
  if (previewPlaying.value) URL.revokeObjectURL(previewPlaying.value)
  if (previewStop.value) URL.revokeObjectURL(previewStop.value)
})

const errorCount = computed(() =>
  [idleError.value, playingError.value, stopError.value].filter(Boolean).length
)
watch(errorCount, (n) => emit('errors', n), { immediate: true })

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

function clearIdle(): void {
  emit('update:idlePath', null)
  if (props.playingPath) emit('update:playingPath', null)
}

function clearPlaying(): void {
  emit('update:playingPath', null)
}

async function pickStop(): Promise<void> {
  const path = await window.api.pickImage()
  if (path) emit('update:stopPath', path)
}

function clearStop(): void {
  emit('update:stopPath', null)
}
</script>

<template>
  <div class="flex gap-5">
    <ImagePickerSlot
      label="Idle"
      :path="idlePath"
      :preview="previewIdle"
      :error="idleError"
      @pick="pickIdle"
      @clear="clearIdle"
    />
    <ImagePickerSlot
      label="Playing"
      :path="playingPath"
      :preview="previewPlaying"
      :error="playingError"
      :disabled="playingDisabled"
      :empty-text="playingDisabled ? 'Select Idle First' : 'Select Icon'"
      @pick="pickPlaying"
      @clear="clearPlaying"
    />
    <ImagePickerSlot
      v-if="stopPath !== undefined || defaultStopPath !== undefined"
      label="Stop"
      :path="stopPath ?? null"
      :preview="previewStop"
      :error="stopError"
      @pick="pickStop"
      @clear="clearStop"
    />
  </div>
</template>
