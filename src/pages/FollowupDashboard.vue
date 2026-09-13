<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useGameStore } from '../stores/game';
import { content, resolveContent } from '../game/content';
import { dialogue } from '../game/content';
import AppIcon from '../components/AppIcon.vue';

const router = useRouter();
const game = useGameStore();
const facts = computed(() => game.state.facts);
const phase = computed(() => game.state.lastMainPhase);
const ending = computed(() => game.state.ending);
const search = ref('');

// 演员名单一次性演出 cue（不参与 gate）
const actorListFlash = ref(false);
onMounted(() => {
  if (phase.value === 'THEATER_DISCOVERED' && !game.save.seenPresentationCues.includes('actor-list')) {
    actorListFlash.value = true;
    setTimeout(() => {
      actorListFlash.value = false;
      game.markPresentationCue('actor-list');
    }, 8000);
  }
});

const title = computed(() =>
  actorListFlash.value ? '演员名单' : '病历列表',
);

interface Row {
  id: string;
  bed: string;
  name: string;
  status: string;
  blank: boolean;
}

const rows = computed<Row[]>(() => {
  const list: Row[] = [];
  for (const id of ['R01', 'R02', 'R03', 'R04', 'R05', 'R06']) {
    const p = content.patients[id];
    if (id === 'R03') {
      const name = resolveContent('patients.R03.name', phase.value, ending.value);
      list.push({
        id,
        bed: id,
        name,
        status:
          phase.value === 'BOOT'
            ? '待外部复核'
            : phase.value === 'R03_PREARCHIVED'
              ? '记录关联缺失'
              : '待整批复核',
        blank: name === '',
      });
    } else {
      list.push({ id, bed: id, name: p.name, status: '资料待补', blank: false });
    }
  }
  if (
    ['CLOSURE_PROVEN', 'TRAIL_FORKED', 'AUDIO_RECOVERED', 'SCOPE_LIMITED', 'SURGERY_READY'].includes(phase.value) ||
    ending.value
  ) {
    list.push({ id: 'W07', bed: '—', name: 'W07', status: ending.value === 'A' ? '观察目的已完成' : '外部见证', blank: false });
  }
  return list;
});

const filtered = computed(() => {
  const q = search.value.trim();
  if (!q) return rows.value;
  return rows.value.filter((r) => !r.blank && (r.name.includes(q) || r.bed.toLowerCase().includes(q.toLowerCase())));
});

const registered = computed(() => {
  if (ending.value === 'A') return 0;
  if (phase.value === 'BOOT') return 6;
  if (phase.value === 'R03_PREARCHIVED') return 5;
  return 6;
});
const pendingReview = computed(() => (phase.value === 'BOOT' ? 1 : 0));
const followupCount = computed(() =>
  ending.value === 'A' ? 0 : ending.value === 'C' ? 6 : registered.value,
);

function goPatient(id: string): void {
  if (id === 'W07') return;
  router.push(`/followup/patient/${id}`);
}
</script>

