<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useGameStore } from '../stores/game';
import { content, resolveContent } from '../game/content';
import { dialogue } from '../game/content';

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
    <h1 data-testid="p02:list-title">{{ title }}</h1>
    <div class="stats" role="status">
      <span>在册 <strong data-testid="p02:count">{{ registered }}</strong></span>
      <span>待外部复核 <strong>{{ pendingReview }}</strong></span>
      <span>待随访 <strong>{{ followupCount }}</strong></span>
    </div>

    <div v-if="phase === 'BOOT' && !facts.r03Prearchived" class="notice">
      R03 待外部复核。
      <RouterLink to="/followup/review/R03" data-testid="p02:goto-review">前往复核页 →</RouterLink>
    </div>
    <div v-if="facts.r03Prearchived && !facts.r03IdentityRestored" class="notice" data-testid="p02:prearchive-notice">
      {{ dialogue.system.prearchiveNotice }}
      <RouterLink to="/medication" data-testid="p02:goto-medication">去发药与出院对照发起复查 →</RouterLink>
    </div>
    <div v-if="facts.r03IdentityRestored" class="notice">
      {{ dialogue.system.restoreFeedback }}
      <RouterLink to="/medication" data-testid="p02:goto-timeline">复查工作区：发药对照与时间线 →</RouterLink>
    </div>
    <div v-if="ending === 'A'" class="notice">康复率：100% ｜ 当前患者：0 ｜ 待随访：0</div>
    <div v-if="ending === 'B'" class="notice">六份记录：封存 · 仍待联系</div>
    <div v-if="ending === 'C'" class="notice">本次确认出院：0 ｜ 已恢复后续随访：6</div>

    <label class="search">
      搜索：
      <input
        type="search"
        v-model="search"
        data-testid="p02:search"
        placeholder="姓名或床位号"
        aria-label="搜索患者"
      />
      <span class="muted">{{ filtered.length }} 条记录</span>
    </label>

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
          <td :class="{ 'anomaly-text': r.status === '记录关联缺失' }">{{ r.status }}</td>
        </tr>
      </tbody>
    </table>
    <p class="muted tip">点击行查看病历详情。搜索为 0 时，可从叙事轨迹或复查入口继续调查。</p>
  </div>
</template>

<style scoped>
.stats { display: flex; gap: var(--space-5); margin: var(--space-3) 0; flex-wrap: wrap; }
.search { display: flex; gap: var(--space-2); align-items: center; margin: var(--space-3) 0; flex-wrap: wrap; }
tbody tr { cursor: pointer; }
tbody tr:hover { background: #eef1ef; }
.blank td { background: repeating-linear-gradient(45deg, #eef1ef, #eef1ef 6px, #e6eae7 6px, #e6eae7 12px); }
.blankcell { opacity: 0.25; }
.tip { font-size: 0.85em; }
h1 { font-size: 1.25em; margin: 0; }
</style>
