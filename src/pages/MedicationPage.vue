<script setup lang="ts">
/**
 * P05 发药与出院对照 · 三栏调查台（docs/09 Batch 3 §B）：
 * 材料箱（原始单据）｜中央对照（异常复查）｜结论区（四段式反馈与下一步）。
 * 两阶段任务：先“少掉的是一条数据，还是一个人”，身份恢复后开放时间线。
 */
import { computed, ref, watch } from 'vue';
import { useGameStore } from '../stores/game';
import { content, dialogue } from '../game/content';
import { checkP1, checkP2 } from '../game/gates';
import { isAcquired } from '../game/selectors';
import type { EvidenceId } from '../game/content-ids';
import AppIcon from '../components/AppIcon.vue';
import CompletionPanel from '../components/CompletionPanel.vue';
import GameDialog from '../components/GameDialog.vue';
import AudioFragment from '../components/AudioFragment.vue';
import HintPanel from '../components/HintPanel.vue';

const game = useGameStore();
const tab = ref<'med' | 'timeline'>('med');
const state = computed(() => game.state);
const facts = computed(() => state.value.facts);

// —— 材料箱 ——
const OPENABLE: EvidenceId[] = ['EV05', 'EV06', 'EV07', 'EV08', 'EV09', 'EV10', 'EV11', 'EV28'];
const acquired = (id: string) => isAcquired(state.value, id as EvidenceId);
const evTitle = (id: string) => content.evidenceRegistry.find((e) => e.id === id)?.title ?? id;
/** 中央对照可选证据：已取得的用复选框；未取得的给“回材料箱取得”提示，不给禁用复选框。 */
const SELECTABLE: EvidenceId[] = ['EV01', 'EV02', 'EV03', 'EV04', 'EV05', 'EV06', 'EV07', 'EV08', 'EV09', 'EV10', 'EV11', 'EV28'];

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

// —— 中央对照（异常复查）——（草稿持久化：刷新后保留未提交的选择）
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

/** 六条须知拆散教学（07册 §6.3）：第一次遇到来源冲突时讲“独立来源”。 */
const ruleCardSeen = computed(() => game.save.seenPresentationCues.includes('rule-independent-source'));
const showSourceRule = ref(false);
watch(
  () => p1Conflicts.value.length > 0,
  (hasConflict) => {
    if (hasConflict && !ruleCardSeen.value) {
      showSourceRule.value = true;
      game.markPresentationCue('rule-independent-source');
    }
  },
);
function dismissSourceRule(): void {
  showSourceRule.value = false;
}

async function submitP1(): Promise<void> {
  const result = checkP1(state.value, anomaly.value, selectedEvidence.value);
  if (result.ok) {
    p1Conflicts.value = [];
    await game.execute({ kind: 'recheckSubmitted', evidenceIds: selectedEvidence.value });
  } else {
    p1Conflicts.value = result.conflicts;
    // 周砚线（10册 §1.2 ④）：官方解释在场但仍被证据排除，错误解释保持可信。
    if (anomaly.value !== 'IDENTITY_INDEX' && acquired('EV28')) {
      p1Conflicts.value.push('迁移值班说明也提到了批处理丢行——但它解释不了本人补记为何被改写。');
    }
    await game.execute({
      kind: 'puzzleAttempt',
      puzzleId: 'p1',
      choiceKeys: [anomaly.value, ...selectedEvidence.value],
      feedbackKey: result.feedbackKey,
    });
  }
}

// —— 周砚第一次联络（10册 §1.2 ③）：p1 受理后作为站内消息留档显示。 ——

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

