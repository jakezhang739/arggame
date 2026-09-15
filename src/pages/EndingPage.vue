<script setup lang="ts">
/** P15 结局（docs/03册 v1.1 §3）：正文、数字、音频文字兜底、固定动作。 */
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useGameStore } from '../stores/game';
import { content } from '../game/content';
import { deleteAllRecordings } from '../game/idb';
import AudioFragment from '../components/AudioFragment.vue';
import AppIcon from '../components/AppIcon.vue';

const route = useRoute();
const router = useRouter();
const game = useGameStore();

const endingId = computed(() => String(route.params.endingId ?? 'A') as 'A' | 'B' | 'C');
const data = computed(
  () =>
    content.endings[endingId.value] as {
      title: string;
      trigger: string;
      ui: string;
      body: string;
      gains?: string[];
      costs?: string[];
      sixResults?: string | null;
      finalSoundNote?: string | null;
    },
);

function clipSpeech(id: string): string {
  const clips = (content.audioManifest as { clips: Record<string, { speech: string }> }).clips;
  return clips[id]?.speech ?? '';
}

// —— 本机数据管理 ——
const manageOpen = ref(false);
const confirmWipe = ref(false);
async function deleteRecordings(): Promise<void> {
  await deleteAllRecordings();
  game.markRecordingsDeleted();
  manageOpen.value = false;
}
function clearProgress(): void {
  game.resetSave();
  router.push('/');
}

const FOLLOWUPS = (['R01', 'R02', 'R03', 'R04', 'R05', 'R06'] as const).map((id) => ({
  id,
  name: content.patients[id].name,
  item: content.patients[id].nextHandover,
}));
</script>

<template>
  <div class="ending" :data-testid="`p15:ending--${endingId}`">
    <p class="eyebrow mono">夜班复核 · 结果</p>
    <h1>{{ data.title }}</h1>

    <section class="panel result-panel">
      <p class="body">{{ data.body }}</p>

      <!-- 真实收益 / 真实代价（10册 §5 已批）：每个方案都有得有失 -->
      <div v-if="data.gains?.length || data.costs?.length" class="gains-costs">
        <div class="gc gc-gains">
          <h3>真实收益</h3>
          <ul v-if="data.gains?.length"><li v-for="(g, i) in data.gains" :key="i">{{ g }}</li></ul>
        </div>
        <div class="gc gc-costs">
          <h3>真实代价</h3>
          <ul v-if="data.costs?.length"><li v-for="(c, i) in data.costs" :key="i">{{ c }}</li></ul>
        </div>
      </div>

      <p class="ui mono" data-testid="p15:ui">{{ data.ui }}</p>
      <template v-if="endingId === 'A'">
        <AudioFragment
          audio-id="AUD09"
          title="结尾音频（AUD09）"
          transcript="（安静。12 秒处：台灯开关，按下，回弹。没有亮。）"
        />
      </template>
      <template v-else-if="endingId === 'B'">
        <AudioFragment audio-id="AUD10" title="结尾音频（AUD10）" :transcript="clipSpeech('AUD10')" />
      </template>
      <template v-else>
        <AudioFragment audio-id="AUD11" title="林闻的新交班（AUD11）" :transcript="clipSpeech('AUD11')" />
      </template>

      <h2 v-if="data.sixResults">六人的结果</h2>
      <p v-if="data.sixResults" class="six">{{ data.sixResults }}</p>
      <template v-if="endingId === 'C'">
        <h2>下一班 · 0617 普通病历</h2>
        <ul class="followups">
          <li v-for="f in FOLLOWUPS" :key="f.id" :data-testid="`p15:followup--${f.id}`">
            <span class="mono">{{ f.id }}</span> {{ f.name }}：{{ f.item }}
          </li>
        </ul>
        <p class="muted small">“下一班”为故事内日期；活跃时钟不加 24 小时。</p>
        <p v-if="data.finalSoundNote" class="final-note" data-testid="p15:final-note">{{ data.finalSoundNote }}</p>
      </template>
      <template v-if="endingId === 'B'">
        <p class="muted">六份记录：封存 · 仍待联系。不伪造死亡或救回。</p>
      </template>
    </section>

    <section class="panel actions">
      <h2>本次调查</h2>
      <div class="actionrow">
        <RouterLink to="/debrief" class="button primary" data-testid="p15:goto-debrief"><AppIcon name="trail" :size="17" /> 查看我是如何走到这里的</RouterLink>
        <button class="ghost" data-testid="p15:export" @click="game.exportArchive()"><AppIcon name="download" :size="17" /> 导出存档</button>
        <button class="ghost" data-testid="p15:export-report" @click="game.exportReport()">导出试玩报告</button>
        <button class="ghost" data-testid="p15:manage" @click="manageOpen = !manageOpen">本机数据管理</button>
        <button class="ghost" data-testid="p15:restart" @click="confirmWipe = true">重新开始</button>
        <RouterLink to="/" class="button ghost" data-testid="p15:exit">退出</RouterLink>
      </div>
      <details class="audit-details">
        <summary>技术审计详情</summary>
        <p class="muted small mono">内部触发：{{ data.trigger }}</p>
      </details>
      <div v-if="manageOpen" class="manage" data-testid="p15:manage-panel">
        <p class="muted small">分别处理；删除录音不撤销你的见证事实，清除进度不可恢复。</p>
        <button class="ghost" data-testid="p15:delete-recordings" @click="deleteRecordings">删除本机录音</button>
        <button class="ghost danger" data-testid="p15:clear-progress" @click="clearProgress">清除全部进度</button>
      </div>
    </section>

    <div v-if="confirmWipe" class="modal" role="dialog" aria-label="确认重新开始">
      <div class="modal-card">
        <h3>重新开始会清除当前进度</h3>
        <p class="muted small">建议先导出存档。此操作不可撤销。</p>
        <div class="modal-actions">
          <button class="ghost" data-testid="p15:restart-cancel" @click="confirmWipe = false">取消</button>
          <button class="primary" data-testid="p15:restart-confirm" @click="clearProgress">确认重新开始</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.eyebrow { margin: 0 0 var(--space-2); color: var(--clinical); font-size: .7rem; font-weight: 750; letter-spacing: .12em; }
