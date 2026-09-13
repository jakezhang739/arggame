<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useGameStore } from '../stores/game';
import { content, dialogue } from '../game/content';
import { checkP1, checkP2 } from '../game/gates';
import { isAcquired } from '../game/selectors';
import type { EvidenceId } from '../game/content-ids';

const game = useGameStore();
const tab = ref<'med' | 'timeline'>('med');
const state = computed(() => game.state);
const facts = computed(() => state.value.facts);

// —— 证据取得 ——
const OPENABLE: EvidenceId[] = ['EV05', 'EV06', 'EV07', 'EV08', 'EV09', 'EV10', 'EV11'];
const acquired = (id: string) => isAcquired(state.value, id as EvidenceId);

// —— 助手捷径 ——（已处理过则不再弹出：记入一次性表现 cue）
const shortcutOpen = ref(!game.save.seenPresentationCues.includes('med-shortcut'));
const shortcutStage = ref<'offer' | 'preview' | 'done'>('offer');
const medFixApplied = ref(false);

function closeShortcut(): void {
  shortcutOpen.value = false;
}

async function openPreview(): Promise<void> {
  shortcutStage.value = 'preview';
  await game.execute({ kind: 'previewMedFix' });
}
async function acceptFix(): Promise<void> {
  game.markPresentationCue('med-shortcut'); // 先落盘一次性状态，再执行异步命令，避免刷新竞态
  await game.execute({ kind: 'acceptMedFix' });
  medFixApplied.value = true;
  shortcutStage.value = 'done';
  closeShortcut();
}
async function cancelFix(): Promise<void> {
  game.markPresentationCue('med-shortcut');
  await game.execute({ kind: 'cancelMedFix' });
  medFixApplied.value = false;
  shortcutStage.value = 'done';
  closeShortcut();
}

// —— 谜题 p1 ——（草稿持久化：刷新后保留未提交的选择）
const storedP1 = game.save.drafts.semanticSelections.p1 ?? [];
const anomaly = ref<string>(storedP1[0] ?? '');
const selectedEvidence = ref<EvidenceId[]>(storedP1.slice(1) as EvidenceId[]);
const p1Conflicts = ref<string[]>([]);
const p1Done = computed(() => facts.value.recheckAccepted);

function persistP1Draft(): void {
  game.updateDrafts((d) => {
    d.semanticSelections.p1 = [anomaly.value, ...selectedEvidence.value];
  });
}
watch(anomaly, persistP1Draft);

function toggleEvidence(id: EvidenceId): void {
  const i = selectedEvidence.value.indexOf(id);
  if (i >= 0) selectedEvidence.value.splice(i, 1);
  else selectedEvidence.value.push(id);
  persistP1Draft();
}
async function submitP1(): Promise<void> {
  const result = checkP1(state.value, anomaly.value, selectedEvidence.value);
  if (result.ok) {
    p1Conflicts.value = [];
    await game.execute({ kind: 'recheckSubmitted', evidenceIds: selectedEvidence.value });
  } else {
    p1Conflicts.value = result.conflicts;
    await game.execute({
      kind: 'puzzleAttempt',
      puzzleId: 'p1',
      choiceKeys: [anomaly.value, ...selectedEvidence.value],
      feedbackKey: result.feedbackKey,
    });
  }
}

// —— AUD01 与恢复关联 ——
const aud01Acked = computed(() => facts.value.aud01Read);
const transcriptOpen = ref(false);
const restoreFeedback = ref(false);
const ev01Acquired = computed(() => acquired('EV01'));
const ev02Acquired = computed(() => acquired('EV02'));
const restoreSource = ref<'EV01' | 'EV02'>(ev01Acquired.value ? 'EV01' : 'EV02');
const restoreSourceAcquired = computed(() =>
  restoreSource.value === 'EV01' ? ev01Acquired.value : ev02Acquired.value,
);

async function ackAudio(): Promise<void> {
  await game.execute({ kind: 'ackAudioContent', audioId: 'AUD01', mode: transcriptOpen.value ? 'TEXT' : 'AUDIO' });
}
async function submitRestore(): Promise<void> {
  if (!restoreSourceAcquired.value) return;
  await game.execute({ kind: 'linkIdentity', source: restoreSource.value });
  restoreFeedback.value = true;
}

