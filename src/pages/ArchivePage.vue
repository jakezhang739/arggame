<script setup lang="ts">
/** P07 地方档案与研究卡（docs/03册 v1.1 §3）：两图配对、M-7/W-F 卡、p3 三联、文学卡回看。 */
import { computed, reactive, ref } from 'vue';
import { useGameStore } from '../stores/game';
import { content } from '../game/content';
import { isAcquired, statementUnlocked } from '../game/selectors';
import { checkM7, checkP3 } from '../game/gates';
import HintPanel from '../components/HintPanel.vue';
import SourceInspector from '../components/SourceInspector.vue';

const game = useGameStore();
const facts = computed(() => game.state.facts);

const ev15 = computed(() => isAcquired(game.state, 'EV15'));
const ev16 = computed(() => isAcquired(game.state, 'EV16'));
const ev17 = computed(() => isAcquired(game.state, 'EV17'));
const ev18 = computed(() => isAcquired(game.state, 'EV18'));

// —— 两张图共用精确基址（03册 §3 P07）——
const BASE = 'M80 60 H920 V640 H80 Z';
const LEFT = { x: 100, y: 120, w: 230, h: 400 };
const DESK = { x: 360, y: 250, w: 100, h: 100 };
const SEAT = { x: 690, y: 470, r: 46 };
const opacity = ref(100);

// —— 配对（键盘可用：下拉即等价于拖拽）——
const PAIR_OPTIONS = ['后台', '提词位', '观众席外席', '正门'] as const;
const pairs = reactive<{ ward: string; desk: string; seat: string }>({ ward: '', desk: '', seat: '' });
const pairFeedback = ref<string[]>([]);
const CORRECT = { ward: '后台', desk: '提词位', seat: '观众席外席' };

async function submitPairs(): Promise<void> {
  pairFeedback.value = [];
  if (pairs.ward !== CORRECT.ward) pairFeedback.value.push('病房区对应的位置不对：长期住人的那片，在剧场里是什么？');
  if (pairs.desk !== CORRECT.desk) pairFeedback.value.push('护士站对应的位置不对：谁在给台上的人递话？');
  if (pairs.seat !== CORRECT.seat) pairFeedback.value.push('复核终端对应的位置不对：你坐在哪里看完整场？');
  if (pairFeedback.value.length) return;
  await game.execute({
    kind: 'matchFloorplan',
    pairs: [`WARD=${pairs.ward}`, `DESK=${pairs.desk}`, `SEAT=${pairs.seat}`],
  });
}

// —— M-7 ——
const m7Choice = ref('');
const m7Evidence = ref<string[]>([]);
const m7Feedback = ref<string[]>([]);
async function submitM7(): Promise<void> {
  const result = checkM7(game.state, m7Choice.value, m7Evidence.value as never);
  m7Feedback.value = result.conflicts;
  if (!result.ok) {
    await game.execute({ kind: 'puzzleAttempt', puzzleId: 'm7', choiceKeys: [m7Choice.value, ...m7Evidence.value], feedbackKey: result.feedbackKey });
    return;
  }
  await game.execute({ kind: 'inferMasque', evidenceIds: m7Evidence.value as never });
}

// —— p3 三联 ——
const p3 = reactive({ action: '', seat: '', cause: '' });
const p3Feedback = ref<string[]>([]);
async function submitP3(): Promise<void> {
  const result = checkP3(game.state, p3.action, p3.seat, p3.cause as 'SELF' | 'REPLAY');
  p3Feedback.value = result.conflicts;
  if (!result.ok) {
    await game.execute({ kind: 'puzzleAttempt', puzzleId: 'p3', choiceKeys: [p3.action, p3.seat, p3.cause], feedbackKey: result.feedbackKey });
    return;
  }
  await game.execute({ kind: 'linkAudience' });
}

// —— 文学卡 ——
type CardId = 'M-7' | 'W-F' | 'R-NM' | 'U-R';
const cardVisible = (id: CardId): boolean =>
  id === 'M-7' ? facts.value.masqueInferred : id === 'W-F' ? facts.value.masqueInferred : id === 'R-NM' ? facts.value.dualSourceProven : facts.value.trailForkCreated;
