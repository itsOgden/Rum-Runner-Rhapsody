<script lang="ts">
import type { PropType } from 'vue'
import { mapStores } from 'pinia'
import { useSoundboardStore } from '~/stores/soundboard'
import SelectDropdown from '~/components/SelectDropdown.vue'

export interface MediaDevicesWithFirefox extends MediaDevices {
  /** Only available in Firefox 116 and later */
  selectAudioOutput?: () => Promise<MediaDeviceInfo[]>
}

export default defineNuxtComponent({
  components: { SelectDropdown },
  emits: ['change'],
  props: {
    deviceType: {
      type: String as PropType<'listener' | 'output'>,
      required: true,
    },
  },
  mounted() {
    if (!this.output)
      return
    this.getAudioDevices()
  },
  computed: {
    ...mapStores(useSoundboardStore),
    output() {
      return this.deviceType === 'output'
    },
    audioDeviceList() {
      return [
        undefined,
        ...this.soundboardStore.audioDevices,
      ]
    },
    selectedDevice(): string | undefined {
      return this.output ? this.soundboardStore.outputDevice : this.soundboardStore.listeningDevice
    },
    devices(): MediaDevicesWithFirefox {
      return navigator.mediaDevices as MediaDevicesWithFirefox
    },
  },
  methods: {
    async getAudioDevices() {
      await this.devices.getUserMedia({ audio: true }).catch(e => console.log(e))
      this.devices.enumerateDevices().then(this.setDevices)
    },
    setDevices(devices: MediaDeviceInfo[]) {
      this.soundboardStore.setAudioDevices(devices.filter(device => device.kind === 'audiooutput'))
    },
    setDevice(deviceID: string | undefined) {
      if (deviceID === 'None')
        deviceID = undefined

      if (this.output)
        this.soundboardStore.setOutputDevice(deviceID)
      else
        this.soundboardStore.setListeningDevice(deviceID)
    },
  },
})
</script>

<template>
  <SelectDropdown :label="`${output ? 'Output' : 'Listening'} Device`" @change="setDevice">
    <option v-for="device in audioDeviceList" :key="device?.deviceId ?? 'undefined'" class="cursor-pointer" :value="device?.deviceId" :selected="selectedDevice === device?.deviceId">
      {{ device?.label ?? 'None' }}
    </option>
  </SelectDropdown>
</template>

<style scoped lang="scss">

</style>
