<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useGameStore } from '../stores/game';
import { currentObjective } from '../game/objectives';
import {
  canOpenEvidence,
  CONFLICTING_EVIDENCE,
  evidenceLocationHint,
  evidenceSourceLabel,
  evidenceStatusFor,
  evidenceView,
  isAcquired,
  EVIDENCE_STATUS_LABEL,
} from '../game/selectors';
import { content } from '../game/content';
import type { EvidenceId } from '../game/content-ids';
import AppIcon from './AppIcon.vue';

const game = useGameStore();
const objective = computed(() => currentObjective(game.state));
const evidenceOpen = ref(false);
const ready = computed(() => game.state.facts.handoverSecured && game.state.facts.rulesAcknowledged);

const pinned = computed(() => game.save.pinnedEvidence);
const PIN_LIMIT = 3;

interface EvidenceRow {
  id: EvidenceId;
  title: string;
  statusLabel: string;
  status: string;
  source: string;
  acquired: boolean;
  location: string;
  text: string;
  tier: 'core' | 'optional';
}

/** 抽屉展示：已取得 ＋ 当前可取得的材料；核心/可选分层（10册 §6 已批清单）。 */
const evidenceRows = computed<EvidenceRow[]>(() =>
  content.evidenceRegistry
    .filter((item) => isAcquired(game.state, item.id) || canOpenEvidence(game.state, item.id))
    .map((item) => {
      const status = evidenceStatusFor(game.state, item.id, pinned.value);
      return {
        id: item.id,
        title: item.title,
        status,
        statusLabel: EVIDENCE_STATUS_LABEL[status],
        source: evidenceSourceLabel(item),
        acquired: status !== 'unseen',
        location: evidenceLocationHint(item),
        text: evidenceView(game.state, item.id).text,
        tier: item.tier ?? 'core',
      };
    }),
);
const coreRows = computed(() => evidenceRows.value.filter((r) => r.tier === 'core'));
const optionalRows = computed(() => evidenceRows.value.filter((r) => r.tier === 'optional'));
const conflictCount = computed(
  () => [...CONFLICTING_EVIDENCE].filter((id) => isAcquired(game.state, id)).length,
);
const acquiredCount = computed(() => evidenceRows.value.filter((r) => r.acquired).length);
/** 切片检查完成＝系统改写被实证；此刻「调查记录」揭示为「叙事轨迹」（07册 问题七）。 */
const trailChallenged = computed(() => game.state.facts.sliceInspected);

function openTrail(): void {
  window.dispatchEvent(new CustomEvent('cw:open-trail'));
}
</script>

