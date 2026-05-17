import { ref } from 'vue'
import { useSettings } from './useSettings'
import { showToast } from '../toastState'

const audioDevices = ref<MediaDeviceInfo[]>([])
const audioInputDevices = ref<MediaDeviceInfo[]>([])

// Returns true for Windows proxy aliases that the Web Audio API cannot route
// to reliably via setSinkId: the explicit "default" deviceId, any label
// beginning with "Default", and any label beginning with "Communications".
// The real hardware device always appears as a separate entry in the list.
function isDefaultDevice(d: MediaDeviceInfo): boolean {
  if (d.deviceId === 'default') return true
  const lower = d.label.toLowerCase()
  if (lower.startsWith('default')) return true
  if (lower.startsWith('communications')) return true
  return false
}

// Strip a leading "Default - " or "Communications - " (with optional en/em
// dash) prefix so that a saved name such as
// "Communications - Headphones (Realtek USB Audio)" can be matched against
// the real device "Headphones (Realtek USB Audio)".
function stripDefaultPrefix(str: string): string {
  return str.replace(/^(?:default|communications)\s*[-–]\s*/i, '').trim()
}

export function useAudioDevices() {
  function cleanDeviceLabel(label: string): string {
    return label.replace(/\s*\([0-9a-fA-F]{4}:[0-9a-fA-F]{4}\)\s*$/, '').trim()
  }

  // Returns the first device in `devs` that specifically matches `savedName`,
  // or null if nothing matches.  Does NOT fall back to the first device.
  function _findSpecificMatch(savedName: string, devs: MediaDeviceInfo[]): MediaDeviceInfo | null {
    if (!savedName) return null

    const stripped = stripDefaultPrefix(savedName)
    // If the saved name had a Default prefix, try the stripped version first,
    // then the original (though it won't be in the filtered list).
    const names = stripped !== savedName ? [stripped, savedName] : [savedName]

    for (const name of names) {
      // Exact deviceId
      let match = devs.find(d => d.deviceId === name)
      if (match) return match

      // Exact raw label
      match = devs.find(d => d.label === name)
      if (match) return match

      // Exact cleaned label (USB ID stripped)
      match = devs.find(d => cleanDeviceLabel(d.label) === name)
      if (match) return match

      // Substring match (handles partial saves and label drift)
      const lower = name.toLowerCase()
      match = devs.find(d => {
        const clean = cleanDeviceLabel(d.label).toLowerCase()
        return clean.includes(lower) || lower.includes(clean)
      })
      if (match) return match
    }

    return null
  }

  async function refreshDevices(): Promise<void> {
    try {
      let devices = await navigator.mediaDevices.enumerateDevices()
      let outputs = devices.filter(d => d.kind === 'audiooutput' && d.deviceId !== '')

      if (outputs.length <= 1 || outputs.every(d => !d.label)) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
          stream.getTracks().forEach(t => t.stop())
          devices = await navigator.mediaDevices.enumerateDevices()
          outputs = devices.filter(d => d.kind === 'audiooutput' && d.deviceId !== '')
        } catch (e) {
          console.warn('Could not get mic permission for device labels:', e)
        }
      }

      // Remove Windows "Default" and "Communications" alias entries — they
      // can't be addressed by setSinkId; the real device is always listed separately.
      outputs = outputs.filter(d => !isDefaultDevice(d))

      audioDevices.value = outputs

      const inputs = devices.filter(d => d.kind === 'audioinput' && d.deviceId !== '' && !isDefaultDevice(d))
      audioInputDevices.value = inputs

      // Warn if a previously saved device can no longer be resolved.
      // This covers the case where a device was disconnected, or the only
      // saved entry was a "Default - X" alias with no real match remaining.
      const { settings } = useSettings()
      for (let i = 0; i < settings.value.devices.length; i++) {
        const label = settings.value.devices[i]?.label ?? ''
        if (label && !_findSpecificMatch(label, outputs)) {
          showToast(`Output ${i + 1} "${label}" not found — please reselect.`, 'info')
        }
      }
    } catch (e) {
      console.error('Could not enumerate devices:', e)
    }
  }

  // fallbackIndex controls which device is used when savedName is empty or
  // no longer matches anything in the list.  Primary slots pass 0; secondary
  // slots pass 1 so they default to a different device than the primary.
  // If the requested index doesn't exist (only one device available) we fall
  // back to index 0 so the function always returns something usable.
  function findMatchingDeviceId(savedName: string, fallbackIndex = 0): string {
    const devs = audioDevices.value
    const fallback = (devs[fallbackIndex] ?? devs[0])?.deviceId ?? ''
    if (!savedName) return fallback
    const match = _findSpecificMatch(savedName, devs)
    return match?.deviceId ?? fallback
  }

  function getDeviceLabel(deviceId: string): string {
    const d = audioDevices.value.find(dev => dev.deviceId === deviceId)
    return d ? cleanDeviceLabel(d.label || `Device ${deviceId.slice(0, 8)}`) : ''
  }

  function findInputDeviceId(savedLabel: string): string {
    if (!savedLabel) return ''
    const match = _findSpecificMatch(savedLabel, audioInputDevices.value)
    return match?.deviceId ?? ''
  }

  return {
    audioDevices,
    audioInputDevices,
    refreshDevices,
    cleanDeviceLabel,
    findMatchingDeviceId,
    findInputDeviceId,
    getDeviceLabel,
  }
}
