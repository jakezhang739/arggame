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
import AppIcon from './components/AppIcon.vue';
import { useSettingsStore } from './stores/settings';
import { useGameStore } from './stores/game';

const route = useRoute();
const settings = useSettingsStore();
const game = useGameStore();
const isDev = import.meta.env.DEV;
const showDebug = computed(() => isDev && route.query.debug === '1');
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
const unsafeOrigin = computed(() => typeof window !== 'undefined' && !window.isSecureContext);

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
  <div v-if="unsafeOrigin" class="global-notice error" role="alert" data-testid="banner:unsafe-origin">
    <AppIcon name="warning" :size="18" />
    当前打开方式无法建立安全存档。请使用 HTTPS 或本机 localhost 地址重新打开。
  </div>
  <div v-else-if="!game.lockHeld" class="global-notice" role="alert" data-testid="banner:temp-mode">
    另一窗口正在推进本存档。此窗口为临时视图（不写入）。
    <button class="ghost" @click="reload">重新载入接管</button>
  </div>
  <div v-else-if="game.commandError" class="global-notice error" role="alert" data-testid="banner:command-error">
    <AppIcon name="warning" :size="18" />
    {{ game.commandError }}
    <button class="ghost" @click="game.clearCommandError">知道了</button>
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
  <DebugPanel v-if="showDebug" />
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
.global-notice.error {
  background: rgba(67, 25, 23, 0.97);
  border-bottom-color: #b36a63;
  color: #fff1ef;
}
.global-notice.error button {
  border-color: rgba(255, 255, 255, .38);
  color: #fff;
}
@media (max-width: 640px) {
  .global-notice {
    align-items: flex-start;
    justify-content: space-between;
    font-size: 0.74rem;
  }
}
</style>
