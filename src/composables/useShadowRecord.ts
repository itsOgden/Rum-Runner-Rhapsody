import { ref } from 'vue'
import { useSettings } from './useSettings'
import { useAudioDevices } from './useAudioDevices'
import { showToast } from '../toastState'
import { trimSidebarOpen, trimSidebarFile } from '../clipEditorState'

// Each chunk is interleaved stereo (L0, R0, L1, R1, …) at the AudioContext sample rate.
// At 48 kHz, 4096 samples ≈ 85 ms per chunk.
const CHUNK_SAMPLES = 4096

// AudioWorklet processor inlined as a blob so it works in both dev and packaged builds.
const PROCESSOR_CODE = `
class ShadowRecordProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this._buf = []
    this._acc = 0
  }
  process(inputs) {
    const input = inputs[0]
    if (!input || !input[0]) return true
    const ch0 = input[0]
    const ch1 = input[1] || ch0
    for (let i = 0; i < ch0.length; i++) {
      this._buf.push(ch0[i], ch1[i])
    }
    this._acc += ch0.length
    if (this._acc >= ${CHUNK_SAMPLES}) {
      const chunk = new Float32Array(this._buf)
      this.port.postMessage(chunk, [chunk.buffer])
      this._buf = []
      this._acc = 0
    }
    return true
  }
}
registerProcessor('shadow-record-processor', ShadowRecordProcessor)
`

// ── Module-level state (singleton — only one recording at a time) ─────────────

const isRecording = ref(false)
const isSaving = ref(false)
const hasBuffer = ref(false)

let _audioCtx: AudioContext | null = null
let _mediaStream: MediaStream | null = null
let _workletNode: AudioWorkletNode | null = null
let _sourceNode: MediaStreamAudioSourceNode | null = null
let _chunks: Float32Array[] = []
let _sampleRate = 48000

async function _teardown(): Promise<void> {
  if (_workletNode) { _workletNode.disconnect(); _workletNode.port.onmessage = null; _workletNode = null }
  if (_sourceNode) { _sourceNode.disconnect(); _sourceNode = null }
  if (_mediaStream) { _mediaStream.getTracks().forEach(t => t.stop()); _mediaStream = null }
  if (_audioCtx) { try { await _audioCtx.close() } catch {}; _audioCtx = null }
  _chunks = []
  isRecording.value = false
  hasBuffer.value = false
}

function _maxChunks(durationSecs: number, sampleRate: number): number {
  return Math.ceil(durationSecs * sampleRate / CHUNK_SAMPLES) + 1
}

function _onChunk(chunk: Float32Array, bufferDuration: number): void {
  const max = _maxChunks(bufferDuration, _sampleRate)
  _chunks.push(chunk)
  if (_chunks.length > max) _chunks.shift()
  if (!hasBuffer.value) hasBuffer.value = true
}

function encodeWav(chunks: Float32Array[], sampleRate: number): ArrayBuffer {
  const numChannels = 2
  const bitsPerSample = 16
  const numSamples = chunks.reduce((s, c) => s + c.length / numChannels, 0)
  const dataSize = numSamples * numChannels * (bitsPerSample / 8)
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  function writeStr(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true)
  view.setUint16(32, numChannels * (bitsPerSample / 8), true)
  view.setUint16(34, bitsPerSample, true)
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (const chunk of chunks) {
    for (let i = 0; i < chunk.length; i++) {
      const s = Math.max(-1, Math.min(1, chunk[i]))
      view.setInt16(offset, Math.round(s * 0x7FFF), true)
      offset += 2
    }
  }
  return buffer
}

export function useShadowRecord() {
  const { settings } = useSettings()
  const { findInputDeviceId } = useAudioDevices()
  // NOTE: do not put watch() here — this composable is called from multiple components.
  // Lifecycle management (start/stop on settings change) lives in App.vue.

  async function startRecording(): Promise<void> {
    await _teardown()

    const label = settings.value.recordingInputDeviceLabel
    if (!label) return

    const deviceId = findInputDeviceId(label)
    if (!deviceId) {
      showToast(`Shadow record: input device "${label}" not found`, 'info')
      return
    }

    try {
      _mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId }, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      })
    } catch (e) {
      showToast(`Shadow record: could not open "${label}" — ${(e as Error).message}`, 'info')
      return
    }

    _audioCtx = new AudioContext()
    _sampleRate = _audioCtx.sampleRate
    await _audioCtx.resume()

    const blob = new Blob([PROCESSOR_CODE], { type: 'application/javascript' })
    const url = URL.createObjectURL(blob)
    try {
      await _audioCtx.audioWorklet.addModule(url)
    } finally {
      URL.revokeObjectURL(url)
    }

    _workletNode = new AudioWorkletNode(_audioCtx, 'shadow-record-processor')
    _workletNode.port.onmessage = (e: MessageEvent<Float32Array>) => {
      _onChunk(e.data, settings.value.shadowBufferDuration ?? 30)
    }

    _sourceNode = _audioCtx.createMediaStreamSource(_mediaStream)
    _sourceNode.connect(_workletNode)
    _workletNode.connect(_audioCtx.destination)

    isRecording.value = true
    _chunks = []
    hasBuffer.value = false
  }

  async function stopRecording(): Promise<void> {
    await _teardown()
  }

  async function saveClip(): Promise<void> {
    if (isSaving.value || _chunks.length === 0) return
    const folder = settings.value.recordingFolder
    if (!folder) {
      showToast('Shadow record: no clips folder set — configure one in Settings', 'info')
      return
    }

    isSaving.value = true
    try {
      const snapshot = _chunks.slice()
      const wav = encodeWav(snapshot, _sampleRate)
      const result = await window.api.saveShadowClip(wav, folder)
      if (result.success) {
        showToast(`Clip saved: ${result.filename}`, 'info')
        if (settings.value.clipAutoOpenTrim && result.filePath) {
          trimSidebarFile.value = result.filePath
          trimSidebarOpen.value = true
        }
      } else {
        showToast(`Clip save failed: ${result.error}`)
      }
    } finally {
      isSaving.value = false
    }
  }

  return { isRecording, isSaving, hasBuffer, startRecording, stopRecording, saveClip }
}
