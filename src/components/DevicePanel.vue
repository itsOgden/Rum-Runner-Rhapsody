<script setup>
import DeviceCard from './DeviceCard.vue'
</script>

<template>
  <div
    class="grid gap-3 px-5 py-2.5 bg-bg-deepest border-b border-border shrink-0"
    style="grid-template-columns: repeat(auto-fill, minmax(220px, 1fr))"
  >
    <DeviceCard role="primary" />
    <DeviceCard role="secondary" />
  </div>
</template>
