<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useGameStore } from '../stores/game';
import { content, dialogue } from '../game/content';
import AppIcon from '../components/AppIcon.vue';

const route = useRoute();
const router = useRouter();
const game = useGameStore();
const patientId = String(route.params.id ?? 'R03');
const patient = content.patients[patientId] ?? content.patients.R03;

const scopeExpanded = ref(false);
const confirmOpen = ref(false);
const replayOpen = ref(false);

const cause = computed(() => game.state.facts.reviewCause);
const submitted = computed(() => cause.value !== null);

async function submitReview(): Promise<void> {
  confirmOpen.value = false;
  const ok = await game.execute({ kind: 'submitReview' });
  if (ok) router.push('/followup');
}
async function watchReplay(): Promise<void> {
  replayOpen.value = false;
  const ok = await game.execute({ kind: 'watchReplay' });
  if (ok) router.push('/followup');
}
async function openDoc(id: string): Promise<void> {
  await game.execute({ kind: 'openDoc', documentId: id });
}
</script>

<template>
  <div class="review">
    <nav class="back"><RouterLink to="/followup">← 返回六人病历</RouterLink></nav>
    <header class="page-intro">
      <p class="eyebrow mono">EXTERNAL REVIEW / SINGLE RECORD</p>
      <h1>核对 {{ patient.id }} 的护理事实</h1>
      <p>先区分“记录已经看过”和“这个人已经有了结局”。前者不会改变案件，后者会进入二次确认。</p>
    </header>

    <section class="patient-strip">
      <div class="patient-id mono">{{ patient.id }}</div>
      <div><span>患者</span><strong>{{ patient.name }}</strong></div>
      <div><span>职业</span><strong>{{ patient.occupation }}</strong></div>
      <div class="patient-note"><span>本人补记</span><strong>“{{ patient.selfStatement }}”</strong></div>
    </section>

    <div class="cols">
      <section class="panel" aria-labelledby="facts-h">
        <p class="panel-kicker"><AppIcon name="clipboard" :size="16" /> 独立核对</p>
        <h2 id="facts-h">当天护理事实</h2>
        <ul>
          <li v-for="(item, i) in patient.nursingItems" :key="i">{{ item }}</li>
        </ul>
        <p>{{ patient.clinicalNote }}</p>
        <button data-testid="p04:open-ev05" @click="openDoc('EV05')">查看护理事实的来源与授权范围</button>
      </section>

      <section class="panel system-conclusion" aria-labelledby="prefill-h">
        <p class="panel-kicker"><AppIcon name="archive" :size="16" /> 系统生成</p>
        <h2 id="prefill-h">预填结案结论</h2>
        <p class="prefill"><span>正向</span>康复</p>
        <p class="muted">生命体征记录完整；最后一次护士交接完整。</p>
        <p class="scope-preview"><AppIcon name="warning" :size="16" /> 此结论包含“无需继续随访”。护理事实本身没有写出这句话。</p>
      </section>
    </div>

    <section class="panel scope" aria-label="授权范围">
      <button
        class="linklike"
        data-testid="p04:expand-scope"
        :aria-expanded="scopeExpanded"
        @click="scopeExpanded = !scopeExpanded"
      >
        <AppIcon name="evidence" :size="17" /> 查看这次提交究竟会确认什么
      </button>
      <div v-if="scopeExpanded" class="scope-text" data-testid="p04:scope-text">
        本次提交会接受系统预填结案，并把你的确认作为“该患者已有终局”的外部依据。仅查看护理事实不会产生这项授权。
      </div>
    </section>

    <template v-if="!submitted">
      <div class="actions">
        <button class="primary" data-testid="p04:submit-review" @click="confirmOpen = true">
          接受预填结论并提交
        </button>
        <button class="linklike" data-testid="p04:refuse" @click="replayOpen = true">
          暂不签认，查看一次历史回放
        </button>
      </div>

      <div v-if="confirmOpen" class="modal-mask" @click.self="confirmOpen = false">
        <div class="panel modal" role="dialog" aria-modal="true" aria-label="确认提交">
          <h2>确认提交</h2>
          <p>即将提交：R03 许棠的单份复核。</p>
          <p class="confirm-warning"><AppIcon name="warning" /> <strong>这不只表示“资料已读”，还会接受系统给出的终局声明。</strong></p>
          <p class="muted">{{ scopeExpanded ? '授权说明已展开。' : '提示：可先展开授权说明。' }}</p>
          <div class="modal-actions">
            <button class="danger" data-testid="p04:confirm-submit" @click="submitReview">确认</button>
            <button data-testid="p04:cancel-submit" @click="confirmOpen = false">再看看</button>
          </div>
        </div>
      </div>

      <div v-if="replayOpen" class="panel replay" role="dialog" aria-label="历史回放">
        <h2>护士保存的历史批次回放</h2>
        <p class="muted">{{ dialogue.system.replayIntro }}</p>
        <ol class="mono small">
          <li>23:07:11　上一位复核者接受系统预填结案</li>
          <li>23:07:12　患者索引重新计数：6 → 5</li>
        </ol>
        <p class="muted small">回放为只读；你的观察不会被记为签认。</p>
        <div class="modal-actions">
          <button class="primary" data-testid="p04:watch-replay" @click="watchReplay">
            已看完，进入该批次的复查工作区
          </button>
          <button @click="replayOpen = false">返回</button>
        </div>
      </div>
    </template>

    <div v-else class="panel">
      <p class="eyebrow mono">本批触发来源（回看）</p>
      <h2>这次索引变化来自哪里</h2>
      <p v-if="cause?.kind === 'SELF'" class="mono small">
        你的提交接受了系统预填结案；原始事件 {{ cause.eventId }} 可在调查记录中回看。
      </p>
      <p v-else class="mono small">
        索引变化来自 W06 的历史签认。你只观看了回放，没有提交新的终局声明。
      </p>
      <p class="muted">触发分支已选定，本页仅供回看；不能第二次签认或切换路线。</p>
    </div>
  </div>
