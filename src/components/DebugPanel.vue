<script setup lang="ts">
import { ref } from 'vue';
import { useGameStore } from '../stores/game';

const game = useGameStore();
const open = ref(false);
const chainResult = ref('');

async function quickSubmitReview(): Promise<void> {
  await game.execute({ kind: 'submitReview' });
}
async function quickRestore(): Promise<void> {
  for (const doc of ['EV05', 'EV06']) await game.execute({ kind: 'openDoc', documentId: doc });
  await game.execute({ kind: 'recheckSubmitted', evidenceIds: ['EV01', 'EV06'] });
  await game.execute({ kind: 'ackAudioContent', audioId: 'AUD01', mode: 'TEXT' });
  await game.execute({ kind: 'linkIdentity', source: 'EV01' });
}
</script>

<template>
  <div class="debug">
    <button data-testid="debug:toggle" @click="open = !open">调试</button>
    <div v-if="open" class="panel">
      <p>
        阶段：<strong>{{ game.state.phase }}</strong>｜ending：{{ game.state.ending ?? '—' }}
      </p>
      <p class="mono small">{{ JSON.stringify(game.state.facts) }}</p>
      <p v-if="game.commandError" class="anomaly-text">命令错误：{{ game.commandError }}</p>
      <div class="btns">
        <button @click="quickSubmitReview">快进：提交R03复核</button>
        <button @click="quickRestore">快进：复查+恢复许棠</button>
        <button @click="game.checkChain().then((r) => (chainResult = r))">校验哈希链</button>
        <span v-if="chainResult">{{ chainResult }}</span>
        <button class="danger" @click="game.resetSave()">重置存档</button>
      </div>
      <details>
        <summary>事件日志（{{ game.save.events.length }}）</summary>
        <pre class="mono small">{{ JSON.stringify(game.save.events, null, 1) }}</pre>
      </details>
    </div>
  </div>
</template>

<style scoped>
.debug { position: fixed; left: var(--space-2); bottom: var(--space-2); z-index: 50; }
.debug .panel { position: absolute; bottom: calc(100% + var(--space-2)); left: 0; width: min(520px, 90vw); max-height: 60vh; overflow: auto; font-size: 0.85em; }
.btns { display: flex; gap: var(--space-2); flex-wrap: wrap; align-items: center; }
.small { font-size: 0.85em; }
pre { white-space: pre-wrap; word-break: break-all; }
</style>
