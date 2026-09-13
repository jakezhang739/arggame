<script setup lang="ts">
withDefaults(
  defineProps<{
    name:
      | 'arrow'
      | 'archive'
      | 'check'
      | 'clipboard'
      | 'download'
      | 'evidence'
      | 'exit'
      | 'headphones'
      | 'moon'
      | 'settings'
      | 'trail'
      | 'users'
      | 'warning';
    size?: number;
    label?: string;
  }>(),
  { size: 20, label: '' },
);
</script>

<template>
  <svg
    class="app-icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    :aria-hidden="label ? undefined : true"
    :aria-label="label || undefined"
    role="img"
  >
    <template v-if="name === 'arrow'">
      <path d="M5 12h14M14 7l5 5-5 5" />
    </template>
    <template v-else-if="name === 'archive'">
      <path d="M4 7h16v13H4zM3 4h18v3H3zM9 11h6" />
    </template>
    <template v-else-if="name === 'check'">
      <path d="m5 12 4 4L19 6" />
    </template>
    <template v-else-if="name === 'clipboard'">
      <path d="M9 5H6a2 2 0 0 0-2 2v12h16V7a2 2 0 0 0-2-2h-3" />
      <path d="M9 3h6v4H9zM8 12h8M8 16h6" />
    </template>
    <template v-else-if="name === 'download'">
      <path d="M12 3v12m-4-4 4 4 4-4M5 20h14" />
    </template>
    <template v-else-if="name === 'evidence'">
      <path d="M5 3h10l4 4v14H5zM15 3v5h4" />
      <circle cx="10.5" cy="13.5" r="2.5" />
      <path d="m12.5 15.5 2 2" />
    </template>
    <template v-else-if="name === 'exit'">
      <path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10" />
    </template>
    <template v-else-if="name === 'headphones'">
      <path d="M4 14v-2a8 8 0 0 1 16 0v2M4 14h4v6H6a2 2 0 0 1-2-2zM20 14h-4v6h2a2 2 0 0 0 2-2z" />
    </template>
    <template v-else-if="name === 'moon'">
      <path d="M20 15.2A8.5 8.5 0 0 1 8.8 4a8.5 8.5 0 1 0 11.2 11.2Z" />
    </template>
    <template v-else-if="name === 'settings'">
      <circle cx="12" cy="12" r="3" />
      <path d="M19 13.5v-3l-2-.7a7 7 0 0 0-.7-1.7l.9-1.9-2.1-2.1-1.9.9a7 7 0 0 0-1.7-.7L10.5 2h-3l-.7 2a7 7 0 0 0-1.7.7l-1.9-.9-2.1 2.1.9 1.9a7 7 0 0 0-.7 1.7L0 10.5v3l2 .7a7 7 0 0 0 .7 1.7l-.9 1.9 2.1 2.1 1.9-.9a7 7 0 0 0 1.7.7l.7 2h3l.7-2a7 7 0 0 0 1.7-.7l1.9.9 2.1-2.1-.9-1.9a7 7 0 0 0 .7-1.7z" transform="translate(2.5) scale(.8 1)" />
    </template>
    <template v-else-if="name === 'trail'">
      <path d="M5 4h14M5 12h10M5 20h14" />
      <circle cx="5" cy="4" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="5" cy="20" r="1.5" fill="currentColor" stroke="none" />
    </template>
    <template v-else-if="name === 'users'">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5.5a3 3 0 0 1 0 5.5M17 14a5 5 0 0 1 4 5" />
    </template>
    <template v-else-if="name === 'warning'">
      <path d="M12 3 2.5 20h19zM12 9v4M12 17h.01" />
    </template>
  </svg>
</template>

<style scoped>
.app-icon {
  display: inline-block;
  flex: 0 0 auto;
  vertical-align: -0.18em;
}
</style>
