import { ref, watch } from 'vue'
import { useSettings } from './useSettings'
import { useAudioDevices } from './useAudioDevices'
import { showToast } from '../toastState'
import type { Sound } from '../types'

interface ActiveSource {
  source: AudioBufferSourceNode
  audioCtx: AudioContext
  path: string
  gainNode: GainNode
  deviceIndex: number
}

const activeSources: ActiveSource[] = []
const playingPaths = ref(new Set<string>())
const statusText = ref('Ready')

// ── Preview playback (primary device only, isolated from main playback) ───────
// previewingPath tracks which sound is currently previewing. It is NOT included
// in playingPaths, so it does not affect the Stop All button or status bar.

const previewingPath = ref<string | null>(null)
let _previewSource: AudioBufferSourceNode | null = null
let _previewCtx: AudioContext | null = null
let _previewGain: GainNode | null = null
// Incrementing generation counter — lets pending async loads detect cancellation.
let _previewGeneration = 0

// Module-level singletons — shared across all useAudioPlayer() calls
const { settings } = useSettings()
const { findMatchingDeviceId } = useAudioDevices()

// Live volume update — fires when masterVolume or any device volume/enabled changes
watch(
  () => [settings.value.masterVolume, settings.value.devices],
  () => {
    const s = settings.value
    const masterVol = s.masterVolume ?? 1.0
    for (const active of activeSources) {
      const devVol = s.devices[active.deviceIndex]?.volume ?? 1.0
      active.gainNode.gain.setTargetAtTime(devVol * masterVol, active.audioCtx.currentTime, 0.01)
    }
    if (_previewGain && _previewCtx) {
      const devVol = s.devices[0]?.volume ?? 1.0
      _previewGain.gain.setTargetAtTime(devVol * masterVol, _previewCtx.currentTime, 0.01)
    }
  },
  { deep: true }
)

