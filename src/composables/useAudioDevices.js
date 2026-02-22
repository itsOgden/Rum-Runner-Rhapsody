import { ref } from 'vue'

const audioDevices = ref([])

export function useAudioDevices() {
  async function refreshDevices() {
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

      audioDevices.value = outputs
    } catch (e) {
      console.error('Could not enumerate devices:', e)
    }
  }

  function cleanDeviceLabel(label) {
    return label.replace(/\s*\([0-9a-fA-F]{4}:[0-9a-fA-F]{4}\)\s*$/, '').trim()
  }

  function findMatchingDeviceId(savedName) {
    const devs = audioDevices.value
    if (!savedName) return devs[0]?.deviceId ?? ''

    // Exact deviceId match
    let match = devs.find(d => d.deviceId === savedName)
    if (match) return match.deviceId

    // Exact raw label match
    match = devs.find(d => d.label === savedName)
    if (match) return match.deviceId

    // Exact cleaned label match
    match = devs.find(d => cleanDeviceLabel(d.label) === savedName)
    if (match) return match.deviceId

    // Substring match
    const lower = savedName.toLowerCase()
    match = devs.find(d => {
      const clean = cleanDeviceLabel(d.label).toLowerCase()
      return clean.includes(lower) || lower.includes(clean)
    })
    return match?.deviceId ?? (devs[0]?.deviceId ?? '')
  }

  function getDeviceLabel(deviceId) {
    const d = audioDevices.value.find(dev => dev.deviceId === deviceId)
    return d ? cleanDeviceLabel(d.label || `Device ${deviceId.slice(0, 8)}`) : ''
  }

  return {
    audioDevices,
    refreshDevices,
    cleanDeviceLabel,
    findMatchingDeviceId,
    getDeviceLabel,
  }
}
