export function encodeWavFromAudioBuffer(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = Math.min(2, buffer.numberOfChannels)
  const sampleRate = buffer.sampleRate
  const numSamples = buffer.length
  const bitsPerSample = 16
  const blockAlign = numChannels * (bitsPerSample / 8)
  const dataSize = numSamples * blockAlign

  const ab = new ArrayBuffer(44 + dataSize)
  const view = new DataView(ab)

  function str(offset: number, s: string) {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
  }

  str(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  str(8, 'WAVE')
  str(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  str(36, 'data')
  view.setUint32(40, dataSize, true)

  const ch0 = buffer.getChannelData(0)
  const ch1 = numChannels > 1 ? buffer.getChannelData(1) : ch0
  let offset = 44
  for (let i = 0; i < numSamples; i++) {
    for (const s of [ch0[i], ch1[i]]) {
      view.setInt16(offset, Math.round(Math.max(-1, Math.min(1, s)) * 0x7fff), true)
      offset += 2
    }
  }
  return ab
}

export function trimAudioBuffer(buffer: AudioBuffer, inSec: number, outSec: number): AudioBuffer {
  const sr = buffer.sampleRate
  const inSample = Math.max(0, Math.floor(inSec * sr))
  const outSample = Math.min(buffer.length, Math.ceil(outSec * sr))
  const length = Math.max(0, outSample - inSample)

  const trimmed = new AudioBuffer({ numberOfChannels: buffer.numberOfChannels, length, sampleRate: sr })
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const src = buffer.getChannelData(c)
    const dst = trimmed.getChannelData(c)
    for (let i = 0; i < length; i++) dst[i] = src[inSample + i]
  }
  return trimmed
}

export function generatePeaks(buffer: AudioBuffer, numPeaks = 1024): Array<{ min: number; max: number }> {
  const ch0 = buffer.getChannelData(0)
  const ch1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : ch0
  const samplesPerPeak = buffer.length / numPeaks
  const result: Array<{ min: number; max: number }> = []

  for (let i = 0; i < numPeaks; i++) {
    const start = Math.floor(i * samplesPerPeak)
    const end = Math.min(buffer.length, Math.floor((i + 1) * samplesPerPeak))
    let min = 0; let max = 0
    for (let j = start; j < end; j++) {
      const v = (ch0[j] + ch1[j]) * 0.5
      if (v < min) min = v
      if (v > max) max = v
    }
    result.push({ min, max })
  }
  return result
}