const cardLoaded = (id: CardId): boolean =>
  game.state.events.some((e) => e.code === 'LOAD_CARD' && (e.payload as { cardId: string }).cardId === id);

// —— 陈述（R06 随 closureProven 在 P03；此处只提示）——
const st6Unlocked = computed(() => statementUnlocked(game.state, 'ST_R06'));
</script>

<template>
  <div class="archive">
    <h1>地方档案 · 澄湾片区</h1>
    <p class="muted">archive.chengwan.local · 馆藏原件与读者研究卡。</p>

    <!-- 区域一：两张图 -->
    <section class="panel">
      <h2>区域一 · 两张图</h2>
      <button
        v-if="!ev15"
        class="primary"
        data-testid="p07:open-ev15"
        @click="game.execute({ kind: 'openDoc', documentId: 'THEATER_MAP' })"
      >
        调出旧剧场平面图（EV15）
      </button>
      <template v-else>
        <p class="ok small">✓ EV15 已取得。</p>
        <div class="maps">
          <figure>
            <svg viewBox="0 0 1000 700" role="img" aria-label="旧剧场平面图：外墙内左侧为后台，中部有提词位，右下为观众席外席">
              <path :d="BASE" class="wall" />
              <rect v-bind="LEFT" class="room" />
              <text :x="LEFT.x + 20" :y="LEFT.y + 40">后台</text>
              <rect v-bind="DESK" class="room" />
              <text :x="DESK.x + 8" :y="DESK.y + 55">提词位</text>
              <circle :cx="SEAT.x" :cy="SEAT.y" :r="SEAT.r" class="room" />
              <text :x="SEAT.x - 40" :y="SEAT.y - 60">观众席外席</text>
            </svg>
            <figcaption>旧剧场平面图（1979 测绘）</figcaption>
          </figure>
          <figure :style="{ opacity: opacity / 100 }">
            <svg viewBox="0 0 1000 700" role="img" aria-label="医院平面图：外墙内左侧为病房区，中部有护士站，右下为复核终端">
              <path :d="BASE" class="wall" />
              <rect v-bind="LEFT" class="room" />
              <text :x="LEFT.x + 20" :y="LEFT.y + 40">病房区</text>
              <rect v-bind="DESK" class="room" />
              <text :x="DESK.x + 8" :y="DESK.y + 55">护士站</text>
              <circle :cx="SEAT.x" :cy="SEAT.y" :r="SEAT.r" class="room" />
              <text :x="SEAT.x - 40" :y="SEAT.y - 60">复核终端</text>
            </svg>
            <figcaption>澄湾康复中心平面图（2026）</figcaption>
          </figure>
        </div>
        <label class="small slider">
          叠合透明度：<input type="range" v-model.number="opacity" min="20" max="100" data-testid="p07:opacity" aria-label="两图叠合透明度" />
          （拖动只帮助观察，不构成完成配对）
        </label>
        <table class="positions small" data-testid="p07:position-table">
          <caption>文字位置表（与图等价）</caption>
          <thead><tr><th>图上位置</th><th>剧场图</th><th>医院图</th></tr></thead>
          <tbody>
            <tr><td>左侧大区 (100,120,230,400)</td><td>后台</td><td>病房区</td></tr>
            <tr><td>中部方间 (360,250,100,100)</td><td>提词位</td><td>护士站</td></tr>
            <tr><td>右下圆席 (690,470)</td><td>观众席外席</td><td>复核终端</td></tr>
          </tbody>
        </table>

        <fieldset v-if="!ev16" class="pairing">
          <legend>把医院的功能配到剧场位置上</legend>
          <label>病房区 ↔
            <select v-model="pairs.ward" data-testid="p07:pair--ward"><option value="">（选择）</option><option v-for="o in PAIR_OPTIONS" :key="o" :value="o">{{ o }}</option></select>
          </label>
          <label>护士站 ↔
            <select v-model="pairs.desk" data-testid="p07:pair--desk"><option value="">（选择）</option><option v-for="o in PAIR_OPTIONS" :key="o" :value="o">{{ o }}</option></select>
          </label>
          <label>复核终端 ↔
            <select v-model="pairs.seat" data-testid="p07:pair--seat"><option value="">（选择）</option><option v-for="o in PAIR_OPTIONS" :key="o" :value="o">{{ o }}</option></select>
          </label>
          <button class="primary" data-testid="p07:submit-pairs" @click="submitPairs">提交空间匹配</button>
          <ul v-if="pairFeedback.length" class="feedback"><li v-for="(f, i) in pairFeedback" :key="i">{{ f }}</li></ul>
        </fieldset>
        <p v-else class="ok">✓ 空间匹配完成（EV16）。<SourceInspector id="EV16" /></p>
      </template>
    </section>

    <!-- 区域二：M-7 -->
    <section v-if="facts.timelineSolved" class="panel">
      <h2>区域二 · 研究卡 M-7《七层之下》</h2>
      <p v-if="cardLoaded('M-7')" class="muted small">读者研究卡 M-7 · {{ content.literature['M-7'].work }}</p>
      <button v-if="!ev17" data-testid="p07:open-ev17" @click="game.execute({ kind: 'openDoc', documentId: 'EV17' })">
        打开七层架构与审计材料（EV17）
      </button>
      <template v-else>
        <p class="ok small">✓ EV17 已取得。<SourceInspector id="EV17" /></p>
        <fieldset v-if="!facts.masqueInferred" class="m7form">
          <legend>选择架构假说并提交空间证据</legend>
          <label>假说：
            <select v-model="m7Choice" data-testid="p07:m7-choice">
              <option value="">（选择）</option>
              <option value="INSIDE_STRUCTURE">内部结构：模板与授权来自系统内部的迁移结构</option>
              <option value="EXTERNAL_INTRUSION">外部入侵：有人从外部改写了数据</option>
            </select>
          </label>
          <p class="small">引用证据：</p>
          <label class="marker small"><input type="checkbox" value="EV17" v-model="m7Evidence" data-testid="p07:m7-ev--EV17" /> EV17 架构与审计</label>
          <label class="marker small"><input type="checkbox" value="EV16" v-model="m7Evidence" data-testid="p07:m7-ev--EV16" /> EV16 空间匹配</label>
          <label class="marker small"><input type="checkbox" value="EV15" v-model="m7Evidence" data-testid="p07:m7-ev--EV15" /> EV15 旧剧场图（干扰项）</label>
          <button class="primary" data-testid="p07:submit-m7" @click="submitM7">提交假说</button>
          <ul v-if="m7Feedback.length" class="feedback"><li v-for="(f, i) in m7Feedback" :key="i">{{ f }}</li></ul>
        </fieldset>
        <p v-else class="ok">✓ M-7 判断完成：本批材料优先支持内部结构假说。</p>
      </template>
      <HintPanel v-if="!facts.masqueInferred" puzzle-id="m7" />
    </section>
    <p v-else class="muted">区域二的读者卡需要先完成发药页的五份材料时间线（p2）。</p>

    <!-- 区域三：W-F 与 p3 -->
    <section v-if="facts.masqueInferred" class="panel">
      <h2>区域三 · 研究卡 W-F 与第七排</h2>
      <blockquote class="literature">
        <p>{{ content.literature['W-F'].excerpt }}</p>
        <footer class="muted small">—— {{ content.literature['W-F'].work }}（{{ content.literature['W-F'].edition }}）</footer>
      </blockquote>
      <p class="muted small">读这段引文：戏的末段，观众在做什么？坐在哪里？</p>

      <fieldset v-if="!facts.audienceConfirmed" class="p3form">
        <legend>三联判断</legend>
        <label>观众的行为：
          <select v-model="p3.action" data-testid="p07:p3-action">
            <option value="">（选择）</option>
            <option value="AFFIRM_ENDING">确认并命名终局</option>
            <option value="WATCH_ONLY">只是安静观看</option>
            <option value="DEMAND_REPEAT">要求再演一遍</option>
          </select>
        </label>
        <label>外席的位置：
          <select v-model="p3.seat" data-testid="p07:p3-seat">
            <option value="">（选择）</option>
            <option value="SEAT_W07">第七排中央外席</option>
            <option value="SEAT_A1">一层第一排</option>
            <option value="BACKSTAGE">后台</option>
          </select>
        </label>
        <label>本批实际触发来源：
          <select v-model="p3.cause" data-testid="p07:p3-cause">
            <option value="">（选择）</option>
            <option value="SELF">本局我提交的复核（SUBMIT_REVIEW）</option>
            <option value="REPLAY">历史签认 W06（RV_PREV_01 回放）</option>
          </select>
        </label>
        <button class="primary" data-testid="p07:submit-p3" @click="submitP3">提交三联</button>
        <ul v-if="p3Feedback.length" class="feedback"><li v-for="(f, i) in p3Feedback" :key="i">{{ f }}</li></ul>
      </fieldset>
      <template v-else>
        <p class="ok">✓ 剧场关系已确认：第七排中央外席 = 你的复核终端。</p>
        <button
          v-if="!ev18"
          data-testid="p07:open-ev18"
          @click="game.execute({ kind: 'openDoc', documentId: 'EV18' })"
        >
          打开第七份记录（EV18）
        </button>
        <p v-else class="ok small">✓ EV18 已取得：<em>{{ content.evidenceRegistry.find((e) => e.id === 'EV18')?.display.split('\n')[0] }}</em></p>
        <p><RouterLink to="/compare" data-testid="p07:goto-compare">去平行复核工作区 →</RouterLink></p>
      </template>
      <HintPanel v-if="!facts.audienceConfirmed" puzzle-id="p3" />
    </section>

    <!-- 区域四：文学卡回看 -->
    <section class="panel">
      <h2>区域四 · 研究卡回看</h2>
      <p class="muted small">站内已核对的短摘录始终可用；外部原文链接可选。</p>
      <article v-for="id in (['M-7', 'W-F', 'R-NM', 'U-R'] as CardId[])" :key="id" class="literature-card">
        <h3 v-if="cardVisible(id)">{{ id }} · {{ content.literature[id].work }}</h3>
        <template v-if="cardVisible(id)">
          <p>{{ content.literature[id].excerpt }}</p>
          <p class="muted small">
            版本：{{ content.literature[id].edition }}；核对日期：{{ content.literature[id].checkedOn }}。
            <a :href="content.literature[id].sourceUrl" target="_blank" rel="noopener noreferrer">原文入口（可选）</a>
          </p>
        </template>
        <p v-else class="muted">{{ id }} 号研究卡尚未解锁。</p>
      </article>
    </section>

    <p v-if="st6Unlocked && !facts.capturedStatements.includes('ST_R06')" class="notice">
      待补交班事项：R06 程枝有新的本人表达，可在
      <RouterLink to="/followup/patient/R06">病历页</RouterLink> 保留。
    </p>
  </div>
</template>

<style scoped>
.maps { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
.maps svg { width: 100%; height: auto; background: #fbf8f1; border: 1px solid var(--line); }
.wall { fill: none; stroke: var(--text); stroke-width: 4; }
.room { fill: #e4e9e4; stroke: var(--primary); stroke-width: 2; }
.maps text { font-size: 26px; fill: var(--text); }
figcaption { text-align: center; font-size: 0.85em; color: var(--muted); margin-top: var(--space-1); }
.pairing, .m7form, .p3form { display: grid; gap: var(--space-2); border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-3); margin-top: var(--space-2); max-width: 560px; }
.positions { margin-top: var(--space-2); }
.literature { border-left: 4px solid var(--primary); margin: var(--space-2) 0; padding-left: var(--space-3); }
.literature-card { border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-2) var(--space-3); margin: var(--space-2) 0; }
.feedback { color: var(--error); }
.slider { display: block; margin-top: var(--space-2); }
.small { font-size: 0.85em; }
.ok { color: var(--clinical); }
@media (max-width: 768px) { .maps { grid-template-columns: 1fr; } }
</style>
