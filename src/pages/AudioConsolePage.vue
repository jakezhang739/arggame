<script setup lang="ts">
/** P12 交班录音台（docs/03册 v1.1 §3）：六片段排序（a1）、完整录音确认、本地见证、ST_R03。 */
import { computed, ref } from 'vue';
import { useGameStore } from '../stores/game';
import { content } from '../game/content';
import { checkA1 } from '../game/gates';
import { statementUnlocked } from '../game/selectors';
import type { AudioId } from '../game/types';
import HintPanel from '../components/HintPanel.vue';
import LiteratureExcerpt from '../components/LiteratureExcerpt.vue';
import LocalWitness from '../components/LocalWitness.vue';
import WalkthroughHint from '../components/WalkthroughHint.vue';
import AudioFragment from '../components/AudioFragment.vue';

const game = useGameStore();
const facts = computed(() => game.state.facts);
const manifest = content.audioManifest as {
  clips: Record<string, { id: string; speech: string; objectiveCaptions: string[] }>;
  channel03: {
    correctOrder: string[];
    displayOrder: string[];
    displayNames: Record<string, string>;
    plotHintLabels: Record<string, string>;
    continuityCuts: { id: string; left: string; right: string; description: string }[];
    boundary: { first: string; firstProof: string; last: string; lastProof: string };
    interpretationLimit: string;
  };
};
const ch03 = manifest.channel03;

// —— a1 排序（草稿持久化）——
const order = ref<AudioId[]>(
  game.save.drafts.audioOrder.length === 6 ? [...game.save.drafts.audioOrder] : [...(ch03.displayOrder as AudioId[])],
);
const anchors = ref<string[]>([...game.save.drafts.audioAnchorPairs]);
const plotHintsOn = ref(false);
const a1Feedback = ref<string[]>([]);
const ANCHOR_OPTIONS = ch03.continuityCuts.map((c) => ({ key: c.id, label: c.description }));
const DISTRACTOR = { key: 'LAMP_PAIR', label: '台灯开关声的两次按压（干扰项：只出现一次）' };

function displayName(id: AudioId): string {
  return ch03.displayNames[id] ?? id;
}
function persist(): void {
  game.updateDrafts((d) => {
    d.audioOrder = [...order.value];
    d.audioAnchorPairs = [...anchors.value];
  });
}
function moveUp(id: AudioId): void {
  const i = order.value.indexOf(id);
  if (i > 0) {
    order.value.splice(i - 1, 0, order.value.splice(i, 1)[0]);
    persist();
  }
}
function moveDown(id: AudioId): void {
  const i = order.value.indexOf(id);
  if (i >= 0 && i < order.value.length - 1) {
    order.value.splice(i + 1, 0, order.value.splice(i, 1)[0]);
    persist();
  }
}
function toggleAnchor(key: string): void {
  const i = anchors.value.indexOf(key);
  if (i >= 0) anchors.value.splice(i, 1);
  else anchors.value.push(key);
  persist();
}
async function submitA1(): Promise<void> {
  const result = checkA1(order.value, anchors.value);
  a1Feedback.value = result.conflicts;
  if (!result.ok) {
    await game.execute({ kind: 'puzzleAttempt', puzzleId: 'a1', choiceKeys: [...order.value, ...anchors.value], feedbackKey: result.feedbackKey });
    return;
  }
  const okExec = await game.execute({ kind: 'solveAudioOrder', order: [...order.value], anchorPairs: [...anchors.value] });
  if (okExec) persist();
}

// —— 完整录音确认 ——
const fullTranscript = computed(() =>
  ch03.correctOrder.map((id) => {
    const clip = manifest.clips[id];
    return { id, name: displayName(id as AudioId), speech: clip.speech, captions: clip.objectiveCaptions };
  }),
);
async function ackFull(): Promise<void> {
  await game.execute({ kind: 'ackAudioContent', audioId: 'CHANNEL_03_FULL', mode: 'TEXT' });
}

// —— ST_R03 ——
const st3Unlocked = computed(() => statementUnlocked(game.state, 'ST_R03'));
const st3Captured = computed(() => facts.value.capturedStatements.includes('ST_R03'));
async function captureR03(): Promise<void> {
  await game.execute({ kind: 'captureStatement', patientId: 'R03', statementId: 'ST_R03' });
}

// —— 可选实物卡 ——
const deskSpotAcked = computed(() => game.state.events.some((e) => e.code === 'ACK_DESK_SPOT'));
</script>

