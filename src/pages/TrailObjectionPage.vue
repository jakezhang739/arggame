<script setup lang="ts">
/** P11 轨迹异议（docs/03册 v1.1 §3）：系统解释 vs 原始事件 vs 证据；三槽里程碑 + 证据链接（p6）。 */
import { computed, ref } from 'vue';
import { useGameStore } from '../stores/game';
import { checkP6 } from '../game/gates';
import { isAcquired, selectEvidence } from '../game/selectors';
import { content } from '../game/content';
import type { EvidenceId } from '../game/content-ids';
import HintPanel from '../components/HintPanel.vue';

const game = useGameStore();
const facts = computed(() => game.state.facts);

const SLOT_META: Record<string, { title: string; hint: string }> = {
  SNAPSHOT_LOADED: { title: '快照载入', hint: '你靠什么确认过原始名单？' },
  REVIEW_CAUSE_OBSERVED: { title: '观察到预归档原因', hint: '把护理事实与终局合并的那一步，你在哪里看到过两次？' },
  IDENTITY_LINKED: { title: '恢复身份关联', hint: '护士的哪句话支持恢复联系？' },
};

// —— 顺序（草稿持久化；初始为固定的错序，便于真实重排）——
const order = ref<string[]>(
  game.save.drafts.trailOrder.length === 3 ? [...game.save.drafts.trailOrder] : ['REVIEW_CAUSE_OBSERVED', 'IDENTITY_LINKED', 'SNAPSHOT_LOADED'],
);

function moveUp(slot: string): void {
  const i = order.value.indexOf(slot);
  if (i > 0) {
    order.value.splice(i - 1, 0, order.value.splice(i, 1)[0]);
    persist();
  }
}
function moveDown(slot: string): void {
  const i = order.value.indexOf(slot);
  if (i >= 0 && i < order.value.length - 1) {
    order.value.splice(i + 1, 0, order.value.splice(i, 1)[0]);
    persist();
  }
}
function persist(): void {
  game.updateDrafts((d) => {
    d.trailOrder = [...order.value];
  });
}

// —— 证据链接（草稿持久化）——
const links = ref<Record<string, EvidenceId[]>>(
  Object.keys(game.save.drafts.trailLinks).length ? JSON.parse(JSON.stringify(game.save.drafts.trailLinks)) : {},
);
const acquired = computed(() => selectEvidence(game.state));
function linkState(slot: string, id: EvidenceId): boolean {
  return (links.value[slot] ?? []).includes(id);
}
function toggleLink(slot: string, id: EvidenceId): void {
  const list = links.value[slot] ?? (links.value[slot] = []);
  const i = list.indexOf(id);
  if (i >= 0) list.splice(i, 1);
  else list.push(id);
  game.updateDrafts((d) => {
    d.trailLinks = JSON.parse(JSON.stringify(links.value));
  });
}

const scopeFinding = ref('');
const feedback = ref<string[]>([]);
const FINDING_OPTIONS = [
  { key: 'UNSUPPORTED_ENDING', label: '护理事实不足以支持关于人生终局的结论' },
  { key: 'SUPPORTED_ENDING', label: '护理事实足以支持终局结论' },
  { key: 'NOT_ENOUGH', label: '证据不足，无法判断' },
];

const isReplay = computed(() => facts.value.reviewCause?.kind === 'REPLAY');

async function submit(): Promise<void> {
  const result = checkP6(game.state, order.value, links.value, scopeFinding.value);
  feedback.value = result.conflicts;
  if (!result.ok) {
    await game.execute({ kind: 'puzzleAttempt', puzzleId: 'p6', choiceKeys: [...order.value, scopeFinding.value], feedbackKey: result.feedbackKey });
    return;
  }
  const okExec = await game.execute({ kind: 'forkTrail', order: order.value, links: links.value });
  if (okExec) persist();
}
</script>

