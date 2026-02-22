<script setup>
import DeviceCard from './DeviceCard.vue'
</script>

<template>
  <div
    class="flex justify-between flex-col lg:flex-row gap-3 px-5 py-2.5 bg-bg-deepest border-b border-border shrink-0"
  >
    <DeviceCard role="primary" />
    <DeviceCard role="secondary" />
  </div>
</template>