// —— 时间线（第二阶段）——（草稿持久化：刷新后保留排序）
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
    <header class="page-head">
      <h1>发药与出院对照</h1>
      <p class="muted">复核当晚的原始单据都在这里。先弄清少掉的是什么，再谈它去了哪里。</p>
    </header>
    <div class="tabs" role="tablist">
      <button role="tab" :aria-selected="tab === 'med'" data-testid="p05:tab--med" @click="tab = 'med'">
        第一步 · 少掉的是一条数据，还是一个人
      </button>
      <button
        role="tab"
        :aria-selected="tab === 'timeline'"
        :disabled="!facts.r03IdentityRestored"
        data-testid="p05:tab--timeline"
        @click="tab = 'timeline'"
      >
        第二步 · 重排当晚时间线{{ facts.r03IdentityRestored ? '' : '（身份恢复后开放）' }}
      </button>
    </div>

    <!-- 第一步：三栏调查台 -->
    <section v-if="tab === 'med'" class="desk" aria-label="发药对照调查台">
      <!-- 左：材料箱 -->
      <div class="panel material-box" aria-labelledby="mat-h">
        <h2 id="mat-h"><AppIcon name="archive" :size="16" /> 材料箱 · 原始单据</h2>
        <p class="muted small">
          助手的数量修正只写在线对照层，不覆盖原始签收层。
          <span v-if="medFixApplied" class="anomaly-text">当前在线层：第六份＝损耗（可在整批公示前撤销）。</span>
        </p>
        <ul class="doclist">
          <li v-for="id in OPENABLE" :key="id" :class="{ got: acquired(id) }" :data-testid="`p05:doc--${id}`">
            <div class="doc-line">
              <span class="doc-title">{{ evTitle(id) }}</span>
              <small class="mono muted">{{ id }}</small>
            </div>
            <span v-if="acquired(id)" class="ok small">✓ 已取得</span>
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

      <!-- 中：对照 -->
      <div class="panel puzzle" aria-labelledby="p1-h">
        <h2 id="p1-h">异常复查：少掉的是一条数据，还是一个人？</h2>
        <p class="muted">先指出冲突的类型，再引用两份来自不同原始过程的材料支撑判断。</p>
        <fieldset>
          <legend>我认为冲突是</legend>
          <label class="opt"><input type="radio" name="anomaly" value="DUPLICATE_ROW" v-model="anomaly" :data-testid="'p05:anomaly--DUPLICATE_ROW'" /> 一条重复数据</label>
          <label class="opt"><input type="radio" name="anomaly" value="COUNT_ERROR" v-model="anomaly" :data-testid="'p05:anomaly--COUNT_ERROR'" /> 数量统计误差</label>
          <label class="opt"><input type="radio" name="anomaly" value="IDENTITY_INDEX" v-model="anomaly" :data-testid="'p05:anomaly--IDENTITY_INDEX'" /> 身份索引异常</label>
          <label class="opt"><input type="radio" name="anomaly" value="ENTRY_DELAY" v-model="anomaly" :data-testid="'p05:anomaly--ENTRY_DELAY'" /> 录入延迟</label>
        </fieldset>
        <fieldset>
          <legend>引用证据（需两类独立来源）</legend>
          <label
            v-for="id in SELECTABLE.filter((x) => acquired(x))"
            :key="id"
            class="opt ev-opt"
          >
            <input
              type="checkbox"
              :value="id"
              :checked="selectedEvidence.includes(id as EvidenceId)"
              :data-testid="`p05:ev--${id}`"
              @change="toggleEvidence(id as EvidenceId)"
            />
            <span>{{ evTitle(id) }}</span>
            <small class="mono muted">{{ id }}</small>
          </label>
          <p v-for="id in SELECTABLE.filter((x) => !acquired(x))" :key="id" class="muted small ev-missing">
            《{{ evTitle(id) }}》尚未取得——回到左侧材料箱打开它。
          </p>
        </fieldset>

        <div v-if="showSourceRule" class="rule-card" role="note">
          <strong><AppIcon name="warning" :size="15" /> 值班须知 · 独立来源</strong>
          <p>同一步抄出来的两份东西，说得再一样也不算互相证明。要指出记录被动过，得拿两处来源不同的材料。</p>
          <button class="ghost small" @click="dismissSourceRule">知道了</button>
        </div>

        <ul v-if="p1Conflicts.length" class="conflict-list" data-testid="p05:p1-feedback">
          <li v-for="(c, i) in p1Conflicts" :key="i">{{ c }}</li>
        </ul>
        <HintPanel v-if="!p1Done" puzzle-id="p1" />
      </div>

      <!-- 右：结论区 -->
      <div class="panel conclusion" aria-labelledby="con-h">
        <h2 id="con-h"><AppIcon name="clipboard" :size="16" /> 结论</h2>
        <button
          v-if="!p1Done"
          class="primary full"
          data-testid="p05:submit-p1"
          @click="submitP1"
        >
          提交复查理由
        </button>
        <p v-if="!p1Done" class="muted small">提交后由夜班复核岗受理；材料可以反复查看，不影响结局。</p>

        <template v-if="p1Done">
          <CompletionPanel
            testid="p05:p1-done"
            proved="R03 的在场记录还在。被改掉的不是一条发药数据，是「R03＝许棠」这根线。"
            excluded="周砚的值班说明把事情推给「录入延迟」，可原始签收层对不上——这条路走不通。"
            opened="一段没有署名的夜班录音，可以核对了。"
            action-label="去听这段录音"
            action-to="/medication#p05-audio"
          />

          <article class="message-card" data-testid="p05:zhouyan-contact">
            <header><AppIcon name="moon" :size="15" /> 站内消息 · 周砚（迁移项目组）</header>
            <p>{{ dialogue.zhouyan.contact1 }}</p>
          </article>

          <section id="p05-audio" class="audio-block" aria-labelledby="audio-h">
            <h3 id="audio-h">异常复查单 · 无归属音频</h3>
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
            <p v-else class="ok small">✓ 林闻的留言已保存为证据。</p>
            <p v-if="aud01Acked" class="muted small xutang-note">{{ dialogue.linwen.xutangNote }}</p>

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
                依据《离线交接联》{{ ev01Acquired ? '' : '（未取得）' }}
              </label>
              <label class="opt">
                <input
                  type="radio"
                  value="EV02"
                  v-model="restoreSource"
                  :disabled="!ev02Acquired"
                  data-testid="p05:restore-source--EV02"
                />
                依据《只读初始快照》
              </label>
              <div>
                <button class="primary" data-testid="p05:submit-restore" @click="submitRestore">恢复 R03—许棠</button>
              </div>
            </div>
            <div v-if="restoreFeedback" class="notice">{{ dialogue.system.restoreFeedback }}</div>

            <CompletionPanel
              v-if="facts.r03IdentityRestored"
              testid="p05:restore-done"
              proved="靠你手里那份原始交接，R03 和许棠重新对上了号。整批回到待复核。"
              excluded="「这条记录从来不存在」——两份独立材料都不答应。"
              opened="接下来把当晚的记录按真实顺序摆一遍。"
              action-label="开始重排时间线"
              @action="tab = 'timeline'"
            />
          </section>
        </template>
      </div>
    </section>

    <!-- 第二步：时间线 -->
    <section v-if="tab === 'timeline'" class="panel puzzle timeline-task" aria-labelledby="p2-h">
      <h2 id="p2-h">按事件发生顺序重排当晚记录</h2>
      <p class="muted">
        按<strong>事情实际发生的先后</strong>排；<strong>上传时间</strong>是另一回事，用它找出后补的材料。
        最后两张卡引用的是本局触发来源。
      </p>
      <ol class="tl-list">
        <li v-for="id in order" :key="id" class="tl-item" :data-testid="`p05:tl--${id}`">
          <span class="tl-move">
            <button :aria-label="`上移 ${evTitle(id)}`" :data-testid="`p05:tl-up--${id}`" @click="move(id, -1)">↑</button>
            <button :aria-label="`下移 ${evTitle(id)}`" :data-testid="`p05:tl-down--${id}`" @click="move(id, 1)">↓</button>
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
        《离院报告与模板清单》的上传时间早于它引用的事件——标记为不可靠
      </label>
      <button class="primary" data-testid="p05:submit-p2" :disabled="p2Done" @click="submitP2">提交时间线</button>
      <ul v-if="p2Conflicts.length" class="conflict-list">
        <li v-for="(c, i) in p2Conflicts" :key="i">{{ c }}</li>
      </ul>
      <HintPanel v-if="!p2Done" puzzle-id="p2" />
      <CompletionPanel
        v-if="p2Done"
        testid="p05:p2-done"
        proved="当晚的顺序拼出来了：那份「离院报告」写在自己引用的事件前面——先有的结论，后补的材料。"
        excluded="《离院报告与模板清单》标记为不可靠，它不算数了。"
        opened="留言板上有三个梦，讲的好像是同一个地方。"
        action-label="去病友留言板"
        action-to="/forum"
      />
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

