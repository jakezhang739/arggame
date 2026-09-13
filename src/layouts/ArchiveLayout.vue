<template>
  <GameLayout skin="archive" v-bind="$attrs">
    <slot />
  </GameLayout>
</template>

<script setup lang="ts">
import GameLayout from './GameLayout.vue';
</script>