</template>

<style scoped>
.back { margin-bottom: var(--space-4); font-size: .78rem; }
.page-intro { max-width: 760px; margin-bottom: var(--space-5); }
.eyebrow { margin: 0 0 var(--space-2); color: var(--clinical); font-size: .7rem; font-weight: 750; letter-spacing: .12em; }
.page-intro h1 { margin-bottom: var(--space-2); }
.page-intro > p:last-child { margin: 0; color: var(--muted); }
.patient-strip { display: grid; grid-template-columns: 74px .7fr .8fr 1.8fr; gap: 0; overflow: hidden; margin-bottom: var(--space-4); border: 1px solid #7f9489; border-radius: var(--radius-lg); background: rgba(247,250,248,.94); box-shadow: var(--shadow-sm); }
.patient-strip > div { display: grid; align-content: center; min-height: 78px; border-right: 1px solid var(--line); padding: var(--space-3) var(--space-4); }
.patient-strip > div:last-child { border-right: 0; }
.patient-strip span { color: var(--muted); font-size: .68rem; }
.patient-strip strong { font-size: .87rem; }
.patient-id { place-items: center; background: var(--clinical-deep); color: #fff; font-size: 1.1rem; font-weight: 750; }
.patient-note strong { color: var(--clinical-deep); font-family: var(--font-serif); font-weight: 600; }
.cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}
@media (max-width: 768px) {
  .cols {
    grid-template-columns: 1fr;
  }
}
.panel-kicker { display: flex; align-items: center; gap: var(--space-2); margin: 0 0 var(--space-2); color: var(--muted); font-size: .7rem; font-weight: 750; letter-spacing: .08em; }
.system-conclusion { background: linear-gradient(90deg, var(--warning) 0 42px, transparent 42px) top left / 100% 2px no-repeat, rgba(250,247,238,.96); }
.prefill {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  font-size: 1.5em;
  color: var(--warning);
  font-weight: 700;
}
.prefill span { border: 1px solid #b6a069; border-radius: 999px; padding: 2px 8px; font-size: .55em; }
.scope-preview { display: flex; gap: var(--space-2); margin-top: var(--space-4); border-top: 1px solid #ddcfab; padding-top: var(--space-3); color: #6e4a09; font-size: .78rem; }
.scope {
  margin-top: var(--space-4);
}
.scope-text {
  margin-top: var(--space-2);
  border-left: 4px solid var(--warning);
  padding-left: var(--space-3);
}
.confirm-warning { display: flex; align-items: flex-start; gap: var(--space-2); border: 1px solid #c69a94; border-radius: var(--radius); padding: var(--space-3); background: var(--anomaly-soft); color: var(--anomaly); }
.actions {
  margin-top: var(--space-4);
  display: flex;
  gap: var(--space-4);
  align-items: center;
  flex-wrap: wrap;
}
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(29, 41, 38, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 60;
  padding: var(--space-4);
}
.modal {
  width: min(480px, 94vw);
}
.modal-actions {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-3);
}
.replay {
  margin-top: var(--space-4);
}
.linklike {
  border: none;
  background: none;
  color: var(--clinical);
  text-decoration: underline;
  padding: 0;
}
.small {
  font-size: 0.85em;
}
h1 {
  margin: 0 0 var(--space-3);
}
@media (max-width: 760px) {
  .patient-strip { grid-template-columns: 64px 1fr 1fr; }
  .patient-note { grid-column: 1 / -1; border-top: 1px solid var(--line); }
}
</style>
