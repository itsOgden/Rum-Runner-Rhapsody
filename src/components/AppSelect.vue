<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { activeDropdownId } from '../dropdownState'
import Icon from './Icon.vue'

const props = defineProps<{
  modelValue: string
  options: Array<{ value: string; label: string; color?: string }>
  variant?: 'default' | 'ghost'
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const dropdownId = `select-${Math.random().toString(36).slice(2)}`
const isOpen = ref(false)
const triggerRef = ref<HTMLButtonElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const pos = ref({ x: 0, y: 0, width: 0 })
const focusedIndex = ref(-1)

const selectedOption = computed(() => props.options.find(o => o.value === props.modelValue))
const selectedLabel = computed(() => selectedOption.value?.label ?? '')

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
  <div :class="variant === 'ghost' ? 'relative' : 'relative w-full'">
    <button
      ref="triggerRef"
      class="outline-none cursor-pointer font-sans"
      :class="variant === 'ghost'
        ? 'flex items-center gap-1.5 text-xs text-accent'
        : 'w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-sm bg-bg-surface text-text-primary border border-border-light transition-colors hover:bg-bg-surface-hover ' + (isOpen ? 'border-accent!' : 'focus:border-accent')"
      @click="toggle"
      @keydown="onTriggerKeydown"
    >
      <span class="flex items-center gap-2 min-w-0 truncate text-left">
        <span v-if="selectedOption?.color" class="w-2 h-2 rounded-full shrink-0" :style="{ backgroundColor: selectedOption.color }" />
        <span class="truncate">{{ selectedLabel }}</span>
      </span>
      <Icon
        name="chevron-down-solid"
        class="shrink-0 transition-transform duration-150"
        :class="[
          variant === 'ghost' ? 'text-[8px] text-accent' : 'text-[9px] text-text-dim',
          { 'rotate-180': isOpen }
        ]"
      />
    </button>

    <Teleport to="body">
      <Transition name="app-select">
        <div
          v-if="isOpen"
          ref="menuRef"
          class="fixed z-500 bg-bg-raised border border-border-light shadow-lg py-1 overflow-y-auto"
          :style="{ left: pos.x + 'px', top: pos.y + 'px', width: pos.width + 'px', minWidth: variant === 'ghost' ? '160px' : undefined, maxHeight: '240px' }"
          @click.stop
        >
          <button
            v-for="(option, i) in options"
            :key="option.value"
            tabindex="-1"
            class="select-item w-full text-left px-3 py-1.5 font-sans text-sm cursor-pointer outline-none transition-colors flex items-center gap-2"
            :class="[
              option.value === modelValue
                ? 'text-accent bg-bg-surface select-item--selected'
                : 'text-text-secondary hover:bg-bg-surface hover:text-text-primary',
              i === focusedIndex && option.value !== modelValue
                ? 'bg-bg-surface-hover! text-text-primary!'
                : ''
            ]"
            @click="select(option.value)"
            @mousemove="focusedIndex = i"
          >
            <span v-if="option.color" class="w-1.5 h-1.5 rounded-full shrink-0" :style="{ backgroundColor: option.color }" />
            <span class="truncate">{{ option.label }}</span>
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

.select-item {
  position: relative;
}
.select-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 15%;
  bottom: 15%;
  width: 2px;
  background: var(--color-accent);
  transform: scaleY(0);
  transition: transform 0.12s ease;
  transform-origin: center;
}
.select-item:hover::before {
  transform: scaleY(1);
}
.select-item--selected::before {
  transform: scaleY(1);
  transition: none;
}
</style>
