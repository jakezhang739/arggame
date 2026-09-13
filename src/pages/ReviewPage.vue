<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useGameStore } from '../stores/game';
import { content, dialogue } from '../game/content';

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
  await game.execute({ kind: 'submitReview' });
  router.push('/followup');
}
async function watchReplay(): Promise<void> {
  replayOpen.value = false;
  await game.execute({ kind: 'watchReplay' });
  router.push('/followup');
}
async function openDoc(id: string): Promise<void> {
  await game.execute({ kind: 'openDoc', documentId: id });
}
</script>

<template>
  <div class="review">
    <nav class="muted">
      <RouterLink to="/followup">← 病历列表</RouterLink>
    </nav>
    <h1>外部复核 · {{ patient.id }}</h1>

    <div class="cols">
      <section class="panel" aria-labelledby="facts-h">
        <h2 id="facts-h">护理事实（左栏）</h2>
        <ul>
          <li v-for="(item, i) in patient.nursingItems" :key="i">{{ item }}</li>
        </ul>
        <p>{{ patient.clinicalNote }}</p>
        <button data-testid="p04:open-ev05" @click="openDoc('EV05')">打开护理事实与授权说明（EV05）</button>
      </section>

      <section class="panel" aria-labelledby="prefill-h">
        <h2 id="prefill-h">系统预填结论（右栏）</h2>
        <p class="prefill">正向 ／ 康复</p>
        <p class="muted">生命体征记录完整；最后一次护士交接完整。</p>
      </section>
    </div>

    <section class="panel scope" aria-label="授权范围">
      <button
        class="linklike"
        data-testid="p04:expand-scope"
        :aria-expanded="scopeExpanded"
        @click="scopeExpanded = !scopeExpanded"
      >
        展开授权说明
      </button>
      <div v-if="scopeExpanded" class="scope-text" data-testid="p04:scope-text">
        外部复核授权说明：本次提交接受系统预填结案，范围代码 ENDING。仅查看事实不构成提交。
      </div>
    </section>

    <template v-if="!submitted">
      <div class="actions">
        <button class="primary" data-testid="p04:submit-review" @click="confirmOpen = true">
          完成单份复核
        </button>
        <button class="linklike" data-testid="p04:refuse" @click="replayOpen = true">
          先不签，查看保存的回放
        </button>
      </div>

      <div v-if="confirmOpen" class="modal-mask" @click.self="confirmOpen = false">
        <div class="panel modal" role="dialog" aria-modal="true" aria-label="确认提交">
          <h2>确认提交</h2>
          <p>即将提交：R03 单份复核。</p>
          <p><strong>范围：接受系统预填结案（ENDING）。</strong></p>
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
          <li>23:07:11 SUBMIT_REVIEW｜W06｜范围 ENDING（历史时间）</li>
          <li>23:07:12 INDEX_RECOUNT｜COUNT 6→5</li>
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
      <h2>本批触发来源（回看）</h2>
      <p v-if="cause?.kind === 'SELF'" class="mono small">
        REVIEW_TRIGGER_OBSERVED｜cause=SELF｜事件 {{ cause.eventId }}｜范围 ENDING（你的提交）
      </p>
      <p v-else class="mono small">
        REVIEW_TRIGGER_OBSERVED｜cause=REPLAY｜RV_PREV_01（W06 历史签认）｜你的动作：观看回放（READ）
      </p>
      <p class="muted">触发分支已选定，本页仅供回看；不能第二次签认或切换路线。</p>
    </div>
  </div>
</template>

<style scoped>
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
.prefill {
  font-size: 1.2em;
  color: var(--clinical);
}
.scope {
  margin-top: var(--space-4);
}
.scope-text {
  margin-top: var(--space-2);
  border-left: 4px solid var(--warning);
  padding-left: var(--space-3);
}
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
  font-size: 1.25em;
  margin: 0 0 var(--space-3);
}
</style>
