<script setup lang="ts">
/** P14 下一班与最终处理（docs/03册 v1.1 §3）：六人×三类依据（p8）+ 三种正式方案的原子事务。 */
import { computed, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useGameStore } from '../stores/game';
import { content, dialogue } from '../game/content';
import { checkP8 } from '../game/gates';
import { isAcquired } from '../game/selectors';
import type { EdgeId, EndingId, IdentityRef, StatementId } from '../game/types';
import HintPanel from '../components/HintPanel.vue';

const game = useGameStore();
const router = useRouter();
const facts = computed(() => game.state.facts);
const PATIENTS = ['R01', 'R02', 'R03', 'R04', 'R05', 'R06'] as const;
type Pid = (typeof PATIENTS)[number];

const ev01 = computed(() => isAcquired(game.state, 'EV01'));
const ev02 = computed(() => isAcquired(game.state, 'EV02'));
const ev27 = computed(() => isAcquired(game.state, 'EV27'));

// —— 槽位（草稿持久化；返回不清除）——
const slots = reactive({
  identity: JSON.parse(JSON.stringify(game.save.drafts.nextVisitSlots.identity)) as Partial<Record<Pid, IdentityRef>>,
  intent: JSON.parse(JSON.stringify(game.save.drafts.nextVisitSlots.intent)) as Partial<Record<Pid, StatementId>>,
  chain: game.save.drafts.nextVisitSlots.chain,
});
function persist(): void {
  game.updateDrafts((d) => {
    d.nextVisitSlots = JSON.parse(JSON.stringify({ identity: slots.identity, intent: slots.intent, chain: slots.chain }));
  });
}
function identityOptions(pid: Pid): { value: IdentityRef; label: string }[] {
  const opts: { value: IdentityRef; label: string }[] = [];
  if (ev01.value) opts.push({ value: `EV01#${pid}`, label: `EV01 交接联 · ${pid} 身份子记录` });
  if (ev02.value) opts.push({ value: `EV02#${pid}`, label: `EV02 快照 · ${pid} 身份子记录` });
  return opts;
}
function stCaptured(pid: Pid): boolean {
  return facts.value.capturedStatements.includes(`ST_${pid}` as StatementId);
}
// 已采集的陈述在对应槽位就位（仍可改动归属前被 p8 校验拦截）
watch(
  () => facts.value.capturedStatements,
  (list) => {
    for (const pid of PATIENTS) {
      if (list.includes(`ST_${pid}` as StatementId) && !slots.intent[pid]) {
        slots.intent[pid] = `ST_${pid}` as StatementId;
      }
    }
  },
  { immediate: true },
);
const ST_PAGE: Record<Pid, { label: string; to: string }> = {
  R01: { label: '去病友留言板', to: '/forum' },
  R02: { label: '去病友留言板', to: '/forum' },
  R03: { label: '去交班录音台', to: '/audio/channel-03' },
  R04: { label: '去病历页', to: '/followup/patient/R04' },
  R05: { label: '去病历页', to: '/followup/patient/R05' },
  R06: { label: '去病历页', to: '/followup/patient/R06' },
};

const p8Feedback = ref<string[]>([]);
async function assemble(): Promise<void> {
  const result = checkP8(game.state, { identity: slots.identity, intent: slots.intent, chain: slots.chain });
  p8Feedback.value = result.conflicts;
  if (!result.ok) {
    await game.execute({ kind: 'puzzleAttempt', puzzleId: 'p8', choiceKeys: [...Object.values(slots.identity), ...Object.values(slots.intent)], feedbackKey: result.feedbackKey });
    return;
  }
  const okExec = await game.execute({
    kind: 'assembleNextVisit',
    slots: { identity: { ...slots.identity }, intent: { ...slots.intent }, chain: slots.chain },
  });
  if (okExec) persist();
}

// —— 三种正式方案 ——
const confirming = ref<EndingId | null>(null);
const surgery = content.surgery as Record<EdgeId, { edge: EdgeId; label: string; preview: string; formalOption: boolean }>;
const previewedF = computed(() => facts.value.simulatedEdges.includes('F'));
const previewedD = computed(() => facts.value.simulatedEdges.includes('D'));

