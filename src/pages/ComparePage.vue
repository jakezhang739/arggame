<script setup lang="ts">
/**
 * P08 平行复核（docs/11 Batch 4 §3）：两份结论相反的文档为什么共享同一份底稿；
 * 共用痕迹内联可视化；相反语气同一栅格；R-NM 为可选解释卡（不再是通关门槛）。
 */
import { computed, ref } from 'vue';
import { useGameStore } from '../stores/game';
import { content, dialogue } from '../game/content';
import { isAcquired } from '../game/selectors';
import { checkP4 } from '../game/gates';
import VersionDiff from '../components/VersionDiff.vue';
import AppIcon from '../components/AppIcon.vue';
import CompletionPanel from '../components/CompletionPanel.vue';
import HintPanel from '../components/HintPanel.vue';
import LiteratureExcerpt from '../components/LiteratureExcerpt.vue';
import SourceInspector from '../components/SourceInspector.vue';

const game = useGameStore();
const facts = computed(() => game.state.facts);

const ev19 = computed(() => isAcquired(game.state, 'EV19'));
const ev20 = computed(() => isAcquired(game.state, 'EV20'));
const ev21 = computed(() => isAcquired(game.state, 'EV21'));
const ev22 = computed(() => isAcquired(game.state, 'EV22'));

const doc = (id: 'EV19' | 'EV20') =>
  content.evidenceRegistry.find((e) => e.id === id)?.display ?? '';

const markers = ref<string[]>([]);
const p4Feedback = ref<string[]>([]);
const MARKER_OPTIONS = [
  { key: 'TYPO', label: '第 4 段同一处错字（“判订”）' },
  { key: 'SOURCE_ID', label: '相同的来源编号（SRC-CW-NAR-0042）' },
  { key: 'TITLE', label: '标题不同（干扰项）' },
  { key: 'TONE', label: '语气不同（干扰项）' },
];
/** 内联共用痕迹：正文里可直接点中的同源片段（与复选框等价）。 */
const INLINE_MARKS = [
  { key: 'TYPO', needle: '判订' },
  { key: 'SOURCE_ID', needle: 'SRC-CW-NAR-0042' },
];

async function submitP4(): Promise<void> {
  const result = checkP4(game.state, markers.value);
  p4Feedback.value = result.conflicts;
  if (!result.ok) {
    await game.execute({ kind: 'puzzleAttempt', puzzleId: 'p4', choiceKeys: [...markers.value], feedbackKey: result.feedbackKey });
    return;
  }
  await game.execute({ kind: 'proveSharedSource', markers: markers.value });
}
</script>

<template>
  <div class="compare">
    <h1>平行复核工作区</h1>
    <p class="muted">lab.chengwan/compare · 同一批导出的两页叙事文档。</p>

    <!-- 周砚第二次联络（10册 §1.3 ②，已批）：剧场发现后回应质问。 -->
    <article class="message-card" data-testid="p08:zhouyan-contact2">
      <header><AppIcon name="moon" :size="15" /> 站内消息 · 周砚（迁移项目组）· 未归档</header>
      <p>{{ dialogue.zhouyan.contact2 }}</p>
    </article>

    <section v-if="!ev19 || !ev20" class="panel">
      <h2>两份文档：结论相反，语气相反</h2>
      <p class="muted small">先分别打开再比较；只滚到底或只看卡片不会得到结果。</p>
      <button v-if="!ev19" data-testid="p08:open-ev19" @click="game.execute({ kind: 'openDoc', documentId: 'EV19' })">
        打开《正向修复文档》 <small class="mono">EV19</small>
      </button>
      <span v-else class="ok small">✓《正向修复文档》已取得</span>
      <button v-if="!ev20" data-testid="p08:open-ev20" @click="game.execute({ kind: 'openDoc', documentId: 'EV20' })">
        打开《负向申诉文档》 <small class="mono">EV20</small>
      </button>
      <span v-else class="ok small">✓《负向申诉文档》已取得</span>
    </section>

    <section v-else class="panel">
      <h2>两份结论相反的文档，为什么共享同一份底稿？</h2>
      <p class="muted small">
        左边语气冷静，右边情绪激烈——但版式、段落与用词习惯出自同一只手。
        在正文里点中两处共用痕迹，或在下方勾选等价选项。
      </p>
      <VersionDiff
        left-title="《正向修复文档》 EV19"
        :left-text="doc('EV19')"
        right-title="《负向申诉文档》 EV20"
        :right-text="doc('EV20')"
        :options="MARKER_OPTIONS"
        :inline-marks="INLINE_MARKS"
        v-model="markers"
      />
      <template v-if="!ev21">
        <button class="primary" data-testid="p08:submit-p4" @click="submitP4">提交共同标记</button>
        <ul v-if="p4Feedback.length" class="feedback"><li v-for="(f, i) in p4Feedback" :key="i">{{ f }}</li></ul>
        <HintPanel puzzle-id="p4" />
      </template>
      <template v-else>
        <p class="ok">✓ 来源比较成立：两页同出一稿。<SourceInspector id="EV21" /></p>
        <CompletionPanel
          testid="p08:p4-done"
          proved="一份说康复、一份说恶化，字底下是同一份底稿。同一只手，两种口气。"
          excluded="「各写各的」不成立：错字一样，来源编号也一样。"
          opened="单变量实验：在归档副本上验证真正的触发条件。"
          action-label="用归档副本验证真正的触发条件"
          action-to="/lab/experiment"
        />
      </template>
    </section>

    <!-- R-NM 可选解释卡（07册 §4.1：不承担通关门槛）＋ 接口日志材料 -->
    <section v-if="facts.dualSourceProven" class="panel shelfcard" aria-labelledby="rnm-h">
      <h2 id="rnm-h">旁证材料（可选）</h2>
      <LiteratureExcerpt id="R-NM" />
      <p class="muted small">
        可选解释卡：同一个核心值被译成两种结论——像同一声回答被听成两个意思。不构成通关条件，
        实验台旁也有一份。
      </p>
      <button v-if="!ev22" data-testid="p08:open-ev22" @click="game.execute({ kind: 'openDoc', documentId: 'EV22' })">
        打开《终止接口捕获日志》 <small class="mono">EV22</small>
      </button>
      <p v-else class="ok small">✓《终止接口捕获日志》已取得。<SourceInspector id="EV22" /></p>
    </section>
  </div>
</template>

<style scoped>
.message-card { border: 1px solid var(--line); border-radius: var(--radius); background: #fbfaf6; padding: var(--space-2) var(--space-3); margin: var(--space-3) 0; }
.message-card header { display: flex; align-items: center; gap: 6px; color: var(--muted); font-size: 0.78rem; font-weight: 700; }
.message-card p { margin: var(--space-1) 0 0; font-size: 0.86em; line-height: 1.7; white-space: pre-wrap; }
.literature { border-left: 4px solid var(--primary); margin: var(--space-2) 0; padding-left: var(--space-3); }
.shelfcard { border-style: dashed; }
.feedback { color: var(--error); }
.small { font-size: 0.85em; }
.ok { color: var(--clinical); }
</style>
