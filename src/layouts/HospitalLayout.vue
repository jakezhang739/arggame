<template>
  <GameLayout skin="hospital" v-bind="$attrs">
    <slot />
  </GameLayout>
</template>

<script setup lang="ts">
import GameLayout from './GameLayout.vue';
</script>