// —— 时间线（p2）——（草稿持久化：刷新后保留排序）
const order = ref<string[]>(
  game.save.drafts.timelineOrder.length === 5
    ? [...game.save.drafts.timelineOrder]
    : ['TL_PREFILL', 'TL_HANDOVER', 'TL_REVIEW', 'TL_OBSERVATION', 'TL_RECOUNT'],
);
const ev11Unreliable = ref(false);
const p2Conflicts = ref<string[]>([]);
const p2Done = computed(() => facts.value.timelineSolved);
const tlCards = computed(() => content.timeline.cards);
function move(id: string, delta: -1 | 1): void {
  const i = order.value.indexOf(id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= order.value.length) return;
  [order.value[i], order.value[j]] = [order.value[j], order.value[i]];
  game.updateDrafts((d) => (d.timelineOrder = [...order.value]));
}
async function submitP2(): Promise<void> {
  const unreliable = ev11Unreliable.value ? ['EV11' as EvidenceId] : [];
  const result = checkP2([...order.value], unreliable);
  if (result.ok) {
    p2Conflicts.value = [];
    await game.execute({ kind: 'solveTimeline', order: [...order.value], unreliable });
  } else {
    p2Conflicts.value = result.conflicts;
    await game.execute({
      kind: 'puzzleAttempt',
      puzzleId: 'p2',
      choiceKeys: [...order.value, ev11Unreliable.value ? 'EV11' : ''],
      feedbackKey: result.feedbackKey,
    });
  }
}
function timeLabel(kind: string, value: string): string {
  if (kind === 'FIXED') return value;
  if (kind === 'REVIEW_CAUSE') {
    return facts.value.reviewCause?.kind === 'REPLAY' ? '历史批次时间（W06）' : '本局触发来源（交接之后）';
  }
  return '未记录';
}
</script>

