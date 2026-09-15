<script setup lang="ts">
/**
 * P07 地方档案（docs/11 Batch 4 §2）：图纸叠合为主视觉操作；
 * 空间匹配后出现 W-F 主线卡；M-7/R-NM/U-R 收入馆藏资料架（可选深化材料）。
 */
import { computed, reactive, ref } from 'vue';
import { useGameStore } from '../stores/game';
import { content } from '../game/content';
import { isAcquired } from '../game/selectors';
import { checkP3 } from '../game/gates';
import AppIcon from '../components/AppIcon.vue';
import CompletionPanel from '../components/CompletionPanel.vue';
import HintPanel from '../components/HintPanel.vue';
import LiteratureExcerpt from '../components/LiteratureExcerpt.vue';
import SourceInspector from '../components/SourceInspector.vue';
import WalkthroughHint from '../components/WalkthroughHint.vue';

const game = useGameStore();
const facts = computed(() => game.state.facts);

const ev15 = computed(() => isAcquired(game.state, 'EV15'));
const ev16 = computed(() => isAcquired(game.state, 'EV16'));
const ev17 = computed(() => isAcquired(game.state, 'EV17'));
const ev18 = computed(() => isAcquired(game.state, 'EV18'));

// —— 图纸叠合（主视觉）：剧场图叠在医院图上，透明度为主操作 ——
const BASE = 'M80 60 H920 V640 H80 Z';
const LEFT = { x: 100, y: 120, w: 230, h: 400 };
const DESK = { x: 360, y: 250, w: 100, h: 100 };
const SEAT = { x: 690, y: 470, r: 46 };
const opacity = ref(55);
const viewMode = ref<'overlay' | 'side'>('overlay');

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

