<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useGameStore } from '../stores/game';
import { useSettingsStore } from '../stores/settings';
import { formatGameTime } from '../game/selectors';
import type { SettingsData } from '../game/types';
import AppIcon from './AppIcon.vue';

const router = useRouter();
const game = useGameStore();
const settings = useSettingsStore();

const showSettings = ref(false);
const tick = ref(0);
let timer: ReturnType<typeof setInterval> | null = null;

const clock = computed(() => {
  void tick.value;
  return formatGameTime(game.elapsedNow());
});

const scaleOptions = [
  { label: '100%', value: 1 },
  { label: '125%', value: 1.25 },
  { label: '150%', value: 1.5 },
  { label: '200%', value: 2 },
];

onMounted(() => {
  timer = setInterval(() => (tick.value += 1), 1000);
});
onUnmounted(() => {
  if (timer) clearInterval(timer);
});

function exit(): void {
  router.push('/');
}
</script>

<template>
  <div class="controls">
    <button class="control-button" data-testid="controls:exit" @click="exit">
      <AppIcon name="exit" :size="17" /> <span>退出</span>
    </button>
    <button
      class="control-button"
      data-testid="controls:settings"
      @click="showSettings = !showSettings"
      :aria-expanded="showSettings"
    >
      <AppIcon name="settings" :size="17" /> <span>设置</span>
    </button>
    <button
      class="control-button"
      data-testid="controls:subtitles"
      :aria-pressed="settings.data.subtitles"
      @click="settings.update({ subtitles: !settings.data.subtitles })"
    >
      <AppIcon name="headphones" :size="17" /> <span>字幕：{{ settings.data.subtitles ? '开' : '关' }}</span>
    </button>
    <span class="clock mono" data-testid="controls:clock" aria-label="游戏内时间">
      <span class="clock-status" aria-hidden="true"></span>
      值班 {{ clock }}
    </span>

    <div v-if="showSettings" class="settings-panel panel" role="dialog" aria-label="设置">
      <header class="settings-head">
        <span class="mono">VIEW / PREFS</span>
        <button class="close" aria-label="关闭设置" @click="showSettings = false">×</button>
      </header>
      <label class="row">
        <span>文字大小</span>
        <select
          data-testid="settings:text-scale"
          :value="settings.data.textScale"
          @change="
            settings.update({
              textScale: Number(
                ($event.target as HTMLSelectElement).value,
              ) as SettingsData['textScale'],
            })
          "
        >
          <option v-for="o in scaleOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </label>
      <label class="row">
        <span>音量</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          :value="settings.data.volume"
          @input="settings.update({ volume: Number(($event.target as HTMLInputElement).value) })"
        />
      </label>
      <label class="row">
        <span>减少动效</span>
        <select
          :value="settings.data.reducedMotion"
          @change="
            settings.update({
              reducedMotion: ($event.target as HTMLSelectElement).value as
                'follow-system' | 'on' | 'off',
            })
          "
        >
          <option value="follow-system">跟随系统</option>
          <option value="on">开</option>
          <option value="off">关</option>
        </select>
      </label>
    </div>
  </div>
</template>

<style scoped>
.controls {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.82rem;
}
.control-button {
  min-height: 36px;
  padding: 5px 11px;
  border-color: transparent;
  background: transparent;
  box-shadow: none;
  color: var(--muted);
}
.control-button:hover:not(:disabled),
.control-button[aria-expanded='true'],
.control-button[aria-pressed='true'] {
  border-color: var(--line);
  background: var(--surface-muted);
  color: var(--text-strong);
  box-shadow: none;
  transform: none;
}
.clock {
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  gap: 7px;
  color: var(--muted);
  border-left: 1px solid var(--line);
  padding: 2px 0 2px var(--space-3);
  white-space: nowrap;
}
.clock-status {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #7d9b8d;
}
.settings-panel {
  position: absolute;
  top: calc(100% + var(--space-3));
  right: 0;
  z-index: 30;
  width: min(340px, calc(100vw - 28px));
  box-shadow: var(--shadow-md);
}
.settings-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: calc(var(--space-2) * -1) 0 var(--space-3);
  border-bottom: 1px solid var(--line);
  padding-bottom: var(--space-2);
  color: var(--muted);
  font-size: 0.7rem;
  letter-spacing: 0.08em;
}
.close {
  width: 30px;
  min-height: 30px;
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
  font-size: 1.25rem;
}
.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
  margin: var(--space-2) 0;
}

@media (max-width: 760px) {
  .controls {
    justify-content: flex-end;
    flex-wrap: wrap;
  }
  .control-button {
    min-height: 34px;
    padding-inline: var(--space-2);
  }
  .clock {
    min-height: 30px;
    padding-left: var(--space-2);
    font-size: 0.72rem;
  }
}
</style>