<template>
  <div class="console">
    <h1>通道 03 · 交班录音台</h1>
    <p class="muted">lab.chengwan/audio/channel-03 · 六个片段乱序；不显示资产编号中的序号。</p>

    <!-- U-R 卡 -->
    <section v-if="facts.trailForkCreated" class="panel">
      <h2>研究卡 U-R（可读）</h2>
      <LiteratureExcerpt id="U-R" />
    </section>

    <!-- a1 -->
    <section v-if="!facts.audioOrderSolved" class="panel">
      <h2>重排当晚录音：按真实先后摆到时间带上</h2>
      <p class="muted small">
        边界：开头是「{{ ch03.boundary.firstProof }}」，结尾是「{{ ch03.boundary.lastProof }}」。
        每个跨切点音效只生成一次：左右片段取同一声响的两个相邻半段。
      </p>
      <p class="anchor-note small">
        锚点设计：这三处接续的声响，是许棠安排的。她说干维修的都这么干活——编号、复现、留住现场。
        她不是碰巧留下素材的人。
      </p>
      <label class="small">
        <input type="checkbox" v-model="plotHintsOn" data-testid="p12:plot-hints" /> 显示情节提示层（可关；客观字幕不受影响）
      </label>

      <!-- 横向时间带：主排序视图（←/→ 与键盘等价；testid 沿用 up/down） -->
      <div class="timeband-wrap">
        <span class="band-start mono">当晚开始</span>
        <ol class="timeband" aria-label="录音时间带：按当前认定的先后顺序排列">
          <li
            v-for="(id, idx) in order"
            :key="id"
            class="band-cell"
            :data-testid="`p12:band--${id}`"
            :class="{ 'has-plot': plotHintsOn }"
          >
            <span class="band-idx mono">{{ idx + 1 }}</span>
            <strong class="band-name">{{ displayName(id) }}</strong>
            <span v-if="plotHintsOn" class="plot-chip" :data-testid="`p12:plot--${id}`">提示层</span>
            <span class="band-move">
              <button class="ghost small" :aria-label="`左移 ${displayName(id)}`" :data-testid="`p12:up--${id}`" @click="moveUp(id)">←</button>
              <button class="ghost small" :aria-label="`右移 ${displayName(id)}`" :data-testid="`p12:down--${id}`" @click="moveDown(id)">→</button>
            </span>
          </li>
        </ol>
        <span class="band-end mono">交班结束</span>
      </div>
      <p v-if="plotHintsOn" class="muted small">
        情节提示层：{{ order.map((id) => ch03.plotHintLabels[id]).join('／') }}（可关闭，只影响提示，不影响字幕）
      </p>

      <!-- 试听列表：逐段播放与客观字幕 -->
      <ul class="frags">
        <li v-for="id in order" :key="id" class="frag" :data-testid="`p12:frag--${id}`">
          <div class="frag-head">
            <strong>{{ displayName(id) }}</strong>
          </div>
          <AudioFragment
            :audio-id="id"
            :title="displayName(id)"
            :transcript="manifest.clips[id].speech"
            :show-anchors="true"
          />
        </li>
      </ul>
      <fieldset class="anchors">
        <legend>确认三对跨切点接续（同一声响的两半）</legend>
        <label v-for="opt in ANCHOR_OPTIONS" :key="opt.key" class="marker small">
          <input type="checkbox" :checked="anchors.includes(opt.key)" :data-testid="`p12:anchor--${opt.key}`" @change="toggleAnchor(opt.key)" />
          {{ opt.label }}
        </label>
        <label class="marker small">
          <input type="checkbox" :checked="anchors.includes(DISTRACTOR.key)" :data-testid="`p12:anchor--${DISTRACTOR.key}`" @change="toggleAnchor(DISTRACTOR.key)" />
          {{ DISTRACTOR.label }}
        </label>
      </fieldset>
      <button class="primary" data-testid="p12:submit-a1" @click="submitA1">提交顺序与接续</button>
      <ul v-if="a1Feedback.length" class="feedback"><li v-for="(f, i) in a1Feedback" :key="i">{{ f }}</li></ul>
      <HintPanel puzzle-id="a1" />
      <p class="muted small">占位配音已接入（合成音）。不听声音也可完成：客观字幕给出全部判定信息。</p>
    </section>

    <!-- 完整录音 -->
    <section v-else-if="!facts.recoveredAudioRead" class="panel">
      <h2>完整交班（按正确顺序重组）</h2>
      <article v-for="seg in fullTranscript" :key="seg.id" class="seg">
        <h3 class="small">{{ seg.name }}</h3>
        <p class="speech">{{ seg.speech }}</p>
        <p class="muted small" v-for="(c, i) in seg.captions" :key="i">字幕：{{ c }}</p>
      </article>
      <p class="muted small">{{ ch03.interpretationLimit }}</p>
      <button class="primary" data-testid="p12:ack-full" @click="ackFull">已确认这段内容</button>
    </section>

    <!-- 见证 + 陈述 + 实物卡 -->
    <template v-else>
      <section class="panel">
        <h2>许棠的当前意愿（ST_R03）</h2>
        <blockquote class="speech">{{ content.statements['ST_R03'].text }}</blockquote>
        <p v-if="st3Captured" class="ok">✓ ST_R03 已保留。</p>
        <button v-else-if="st3Unlocked" class="primary" data-testid="p12:capture-r03" @click="captureR03">
          保留这条本人陈述
        </button>
      </section>

      <LocalWitness v-if="facts.witnessScope !== 'FACT_ONLY'" @confirm="(p) => game.execute({ kind: 'witnessScope', mode: p.mode, recordingId: p.recordingId })" />
      <WalkthroughHint v-if="facts.witnessScope !== 'FACT_ONLY'">
        见证这一步：选「文字确认」→ 勾「我确认以上固定范围声明（不改写、不添加结论）」→ 点「确认见证范围」。
      </WalkthroughHint>
      <section v-else class="panel">
        <p class="ok" data-testid="p12:scope-ok">✓ 见证范围已确认（仅事实）：{{ game.save.witness?.mode === 'VOICE' ? '语音' : '文字' }}
          <template v-if="game.save.witness && !game.save.witness.recordingAvailable">（本机录音已不在，文字声明仍有效）</template>
        </p>
      </section>

      <section class="panel">
        <h2>可选 · 手边的物件</h2>
        <p class="muted small">留一个普通物件在手边。之后再看到它时，回想它的具体事项。仅自证；不上传照片、不定位、不安排外出。</p>
        <button
          v-if="!deskSpotAcked"
          class="ghost"
          data-testid="p12:ack-deskspot"
          @click="game.execute({ kind: 'ackDeskSpot' })"
        >
          我已在手边放好
        </button>
        <p v-else class="ok small">✓ 已记录（仅自证）。</p>
      </section>

      <p v-if="facts.witnessScope === 'FACT_ONLY'">
        <RouterLink to="/lab/surgery" data-testid="p12:goto-surgery">去连接切除模拟 →</RouterLink>
      </p>
    </template>
  </div>
