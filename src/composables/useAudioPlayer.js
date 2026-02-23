import { ref } from 'vue'
import { useSettings } from './useSettings.js'
import { useAudioDevices } from './useAudioDevices.js'
import { showToast } from '../toastState.js'

const activeSources = []
const playingPaths = ref(new Set())
const statusText = ref('Ready')

export function useAudioPlayer() {
  const { settings } = useSettings()
  const { findMatchingDeviceId } = useAudioDevices()

  async function playSound(sound) {
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
    const primaryDeviceId = findMatchingDeviceId(s.primaryDevice)
    const secondaryDeviceId = findMatchingDeviceId(s.secondaryDevice)
    const masterVol = s.masterVolume ?? 1.0

    statusText.value = `Playing: ${sound.name}`
    playingPaths.value = new Set([...playingPaths.value, sound.path])

    const promises = []

    if (s.primaryEnabled && primaryDeviceId) {
      promises.push(playSoundOnDevice(arrayBuffer.slice(0), primaryDeviceId, s.primaryVolume * masterVol, sound.path))
    }
    if (s.secondaryEnabled && secondaryDeviceId) {
      promises.push(playSoundOnDevice(arrayBuffer.slice(0), secondaryDeviceId, s.secondaryVolume * masterVol, sound.path))
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
        statusText.value = `Error: ${e.message}`
        showToast(`Playback failed: ${sound.name}`)
      })
  }

  function playSoundOnDevice(arrayBuffer, deviceId, volume, path) {
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

        const sourceEntry = { source, audioCtx, path }
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

  function stopAll() {
    activeSources.forEach(({ source, audioCtx }) => {
      try { source.stop() } catch {}
      try { audioCtx.close() } catch {}
    })
    activeSources.length = 0
    playingPaths.value = new Set()
    statusText.value = 'Stopped'
  }

  return {
    playSound,
    stopAll,
    playingPaths,
    statusText,
  }
}
