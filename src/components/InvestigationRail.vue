<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useGameStore } from '../stores/game';
import { currentObjective } from '../game/objectives';
import AppIcon from './AppIcon.vue';

const game = useGameStore();
const objective = computed(() => currentObjective(game.state));
const evidenceOpen = ref(false);
const recentEvidence = computed(() => [...game.acquiredEvidence].slice(-4).reverse());
const ready = computed(() => game.state.facts.handoverSecured && game.state.facts.rulesAcknowledged);

function openTrail(): void {
  window.dispatchEvent(new CustomEvent('cw:open-trail'));
}
</script>

<template>
  <aside class="investigation-rail" aria-label="W07 调查工具栏">
    <div class="rail-kicker mono"><AppIcon name="moon" :size="14" /> W07 / NIGHT REVIEW</div>

    <section class="objective-card" :class="`tone-${objective.tone}`">
      <div class="objective-meta">
        <span>{{ objective.chapter }}</span>
        <span>{{ objective.step }}</span>
      </div>
      <div class="progress-track" aria-hidden="true">
        <span :style="{ width: `${objective.progress}%` }"></span>
      </div>
      <h2><AppIcon name="clipboard" :size="19" /> 当前任务</h2>
      <h3>{{ objective.title }}</h3>
      <p>{{ objective.description }}</p>
      <RouterLink :to="objective.route" class="button primary objective-action">
        {{ objective.action }} <AppIcon name="arrow" :size="17" />
      </RouterLink>
    </section>

    <nav class="rail-nav" aria-label="调查入口">
      <RouterLink v-if="ready" to="/followup">
        <AppIcon name="users" />
        <span><strong>六人病历</strong><small>身份与当前照护</small></span>
      </RouterLink>
      <button type="button" :aria-expanded="evidenceOpen" @click="evidenceOpen = !evidenceOpen">
        <AppIcon name="evidence" />
        <span><strong>已存证据</strong><small>{{ game.acquiredEvidence.length }} 份可回看</small></span>
      </button>
      <button v-if="ready" type="button" @click="openTrail">
        <AppIcon name="trail" />
        <span><strong>调查记录</strong><small>{{ game.trailRows.length }} 个实际动作</small></span>
      </button>
    </nav>

    <section v-if="evidenceOpen" class="evidence-peek" aria-label="最近取得的证据">
      <header><span>最近取得</span><span class="mono">{{ game.acquiredEvidence.length }}</span></header>
      <p v-if="recentEvidence.length === 0" class="empty">完成当前任务后，原始材料会保存在这里。</p>
      <ul v-else>
        <li v-for="item in recentEvidence" :key="item.id">
          <AppIcon name="archive" :size="15" />
          <span>{{ item.title }}</span>
          <small class="mono">{{ item.id }}</small>
        </li>
      </ul>
    </section>

    <p class="rail-note"><AppIcon name="check" :size="15" /> 查看材料不会改变结局；只有明确提交才会推进案件。</p>
  </aside>
</template>

<style scoped>
.investigation-rail {
  position: sticky;
  top: 96px;
  align-self: start;
  display: grid;
  gap: var(--space-3);
}
.rail-kicker {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--muted);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.09em;
}
.objective-card {
  position: relative;
  overflow: hidden;
  border: 1px solid #6f867b;
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  background: linear-gradient(145deg, #153d31, #10261f);
  box-shadow: 0 18px 38px rgba(9, 29, 21, 0.2);
  color: #eef5f1;
}
.objective-card.tone-warning { border-color: #ad8a42; }
.objective-card.tone-anomaly { border-color: #a85c55; }
.objective-meta {
  display: flex;
  justify-content: space-between;
  color: #bdcbc4;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.06em;
}
.progress-track {
  height: 3px;
  margin: var(--space-3) 0 var(--space-4);
  overflow: hidden;
  background: rgba(255,255,255,.14);
}
.progress-track span { display: block; height: 100%; background: #d5aa53; transition: width 240ms ease; }
.objective-card h2 {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0 0 var(--space-3);
  color: #d7e3dc;
  font-size: .78rem;
  letter-spacing: .09em;
  text-transform: uppercase;
}
.objective-card h3 { margin: 0; color: #fff; font-size: 1.16rem; line-height: 1.35; }
.objective-card p { margin: var(--space-2) 0 var(--space-4); color: #c6d2cc; font-size: .83rem; line-height: 1.65; }
.objective-action { width: 100%; justify-content: space-between; border-color: #d2a84f; background: #d2a84f; color: #14241e; box-shadow: none; }
.objective-action:hover { background: #e1bb69; color: #0c1813; }
.rail-nav { display: grid; overflow: hidden; border: 1px solid var(--line); border-radius: var(--radius); background: rgba(250,252,250,.9); box-shadow: var(--shadow-xs); }
.rail-nav a, .rail-nav button {
  display: grid;
  grid-template-columns: 25px 1fr;
  gap: var(--space-3);
  align-items: center;
  min-height: 60px;
  border: 0;
  border-bottom: 1px solid var(--line);
  border-radius: 0;
  padding: var(--space-2) var(--space-3);
  background: transparent;
  box-shadow: none;
  color: var(--text);
  text-align: left;
  text-decoration: none;
}
.rail-nav > :last-child { border-bottom: 0; }
.rail-nav a:hover, .rail-nav button:hover { background: var(--clinical-soft); transform: none; }
.rail-nav span { display: grid; }
.rail-nav strong { font-size: .82rem; }
.rail-nav small { color: var(--muted); font-size: .7rem; font-weight: 500; }
.evidence-peek { border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-3); background: var(--surface); }
.evidence-peek header { display: flex; justify-content: space-between; margin-bottom: var(--space-2); color: var(--muted); font-size: .72rem; font-weight: 700; }
.evidence-peek ul { display: grid; gap: var(--space-2); margin: 0; padding: 0; list-style: none; }
.evidence-peek li { display: grid; grid-template-columns: 18px 1fr auto; gap: 6px; align-items: start; font-size: .75rem; }
.evidence-peek small { color: var(--muted); font-size: .64rem; }
.empty, .rail-note { margin: 0; color: var(--muted); font-size: .72rem; line-height: 1.55; }
.rail-note { display: flex; gap: var(--space-2); align-items: flex-start; padding: 0 var(--space-1); }

@media (max-width: 1020px) {
  .investigation-rail { position: static; order: -1; }
  .objective-card { display: grid; grid-template-columns: 1fr auto; column-gap: var(--space-4); }
  .objective-meta, .progress-track, .objective-card h2 { grid-column: 1 / -1; }
  .objective-card p { margin-bottom: 0; }
  .objective-action { width: auto; min-width: 210px; align-self: end; }
  .rail-nav { grid-template-columns: repeat(3, 1fr); }
  .rail-nav a, .rail-nav button { border-right: 1px solid var(--line); border-bottom: 0; }
  .rail-note { display: none; }
}
@media (max-width: 680px) {
  .objective-card { display: block; }
  .objective-card p { margin-bottom: var(--space-3); }
  .objective-action { width: 100%; }
  .rail-nav { grid-template-columns: 1fr; }
  .rail-nav a, .rail-nav button { border-right: 0; border-bottom: 1px solid var(--line); }
}
</style>