interface OptionCard {
  id: EndingId;
  title: string;
  desc: string;
  cut: string;
  keeps: string;
  result: string;
  available: boolean;
  blocked: string | null;
}
const options = computed<OptionCard[]>(() => [
  {
    id: 'A',
    title: '方案 A · 接受预填终局',
    desc: '签认整批结案。不再追查。',
    cut: '不切任何边；接受模板预填与外部确认的全部结果。',
    keeps: '保留材料：本局全部证据与轨迹（可导出）。',
    result: '六人整批结案；后续随访 0。',
    available: true,
    blocked: null,
  },
  {
    id: 'B',
    title: '方案 B · 切 F（隔离）',
    desc: surgery.F.preview,
    cut: '所切联系：终局声明 → 公示队列。',
    keeps: '保留材料：六份记录封存；原始证据保留。',
    result: '外部传播停止；六人仍封存在本批内，状态“仍待联系”。',
    available: previewedF.value,
    blocked: previewedF.value ? null : '需先在切除模拟中预览 F 的后果。',
  },
  {
    id: 'C',
    title: '方案 C · 切 D 并继续照护',
    desc: surgery.D.preview,
    cut: '所切联系：外部见证 → 终局声明（撤销终局授权）。',
    keeps: '保留材料：六人身份、六条本人意愿、下一班承接单。',
    result: '恢复六人身份关联与后续随访 6；照护继续。',
    available: previewedD.value,
    blocked: previewedD.value ? null : '需先在切除模拟中预览 D 的后果。',
  },
]);

async function confirmEnding(): Promise<void> {
  if (!confirming.value) return;
  const ending = confirming.value;
  confirming.value = null;
  const ok = await game.execute({ kind: 'chooseEnding', ending });
  if (ok) await router.push(`/ending/${ending}`);
}
</script>

