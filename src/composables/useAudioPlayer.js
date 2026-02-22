import { ref } from 'vue'
import { useSettings } from './useSettings.js'
import { useAudioDevices } from './useAudioDevices.js'

const activeSources = []
const playingPaths = ref(new Set())
const statusText = ref('Ready')

export function useAudioPlayer() {
  const { settings } = useSettings()
  const { findMatchingDeviceId } = useAudioDevices()

  async function playSound(sound) {
    const arrayBuffer = await window.api.readSoundFile(sound.path)
    if (!arrayBuffer) {
      statusText.value = `Error reading: ${sound.filename}`
      return
    }

    const s = settings.value
    const primaryDeviceId = findMatchingDeviceId(s.primaryDevice)
    const secondaryDeviceId = findMatchingDeviceId(s.secondaryDevice)

    statusText.value = `Playing: ${sound.name}`
    playingPaths.value = new Set([...playingPaths.value, sound.path])

    const promises = []

    if (s.primaryEnabled && primaryDeviceId) {
      promises.push(playSoundOnDevice(arrayBuffer.slice(0), primaryDeviceId, s.primaryVolume))
    }
    if (s.secondaryEnabled && secondaryDeviceId) {
      promises.push(playSoundOnDevice(arrayBuffer.slice(0), secondaryDeviceId, s.secondaryVolume))
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
      })
  }

  function playSoundOnDevice(arrayBuffer, deviceId, volume) {
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

        const sourceEntry = { source, audioCtx }
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
