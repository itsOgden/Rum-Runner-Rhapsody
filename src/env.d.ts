/// <reference types="vite/client" />

// AudioContext.setSinkId is part of the Audio Output Devices API
// and is not yet included in the standard TypeScript DOM lib.
interface AudioContext {
  setSinkId(sinkId: string): Promise<void>
}
