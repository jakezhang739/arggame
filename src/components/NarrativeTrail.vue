<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useGameStore } from '../stores/game';
import { formatGameTime } from '../game/selectors';

defineProps<{ mode: 'drawer' | 'full' }>();

const game = useGameStore();
const open = ref(false);
const expandedSeq = ref<number | null>(null);

function toggle(): void {
  open.value = !open.value;
}

function eventDetail(code: string, rawPayload: unknown): string {
  const payload = rawPayload as Record<string, unknown> | undefined;
  const obj = (payload?.documentId ?? payload?.audioId ?? payload?.cardId) as string | undefined;
  return obj ? `${code}:${obj}` : code;
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.ctrlKey && e.key.toLowerCase() === 't') {
    e.preventDefault();
    toggle();
  }
}

onMounted(() => window.addEventListener('keydown', onKeyDown));
onUnmounted(() => window.removeEventListener('keydown', onKeyDown));
</script>

<template>
  <div v-if="mode === 'drawer'" class="trail-wrap" :class="{ open }">
    <button
      class="trail-toggle"
      data-testid="trail:drawer-toggle"
      :aria-expanded="open"
      aria-controls="trail-drawer"
      @click="toggle"
    >
      <span>叙事轨迹</span>
      <span class="trail-count mono" aria-hidden="true">{{ game.trailRows.length }}</span>
    </button>
    <aside
      id="trail-drawer"
      class="trail-drawer"
      :hidden="!open"
      aria-label="叙事轨迹"
      role="region"
    >
      <header class="trail-head">
        <h2>叙事轨迹</h2>
        <button data-testid="trail:close" @click="toggle">收起</button>
      </header>
      <ol class="trail-list">
        <li
          v-for="row in game.trailRows"
          :key="row.event.id"
          class="trail-row"
          :data-testid="`trail:row--${row.event.seq}`"
        >
          <div class="trail-line">
            <span class="mono muted">{{ formatGameTime(row.event.elapsedMs) }}</span>
            <span :class="{ rewritten: row.isRewritten }">{{ row.systemLabel }}</span>
            <button
              v-if="row.isRewritten || row.fact"
              class="linklike"
              :aria-expanded="expandedSeq === row.event.seq"
              @click="expandedSeq = expandedSeq === row.event.seq ? null : row.event.seq"
            >
              对照原始事件
            </button>
          </div>
          <div v-if="expandedSeq === row.event.seq" class="trail-raw mono">
            <div>
              {{ eventDetail(row.event.code, row.event.payload) }}
              <span v-if="row.event.scope"> / SCOPE={{ row.event.scope }}</span>
            </div>
            <div v-if="row.fact" class="muted">事实：{{ row.fact }}</div>
          </div>
        </li>
      </ol>
    </aside>
  </div>

  <div v-else class="trail-full panel">
    <h2>叙事轨迹 · 复核工作台</h2>
    <ol class="trail-list">
      <li v-for="row in game.trailRows" :key="row.event.id" class="trail-row">
        <div class="trail-line">
          <span class="mono muted">{{ formatGameTime(row.event.elapsedMs) }}</span>
          <span :class="{ rewritten: row.isRewritten }">{{ row.systemLabel }}</span>
        </div>
        <div class="trail-raw mono muted">
          {{ eventDetail(row.event.code, row.event.payload) }} · {{ row.fact ?? '' }}
        </div>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.trail-toggle {
  position: fixed;
  right: var(--space-4);
  bottom: var(--space-5);
  z-index: 40;
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  gap: var(--space-2);
  border-color: #72867c;
  border-radius: 999px;
  padding: 6px 7px 6px var(--space-4);
  background: var(--room-black);
  box-shadow: 0 9px 25px rgba(9, 24, 18, 0.24);
  color: #f3f7f4;
  font-size: 0.78rem;
  letter-spacing: 0.04em;
}
.trail-toggle:hover:not(:disabled) {
  border-color: #9db0a6;
  background: #193027;
  color: #fff;
}
.trail-count {
  display: grid;
  min-width: 30px;
  height: 30px;
  place-items: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.13);
  color: #fff;
  font-size: 0.68rem;
}
.trail-drawer {
  position: fixed;
  right: 0;
  top: 0;
  bottom: 0;
  width: min(410px, 94vw);
  background:
    linear-gradient(90deg, var(--clinical) 0 52px, transparent 52px) top left / 100% 3px no-repeat,
    #f6f8f6;
  border-left: 1px solid var(--line-strong);
  box-shadow: -16px 0 48px rgba(10, 28, 21, 0.2);
  z-index: 45;
  overflow-y: auto;
  padding: var(--space-5);
}
.trail-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.trail-head h2 {
  margin: 0;
  font-size: 1.12rem;
}
.trail-list {
  list-style: none;
  margin: var(--space-3) 0 0;
  padding: 0;
}
.trail-row {
  position: relative;
  border-bottom: 1px solid var(--line);
  padding: var(--space-3) 0 var(--space-3) var(--space-4);
}
.trail-row::before {
  content: '';
  position: absolute;
  top: 20px;
  left: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--line-strong);
}
.trail-line {
  display: flex;
  gap: var(--space-2);
  align-items: baseline;
  flex-wrap: wrap;
}
.rewritten {
  text-decoration: line-through;
  text-decoration-color: var(--anomaly);
  color: var(--muted);
}
.trail-raw {
  margin-top: var(--space-1);
  font-size: 0.85em;
  background: var(--surface-muted);
  border-radius: var(--radius);
  padding: var(--space-2) var(--space-3);
}
.linklike {
  border: none;
  background: none;
  color: var(--clinical);
  text-decoration: underline;
  padding: 0;
  font-size: 0.85em;
}
.trail-full {
  max-height: 70vh;
  overflow-y: auto;
}

@media (max-width: 768px) {
  .trail-toggle {
    right: 12px;
    bottom: 14px;
  }
  .trail-drawer {
    width: 100vw;
    padding: var(--space-4);
  }
}
</style>
