<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { activeDropdownId } from '../dropdownState'
import Icon from './Icon.vue'

const props = defineProps<{
  modelValue: string
  options: Array<{ value: string; label: string }>
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const dropdownId = `select-${Math.random().toString(36).slice(2)}`
const isOpen = ref(false)
const triggerRef = ref<HTMLButtonElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const pos = ref({ x: 0, y: 0, width: 0 })
const focusedIndex = ref(-1)

const selectedLabel = computed(
  () => props.options.find(o => o.value === props.modelValue)?.label ?? ''
)

// Close when another dropdown opens
watch(activeDropdownId, (id) => { if (id !== dropdownId) isOpen.value = false })

let outsideHandler: ((e: MouseEvent) => void) | null = null

function removeOutsideHandler() {
  if (outsideHandler) {
    document.removeEventListener('mousedown', outsideHandler)
    outsideHandler = null
  }
}

function open() {
  removeOutsideHandler()
  if (!triggerRef.value) return
  const rect = triggerRef.value.getBoundingClientRect()
  const est = Math.min(props.options.length * 34, 240)
  const y = rect.bottom + 2 + est > window.innerHeight ? rect.top - est - 2 : rect.bottom + 2
  pos.value = { x: rect.left, y, width: rect.width }
  focusedIndex.value = props.options.findIndex(o => o.value === props.modelValue)
  activeDropdownId.value = dropdownId
  isOpen.value = true

  outsideHandler = (e: MouseEvent) => {
    if (!menuRef.value?.contains(e.target as Node) && !triggerRef.value?.contains(e.target as Node)) {
      close()
    }
  }
  setTimeout(() => document.addEventListener('mousedown', outsideHandler!), 0)
}

function close() {
  removeOutsideHandler()
  isOpen.value = false
}

function toggle() {
  isOpen.value ? close() : open()
}

function select(value: string) {
  emit('update:modelValue', value)
  close()
  triggerRef.value?.focus()
}

function onTriggerKeydown(e: KeyboardEvent) {
  if (!isOpen.value) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault()
      open()
    }
    return
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    focusedIndex.value = Math.min(focusedIndex.value + 1, props.options.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    focusedIndex.value = Math.max(focusedIndex.value - 1, 0)
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    if (focusedIndex.value >= 0) select(props.options[focusedIndex.value].value)
    else close()
  } else if (e.key === 'Escape' || e.key === 'Tab') {
    if (e.key === 'Tab') e.preventDefault()
    close()
  }
}

onUnmounted(removeOutsideHandler)
</script>

<template>
  <div class="relative w-full">
    <button
      ref="triggerRef"
      class="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 font-sans text-sm bg-bg-surface text-text-primary border border-border-light outline-none cursor-pointer transition-colors focus:border-accent hover:bg-bg-surface-hover"
      @click="toggle"
      @keydown="onTriggerKeydown"
    >
      <span class="truncate text-left">{{ selectedLabel }}</span>
      <Icon
        name="chevron-down-solid"
        class="text-[9px] text-text-dim shrink-0 transition-transform duration-150"
        :class="{ 'rotate-180': isOpen }"
      />
    </button>

    <Teleport to="body">
      <Transition name="app-select">
        <div
          v-if="isOpen"
          ref="menuRef"
          class="fixed z-500 bg-bg-raised border border-border-light shadow-lg py-1 overflow-y-auto"
          :style="{ left: pos.x + 'px', top: pos.y + 'px', width: pos.width + 'px', maxHeight: '240px' }"
          @click.stop
        >
          <button
            v-for="(option, i) in options"
            :key="option.value"
            tabindex="-1"
            class="w-full text-left px-3 py-1.5 font-sans text-sm cursor-pointer outline-none transition-colors"
            :class="[
              option.value === modelValue
                ? 'text-accent bg-bg-surface'
                : 'text-text-secondary hover:bg-bg-surface hover:text-text-primary',
              i === focusedIndex && option.value !== modelValue
                ? 'bg-bg-surface-hover! text-text-primary!'
                : ''
            ]"
            @click="select(option.value)"
            @mousemove="focusedIndex = i"
          >
            {{ option.label }}
          </button>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.app-select-enter-active { transition: opacity 0.1s ease, transform 0.1s ease; }
.app-select-enter-from { opacity: 0; transform: translateY(-4px) scale(0.98); transform-origin: top; }
.app-select-leave-active { transition: opacity 0.08s ease; }
.app-select-leave-to { opacity: 0; }
</style>