.result-panel { border-top-width: 3px; }
.body { white-space: pre-wrap; font-size: 1.05em; line-height: 1.8; }
.gains-costs { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin: var(--space-3) 0; }
.gc { border-radius: var(--radius); padding: var(--space-3); }
.gc-gains { background: rgba(36, 90, 72, 0.07); border: 1px solid rgba(36, 90, 72, 0.25); }
.gc-costs { background: rgba(168, 92, 85, 0.07); border: 1px solid rgba(168, 92, 85, 0.28); }
.gc h3 { margin: 0 0 var(--space-2); font-size: 0.85rem; letter-spacing: 0.05em; }
.gc-gains h3 { color: #245a48; }
.gc-costs h3 { color: #8d4a44; }
.gc ul { margin: 0; padding-left: 1.2em; font-size: 0.88em; line-height: 1.7; }
.six { font-size: 0.95em; line-height: 1.8; }
.final-note { white-space: pre-wrap; border-left: 3px solid #ad8a42; background: rgba(213, 170, 83, 0.08); border-radius: var(--radius); padding: var(--space-2) var(--space-3); font-size: 0.95em; }
.ui { background: #eef1ef; border-radius: var(--radius); padding: var(--space-2) var(--space-3); }
.followups { padding-left: var(--space-4); }
.followups li { margin: var(--space-1) 0; }
@media (max-width: 768px) { .gains-costs { grid-template-columns: 1fr; } }
.actionrow { display: flex; gap: var(--space-3); flex-wrap: wrap; }
.audit-details { margin-top: var(--space-4); border-top: 1px solid var(--line); padding-top: var(--space-3); }
.audit-details summary { color: var(--muted); font-size: .76rem; }
.manage { border-top: 1px solid var(--line); margin-top: var(--space-3); padding-top: var(--space-3); display: flex; gap: var(--space-3); flex-wrap: wrap; }
.danger { color: var(--error); }
.modal { position: fixed; inset: 0; background: rgba(20, 30, 26, 0.45); display: flex; align-items: center; justify-content: center; z-index: 60; }
.modal-card { background: var(--surface); border-radius: var(--radius); padding: var(--space-4); max-width: 460px; width: 90%; }
.modal-actions { display: flex; gap: var(--space-3); justify-content: flex-end; margin-top: var(--space-3); }
.small { font-size: 0.85em; }
</style>
