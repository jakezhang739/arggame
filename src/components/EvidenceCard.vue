<script setup lang="ts">
import { computed } from 'vue';
import { useGameStore } from '../stores/game';
import { canOpenEvidence, evidenceSourceLabel, evidenceStatusFor, evidenceView, isAcquired, EVIDENCE_STATUS_LABEL } from '../game/selectors';
import { content } from '../game/content';
import type { EvidenceId } from '../game/content-ids';
import AppIcon from './AppIcon.vue';

const props = defineProps<{ id: string }>();
const game = useGameStore();

const id = computed(() => props.id as EvidenceId);
const item = computed(() => content.evidenceRegistry.find((e) => e.id === id.value));
const acquired = computed(() => isAcquired(game.state, id.value));
const openable = computed(() => canOpenEvidence(game.state, id.value));
const view = computed(() => evidenceView(game.state, id.value));
const pinned = computed(() => game.save.pinnedEvidence.includes(id.value));
const status = computed(() => evidenceStatusFor(game.state, id.value, game.save.pinnedEvidence));
const statusLabel = computed(() => EVIDENCE_STATUS_LABEL[status.value]);
const sourceLabel = computed(() => (item.value ? evidenceSourceLabel(item.value) : ''));
const trayFull = computed(() => !pinned.value && game.save.pinnedEvidence.length >= 3);
</script>

<template>
  <article v-if="item" class="ev-card" :data-testid="`ev:card--${id}`" :data-status="status">
    <header class="ev-head">
      <span class="ev-icon"><AppIcon name="evidence" :size="17" /></span>
      <h3>{{ item.title }}</h3>
      <span class="badge" :class="`src-${sourceLabel}`">{{ sourceLabel }}</span>
      <span v-if="acquired" class="status" :class="`st-${status}`">{{ statusLabel }}</span>
      <button
        v-if="acquired"
        class="pin"
        :aria-pressed="pinned"
        :disabled="trayFull"
        :title="trayFull ? '对照托盘已满（最多三份），先移出一份' : undefined"
        data-testid="ev:pin"
        @click.stop="game.togglePin(id)"
      >
        {{ pinned ? '移出对照' : '加入对照' }}
      </button>
    </header>
    <template v-if="acquired">
      <p class="ev-text">{{ view.text }}</p>
      <p class="muted ev-meta mono small">
        {{ id }} · 来源 {{ item.sourceId }} · {{ item.originGroup }} · 版本 {{ item.version }}
      </p>
    </template>
    <template v-else-if="openable">
      <button data-testid="ev:open" @click="game.execute({ kind: 'openDoc', documentId: id })">
        查看这份材料 <AppIcon name="arrow" :size="16" />
      </button>
    </template>
    <p v-else class="muted small">尚未开放。</p>
  </article>
</template>

<style scoped>
.ev-card {
  position: relative;
  overflow: hidden;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: var(--space-4);
  box-shadow: var(--shadow-xs);
}
.ev-card::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 3px;
  background: var(--clinical);
  opacity: 0.72;
}
.ev-card[data-status='conflict']::before { background: #a85c55; opacity: 1; }
.ev-card[data-status='used']::before { background: #6f867b; }
.ev-head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.ev-icon { display: grid; width: 30px; height: 30px; place-items: center; border-radius: var(--radius-sm); background: var(--clinical-soft); color: var(--clinical); }
.ev-head h3 {
  margin: 0;
  font-size: 1em;
  flex: 1;
  min-width: 8em;
}
.badge { font-size: 0.72em; }
.status { font-size: 0.72em; font-weight: 600; padding: 2px var(--space-2); border-radius: var(--radius-sm); background: var(--clinical-soft); color: var(--clinical); }
.status.st-conflict { background: rgba(168, 92, 85, 0.14); color: #8d4a44; }
.status.st-pinned { background: rgba(213, 170, 83, 0.18); color: #8a6a2c; }
.status.st-used { background: #eef1ef; color: var(--muted); }
.pin {
  min-height: 30px;
  font-size: 0.76em;
  padding: 2px var(--space-2);
}
.pin:disabled { opacity: 0.55; cursor: not-allowed; }
.ev-text {
  white-space: pre-wrap;
  margin: var(--space-2) 0 0;
  font-size: 0.95em;
}
.ev-meta {
  margin: var(--space-1) 0 0;
}
.small {
  font-size: 0.8em;
}
</style>