<style scoped>
.page-head h1 { font-size: 1.25em; margin: 0; }
.page-head p { margin: var(--space-1) 0 0; }
.tabs { display: flex; gap: var(--space-2); margin: var(--space-3) 0; flex-wrap: wrap; }
.tabs [aria-selected='true'] { background: var(--clinical); color: #fff; border-color: var(--clinical); }

/* 三栏调查台 */
/* 三栏调查台：子项一律可收缩（min-width:0），防止波形/长文本固有宽撑爆窄列 */
.desk { display: grid; grid-template-columns: minmax(230px, 280px) minmax(0, 1.4fr) minmax(260px, 320px); gap: var(--space-4); align-items: start; }
.desk > .panel { min-width: 0; }
.material-box h2, .puzzle h2, .conclusion h2 { font-size: 1.02em; display: flex; align-items: center; gap: var(--space-2); }

.doclist { list-style: none; padding: 0; display: flex; flex-direction: column; gap: var(--space-2); margin: var(--space-2) 0 0; }
.doclist li { border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-2) var(--space-3); background: #fff; }
.doclist li.got { border-left: 3px solid var(--clinical); }
.doc-line { display: flex; justify-content: space-between; align-items: baseline; gap: var(--space-2); }
.doc-title { font-weight: 600; font-size: 0.92em; }
.docbody pre { white-space: pre-wrap; font-size: 0.85em; margin: var(--space-2) 0 0; }

.puzzle fieldset { border: 1px dashed var(--line); border-radius: var(--radius); margin: var(--space-3) 0; padding: var(--space-4) var(--space-3) var(--space-3); }
.puzzle fieldset legend { line-height: 1.6; margin-bottom: var(--space-1); padding: 0 var(--space-1); float: none; width: auto; }
.opt { display: flex; margin: var(--space-1) 0; gap: var(--space-2); align-items: baseline; }
.ev-opt span { font-size: 0.9em; }
.ev-missing { margin: var(--space-1) 0 0; }
.rule-card { border: 1px solid #ad8a42; background: rgba(213, 170, 83, 0.1); border-radius: var(--radius); padding: var(--space-2) var(--space-3); margin: var(--space-3) 0; }
.rule-card strong { display: flex; gap: 6px; align-items: center; font-size: 0.88em; }
.rule-card p { margin: var(--space-1) 0; font-size: 0.85em; }
.conflict-list { color: var(--error); padding-left: 1.2em; font-size: 0.88em; }

.conclusion { display: grid; gap: var(--space-3); }
.full { width: 100%; }
.message-card { border: 1px solid var(--line); border-radius: var(--radius); background: #fbfaf6; padding: var(--space-2) var(--space-3); }
.message-card header { display: flex; align-items: center; gap: 6px; color: var(--muted); font-size: 0.78rem; font-weight: 700; }
.message-card p { margin: var(--space-1) 0 0; font-size: 0.86em; line-height: 1.7; white-space: pre-wrap; }
.audio-block { border-top: 1px solid var(--line); padding-top: var(--space-3); display: grid; gap: var(--space-2); }
.audio-block h3 { font-size: 0.95em; margin: 0; }
.xutang-note { border-left: 3px solid #ad8a42; padding-left: var(--space-2); }
.row { display: flex; gap: var(--space-3); align-items: center; }
.transcript { white-space: pre-wrap; background: #eef1ef; border-radius: var(--radius); padding: var(--space-2) var(--space-3); margin: 0; }
.restore { margin-top: var(--space-2); }
.ok { color: var(--clinical); }

.timeline-task { max-width: 860px; }
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
.small { font-size: 0.85em; }

@media (max-width: 1280px) {
  /* 1280 档（docs/09 附录二 问题1）：三栏＋右侧调查栏并排过挤，结论区并入下方全宽 */
  .desk { grid-template-columns: minmax(230px, 280px) minmax(0, 1.4fr); }
  .conclusion { grid-column: 1 / -1; }
}
@media (max-width: 1020px) {
  .desk { grid-template-columns: 1fr; }
  .conclusion { grid-column: auto; }
}
</style>
