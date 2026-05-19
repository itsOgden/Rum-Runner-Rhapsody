import { ref, watch, type Ref } from 'vue'
import { encodeWavFromAudioBuffer, trimAudioBuffer, generatePeaks } from '../utils/audio'

function getBufferPeak(buffer: AudioBuffer): number {
  let peak = 0
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch)
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i])
      if (abs > peak) peak = abs
    }
  }
  return peak
}

export function useClipPlayer(normalize?: Ref<boolean>, masterVolume?: Ref<number>) {
  const isLoading = ref(false)
  const isPlaying = ref(false)
  const duration = ref(0)
  const inPoint = ref(0)
  const outPoint = ref(0)
  const currentTime = ref(0)
  const loop = ref(false)
  const peaks = ref<Array<{ min: number; max: number }>>([])
  const hasSelection = ref(false)

  let _ctx: AudioContext | null = null
  let _buffer: AudioBuffer | null = null
  let _sourceNode: AudioBufferSourceNode | null = null
  let _gainNode: GainNode | null = null
  let _masterGainNode: GainNode | null = null
  let _rafId: number | null = null
  let _startCtxTime = 0
  let _startOffset = 0
  let _stopped = false

  if (masterVolume) {
    watch(masterVolume, (vol) => {
      if (_masterGainNode && _ctx) {
        _masterGainNode.gain.setTargetAtTime(vol ?? 1, _ctx.currentTime, 0.01)
      }
    })
  }

  function _getOrCreateMasterGain(): GainNode {
    if (!_masterGainNode && _ctx) {
      _masterGainNode = _ctx.createGain()
      _masterGainNode.gain.value = masterVolume?.value ?? 1
      _masterGainNode.connect(_ctx.destination)
    }
    return _masterGainNode!
  }

  function _cancelRaf() {
    if (_rafId !== null) { cancelAnimationFrame(_rafId); _rafId = null }
  }

  function _stopSource() {
    _stopped = true
    try { _sourceNode?.stop() } catch {}
    _sourceNode = null
  }

  function _tick() {
    if (!_ctx || !isPlaying.value) return
    const elapsed = _ctx.currentTime - _startCtxTime
    let pos = _startOffset + elapsed

    if (loop.value) {
      const range = outPoint.value - inPoint.value
      if (range > 0) pos = inPoint.value + ((pos - inPoint.value) % range)
    } else {
      pos = Math.min(pos, outPoint.value)
    }
    currentTime.value = pos
    _rafId = requestAnimationFrame(_tick)
  }

  async function loadFile(path: string): Promise<void> {
    stop()
    peaks.value = []
    duration.value = 0
    isLoading.value = true

    try {
      const ab = await window.api.readSoundFile(path)
      if (!ab) return

      if (!_ctx || _ctx.state === 'closed') _ctx = new AudioContext()
      _buffer = await _ctx.decodeAudioData(ab)
      duration.value = _buffer.duration
      inPoint.value = 0
      outPoint.value = _buffer.duration
      currentTime.value = 0
      hasSelection.value = false
      peaks.value = generatePeaks(_buffer)
    } finally {
      isLoading.value = false
    }
  }

  function play() {
    if (!_buffer || !_ctx) return
    if (_ctx.state === 'suspended') _ctx.resume()

    _stopSource()
    _stopped = false
    _cancelRaf()
    _gainNode?.disconnect()
    _gainNode = null

    const masterGain = _getOrCreateMasterGain()

    _sourceNode = _ctx.createBufferSource()
    _sourceNode.buffer = _buffer

    if (normalize?.value) {
      _gainNode = _ctx.createGain()
      const peak = getBufferPeak(_buffer)
      _gainNode.gain.value = peak > 0.01 ? 1 / peak : 1
      _sourceNode.connect(_gainNode)
      _gainNode.connect(masterGain)
    } else {
      _sourceNode.connect(masterGain)
    }

    const offset = Math.max(inPoint.value, Math.min(currentTime.value, outPoint.value))
    const playDur = loop.value ? undefined : Math.max(0.001, outPoint.value - offset)

    if (loop.value) {
      _sourceNode.loop = true
      _sourceNode.loopStart = inPoint.value
      _sourceNode.loopEnd = outPoint.value
    }

    _startCtxTime = _ctx.currentTime
    _startOffset = offset
    _sourceNode.start(0, offset, playDur)
    isPlaying.value = true
    _rafId = requestAnimationFrame(_tick)

    // Capture identity so a stale onended from a previous source can't stomp this playback
    const capturedSource = _sourceNode
    capturedSource.onended = () => {
      if (_stopped || _sourceNode !== capturedSource) return
      isPlaying.value = false
      currentTime.value = inPoint.value
      _cancelRaf()
    }
  }

  function pause() {
    if (!isPlaying.value || !_ctx) return
    const elapsed = _ctx.currentTime - _startCtxTime
    const rawPos = _startOffset + elapsed
    const range = outPoint.value - inPoint.value
    const pos = loop.value && range > 0
      ? inPoint.value + ((rawPos - inPoint.value) % range)
      : Math.min(rawPos, outPoint.value)
    isPlaying.value = false
    _stopSource()
    _cancelRaf()
    currentTime.value = pos
  }

  function stop() {
    isPlaying.value = false
    _stopSource()
    _cancelRaf()
    currentTime.value = inPoint.value
  }

  function seek(time: number) {
    const wasPlaying = isPlaying.value
    if (wasPlaying) stop()
    currentTime.value = Math.max(0, Math.min(time, duration.value))
    if (wasPlaying) play()
  }

  function setIn(time: number) {
    inPoint.value = Math.max(0, Math.min(time, outPoint.value - 0.05))
    if (currentTime.value < inPoint.value) currentTime.value = inPoint.value
    hasSelection.value = true
  }

  function setOut(time: number) {
    outPoint.value = Math.max(inPoint.value + 0.05, Math.min(time, duration.value))
    if (currentTime.value > outPoint.value) currentTime.value = outPoint.value
    hasSelection.value = true
  }

  function resetTrim() {
    inPoint.value = 0
    outPoint.value = duration.value
    hasSelection.value = false
  }

  async function exportTrimmed(
    destFolder: string,
    filename: string,
  ): Promise<{ success: boolean; filePath?: string; filename?: string; error?: string }> {
    if (!_buffer) return { success: false, error: 'No file loaded' }
    const trimmed = trimAudioBuffer(_buffer, inPoint.value, outPoint.value)
    const wav = encodeWavFromAudioBuffer(trimmed)
    return window.api.saveExportedClip(wav, destFolder, filename)
  }

  function cleanup() {
    stop()
    _gainNode?.disconnect()
    _gainNode = null
    _masterGainNode?.disconnect()
    _masterGainNode = null
    try { _ctx?.close() } catch {}
    _ctx = null
    _buffer = null
  }

  return {
    isLoading, isPlaying, duration, inPoint, outPoint, currentTime, loop, peaks, hasSelection,
    loadFile, play, pause, stop, seek, setIn, setOut, resetTrim, exportTrimmed, cleanup,
  }
}
