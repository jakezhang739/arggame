/** 音频 store：全局单音频源（docs/01_核心契约.md §4.6 / 方案稿）。 */
import { ref } from 'vue';
import { defineStore } from 'pinia';
import { useSettingsStore } from './settings';

export const useAudioStore = defineStore('audio', () => {
  const unavailable = ref<Set<string>>(new Set());
  const playing = ref<string | null>(null);
  const currentTimeMs = ref(0);
  const durationMs = ref(0);
  let current: HTMLAudioElement | null = null;

  function assetUrl(target: string): string {
    const base = import.meta.env.BASE_URL ?? '/';
    return `${base}audio/${target}.wav`;
  }

  function stop(): void {
    current?.pause();
    current = null;
    playing.value = null;
  }

  function play(target: string): void {
    if (typeof Audio === 'undefined') return;
    stop();
    const a = new Audio(assetUrl(target));
    const settings = useSettingsStore();
    a.volume = settings.data.volume;
    a.addEventListener('error', () => {
      unavailable.value.add(target);
      playing.value = null;
    });
    a.addEventListener('ended', () => {
      if (playing.value === target) playing.value = null;
      currentTimeMs.value = 0;
    });
    a.addEventListener('timeupdate', () => {
      currentTimeMs.value = Math.round(a.currentTime * 1000);
      if (Number.isFinite(a.duration)) durationMs.value = Math.round(a.duration * 1000);
    });
    a.addEventListener('loadedmetadata', () => {
      if (Number.isFinite(a.duration)) durationMs.value = Math.round(a.duration * 1000);
    });
    current = a;
    playing.value = target;
    void a.play().catch(() => {
      unavailable.value.add(target);
      playing.value = null;
    });
  }

  /** 声音测试：短促正弦提示音（不依赖音频资产）。 */
  function testBeep(): void {
    try {
      const Ctx =
        globalThis.AudioContext ??
        (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const settings = useSettingsStore();
      osc.frequency.value = 660;
      gain.gain.value = 0.15 * settings.data.volume;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
      osc.onended = () => void ctx.close();
    } catch {
      /* 无音频环境时静默 */
    }
  }

  function isUnavailable(target: string): boolean {
    return unavailable.value.has(target);
  }

  return { unavailable, playing, currentTimeMs, durationMs, play, stop, testBeep, isUnavailable, assetUrl };
});