<template>
  <div class="medication">
    <h1>发药与出院对照</h1>
    <div class="tabs" role="tablist">
      <button role="tab" :aria-selected="tab === 'med'" data-testid="p05:tab--med" @click="tab = 'med'">
        发药对照
      </button>
      <button
        role="tab"
        :aria-selected="tab === 'timeline'"
        :disabled="!facts.r03IdentityRestored"
        data-testid="p05:tab--timeline"
        @click="tab = 'timeline'"
      >
        时间线重排{{ facts.r03IdentityRestored ? '' : '（身份恢复后开放）' }}
      </button>
    </div>

    <!-- 标签一：发药对照 -->
    <section v-if="tab === 'med'">
      <div class="panel">
        <h2>原始单据（逐份打开取得）</h2>
        <p class="muted small">
          助手的数量修正只写在线对照层，不覆盖原始签收层。
          <span v-if="medFixApplied" class="anomaly-text">当前在线层：第六份=损耗（可在整批公示前撤销）。</span>
        </p>
        <ul class="doclist">
          <li v-for="id in OPENABLE" :key="id" :data-testid="`p05:doc--${id}`">
            <span class="mono">{{ id }}</span>
            {{ content.evidenceRegistry.find((e) => e.id === id)?.title }}
            <span v-if="acquired(id)" class="ok">✓ 已取得</span>
            <button v-else :data-testid="`p05:open--${id}`" @click="game.execute({ kind: 'openDoc', documentId: id })">
              打开
            </button>
            <details v-if="acquired(id)" class="docbody">
              <summary>查看内容</summary>
              <pre>{{ content.evidenceRegistry.find((e) => e.id === id)?.display }}</pre>
            </details>
          </li>
        </ul>
      </div>

      <div class="panel puzzle" aria-labelledby="p1-h">
        <h2 id="p1-h">异常复查 · 谜题一</h2>
        <p class="muted">
          指出冲突类型并选择证据：需要名单基线（交接联/快照）＋声称离院之后的在场记录；同一原始过程的两份副本不能互相印证。
        </p>
        <fieldset>
          <legend>冲突类型</legend>
          <label class="opt"><input type="radio" name="anomaly" value="DUPLICATE_ROW" v-model="anomaly" :data-testid="'p05:anomaly--DUPLICATE_ROW'" /> 一条重复数据</label>
          <label class="opt"><input type="radio" name="anomaly" value="COUNT_ERROR" v-model="anomaly" :data-testid="'p05:anomaly--COUNT_ERROR'" /> 数量统计误差</label>
          <label class="opt"><input type="radio" name="anomaly" value="IDENTITY_INDEX" v-model="anomaly" :data-testid="'p05:anomaly--IDENTITY_INDEX'" /> 身份索引异常</label>
          <label class="opt"><input type="radio" name="anomaly" value="ENTRY_DELAY" v-model="anomaly" :data-testid="'p05:anomaly--ENTRY_DELAY'" /> 录入延迟</label>
        </fieldset>
        <fieldset>
          <legend>支持证据</legend>
          <label v-for="id in ['EV01','EV02','EV03','EV04','EV05','EV06','EV07','EV08','EV09','EV10','EV11']" :key="id" class="opt">
            <input
              type="checkbox"
              :value="id"
              :disabled="!acquired(id)"
              :checked="selectedEvidence.includes(id as EvidenceId)"
              :data-testid="`p05:ev--${id}`"
              @change="toggleEvidence(id as EvidenceId)"
            />
            {{ id }}{{ acquired(id) ? '' : '（未取得）' }}
          </label>
        </fieldset>
        <button class="primary" data-testid="p05:submit-p1" :disabled="p1Done" @click="submitP1">提交复查理由</button>
        <ul v-if="p1Conflicts.length" class="conflict-list">
          <li v-for="(c, i) in p1Conflicts" :key="i">{{ c }}</li>
        </ul>
        <p v-if="p1Done" class="ok">复查已受理：R03 的在场记录仍在，被改写的是指向“许棠”的关联。</p>
      </div>

      <div v-if="p1Done" class="panel" aria-labelledby="audio-h">
        <h2 id="audio-h">异常复查单 · 无归属音频（AUD01）</h2>
        <AudioFragment audio-id="AUD01" :transcript="dialogue.linwen.audio1C" />
        <div class="row">
          <button class="linklike" data-testid="p05:transcript" @click="transcriptOpen = !transcriptOpen">
            {{ transcriptOpen ? '收起完整台词' : '展开完整台词（文字确认）' }}
          </button>
        </div>
        <p v-if="transcriptOpen" class="transcript">{{ dialogue.linwen.audio1C }}</p>
        <button v-if="!aud01Acked" :disabled="!transcriptOpen" data-testid="p05:ack-aud01" @click="ackAudio">
          已确认这段内容（听完后确认与阅读确认等价）
        </button>
        <p v-else class="ok">✓ EV12 已取得（林闻无归属留言）。</p>

        <div v-if="aud01Acked && !facts.r03IdentityRestored" class="restore">
          <h3>从原始交接恢复关联</h3>
          <label class="opt">
            <input
              type="radio"
              value="EV01"
              v-model="restoreSource"
              :disabled="!ev01Acquired"
              data-testid="p05:restore-source--EV01"
            />
            依据 EV01（交接联）{{ ev01Acquired ? '' : '（未取得）' }}
          </label>
          <label class="opt">
            <input
              type="radio"
              value="EV02"
              v-model="restoreSource"
              :disabled="!ev02Acquired"
              data-testid="p05:restore-source--EV02"
            />
            依据 EV02（快照）
          </label>
          <div>
            <button class="primary" data-testid="p05:submit-restore" @click="submitRestore">恢复 R03—许棠</button>
          </div>
        </div>
        <div v-if="restoreFeedback" class="notice">{{ dialogue.system.restoreFeedback }}</div>
      </div>
    </section>

    <!-- 标签二：时间线 -->
    <section v-if="tab === 'timeline'">
      <div class="panel puzzle">
        <h2>时间线重排 · 谜题二</h2>
        <p class="muted">按<strong>事件时间</strong>排列；上传时间用于发现 EV11 的版本矛盾。后两卡引用本局触发来源。</p>
        <ol class="tl-list">
          <li v-for="id in order" :key="id" class="tl-item" :data-testid="`p05:tl--${id}`">
            <span class="tl-move">
              <button :aria-label="`上移 ${id}`" :data-testid="`p05:tl-up--${id}`" @click="move(id, -1)">↑</button>
              <button :aria-label="`下移 ${id}`" :data-testid="`p05:tl-down--${id}`" @click="move(id, 1)">↓</button>
            </span>
            <span class="tl-title">
              {{ tlCards.find((c) => c.id === id)?.title }}
              <span class="muted small">{{ tlCards.find((c) => c.id === id)?.text }}</span>
            </span>
            <span class="mono muted small">
              事件 {{ timeLabel(tlCards.find((c) => c.id === id)!.eventTime.kind, tlCards.find((c) => c.id === id)!.eventTime.value) }}
              ｜ 上传 {{ timeLabel(tlCards.find((c) => c.id === id)!.uploadTime.kind, tlCards.find((c) => c.id === id)!.uploadTime.value) }}
            </span>
          </li>
        </ol>
        <label class="check">
          <input type="checkbox" v-model="ev11Unreliable" data-testid="p05:ev11-unreliable" />
          标记 EV11《离院报告与模板清单》为不可靠
        </label>
        <button class="primary" data-testid="p05:submit-p2" :disabled="p2Done" @click="submitP2">提交时间线</button>
        <ul v-if="p2Conflicts.length" class="conflict-list">
          <li v-for="(c, i) in p2Conflicts" :key="i">{{ c }}</li>
        </ul>
        <p v-if="p2Done" class="ok">✓ 时间线已重建。研究卡 M-7 的解锁条件之一成立（另需论坛关联）。</p>
        <p v-if="p2Done && !facts.postsLinked">
          <RouterLink to="/forum" data-testid="p05:goto-forum">去病友留言板 →</RouterLink>
        </p>
      </div>
    </section>

    <!-- 助手捷径 -->
    <div v-if="shortcutOpen" class="modal-mask" @click.self="shortcutOpen = false">
      <div class="panel modal" role="dialog" aria-modal="true" aria-label="归档助手">
        <p class="speaker">归档助手</p>
        <template v-if="shortcutStage === 'offer'">
          <GameDialog :speaker="'归档助手'" :lines="[dialogue.assistant.shortcut]" :open="true" @update-open="() => undefined" @done="() => undefined" />
          <div class="modal-actions">
            <button data-testid="p05:preview-fix" @click="openPreview">查看差异预览</button>
            <button data-testid="p05:skip-fix" @click="cancelFix">暂不处理</button>
          </div>
        </template>
        <template v-else-if="shortcutStage === 'preview'">
          <table>
            <thead><tr><th>记录</th><th>当前值</th><th>修正后</th></tr></thead>
            <tbody>
              <tr><td>06-16 第六份发药</td><td>签收（R03 · 21:40）</td><td class="anomaly-text">损耗</td></tr>
            </tbody>
          </table>
          <p class="muted">{{ dialogue.assistant.medFixPreview }}</p>
          <div class="modal-actions">
            <button class="danger" data-testid="p05:accept-fix" @click="acceptFix">接受修正</button>
            <button data-testid="p05:cancel-fix" @click="cancelFix">取消/撤销</button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import GameDialog from '../components/GameDialog.vue';