<template>
  <div class="trailobj">
    <h1>轨迹异议工作台</h1>
    <p class="muted">三栏对照：系统解释 ｜ 不可变原始事件 ｜ 已取得证据。</p>
    <p v-if="isReplay" class="notice small" data-testid="p11:replay-note">
      回放路线：本批触发原因是历史签认（W06 / RV_PREV_01）。你的 WATCH_REPLAY 保持 READ，不会被写成签署；
      下面的因果链接会清楚跨到历史档案。
    </p>

    <div class="cols">
      <section class="panel">
        <h2>系统解释（叙事轨迹节选）</h2>
        <ul class="small syslist">
          <li v-for="row in game.trailRows.filter((r) => ['LOAD_SNAPSHOT','SUBMIT_REVIEW','WATCH_REPLAY','REVIEW_TRIGGER_OBSERVED','LINK_IDENTITY','RECHECK_SUBMITTED','ACK_AUDIO_CONTENT'].includes(r.event.code)).slice(-10)" :key="row.event.id">
            <span class="mono">seq{{ row.event.seq }}</span>
            {{ row.systemLabel }}
            <em v-if="row.isRewritten" class="rewritten">（被改写）</em>
            <span v-if="row.fact" class="fact">· 原始事实：{{ row.fact }}</span>
          </li>
        </ul>
      </section>

      <section class="panel">
        <h2>不可变原始事件</h2>
        <ul class="small mono rawlist">
          <li v-for="e in game.state.events.slice(-12)" :key="e.id">seq{{ e.seq }} {{ e.code }} {{ e.actor }}<span v-if="e.scope"> [{{ e.scope }}]</span></li>
        </ul>
      </section>

      <section class="panel">
        <h2>已取得证据</h2>
        <ul class="small">
          <li v-for="ev in acquired" :key="ev.id">{{ ev.id }} {{ ev.title }}</li>
        </ul>
      </section>
    </div>

    <section v-if="!facts.trailForkCreated" class="panel">
      <h2>提交异议（p6）</h2>
      <p class="muted small">把三个里程碑按原始顺序排好，并给每个里程碑链接证据。</p>
      <ol class="milestones">
        <li v-for="slot in order" :key="slot" class="milestone" :data-testid="`p11:slot--${slot}`">
          <div class="slot-head">
            <strong>{{ SLOT_META[slot].title }}</strong>
            <button class="ghost small" :data-testid="`p11:up--${slot}`" @click="moveUp(slot)">↑</button>
            <button class="ghost small" :data-testid="`p11:down--${slot}`" @click="moveDown(slot)">↓</button>
          </div>
          <p class="muted small">{{ SLOT_META[slot].hint }}</p>
          <details open>
            <summary class="small">链接证据</summary>
            <label v-for="ev in acquired" :key="ev.id" class="marker small">
              <input
                type="checkbox"
                :checked="linkState(slot, ev.id)"
                :disabled="!isAcquired(game.state, ev.id)"
                :data-testid="`p11:link--${slot}--${ev.id}`"
                @change="toggleLink(slot, ev.id)"
              />
              {{ ev.id }} {{ ev.title }}
            </label>
          </details>
        </li>
      </ol>
      <fieldset class="finding">
        <legend>这句系统解释是否由事实支持？</legend>
        <label v-for="opt in FINDING_OPTIONS" :key="opt.key" class="marker small">
          <input type="radio" name="finding" :value="opt.key" v-model="scopeFinding" :data-testid="`p11:finding--${opt.key}`" />
          {{ opt.label }}
        </label>
      </fieldset>
      <button class="primary" data-testid="p11:submit" @click="submit">保存异议分支</button>
      <ul v-if="feedback.length" class="feedback"><li v-for="(f, i) in feedback" :key="i">{{ f }}</li></ul>
      <HintPanel puzzle-id="p6" />
    </section>

    <section v-else class="panel">
      <p class="ok">✓ 异议分支已保存：系统版本与 W07 版本并排；实际日志未被改写。</p>
      <p class="muted small">{{ content.dialogue.system.replayIntro }}</p>
      <p><RouterLink to="/audio/channel-03" data-testid="p11:goto-audio">去交班录音台（通道 03）→</RouterLink></p>
    </section>
  </div>
</template>

<style scoped>
.cols { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-3); }
.syslist .rewritten { color: #805600; }
.syslist .fact { color: var(--clinical); }
.rawlist { word-break: break-all; }
.milestones { list-style: none; padding: 0; display: grid; gap: var(--space-2); max-width: 560px; }
.milestone { border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-2) var(--space-3); }
.slot-head { display: flex; align-items: center; gap: var(--space-2); }
.finding { border: 1px solid var(--line); border-radius: var(--radius); display: grid; gap: var(--space-1); margin: var(--space-3) 0; max-width: 560px; }
.feedback { color: var(--error); }
.small { font-size: 0.85em; }
.ok { color: var(--clinical); }
@media (max-width: 900px) { .cols { grid-template-columns: 1fr; } }
</style>
