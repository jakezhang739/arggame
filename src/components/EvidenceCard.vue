<script setup lang="ts">
import { computed } from 'vue';
import { useGameStore } from '../stores/game';
import { canOpenEvidence, evidenceView, isAcquired } from '../game/selectors';
import { content } from '../game/content';
import type { EvidenceId } from '../game/content-ids';

const props = defineProps<{ id: string }>();
const game = useGameStore();

const id = computed(() => props.id as EvidenceId);
const item = computed(() => content.evidenceRegistry.find((e) => e.id === id.value));
const acquired = computed(() => isAcquired(game.state, id.value));
const openable = computed(() => canOpenEvidence(game.state, id.value));
const view = computed(() => evidenceView(game.state, id.value));
const pinned = computed(() => game.save.pinnedEvidence.includes(id.value));
</script>

<template>
  <article v-if="item" class="ev-card" :data-testid="`ev:card--${id}`">
    <header class="ev-head">
      <h3>{{ item.title }}</h3>
      <span class="badge">{{
        item.sourceType === 'PLAYER_LOCAL'
          ? '本机'
          : item.sourceType === 'PRIMARY'
            ? '原始'
            : '派生'
      }}</span>
      <button
        v-if="acquired"
        class="pin"
        :aria-pressed="pinned"
        data-testid="ev:pin"
        @click.stop="game.togglePin(id)"
      >
        {{ pinned ? '取消钉住' : '钉住' }}
      </button>
    </header>
    <template v-if="acquired">
      <p class="ev-text">{{ view.text }}</p>
      <p class="muted ev-meta mono small">
        来源 {{ item.sourceId }} · {{ item.originGroup }} · 版本 {{ item.version }}
      </p>
    </template>
    <template v-else-if="openable">
      <button data-testid="ev:open" @click="game.execute({ kind: 'openDoc', documentId: id })">
        打开
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
.ev-head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.ev-head h3 {
  margin: 0;
  font-size: 1em;
  flex: 1;
}
.pin {
  min-height: 30px;
  font-size: 0.76em;
  padding: 2px var(--space-2);
}
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
