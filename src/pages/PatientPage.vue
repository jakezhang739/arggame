<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useGameStore } from '../stores/game';
import { content, resolveContent } from '../game/content';
import { statementUnlocked, isAcquired } from '../game/selectors';

const route = useRoute();
const router = useRouter();
const game = useGameStore();
const phase = computed(() => game.state.lastMainPhase);
const ending = computed(() => game.state.ending);

const patient = computed(() => {
  const id = String(route.params.id ?? '');
  return content.patients[id] ?? null;
});
const isR03 = computed(() => patient.value?.id === 'R03');

const name = computed(() =>
  isR03.value ? resolveContent('patients.R03.name', phase.value, ending.value) : (patient.value?.name ?? ''),
);
const nameTag = computed(() => resolveContent('patients.R03.nameEvidenceTag', phase.value, ending.value));
const statement = computed(() => {
  if (!patient.value) return '';
  if (isR03.value) return resolveContent('patients.R03.statement', phase.value, ending.value);
  return patient.value.selfStatement;
});

const showSource = ref(false);
const ev05Acquired = computed(() => isAcquired(game.state, 'EV05'));

const stId = computed(() => (patient.value ? `ST_${patient.value.id}` : ''));
const stUnlocked = computed(() => statementUnlocked(game.state, stId.value));
const stCaptured = computed(() => game.state.facts.capturedStatements.includes(stId.value as never));

const STATEMENT_PAGE_HINT: Record<string, string> = {
  R01: '先在病友留言板确认这段话确实由本人留下。',
  R02: '先在病友留言板确认这段话确实由本人留下。',
  R03: 'R03 的有效当前意愿需要由通道 03 的完整录音确认。',
};

async function capture(): Promise<void> {
  if (!patient.value) return;
  await game.execute({
    kind: 'captureStatement',
    patientId: patient.value.id as 'R01',
    statementId: stId.value as 'ST_R01',
  });
}

if (!patient.value) {
  router.replace('/followup');
}
</script>

<template>
  <div v-if="patient" class="patient">
    <nav class="muted">
      <RouterLink to="/followup">← 病历列表</RouterLink>
    </nav>
    <h1 :data-testid="`p03:name--${patient.id}`">
      {{ patient.id }} · <span :class="{ blankname: name === '' }">{{ name === '' ? '—' : name }}</span>
      <span v-if="nameTag" class="badge">{{ nameTag }}</span>
    </h1>

    <div class="grid">
      <section class="panel">
        <h2>身份</h2>
        <dl class="kv">
          <dt>床位</dt><dd class="mono">{{ patient.id }}</dd>
          <template v-if="name !== ''">
            <dt>姓名</dt><dd>{{ name }}</dd>
            <dt>年龄</dt><dd>{{ patient.age }}</dd>
            <dt>职业</dt><dd>{{ patient.occupation }}</dd>
          </template>
        </dl>
      </section>

      <section class="panel">
        <h2>临床观察</h2>
        <p>{{ patient.clinicalNote }}</p>
      </section>

      <section class="panel">
        <h2>本人表达</h2>
        <blockquote v-if="isR03" class="statement">{{ statement }}</blockquote>
        <template v-else>
          <blockquote class="statement">{{ patient.selfStatement }}</blockquote>
          <p v-if="stCaptured" class="ok">✓ 已保留这条本人陈述（ST_{{ patient.id }}）</p>
          <button
            v-else-if="stUnlocked"
            class="primary"
            :data-testid="`p03:capture--${patient.id}`"
            @click="capture"
          >
            保留这条本人陈述
          </button>
          <p v-else class="muted small">{{ STATEMENT_PAGE_HINT[patient.id] ?? '待补交班事项：稍后出现。' }}</p>
        </template>
      </section>

      <section class="panel">
        <h2>护理事项</h2>
        <ul>
          <li v-for="(item, i) in patient.nursingItems" :key="i">{{ item }}</li>
        </ul>
      </section>

      <section class="panel">
        <h2>来源</h2>
        <template v-if="isR03">
          <button data-testid="p03:open-ev05" :disabled="ev05Acquired" @click="game.execute({ kind: 'openDoc', documentId: 'EV05' })">
            {{ ev05Acquired ? '✓ 护理事实与授权说明（EV05）已取得' : '查看护理事实与授权范围' }}
          </button>
        </template>
        <button data-testid="p03:source" @click="showSource = !showSource">来源检查</button>
        <div v-if="showSource" class="mono small source-detail">
          sourceId：{{ content.evidenceRegistry.find((e) => e.id === (isR03 ? 'EV05' : 'EV04'))?.sourceId }}<br />
          originGroup：{{ content.evidenceRegistry.find((e) => e.id === (isR03 ? 'EV05' : 'EV04'))?.originGroup }}<br />
          导出批次：{{ content.evidenceRegistry.find((e) => e.id === (isR03 ? 'EV05' : 'EV04'))?.exportBatch ?? '无' }}
        </div>
      </section>

      <section class="panel">
        <h2>版本历史</h2>
        <ol class="muted small">
          <li>v3.2 · 2026-06-02 · 值班须知基线</li>
          <li>BATCH-0617 · 2026-06-16 · 迁移导出</li>
          <li v-if="['CLOSURE_PROVEN','TRAIL_FORKED','AUDIO_RECOVERED','SCOPE_LIMITED','SURGERY_READY'].includes(phase) || ending">
            v4.1 · 2026-06-16 23:40 · 须知优化版（与基线冲突）
          </li>
        </ol>
      </section>
    </div>
  </div>
</template>

<style scoped>
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--space-4); }
.kv { display: grid; grid-template-columns: auto 1fr; gap: var(--space-1) var(--space-3); margin: 0; }
.kv dt { color: var(--muted); }
.statement { margin: 0 0 var(--space-2); border-left: 4px solid var(--line); padding-left: var(--space-3); white-space: pre-wrap; }
.blankname { opacity: 0.3; }
.small { font-size: 0.85em; }
.source-detail { background: #eef1ef; padding: var(--space-2) var(--space-3); border-radius: var(--radius); margin-top: var(--space-2); }
.ok { color: var(--clinical); }
</style>