<template>
  <div class="dashboard">
    <header class="page-intro">
      <p class="eyebrow mono">PATIENT INDEX / BATCH 0617</p>
      <h1 data-testid="p02:list-title">{{ title }}</h1>
      <p>这是今晚交给 W07 的六人名单。先处理唯一一份待外部复核记录。</p>
    </header>

    <div class="stats" role="status">
      <div><AppIcon name="users" /><span>当前在册<strong data-testid="p02:count">{{ registered }}</strong></span></div>
      <div><AppIcon name="clipboard" /><span>待外部复核<strong>{{ pendingReview }}</strong></span></div>
      <div><AppIcon name="trail" /><span>待后续随访<strong>{{ followupCount }}</strong></span></div>
    </div>

    <div v-if="phase === 'BOOT' && !facts.r03Prearchived" class="task-callout">
      <div class="callout-icon"><AppIcon name="clipboard" :size="24" /></div>
      <div>
        <p class="callout-kicker">当前任务 · 唯一待办</p>
        <h2>核对 R03 许棠的护理事实</h2>
        <p>她的当日记录已经齐备，系统预填为“正向／康复”。提交前请先阅读本人补记和授权范围。</p>
      </div>
      <RouterLink to="/followup/review/R03" class="button primary" data-testid="p02:goto-review">
        开始复核 R03 <AppIcon name="arrow" :size="17" />
      </RouterLink>
    </div>
    <div v-if="facts.r03Prearchived && !facts.r03IdentityRestored" class="task-callout anomaly" data-testid="p02:prearchive-notice">
      <div class="callout-icon"><AppIcon name="warning" :size="24" /></div>
      <div>
        <p class="callout-kicker">异常复查 · 在册 6 → 5</p>
        <h2>R03 的姓名联系刚刚消失</h2>
        <p>{{ dialogue.system.prearchiveNotice }} 对照复核前名单、今日发药和出院去向，判断少掉的是重复数据还是一个人。</p>
      </div>
      <RouterLink to="/medication" class="button primary" data-testid="p02:goto-medication">
        打开调查工作台 <AppIcon name="arrow" :size="17" />
      </RouterLink>
    </div>
    <div v-if="facts.r03IdentityRestored" class="task-callout restored">
      <div class="callout-icon"><AppIcon name="check" :size="24" /></div>
      <div>
        <p class="callout-kicker">身份联系已恢复</p>
        <h2>R03 再次指向许棠</h2>
        <p>{{ dialogue.system.restoreFeedback }} 这不代表异常已经解除；下一步要重建复核发生前后的时间线。</p>
      </div>
      <RouterLink to="/medication" class="button" data-testid="p02:goto-timeline">
        继续时间线复查 <AppIcon name="arrow" :size="17" />
      </RouterLink>
    </div>
    <div v-if="ending === 'A'" class="notice">康复率：100% ｜ 当前患者：0 ｜ 待随访：0</div>
    <div v-if="ending === 'B'" class="notice">六份记录：封存 · 仍待联系</div>
    <div v-if="ending === 'C'" class="notice">本次确认出院：0 ｜ 已恢复后续随访：6</div>

    <div class="list-head">
      <div><h2>六人索引</h2><p>点击任一行查看身份、护理事实和本人表达。</p></div>
      <label class="search">
      <AppIcon name="evidence" :size="17" />
      <input
        type="search"
        v-model="search"
        data-testid="p02:search"
        placeholder="姓名或床位号"
        aria-label="搜索患者"
      />
      <span class="muted">{{ filtered.length }} 条记录</span>
      </label>
    </div>

    <table>
      <thead>
        <tr><th scope="col">床位</th><th scope="col">姓名</th><th scope="col">状态</th></tr>
      </thead>
      <tbody>
        <tr
          v-for="r in filtered"
          :key="r.id"
          :data-testid="`p02:patient-row--${r.id}`"
          :aria-label="r.blank ? '记录关联缺失' : `${r.bed} ${r.name}`"
          :class="{ blank: r.blank }"
          tabindex="0"
          @keydown.enter="goPatient(r.id)"
          @click="goPatient(r.id)"
        >
          <td class="mono">{{ r.bed }}</td>
          <td>
            <span v-if="r.blank" class="blankcell" aria-hidden="true">—</span>
            <template v-else>
              {{ r.name }}
              <span v-if="r.id === 'R03' && facts.r03IdentityRestored" class="badge">{{
                resolveContent('patients.R03.nameEvidenceTag', phase, ending)
              }}</span>
            </template>
          </td>
          <td :class="{ 'anomaly-text': r.status === '记录关联缺失' }">
            <span class="status-dot" :class="{ danger: r.status === '记录关联缺失', active: r.status === '待外部复核' }" aria-hidden="true"></span>
            {{ r.status }}
          </td>
        </tr>
      </tbody>
    </table>
    <p class="muted tip"><AppIcon name="check" :size="15" /> 查看病历不会改变记录。只有带确认步骤的提交会推进案件。</p>
  </div>
