<script lang="ts">
import { mapState } from 'pinia'
import { register, unregisterAll } from '@tauri-apps/plugin-global-shortcut'
import { useSoundboardStore } from '~/stores/soundboard'

export default defineNuxtComponent({
  data() {
    return {
      shortcutTriggered: false,
    }
  },
  computed: {
    ...mapState(useSoundboardStore, ['outputDevice', 'listeningDevice']),
  },
  mounted() {
    this.addShortcuts()
  },
  async beforeUnmount() {
    await unregisterAll()
  },
  methods: {
    addShortcuts() {
      this.addShortcut('CommandOrControl+Shift+Alt+F12', () => {
        this.shortcutTriggered = !this.shortcutTriggered
      })
    },
    async addShortcut(key: string, handler: () => void, onPress = true) {
      try {
        await register(key, (event) => {
          const pressed = event.state === 'Pressed'
          if (pressed !== onPress)
            return

          handler()
        })
      }
      catch (e) {
        console.warn(e)
      }
    },
    playAudioToId(url: string, id: string) {
      if (!id)
        return
      const audio = new Audio(url)
      audio.setSinkId(id).then(() => {
        audio.play()
      }).catch((e) => {
        console.error('Error setting audio device', e)
      })
    },
    play(file: File) {
      const reader = new FileReader()
      reader.onload = (event) => {
        if (event.target) {
          const result = event.target.result as string
          console.log(result)
          this.playAudioToId(result, this.outputDevice)
          this.playAudioToId(result, this.listeningDevice)
        }
      }
      reader.readAsDataURL(file)
    },
    playEvent(e: Event) {
      const target = e.target as HTMLInputElement
      if (!target || !target.files)
        return
      this.play(target.files[0])
    },
  },
})
</script>

<template>
  <main class="min-h-screen font-sans bg-gray-900" :class="shortcutTriggered ? 'bg-red-500' : ''">
    <div class="font-sans min-h-screen flex-center">
      <div class="space-y-8 w-96 m-auto pb-12">
        <SoundboardAudioDeviceSelector device-type="listener" description="Lets you hear what sound has been played" />
        <SoundboardAudioDeviceSelector device-type="output" description="What you want other people to hear" />
        <hr>
        <input type="file" accept=".mp3" @input="playEvent">
      </div>
    </div>
  </main>
</template>

<style scoped lang="scss">

</style>