</template>

<style scoped>
/* 横向时间带（08册 §7.5）：主排序视图 */
.timeband-wrap { display: flex; align-items: stretch; gap: var(--space-2); margin: var(--space-3) 0; overflow-x: auto; padding-bottom: var(--space-1); }
.band-start, .band-end { writing-mode: vertical-rl; text-orientation: mixed; color: var(--muted); font-size: 0.68rem; display: flex; align-items: center; }
.timeband { list-style: none; display: flex; gap: var(--space-2); margin: 0; padding: var(--space-2); border-top: 2px solid var(--line); border-bottom: 2px solid var(--line); background: repeating-linear-gradient(90deg, transparent 0 46px, rgba(93, 122, 112, 0.12) 46px 48px); }
.band-cell { position: relative; display: grid; gap: 4px; justify-items: start; min-width: 132px; border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-2); background: var(--surface); }
.band-cell.has-plot { border-color: #ad8a42; }
.band-idx { color: var(--muted); font-size: 0.68rem; }
.band-name { font-size: 0.8rem; line-height: 1.4; }
.plot-chip { position: absolute; top: -8px; right: 8px; background: #f3e3d3; border: 1px solid #b98a4f; color: #805600; border-radius: 999px; font-size: 0.62rem; padding: 0 6px; }
.band-move { display: inline-flex; gap: 4px; }
.anchor-note { border-left: 3px solid #ad8a42; background: rgba(213, 170, 83, 0.08); border-radius: var(--radius); padding: var(--space-2) var(--space-3); margin: var(--space-2) 0; }
.frags { list-style: none; padding: 0; display: grid; gap: var(--space-2); grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
.frag { border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-2) var(--space-3); }
.frag-head { display: flex; align-items: center; gap: var(--space-2); }
.plot { color: #805600; }
.anchors { border: 1px solid var(--line); border-radius: var(--radius); display: grid; gap: var(--space-1); margin: var(--space-3) 0; max-width: 640px; }
.seg { border-left: 3px solid var(--line); padding-left: var(--space-3); margin: var(--space-2) 0; }
.speech { white-space: pre-wrap; margin: var(--space-1) 0; }
.literature { border-left: 4px solid var(--primary); margin: var(--space-2) 0; padding-left: var(--space-3); }
.feedback { color: var(--error); }
.small { font-size: 0.85em; }
.ok { color: var(--clinical); }
</style>