</template>

<style scoped>
.page-intro { max-width: 720px; margin-bottom: var(--space-5); }
.eyebrow { margin: 0 0 var(--space-2); color: var(--clinical); font-size: .7rem; font-weight: 750; letter-spacing: .12em; }
.page-intro h1 { margin-bottom: var(--space-2); }
.page-intro > p:last-child { margin: 0; color: var(--muted); }
.stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-3); margin: 0 0 var(--space-4); }
.stats > div { display: grid; grid-template-columns: 36px 1fr; gap: var(--space-3); align-items: center; border: 1px solid rgba(164,180,171,.72); border-radius: var(--radius); padding: var(--space-3) var(--space-4); background: rgba(249,251,249,.88); box-shadow: var(--shadow-xs); color: var(--clinical); }
.stats span { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-3); color: var(--muted); font-size: .75rem; }
.stats strong { color: var(--text-strong); font-family: var(--font-mono); font-size: 1.45rem; }
.task-callout { display: grid; grid-template-columns: 52px minmax(0, 1fr) auto; gap: var(--space-4); align-items: center; margin-bottom: var(--space-5); border: 1px solid #a9935d; border-radius: var(--radius-lg); padding: var(--space-4); background: linear-gradient(110deg, rgba(248,240,218,.98), rgba(250,248,240,.96)); box-shadow: var(--shadow-sm); }
.task-callout.anomaly { border-color: #a85a53; background: linear-gradient(110deg, rgba(248,229,225,.98), rgba(251,246,242,.96)); }
.task-callout.restored { border-color: #6f9883; background: linear-gradient(110deg, rgba(225,239,231,.98), rgba(247,250,248,.96)); }
.callout-icon { display: grid; width: 48px; height: 48px; place-items: center; border-radius: 50%; background: #84601a; color: #fff; }
.anomaly .callout-icon { background: var(--anomaly); }
.restored .callout-icon { background: var(--clinical); }
.callout-kicker { margin: 0; color: var(--warning); font-size: .69rem; font-weight: 750; letter-spacing: .08em; }
.anomaly .callout-kicker { color: var(--anomaly); }
.restored .callout-kicker { color: var(--clinical); }
.task-callout h2 { margin: 2px 0 var(--space-1); font-size: 1.12rem; }
.task-callout p:not(.callout-kicker) { margin: 0; color: var(--muted); font-size: .8rem; line-height: 1.6; }
.task-callout .button { min-width: 190px; justify-content: space-between; }
.list-head { display: flex; align-items: end; justify-content: space-between; gap: var(--space-4); margin: var(--space-5) 0 var(--space-3); }
.list-head h2 { margin: 0; }
.list-head p { margin: 2px 0 0; color: var(--muted); font-size: .75rem; }
.search { display: flex; gap: var(--space-2); align-items: center; flex-wrap: wrap; }
.search input { min-width: 220px; }
tbody tr { cursor: pointer; }
tbody tr:hover { background: #e5eee8; }
.blank td { background: repeating-linear-gradient(45deg, #eef1ef, #eef1ef 6px, #e6eae7 6px, #e6eae7 12px); }
.blankcell { opacity: 0.25; }
.status-dot { display: inline-block; width: 7px; height: 7px; margin-right: 7px; border-radius: 50%; background: #a9b6af; }
.status-dot.active { background: #bc8121; box-shadow: 0 0 0 4px rgba(188,129,33,.11); }
.status-dot.danger { background: var(--anomaly); box-shadow: 0 0 0 4px rgba(150,54,48,.1); }
.tip { display: flex; align-items: center; gap: var(--space-2); font-size: .76em; }

@media (max-width: 760px) {
  .stats { grid-template-columns: 1fr; }
  .task-callout { grid-template-columns: 46px 1fr; }
  .task-callout .button { grid-column: 1 / -1; width: 100%; }
  .list-head { align-items: stretch; flex-direction: column; }
  .search input { min-width: 0; flex: 1; }
}
</style>