<template>
  <aside class="investigation-rail" aria-label="W07 调查工具栏">
    <div class="rail-kicker mono"><AppIcon name="moon" :size="14" /> W07 · 夜班复核</div>

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
      <button type="button" data-testid="rail:evidence-toggle" :aria-expanded="evidenceOpen" @click="evidenceOpen = !evidenceOpen">
        <AppIcon name="evidence" />
        <span><strong>已存证据</strong><small>{{ acquiredCount }} 份可回看</small></span>
      </button>
      <button v-if="ready" type="button" data-testid="rail:trail-toggle" @click="openTrail">
        <AppIcon name="trail" />
        <span>
          <!-- 07册 问题七：系统改写被实证（切片检查完成）时，「调查记录」揭示为「叙事轨迹」 -->
          <strong>{{ trailChallenged ? '叙事轨迹' : '调查记录' }}</strong>
          <small>{{ trailChallenged ? '系统叙述 · 含改写' : `${game.trailRows.length} 个实际动作` }}</small>
        </span>
      </button>
    </nav>

    <section v-if="evidenceOpen" class="evidence-drawer" aria-label="证据与对照托盘">
      <header>
        <span>对照托盘</span>
        <span class="mono">已固定 {{ pinned.length }}/{{ PIN_LIMIT }}</span>
      </header>
      <p v-if="pinned.length === 0" class="empty">在证据卡上选择「加入对照」，最多固定三份。</p>
      <ul v-else class="pin-list">
        <li v-for="pid in pinned" :key="pid">
          <AppIcon name="pin" :size="15" />
          <span>{{ content.evidenceRegistry.find((e) => e.id === pid)?.title }}</span>
          <button type="button" class="unpin" @click="game.togglePin(pid)">移出</button>
        </li>
      </ul>
      <p v-if="conflictCount" class="conflict-note">
        {{ conflictCount }} 份材料与其他记录存在矛盾，提交结论前先对照原始版本。
      </p>

      <header class="drawer-sub">
        <span>主线材料</span>
        <span class="mono">{{ coreRows.filter((r) => r.acquired).length }}/{{ coreRows.length }}</span>
      </header>
      <p v-if="evidenceRows.length === 0" class="empty">完成当前任务后，原始材料会保存在这里。</p>
      <ul v-else class="ev-list">
        <li v-for="row in coreRows" :key="row.id" :class="{ acquired: row.acquired }">
          <AppIcon :name="row.acquired ? 'archive' : 'arrow'" :size="15" />
          <div>
            <span class="ev-title">{{ row.title }}</span>
            <small class="mono">{{ row.id }}</small>
            <small v-if="row.acquired" class="ev-tags">
              <span class="tag" :class="`st-${row.status}`">{{ row.statusLabel }}</span>
              <span class="tag">{{ row.source }}</span>
            </small>
            <small v-else class="ev-hint">可在{{ row.location }}取得</small>
          </div>
        </li>
      </ul>

      <template v-if="optionalRows.length">
        <header class="drawer-sub">
          <span>可选调查材料</span>
          <span class="mono">{{ optionalRows.filter((r) => r.acquired).length }}/{{ optionalRows.length }}</span>
        </header>
        <ul class="ev-list">
          <li v-for="row in optionalRows" :key="row.id" :class="{ acquired: row.acquired }">
            <AppIcon :name="row.acquired ? 'archive' : 'arrow'" :size="15" />
            <div>
              <span class="ev-title">{{ row.title }}</span>
              <small class="mono">{{ row.id }}</small>
              <small v-if="row.acquired" class="ev-tags">
                <span class="tag" :class="`st-${row.status}`">{{ row.statusLabel }}</span>
                <span class="tag">{{ row.source }}</span>
              </small>
              <small v-else class="ev-hint">可在{{ row.location }}取得（可选）</small>
            </div>
          </li>
        </ul>
      </template>
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
.evidence-drawer { border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-3); background: var(--surface); display: grid; gap: var(--space-2); max-height: 62vh; overflow-y: auto; }
.evidence-drawer header { display: flex; justify-content: space-between; align-items: baseline; color: var(--muted); font-size: .72rem; font-weight: 700; }
.evidence-drawer .drawer-sub { margin-top: var(--space-2); border-top: 1px solid var(--line); padding-top: var(--space-2); }
.pin-list, .ev-list { display: grid; gap: var(--space-2); margin: 0; padding: 0; list-style: none; }
.pin-list li { display: grid; grid-template-columns: 18px 1fr auto; gap: 6px; align-items: center; font-size: .76rem; border: 1px dashed #ad8a42; border-radius: var(--radius-sm); padding: var(--space-1) var(--space-2); }
.pin-list .unpin { min-height: 24px; padding: 0 var(--space-2); font-size: .68rem; }
.conflict-note { margin: 0; color: #8d4a44; font-size: .72rem; }
.ev-list li { display: grid; grid-template-columns: 18px 1fr; gap: 6px; align-items: start; font-size: .76rem; }
.ev-list li:not(.acquired) { color: var(--muted); }
.ev-list .ev-title { display: block; font-weight: 600; }
.ev-list small { display: inline-block; color: var(--muted); font-size: .64rem; margin-right: 6px; }
.ev-list .ev-tags { display: flex; gap: 4px; margin-top: 2px; }
.ev-list .tag { border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 0 4px; }
.ev-list .tag.st-conflict { border-color: #a85c55; color: #8d4a44; }
.ev-list .tag.st-pinned { border-color: #ad8a42; color: #8a6a2c; }
.ev-list .ev-hint { display: block; }
.empty { color: var(--muted); font-size: .72rem; margin: 0; }
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
