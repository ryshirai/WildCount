<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'default' | 'teal' | 'muted' | 'danger' | 'gold'
    /** When set, used as text content. Prefer default slot for custom markup. */
    label?: string
  }>(),
  { variant: 'default' },
)
</script>

<template>
  <span
    class="chip"
    :class="{
      'chip-teal': variant === 'teal',
      'chip-muted': variant === 'muted',
      'chip-danger': variant === 'danger',
      'chip-gold': variant === 'gold',
    }"
  >
    <slot>{{ label }}</slot>
  </span>
</template>