export function useAudioPlayer() {
  async function playSound(sound: Sound): Promise<void> {
    // Read playbackMode directly from the live ref — not a cached snapshot — to avoid stale reads
    const mode = settings.value.playbackMode

    if (mode === 'stop' && playingPaths.value.has(sound.path)) {
      // Stop mode: clicking a playing sound stops it without restarting
      const toStop = activeSources.filter(e => e.path === sound.path)
      toStop.forEach(e => {
        e.source.onended = null
        try { e.source.stop() } catch {}
        try { e.audioCtx.close() } catch {}
      })
      for (let i = activeSources.length - 1; i >= 0; i--) {
        if (activeSources[i].path === sound.path) activeSources.splice(i, 1)
      }
      const next = new Set(playingPaths.value)
      next.delete(sound.path)
      playingPaths.value = next
      if (playingPaths.value.size === 0) statusText.value = 'Ready'
      return
    }

    if (mode === 'restart' && playingPaths.value.has(sound.path)) {
      const toStop = activeSources.filter(e => e.path === sound.path)
      toStop.forEach(e => {
        e.source.onended = null  // prevent stale cleanup from removing the path we're about to re-add
        try { e.source.stop() } catch {}
        try { e.audioCtx.close() } catch {}
      })
      for (let i = activeSources.length - 1; i >= 0; i--) {
        if (activeSources[i].path === sound.path) activeSources.splice(i, 1)
      }
      // Keep sound.path in playingPaths — we're immediately restarting
    }

    const arrayBuffer = await window.api.readSoundFile(sound.path)
    if (!arrayBuffer) {
      statusText.value = `Error reading: ${sound.filename}`
      showToast(`Could not read file: ${sound.name}`)
      return
    }

    // Read settings fresh after the async IPC call
    const s = settings.value
    const primaryDeviceId = findMatchingDeviceId(s.devices[0]?.label ?? '', 0)
    const secondaryDeviceId = findMatchingDeviceId(s.devices[1]?.label ?? '', 1)
    const masterVol = s.masterVolume ?? 1.0

    statusText.value = `Playing: ${sound.name}`
    playingPaths.value = new Set([...playingPaths.value, sound.path])

    const promises: Promise<void>[] = []

    if ((s.devices[0]?.enabled ?? true) && primaryDeviceId) {
      promises.push(playSoundOnDevice(arrayBuffer.slice(0), primaryDeviceId, (s.devices[0]?.volume ?? 1.0) * masterVol, sound.path, 0))
    }
    if ((s.devices[1]?.enabled ?? true) && secondaryDeviceId) {
      promises.push(playSoundOnDevice(arrayBuffer.slice(0), secondaryDeviceId, (s.devices[1]?.volume ?? 1.0) * masterVol, sound.path, 1))
    }

    Promise.all(promises)
      .then(() => {
        const next = new Set(playingPaths.value)
        next.delete(sound.path)
        playingPaths.value = next
        if (playingPaths.value.size === 0) statusText.value = 'Ready'
      })
      .catch(e => {
        console.error('Playback error:', e)
        const next = new Set(playingPaths.value)
        next.delete(sound.path)
        playingPaths.value = next
        statusText.value = `Error: ${(e as Error).message}`
        showToast(`Playback failed: ${sound.name}`)
      })
  }

  function playSoundOnDevice(arrayBuffer: ArrayBuffer, deviceId: string, volume: number, path: string, deviceIndex: number): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const audioCtx = new AudioContext()
        const decodedData = await audioCtx.decodeAudioData(arrayBuffer)

        const source = audioCtx.createBufferSource()
        source.buffer = decodedData

        const gainNode = audioCtx.createGain()
        gainNode.gain.value = volume

        source.connect(gainNode)
        gainNode.connect(audioCtx.destination)

        if (audioCtx.setSinkId) {
          await audioCtx.setSinkId(deviceId)
        }

        const sourceEntry: ActiveSource = { source, audioCtx, path, gainNode, deviceIndex }
        activeSources.push(sourceEntry)

        source.onended = () => {
          const idx = activeSources.indexOf(sourceEntry)
          if (idx > -1) activeSources.splice(idx, 1)
          audioCtx.close()
          resolve()
        }

        source.start(0)
      } catch (e) {
        reject(e)
      }
    })
  }

  function stopAll(): void {
    activeSources.forEach(({ source, audioCtx }) => {
      try { source.stop() } catch {}
      try { audioCtx.close() } catch {}
    })
    activeSources.length = 0
    playingPaths.value = new Set()
    statusText.value = 'Stopped'
  }

  // ── Preview ───────────────────────────────────────────────────────────────

  function stopPreview(): void {
    _previewGeneration++ // Invalidate any in-flight async load
    if (_previewSource) {
      _previewSource.onended = null
      try { _previewSource.stop() } catch {}
      _previewSource = null
    }
    if (_previewCtx) {
      try { _previewCtx.close() } catch {}
      _previewCtx = null
    }
    _previewGain = null
    previewingPath.value = null
  }

  async function previewSound(sound: Sound): Promise<void> {
    // Toggle off if this sound is already previewing
    if (previewingPath.value === sound.path) {
      stopPreview()
      return
    }

    stopPreview()
    const generation = ++_previewGeneration

    const arrayBuffer = await window.api.readSoundFile(sound.path)
    // Bail if cancelled (cursor left, or another preview was triggered) during load
    if (!arrayBuffer || generation !== _previewGeneration) return

    const s = settings.value
    const primaryDeviceId = findMatchingDeviceId(s.devices[0]?.label ?? '', 0)
    if (!primaryDeviceId) return

    const volume = (s.devices[0]?.volume ?? 1.0) * (s.masterVolume ?? 1.0)

    try {
      _previewCtx = new AudioContext()
      const decoded = await _previewCtx.decodeAudioData(arrayBuffer.slice(0))
      if (generation !== _previewGeneration) {
        try { _previewCtx.close() } catch {}
        _previewCtx = null
        return
      }

      _previewSource = _previewCtx.createBufferSource()
      _previewSource.buffer = decoded

      const gain = _previewCtx.createGain()
      gain.gain.value = volume
      _previewSource.connect(gain)
      gain.connect(_previewCtx.destination)
      _previewGain = gain

      if (_previewCtx.setSinkId) {
        await _previewCtx.setSinkId(primaryDeviceId)
      }

      previewingPath.value = sound.path

      _previewSource.onended = () => {
        _previewSource = null
        _previewGain = null
        try { _previewCtx?.close() } catch {}
        _previewCtx = null
        previewingPath.value = null
      }

      _previewSource.start(0)
    } catch (e) {
      console.error('Preview error:', e)
      stopPreview()
    }
  }

  return {
    playSound,
    stopAll,
    playingPaths,
    statusText,
    previewSound,
    stopPreview,
    previewingPath,
  }
}
