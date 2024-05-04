export const useSoundboardStore = defineStore('soundboard', {
  state: () => ({
    audioDevices: [] as MediaDeviceInfo[],
    listeningDevice: '',
    outputDevice: '',
  }),
  actions: {
    setAudioDevices(devices: MediaDeviceInfo[]) {
      this.audioDevices = devices
    },
    setListeningDevice(deviceID?: string) {
      this.listeningDevice = deviceID ?? ''
    },
    setOutputDevice(deviceID?: string) {
      this.outputDevice = deviceID ?? ''
    },
  },
  // https://prazdevs.github.io/pinia-plugin-persistedstate/frameworks/nuxt-3.html#usage
  persist: {
    storage: persistedState.cookiesWithOptions({
      sameSite: 'strict',
    }),
  },
})
