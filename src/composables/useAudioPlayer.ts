import { ref, watch } from 'vue'
import { useSettings } from './useSettings'
import { useAudioDevices } from './useAudioDevices'
import { showToast } from '../toastState'
import type { Sound } from '../types'

export const CLIP_VOLUME_MAX_DB = 20

interface ActiveSource {
  source: AudioBufferSourceNode
  audioCtx: AudioContext
  path: string
  key: string
  gainNode: GainNode
  deviceIndex: number
  normGain: number  // normalize-only linear gain (excludes per-clip dB offset)
}

const activeSources: ActiveSource[] = []
// Tracks the number of active playSound() invocations per path.
// A key is present if and only if count > 0; the key is removed when count reaches 0.
// This allows overlap mode to keep the button lit until every overlapping instance finishes.
const playingPaths = ref(new Map<string, number>())
const statusText = ref('Ready')

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

// Stop active sources on a device when it's toggled off mid-playback
watch(
  () => settings.value.devices.map(d => d.enabled ? 1 : 0).join(','),
  (newVal, oldVal) => {
    if (!oldVal) return
    const newStates = newVal.split(',').map(Number)
    const oldStates = oldVal.split(',').map(Number)
    newStates.forEach((enabled, i) => {
      if (!enabled && oldStates[i]) {
        activeSources
          .filter(e => e.deviceIndex === i)
          .forEach(e => { try { e.source.stop() } catch {} })
      }
    })
  }
)

// Live volume update — fires when masterVolume or any device volume/enabled changes
watch(
  () => [settings.value.masterVolume, settings.value.devices],
  () => {
    const s = settings.value
    const masterVol = s.masterVolume ?? 1.0
    for (const active of activeSources) {
      const devVol = s.devices[active.deviceIndex]?.volume ?? 1.0
      const normalizeDb = 20 * Math.log10(active.normGain)
      const dbOffset = s.soundVolumes?.[active.key] ?? 0
      const gainValue = Math.pow(10, (normalizeDb + dbOffset) / 20)
      active.gainNode.gain.setTargetAtTime(devVol * masterVol * gainValue, active.audioCtx.currentTime, 0.01)
    }
  },
  { deep: true }
)

export function setClipVolumeOffset(soundKey: string, dbOffset: number): void {
  const s = settings.value
  const masterVol = s.masterVolume ?? 1.0
  for (const active of activeSources) {
    if (active.key !== soundKey) continue
    const devVol = s.devices[active.deviceIndex]?.volume ?? 1.0
    const normalizeDb = 20 * Math.log10(active.normGain)
    const gainValue = Math.pow(10, (normalizeDb + dbOffset) / 20)
    active.gainNode.gain.setTargetAtTime(devVol * masterVol * gainValue, active.audioCtx.currentTime, 0.01)
  }
}

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
    const masterVol = s.masterVolume ?? 1.0

    statusText.value = `Playing: ${sound.name}`
    // Restart already set the count to 1 above; all other modes increment normally.
    if (!isRestart) incrementPlaying(sound.path)

    const promises: Promise<void>[] = []

    for (let i = 0; i < s.devices.length; i++) {
      const dev = s.devices[i]
      if (dev.enabled ?? true) {
        const deviceId = findMatchingDeviceId(dev.label ?? '', i)
        if (deviceId) {
          promises.push(playSoundOnDevice(arrayBuffer.slice(0), deviceId, (dev.volume ?? 1.0) * masterVol, sound.path, i, sound.name, sound.key))
        }
      }
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

  function playSoundOnDevice(arrayBuffer: ArrayBuffer, deviceId: string, volume: number, path: string, deviceIndex: number, soundName: string, soundKey: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const audioCtx = new AudioContext()
        const decodedData = await audioCtx.decodeAudioData(arrayBuffer)

        const normGain = computeNormGain(decodedData)

        // Combine normalize gain (in dB) with per-clip dB offset, then convert back to linear
        const normalizeDb = 20 * Math.log10(normGain)
        const dbOffset = settings.value.soundVolumes?.[soundKey] ?? 0
        const totalDb = normalizeDb + dbOffset
        const gainValue = Math.pow(10, totalDb / 20)

        const source = audioCtx.createBufferSource()
        source.buffer = decodedData

        const gainNode = audioCtx.createGain()
        gainNode.gain.value = volume * gainValue

        source.connect(gainNode)
        gainNode.connect(audioCtx.destination)

        if (audioCtx.setSinkId) {
          await audioCtx.setSinkId(deviceId)
        }

        const sourceEntry: ActiveSource = { source, audioCtx, path, key: soundKey, gainNode, deviceIndex, normGain }
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

  return {
    playSound,
    stopAll,
    playingPaths,
    statusText,
  }
}
