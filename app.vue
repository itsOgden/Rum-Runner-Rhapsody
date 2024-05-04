<script setup lang="ts">
import { ModalsContainer } from 'vue-final-modal'

useHead({
  htmlAttrs: {
    lang: 'en',
  },
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
    <ModalsContainer />
  </NuxtLayout>
</template>