// —— W-F 主线卡（空间匹配后出现）＋ p3 三联 ——
const wfCard = ref<HTMLElement | null>(null);
function scrollToWf(): void {
  wfCard.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
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

// —— 馆藏资料架（可选深化材料）——
type CardId = 'M-7' | 'W-F' | 'R-NM' | 'U-R';
const cardLoaded = (id: CardId): boolean =>
  game.state.events.some((e) => e.code === 'LOAD_CARD' && (e.payload as { cardId: string }).cardId === id);
</script>

<template>
  <div class="archive">
    <h1>地方档案 · 澄湾片区</h1>
    <p class="muted">馆藏原件与读者研究卡。图纸来自地方馆藏，不在院内归档链内。</p>

    <!-- 主场景：图纸叠合 -->
    <section class="panel mapscene" aria-labelledby="map-h">
      <div class="scene-head">
        <h2 id="map-h"><AppIcon name="archive" :size="16" /> 图纸叠合：这座楼从前是什么？</h2>
        <div class="view-toggle" role="group" aria-label="图纸视图">
          <button :class="{ active: viewMode === 'overlay' }" data-testid="p07:view--overlay" @click="viewMode = 'overlay'">叠合</button>
          <button :class="{ active: viewMode === 'side' }" data-testid="p07:view--side" @click="viewMode = 'side'">并排</button>
        </div>
      </div>
      <button
        v-if="!ev15"
        class="primary"
        data-testid="p07:open-ev15"
        @click="game.execute({ kind: 'openDoc', documentId: 'THEATER_MAP' })"
      >
        调出馆藏《旧剧场平面图》 <small class="mono">EV15</small>
      </button>
      <template v-else>
        <p class="muted small">两份图纸相隔四十七年，墙体走向一致。拖动透明度，把剧场叠到医院上。</p>

        <div v-if="viewMode === 'overlay'" class="overlay-wrap">
          <figure class="overlay-fig">
            <svg viewBox="0 0 1000 700" role="img" aria-label="叠合图：医院平面（底层）与旧剧场平面（上层可调透明度），三个功能区位置重合">
              <path :d="BASE" class="wall" />
              <rect v-bind="LEFT" class="room hospital" />
              <text :x="LEFT.x + 20" :y="LEFT.y + 40" class="hospital-label">病房区</text>
              <rect v-bind="DESK" class="room hospital" />
              <text :x="DESK.x + 8" :y="DESK.y + 55" class="hospital-label">护士站</text>
              <circle :cx="SEAT.x" :cy="SEAT.y" :r="SEAT.r" class="room hospital" />
              <text :x="SEAT.x - 40" :y="SEAT.y - 60" class="hospital-label">复核终端</text>
              <g class="theater-layer" :style="{ opacity: opacity / 100 }">
                <rect v-bind="LEFT" class="room theater" />
                <text :x="LEFT.x + 20" :y="LEFT.y + 78">后台</text>
                <rect v-bind="DESK" class="room theater" />
                <text :x="DESK.x + 8" :y="DESK.y + 22">提词位</text>
                <circle :cx="SEAT.x" :cy="SEAT.y" :r="SEAT.r" class="room theater" />
                <text :x="SEAT.x - 40" :y="SEAT.y + 76">观众席外席</text>
              </g>
            </svg>
            <figcaption>叠合视图 · 剧场图（1979 测绘）压在康复中心平面图（2026）之上</figcaption>
          </figure>
        </div>
        <div v-else class="maps">
          <figure>
            <svg viewBox="0 0 1000 700" role="img" aria-label="旧剧场平面图：外墙内左侧为后台，中部有提词位，右下为观众席外席">
              <path :d="BASE" class="wall" />
              <rect v-bind="LEFT" class="room theater" />
              <text :x="LEFT.x + 20" :y="LEFT.y + 40">后台</text>
              <rect v-bind="DESK" class="room theater" />
              <text :x="DESK.x + 8" :y="DESK.y + 55">提词位</text>
              <circle :cx="SEAT.x" :cy="SEAT.y" :r="SEAT.r" class="room theater" />
              <text :x="SEAT.x - 40" :y="SEAT.y - 60">观众席外席</text>
            </svg>
            <figcaption>旧剧场平面图（1979 测绘）</figcaption>
          </figure>
          <figure>
            <svg viewBox="0 0 1000 700" role="img" aria-label="医院平面图：外墙内左侧为病房区，中部有护士站，右下为复核终端">
              <path :d="BASE" class="wall" />
              <rect v-bind="LEFT" class="room hospital" />
              <text :x="LEFT.x + 20" :y="LEFT.y + 40" class="hospital-label">病房区</text>
              <rect v-bind="DESK" class="room hospital" />
              <text :x="DESK.x + 8" :y="DESK.y + 55" class="hospital-label">护士站</text>
              <circle :cx="SEAT.x" :cy="SEAT.y" :r="SEAT.r" class="room hospital" />
              <text :x="SEAT.x - 40" :y="SEAT.y - 60" class="hospital-label">复核终端</text>
            </svg>
            <figcaption>澄湾康复中心平面图（2026）</figcaption>
          </figure>
        </div>

        <label class="small slider">
          剧场图透明度：<input type="range" v-model.number="opacity" min="20" max="100" data-testid="p07:opacity" aria-label="剧场图叠合透明度" />
          （拖动只帮助观察，不构成完成配对）
        </label>
        <table class="positions small" data-testid="p07:position-table">
          <caption>馆藏位置对照表（与图等价）</caption>
          <thead><tr><th>图上位置</th><th>剧场图</th><th>医院图</th></tr></thead>
          <tbody>
            <tr><td>左侧大区</td><td>后台</td><td>病房区</td></tr>
            <tr><td>中部方间</td><td>提词位</td><td>护士站</td></tr>
            <tr><td>右下圆席</td><td>观众席外席</td><td>复核终端</td></tr>
          </tbody>
        </table>

        <fieldset v-if="!ev16" class="pairing">
          <legend>把医院的功能配到剧场位置上</legend>
          <WalkthroughHint>病房区 ↔ 后台；护士站 ↔ 提词位；复核终端 ↔ 观众席外席。</WalkthroughHint>
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
        <template v-else>
          <p class="ok small">✓ 空间匹配完成。<SourceInspector id="EV16" /></p>
          <CompletionPanel
            testid="p07:match-done"
            proved="这是同一座楼。病房区就是后台，护士站就是提词位，你坐的位置，是观众席的外席。"
            excluded="不是「长得像」。墙的走向，四十七年没变过。"
            opened="馆藏里有一张读者卡 W-F《征服者蠕虫》，讲的正是落幕时观众做了什么。"
            action-label="去读 W-F 研究卡"
            @action="scrollToWf"
          />
        </template>
      </template>
    </section>

    <!-- 主线：W-F 与第七排（空间匹配后出现） -->
    <section v-if="facts.floorplanMatched" ref="wfCard" class="panel wfcard" aria-labelledby="wf-h">
      <h2 id="wf-h">读者研究卡 W-F ·《征服者蠕虫》</h2>
      <p class="muted small">馆藏编号 CW-ARC-WF。这张卡只回答一个问题：戏的末段，观众在做什么？</p>
      <LiteratureExcerpt id="W-F" />
      <p class="muted small">
        空间已经同构。剩下的是关系：谁在台上，谁在台下，谁说了“结束”。
      </p>

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
            <option value="SELF">本局我提交的复核</option>
            <option value="REPLAY">历史签认 W06（回放）</option>
          </select>
        </label>
        <button class="primary" data-testid="p07:submit-p3" @click="submitP3">提交三联</button>
        <ul v-if="p3Feedback.length" class="feedback"><li v-for="(f, i) in p3Feedback" :key="i">{{ f }}</li></ul>
        <HintPanel puzzle-id="p3" />
      </fieldset>
      <template v-else>
        <p class="ok">✓ 剧场关系已确认：第七排中央外席＝你的复核终端——W07 是流程里的一个座位，不是旁观者。</p>
        <button
          v-if="!ev18"
          data-testid="p07:open-ev18"
          @click="game.execute({ kind: 'openDoc', documentId: 'EV18' })"
        >
          打开《第七份记录》 <small class="mono">EV18</small>
        </button>
        <template v-else>
          <p class="ok small">✓《第七份记录》已取得：那份记录写的就是这个座位。<SourceInspector id="EV18" /></p>
          <CompletionPanel
            testid="p07:wf-done"
            proved="对上了：外部见证，就是观众确认终局。你那个座位，恰好坐得住一场终局。"
            excluded="别再说自己只是旁观。第七份记录写得明白：这个座位本来就是流程的一部分。"
            opened="两份结论相反的文档，在平行复核工作区等你。"
            action-label="去平行复核工作区"
            action-to="/compare"
          />
        </template>
      </template>
    </section>

    <!-- 馆藏资料架：可选深化材料 -->
    <section class="panel shelf" aria-labelledby="shelf-h">
      <h2 id="shelf-h">馆藏资料架</h2>
      <p class="muted small">可选深化材料：帮助理解，不做通关门槛；不影响结局。</p>

      <article v-if="facts.timelineSolved" class="literature-card">
        <h3>短材料 ·《红死病的假面》摘录 <small class="mono">M-7</small></h3>
        <LiteratureExcerpt id="M-7" />
        <p class="muted small">
          读者批注：内部成因先于外部入侵——与“迁移结构自身覆盖身份”的读法互证（游戏假说，非原作结论）。
          版本：{{ content.literature['M-7'].edition }}；核对日期：{{ content.literature['M-7'].checkedOn }}。
        </p>
        <button v-if="!ev17" data-testid="p07:open-ev17" @click="game.execute({ kind: 'openDoc', documentId: 'EV17' })">
          打开《七层架构及审计》 <small class="mono">EV17</small>
        </button>
        <p v-else class="ok small">✓《七层架构及审计》已取得。<SourceInspector id="EV17" /></p>
      </article>
      <p v-else class="muted small">时间线重排完成后，这里会摆上一份关于“内部结构”的短材料。</p>

      <article v-if="facts.dualSourceProven" class="literature-card">
        <h3>可选解释卡 ·《乌鸦》摘录 <small class="mono">R-NM</small></h3>
        <LiteratureExcerpt id="R-NM" />
        <p class="muted small">同一个声音被译成两种回答——这张卡放在实验台旁更好用（单变量实验页内也有）。</p>
      </article>

      <article v-if="facts.trailForkCreated" class="literature-card">
        <h3>主线卡 ·《厄舍府的倒塌》摘录 <small class="mono">U-R</small></h3>
        <LiteratureExcerpt id="U-R" />
        <p class="muted small">用于判断文字与声音谁先发生——录音台章节的主线材料。</p>
      </article>

      <article v-if="cardLoaded('W-F')" class="literature-card">
        <h3>已读回看 · W-F《征服者蠕虫》</h3>
        <p class="muted small">站内摘录随时可回看；
          <a :href="content.literature['W-F'].sourceUrl" target="_blank" rel="noopener noreferrer">外部原文入口（可选）</a>。
        </p>
      </article>
    </section>
  </div>
</template>

<style scoped>
.scene-head { display: flex; justify-content: space-between; align-items: center; gap: var(--space-3); flex-wrap: wrap; }
.scene-head h2 { display: flex; align-items: center; gap: var(--space-2); margin: 0; }
.view-toggle { display: inline-flex; border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; }
.view-toggle button { min-height: 34px; border: 0; border-radius: 0; background: transparent; padding: 0 var(--space-3); }
.view-toggle button.active { background: #795d3d; color: #fff; }
.overlay-wrap { margin-top: var(--space-3); }
.overlay-fig { margin: 0; }
.overlay-fig svg { width: 100%; height: auto; background: #fbf8f1; border: 1px solid #ad9e89; }
.maps { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-top: var(--space-3); }
.maps svg { width: 100%; height: auto; background: #fbf8f1; border: 1px solid var(--line); }
.wall { fill: none; stroke: var(--text); stroke-width: 4; }
.room { fill: #e4e9e4; stroke: #5d7a70; stroke-width: 2; }
.room.theater { fill: rgba(121, 93, 61, 0.18); stroke: #795d3d; stroke-dasharray: 6 4; }
svg text { font-size: 26px; fill: var(--text); }
svg text.hospital-label { fill: #44625a; }
figcaption { text-align: center; font-size: 0.85em; color: var(--muted); margin-top: var(--space-1); }
.pairing, .p3form { display: grid; gap: var(--space-2); border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-3); margin-top: var(--space-2); max-width: 560px; }
.positions { margin-top: var(--space-2); }
.literature { border-left: 4px solid #795d3d; margin: var(--space-2) 0; padding-left: var(--space-3); }
.literature-card { border: 1px dashed #ad9e89; border-radius: var(--radius); padding: var(--space-2) var(--space-3); margin: var(--space-2) 0; background: rgba(251, 248, 240, 0.6); }
.literature-card h3 { font-size: 0.95em; margin: 0 0 var(--space-1); }
.wfcard { margin-top: var(--space-4); border-top: 3px solid #795d3d; }
.shelf { margin-top: var(--space-4); }
.feedback { color: var(--error); }
.slider { display: block; margin-top: var(--space-2); }
.small { font-size: 0.85em; }
.ok { color: var(--clinical); }
@media (max-width: 768px) { .maps { grid-template-columns: 1fr; } }
</style>
