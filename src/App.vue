<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import HospitalLayout from './layouts/HospitalLayout.vue';
import ForumLayout from './layouts/ForumLayout.vue';
import ArchiveLayout from './layouts/ArchiveLayout.vue';
import LabLayout from './layouts/LabLayout.vue';
import PlainLayout from './layouts/PlainLayout.vue';
import NarrativeTrail from './components/NarrativeTrail.vue';
import DebugPanel from './components/DebugPanel.vue';
import { useSettingsStore } from './stores/settings';
import { useGameStore } from './stores/game';

const route = useRoute();
const settings = useSettingsStore();
const game = useGameStore();
const isDev = import.meta.env.DEV;
function reload(): void {
  window.location.reload();
}

const layouts = {
  hospital: HospitalLayout,
  forum: ForumLayout,
  archive: ArchiveLayout,
  lab: LabLayout,
  plain: PlainLayout,
} as const;

const layoutComp = computed(() => {
  const name = route.meta.layout as keyof typeof layouts | undefined;
  return (name && layouts[name]) || 'div';
});
const showTrail = computed(() => route.meta.trail !== false && route.name !== 'start');

onMounted(() => {
  document.documentElement.style.fontSize = `${16 * settings.data.textScale}px`;
});
watch(
  () => settings.data.textScale,
  (scale) => {
    document.documentElement.style.fontSize = `${16 * scale}px`;
  },
);
</script>

<template>
  <component :is="layoutComp" :address="(route.meta.address as string) ?? ''">
    <RouterView />
  </component>
  <div v-if="!game.lockHeld" class="global-notice" role="alert" data-testid="banner:temp-mode">
    另一窗口正在推进本存档。此窗口为临时视图（不写入）。
    <button class="ghost" @click="reload">重新载入接管</button>
  </div>
  <div
    v-else-if="game.externalUpdate"
    class="global-notice"
    role="status"
    data-testid="banner:external-update"
  >
    存档已在另一窗口更新。本窗口显示的仍是旧进度；重新载入可同步。
    <button class="ghost" @click="reload">重新载入</button>
  </div>
  <NarrativeTrail v-if="showTrail" mode="drawer" />
  <DebugPanel v-if="isDev" />
</template>

<style>
.global-notice {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 50;
  display: flex;
  gap: var(--space-3);
  align-items: center;
  justify-content: center;
  background: rgba(244, 235, 216, 0.97);
  border-bottom: 1px solid #c9b277;
  padding: var(--space-2) var(--space-4);
  box-shadow: 0 6px 18px rgba(50, 38, 13, 0.12);
  color: #4e3911;
  font-size: 0.82rem;
  backdrop-filter: blur(10px);
}
.global-notice button {
  min-height: 34px;
  border-color: #bda86f;
  color: #4e3911;
}
@media (max-width: 640px) {
  .global-notice {
    align-items: flex-start;
    justify-content: space-between;
    font-size: 0.74rem;
  }
}
</style>