<template>
  <div class="next">
    <h1>下一班与最终处理</h1>
    <p class="muted">intra.chengwan/handover/next · 上半：整理依据；下半：集中最终操作。</p>

    <section class="panel">
      <h2>六人 × 三类依据（p8）</h2>
      <p class="muted small">不自动补内容；缺陈述可返回原页，已装槽位保留。</p>
      <table class="slots-table">
        <thead><tr><th>床位</th><th>身份子记录</th><th>当前意愿</th></tr></thead>
        <tbody>
          <tr v-for="pid in PATIENTS" :key="pid" :data-testid="`p14:row--${pid}`">
            <td class="mono">{{ pid }}<br /><span class="small">{{ content.patients[pid].name }}</span></td>
            <td>
              <select
                :value="slots.identity[pid] ?? ''"
                :data-testid="`p14:identity--${pid}`"
                @change="(ev) => { slots.identity[pid] = (ev.target as HTMLSelectElement).value as IdentityRef; persist(); }"
              >
                <option value="">（选择）</option>
                <option v-for="opt in identityOptions(pid)" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
            </td>
            <td>
              <template v-if="stCaptured(pid)">
                <span class="ok small">✓ ST_{{ pid }}（{{ slots.intent[pid] ?? `ST_${pid}` }}）</span>
              </template>
              <template v-else>
                <span class="muted small">缺当前陈述</span>
                <RouterLink class="small" :to="ST_PAGE[pid].to" :data-testid="`p14:goto-st--${pid}`">{{ ST_PAGE[pid].label }} →</RouterLink>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="chainbox">
        <template v-if="!ev27">
          <button data-testid="p14:open-ev27" @click="game.execute({ kind: 'openDoc', documentId: 'EV27' })">
            打开下一班承接单（EV27）
          </button>
          <span class="muted small">内容“待签认后生效”。</span>
        </template>
        <template v-else>
          <label class="small">
            <input
              type="checkbox"
              :checked="slots.chain === 'EV27#NEXT_SHIFT'"
              data-testid="p14:chain"
              @change="(ev) => { slots.chain = (ev.target as HTMLInputElement).checked ? 'EV27#NEXT_SHIFT' : null; persist(); }"
            />
            ✓ EV27 已取得：纳入承接（林闻承接单）
          </label>
        </template>
      </div>
      <button v-if="!facts.carePlanReady" class="primary" data-testid="p14:assemble" @click="assemble">
        整理下一班依据
      </button>
      <ul v-if="p8Feedback.length" class="feedback"><li v-for="(f, i) in p8Feedback" :key="i">{{ f }}</li></ul>
      <HintPanel v-if="!facts.carePlanReady" puzzle-id="p8" />
      <p v-else class="ok" data-testid="p14:ready">✓ 方案已准备，尚未执行：{{ dialogue.system.handoverPrepared }}</p>
    </section>

    <section v-if="facts.carePlanReady && !game.state.ending" class="panel">
      <h2>最终处理（三种方案，一次原子事务）</h2>
      <p><button class="ghost" data-testid="p14:export" @click="game.exportArchive()">决策前导出存档</button></p>
      <div class="options">
        <article v-for="opt in options" :key="opt.id" class="option" :class="{ primary: opt.id === 'C' }" :data-testid="`p14:option--${opt.id}`">
          <h3>{{ opt.title }}</h3>
          <p>{{ opt.desc }}</p>
          <ul class="small">
            <li>{{ opt.cut }}</li>
            <li>{{ opt.keeps }}</li>
            <li>结果：{{ opt.result }}</li>
          </ul>
          <template v-if="opt.available">
            <button :class="opt.id === 'C' ? 'primary' : 'ghost'" :data-testid="`p14:choose--${opt.id}`" @click="confirming = opt.id">
              核对后果并确认
            </button>
          </template>
          <template v-else>
            <p class="muted small">{{ opt.blocked }}</p>
            <RouterLink class="small" to="/lab/surgery" :data-testid="`p14:goto-preview--${opt.id}`">去预览 →</RouterLink>
          </template>
        </article>
      </div>
    </section>

    <div v-if="confirming" class="modal" role="dialog" :aria-label="`确认方案 ${confirming}`" :data-testid="`p14:modal--${confirming}`">
      <div class="modal-card">
        <h3>确认 · 方案 {{ confirming }}</h3>
        <template v-if="confirming === 'C'">
          <pre class="reviewtext">{{ dialogue.system.finalReviewText }}</pre>
          <p class="muted small">切 D → 签 FACT_ONLY → 恢复六人身份 → 保留意愿 → 打开下一班。一个事务完成，无中间半切状态。</p>
        </template>
        <template v-else-if="confirming === 'B'">
          <p>切 F → 接受隔离。六人记录封存，状态“仍待联系”。无恢复事件。</p>
        </template>
        <template v-else>
          <p>签认 ENDING：接受预填终局。整批结案，后续随访 0。</p>
        </template>
        <div class="modal-actions">
          <button class="ghost" data-testid="p14:modal-cancel" @click="confirming = null">再想想</button>
          <button class="primary" data-testid="p14:modal-confirm" @click="confirmEnding">
            {{ confirming === 'C' ? dialogue.system.finalButtonLate : '确认执行' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.slots-table { width: 100%; border-collapse: collapse; }
.slots-table th, .slots-table td { border: 1px solid var(--line); padding: var(--space-2); text-align: left; vertical-align: top; }
.chainbox { margin: var(--space-3) 0; display: flex; gap: var(--space-3); align-items: center; flex-wrap: wrap; }
.options { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--space-3); }
.option { border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-3); }
.option.primary { border-color: var(--primary); border-width: 2px; }
.modal { position: fixed; inset: 0; background: rgba(20, 30, 26, 0.45); display: flex; align-items: center; justify-content: center; z-index: 60; }
.modal-card { background: var(--surface); border-radius: var(--radius); padding: var(--space-4); max-width: 520px; width: 90%; }
.modal-actions { display: flex; gap: var(--space-3); justify-content: flex-end; margin-top: var(--space-3); }
.reviewtext { white-space: pre-wrap; background: #f6f1e7; padding: var(--space-3); border-radius: var(--radius); }
.feedback { color: var(--error); }
.small { font-size: 0.85em; }
.ok { color: var(--clinical); }
</style>
