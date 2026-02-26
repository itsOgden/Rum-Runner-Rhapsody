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
  normGain: number
}

const activeSources: ActiveSource[] = []
// Tracks the number of active playSound() invocations per path.
// A key is present if and only if count > 0; the key is removed when count reaches 0.
// This allows overlap mode to keep the button lit until every overlapping instance finishes.
const playingPaths = ref(new Map<string, number>())
const statusText = ref('Ready')

// ── Preview playback (primary device only, isolated from main playback) ───────
// previewingPath tracks which sound is currently previewing. It is NOT included
// in playingPaths, so it does not affect the Stop All button or status bar.

const previewingPath = ref<string | null>(null)
let _previewSource: AudioBufferSourceNode | null = null
let _previewCtx: AudioContext | null = null
let _previewGain: GainNode | null = null
let _previewNormGain = 1.0
// Incrementing generation counter — lets pending async loads detect cancellation.
let _previewGeneration = 0

// Module-level singletons — shared across all useAudioPlayer() calls
const { settings, saveSettings } = useSettings()
const { findMatchingDeviceId } = useAudioDevices()

// Scans all channels and returns a gain factor that brings peak amplitude to 0.9.
// Returns 1.0 (no adjustment) when normalization is disabled or the buffer is silent.
function computeNormGain(buffer: AudioBuffer): number {
  if (!settings.value.normalize) return 1.0
  let peak = 0
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c)
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i])
      if (abs > peak) peak = abs
    }
  }
  return peak >= 0.001 ? 0.9 / peak : 1.0
}

// Live volume update — fires when masterVolume or any device volume/enabled changes
watch(
  () => [settings.value.masterVolume, settings.value.devices],
  () => {
    const s = settings.value
    const masterVol = s.masterVolume ?? 1.0
    for (const active of activeSources) {
      const devVol = s.devices[active.deviceIndex]?.volume ?? 1.0
      active.gainNode.gain.setTargetAtTime(devVol * masterVol * active.normGain, active.audioCtx.currentTime, 0.01)
    }
    if (_previewGain && _previewCtx) {
      const devVol = s.devices[0]?.volume ?? 1.0
      _previewGain.gain.setTargetAtTime(devVol * masterVol * _previewNormGain, _previewCtx.currentTime, 0.01)
    }
  },
  { deep: true }
)

function incrementPlaying(path: string): void {
  playingPaths.value.set(path, (playingPaths.value.get(path) ?? 0) + 1)
}

function decrementPlaying(path: string): void {
  const count = (playingPaths.value.get(path) ?? 1) - 1
  if (count <= 0) playingPaths.value.delete(path)
  else playingPaths.value.set(path, count)
}