import AudioFragment from '../components/AudioFragment.vue';
export default { components: { GameDialog } };
</script>

<style scoped>
.tabs { display: flex; gap: var(--space-2); margin: var(--space-3) 0; }
.tabs [aria-selected='true'] { background: var(--clinical); color: #fff; border-color: var(--clinical); }
.doclist { list-style: none; padding: 0; display: flex; flex-direction: column; gap: var(--space-2); }
.doclist li { border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-2) var(--space-3); background: #fff; }
.docbody pre { white-space: pre-wrap; font-size: 0.85em; margin: var(--space-2) 0 0; }
.puzzle { margin-top: var(--space-4); }
fieldset { border: 1px dashed var(--line); border-radius: var(--radius); margin: var(--space-3) 0; }
.opt { display: block; margin: var(--space-1) 0; }
.ok { color: var(--clinical); }
.row { display: flex; gap: var(--space-3); align-items: center; }
.transcript { white-space: pre-wrap; background: #eef1ef; border-radius: var(--radius); padding: var(--space-2) var(--space-3); }
.restore { margin-top: var(--space-3); }
.tl-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: var(--space-2); }
.tl-item { display: flex; gap: var(--space-3); align-items: center; flex-wrap: wrap; border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-2) var(--space-3); background: #fff; }
.tl-move { display: inline-flex; gap: var(--space-1); }
.tl-title { flex: 1; min-width: 14em; }
.check { display: block; margin: var(--space-3) 0; }
.modal-mask { position: fixed; inset: 0; background: rgba(29, 41, 38, 0.4); display: flex; align-items: center; justify-content: center; z-index: 60; padding: var(--space-4); }
.modal { width: min(560px, 94vw); }
.modal-actions { display: flex; gap: var(--space-3); margin-top: var(--space-3); flex-wrap: wrap; }
.speaker { font-weight: 600; color: var(--clinical); margin: 0 0 var(--space-2); }
.linklike { border: none; background: none; color: var(--clinical); text-decoration: underline; padding: 0; }
h1 { font-size: 1.25em; margin: 0; }
h2 { font-size: 1.05em; }
.small { font-size: 0.85em; }
</style>
