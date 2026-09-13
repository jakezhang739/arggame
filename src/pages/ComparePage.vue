<script setup lang="ts">
/** P08 平行复核（docs/03册 v1.1 §3）：两份文档对照标错字/来源，p4；R-NM 与接口日志。 */
import { computed, ref } from 'vue';
import { useGameStore } from '../stores/game';
import { content } from '../game/content';
import { isAcquired } from '../game/selectors';
import { checkP4, checkRnm } from '../game/gates';
import VersionDiff from '../components/VersionDiff.vue';
import HintPanel from '../components/HintPanel.vue';
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
  { key: 'SOURCE_ID', label: '相同的 SOURCE_ID（SRC-CW-NAR-0042）' },
  { key: 'TITLE', label: '标题不同（干扰项）' },
  { key: 'TONE', label: '语气不同（干扰项）' },
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

// —— R-NM ——
const rnmChoice = ref('');
const rnmFeedback = ref<string[]>([]);
const RNM_OPTIONS = [
  { key: 'ONE_TERMINATION_INTERFACE', label: '同一个“终止接口”把一个核心值译成了两个结论' },
  { key: 'TWO_CONDITIONS', label: '两位患者病情确实不同，各写各的' },
  { key: 'NURSE_ERROR', label: '护士抄错了其中一份' },
];
async function submitRnm(): Promise<void> {
  const result = checkRnm(game.state, rnmChoice.value);
  rnmFeedback.value = result.conflicts;
  if (!result.ok) {
    await game.execute({ kind: 'puzzleAttempt', puzzleId: 'rnm', choiceKeys: [rnmChoice.value], feedbackKey: result.feedbackKey });
    return;
  }
  await game.execute({ kind: 'inferRefrain', evidenceIds: ['EV21', 'EV22'] });
}
</script>

<template>
  <div class="compare">
    <h1>平行复核工作区</h1>
    <p class="muted">lab.chengwan/compare · 同一批导出的两页叙事文档。两窗可分别开关。</p>

    <section v-if="!ev19 || !ev20" class="panel">
      <h2>两份文档</h2>
      <p class="muted small">先分别打开；只滚到底或只看卡片不会得到结果。</p>
      <button v-if="!ev19" data-testid="p08:open-ev19" @click="game.execute({ kind: 'openDoc', documentId: 'EV19' })">
        打开正向修复文档（EV19）
      </button>
      <span v-else class="ok small">✓ EV19 已取得</span>
      <button v-if="!ev20" data-testid="p08:open-ev20" @click="game.execute({ kind: 'openDoc', documentId: 'EV20' })">
        打开负向申诉文档（EV20）
      </button>
      <span v-else class="ok small">✓ EV20 已取得</span>
    </section>

    <section v-else class="panel">
      <h2>版本对照（p4）</h2>
      <VersionDiff
        left-title="正向修复文档（EV19）"
        :left-text="doc('EV19')"
        right-title="负向申诉文档（EV20）"
        :right-text="doc('EV20')"
        :options="MARKER_OPTIONS"
        v-model="markers"
      />
      <template v-if="!ev21">
        <button class="primary" data-testid="p08:submit-p4" @click="submitP4">提交共同标记</button>
        <ul v-if="p4Feedback.length" class="feedback"><li v-for="(f, i) in p4Feedback" :key="i">{{ f }}</li></ul>
        <HintPanel puzzle-id="p4" />
      </template>
      <p v-else class="ok">✓ 来源比较成立（EV21）：两页同出一稿。<SourceInspector id="EV21" /></p>
    </section>

    <section v-if="facts.dualSourceProven" class="panel">
      <h2>研究卡 R-NM 与接口日志</h2>
      <blockquote class="literature">
        <p>{{ content.literature['R-NM'].excerpt }}</p>
        <footer class="muted small">—— {{ content.literature['R-NM'].work }}（{{ content.literature['R-NM'].edition }}）</footer>
      </blockquote>
      <button v-if="!ev22" data-testid="p08:open-ev22" @click="game.execute({ kind: 'openDoc', documentId: 'EV22' })">
        打开终止接口捕获日志（EV22）
      </button>
      <template v-else>
        <p class="ok small">✓ EV22 已取得。<SourceInspector id="EV22" /></p>
        <fieldset v-if="!facts.refrainInferred" class="rnmform">
          <legend>谁把核心值译成了两个结论？</legend>
          <label v-for="opt in RNM_OPTIONS" :key="opt.key" class="marker">
            <input type="radio" name="rnm" :value="opt.key" v-model="rnmChoice" :data-testid="`p08:rnm--${opt.key}`" />
            {{ opt.label }}
          </label>
          <button class="primary" data-testid="p08:submit-rnm" @click="submitRnm">提交判断</button>
          <ul v-if="rnmFeedback.length" class="feedback"><li v-for="(f, i) in rnmFeedback" :key="i">{{ f }}</li></ul>
          <HintPanel puzzle-id="rnm" />
        </fieldset>
        <template v-else>
          <p class="ok">✓ 判断完成：一个终止接口，两种译文。</p>
          <p><RouterLink to="/lab/experiment" data-testid="p08:goto-experiment">去单变量实验 →</RouterLink></p>
        </template>
      </template>
    </section>
    <p v-else-if="ev21" class="muted">同源成立后，这张研究卡（R-NM）会出现在档案页与这里。</p>
  </div>
</template>

<style scoped>
.literature { border-left: 4px solid var(--primary); margin: var(--space-2) 0; padding-left: var(--space-3); }
.rnmform { display: grid; gap: var(--space-2); border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-3); max-width: 620px; }
.feedback { color: var(--error); }
.small { font-size: 0.85em; }
.ok { color: var(--clinical); }
</style>