// Notify the Stream Deck plugin whenever the set of playing sounds changes.
// Converts full file paths to sound keys (relative forward-slash paths).
watch(playingPaths, (newPaths) => {
  const folder = settings.value.soundFolder
  const keys = Array.from(newPaths.keys()).map(p => {
    const rel = folder && p.startsWith(folder) ? p.slice(folder.length + 1) : p
    return rel.replace(/\\/g, '/')
  })
  window.api.updatePlayingStatus(keys)
}, { deep: true })

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
      playingPaths.value.delete(sound.path)
      if (playingPaths.value.size === 0) statusText.value = 'Ready'
      return
    }

    // Capture before the async gap so we know whether to skip the increment below.
    const isRestart = mode === 'restart' && playingPaths.value.has(sound.path)

    if (isRestart) {
      const toStop = activeSources.filter(e => e.path === sound.path)
      toStop.forEach(e => {
        e.source.onended = null  // prevent stale decrements from the cancelled instances
        try { e.source.stop() } catch {}
        try { e.audioCtx.close() } catch {}
      })
      for (let i = activeSources.length - 1; i >= 0; i--) {
        if (activeSources[i].path === sound.path) activeSources.splice(i, 1)
      }
      // Reset count to 1 for the single upcoming play; keeps the key in the map so
      // the button stays lit and no flash occurs during the async file load.
      playingPaths.value.set(sound.path, 1)
    }

    const arrayBuffer = await window.api.readSoundFile(sound.path)
    if (!arrayBuffer) {
      if (isRestart) playingPaths.value.delete(sound.path)
      statusText.value = `Error reading: ${sound.filename}`
      showToast(`Could not read file: ${sound.name}`)
      return
    }

    // Increment play count — fire-and-forget, does not block audio start.
    // Use a local plain object for the saveSettings call — settings.value.playCounts
    // becomes a Vue reactive proxy after assignment and cannot be serialized by IPC.
    const newCount = (settings.value.playCounts?.[sound.key] ?? 0) + 1
    const newCounts = { ...(settings.value.playCounts ?? {}), [sound.key]: newCount }
    settings.value.playCounts = newCounts
    saveSettings({ playCounts: newCounts })

    // Read settings fresh after the async IPC call
    const s = settings.value
    const primaryDeviceId = findMatchingDeviceId(s.devices[0]?.label ?? '', 0)
    const secondaryDeviceId = findMatchingDeviceId(s.devices[1]?.label ?? '', 1)
    const masterVol = s.masterVolume ?? 1.0

    statusText.value = `Playing: ${sound.name}`
    // Restart already set the count to 1 above; all other modes increment normally.
    if (!isRestart) incrementPlaying(sound.path)

    const promises: Promise<void>[] = []

    if ((s.devices[0]?.enabled ?? true) && primaryDeviceId) {
      promises.push(playSoundOnDevice(arrayBuffer.slice(0), primaryDeviceId, (s.devices[0]?.volume ?? 1.0) * masterVol, sound.path, 0, sound.name))
    }
    if ((s.devices[1]?.enabled ?? true) && secondaryDeviceId) {
      promises.push(playSoundOnDevice(arrayBuffer.slice(0), secondaryDeviceId, (s.devices[1]?.volume ?? 1.0) * masterVol, sound.path, 1, sound.name))
    }

    Promise.all(promises)
      .then(() => {
        decrementPlaying(sound.path)
        if (playingPaths.value.size === 0) statusText.value = 'Ready'
      })
      .catch(e => {
        console.error('Playback error:', e)
        decrementPlaying(sound.path)
        statusText.value = `Error: ${(e as Error).message}`
        showToast(`Playback failed: ${sound.name}`)
      })
  }

  function playSoundOnDevice(arrayBuffer: ArrayBuffer, deviceId: string, volume: number, path: string, deviceIndex: number, soundName: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const audioCtx = new AudioContext()
        const decodedData = await audioCtx.decodeAudioData(arrayBuffer)

        const normGain = computeNormGain(decodedData)

        const source = audioCtx.createBufferSource()
        source.buffer = decodedData

        const gainNode = audioCtx.createGain()
        gainNode.gain.value = volume * normGain

        source.connect(gainNode)
        gainNode.connect(audioCtx.destination)

        if (audioCtx.setSinkId) {
          await audioCtx.setSinkId(deviceId)
        }

        const sourceEntry: ActiveSource = { source, audioCtx, path, gainNode, deviceIndex, normGain }
        activeSources.push(sourceEntry)

        source.onended = () => {
          const idx = activeSources.indexOf(sourceEntry)
          if (idx > -1) activeSources.splice(idx, 1)
          audioCtx.close()
          resolve()
        }

        source.start(0)

        // Update status bar with normalization info (primary device only)
        if (deviceIndex === 0 && settings.value.normalize && normGain !== 1.0) {
          const dB = 20 * Math.log10(normGain)
          statusText.value = `Playing: ${soundName}  (${dB >= 0 ? '+' : ''}${dB.toFixed(1)} dB)`
        }
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
    playingPaths.value.clear()
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
    _previewNormGain = 1.0
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

      _previewNormGain = computeNormGain(decoded)

      _previewSource = _previewCtx.createBufferSource()
      _previewSource.buffer = decoded

      const gain = _previewCtx.createGain()
      gain.gain.value = volume * _previewNormGain
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
