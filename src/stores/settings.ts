/** 设置 store（docs/01_核心契约.md §10.1）。 */
import { ref, watch } from 'vue';
import { defineStore } from 'pinia';
import type { SettingsData } from '../game/types';
import { KVStorage, loadSettings, writeSettings } from '../game/persistence';

function safeStorage(): KVStorage {
  if (typeof localStorage !== 'undefined') return localStorage;
  return { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };
}

export const useSettingsStore = defineStore('settings', () => {
  const data = ref<SettingsData>(loadSettings(safeStorage()));

  watch(
    data,
    (d) => {
      writeSettings(safeStorage(), d);
      if (typeof document !== 'undefined') {
        document.documentElement.style.fontSize = `${16 * d.textScale}px`;
      }
    },
    { deep: true },
  );

  function update(patch: Partial<SettingsData>): void {
    data.value = { ...data.value, ...patch };
  }

  return { data, update };
});
