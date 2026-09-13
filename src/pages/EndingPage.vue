<script setup lang="ts">
/** P15 结局（docs/03册 v1.1 §3）：正文、数字、音频文字兜底、固定动作。 */
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useGameStore } from '../stores/game';
import { content } from '../game/content';
import { deleteAllRecordings } from '../game/idb';
import AudioFragment from '../components/AudioFragment.vue';

const route = useRoute();
const router = useRouter();
const game = useGameStore();

const endingId = computed(() => String(route.params.endingId ?? 'A') as 'A' | 'B' | 'C');
const data = computed(() => content.endings[endingId.value] as { title: string; trigger: string; ui: string; body: string });

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
    <h1>{{ data.title }}</h1>
    <p class="muted small">触发条件：{{ data.trigger }}</p>

    <section class="panel">
      <p class="body">{{ data.body }}</p>
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
      <template v-if="endingId === 'C'">
        <h2>下一班 · 0617 普通病历</h2>
        <ul class="followups">
          <li v-for="f in FOLLOWUPS" :key="f.id" :data-testid="`p15:followup--${f.id}`">
            <span class="mono">{{ f.id }}</span> {{ f.name }}：{{ f.item }}
          </li>
        </ul>
        <p class="muted small">“下一班”为故事内日期；活跃时钟不加 24 小时。</p>
      </template>
      <template v-if="endingId === 'B'">
        <p class="muted">六份记录：封存 · 仍待联系。不伪造死亡或救回。</p>
      </template>
    </section>

    <section class="panel actions">
      <h2>固定动作</h2>
      <div class="actionrow">
        <RouterLink to="/debrief" class="button" data-testid="p15:goto-debrief">去复盘</RouterLink>
        <button class="ghost" data-testid="p15:export" @click="game.exportArchive()">导出存档</button>
        <button class="ghost" data-testid="p15:export-report" @click="game.exportReport()">导出试玩报告</button>
        <button class="ghost" data-testid="p15:manage" @click="manageOpen = !manageOpen">本机数据管理</button>
        <button class="ghost" data-testid="p15:restart" @click="confirmWipe = true">重新开始</button>
        <RouterLink to="/" class="button ghost" data-testid="p15:exit">退出</RouterLink>
      </div>
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
.body { white-space: pre-wrap; font-size: 1.05em; line-height: 1.8; }
.ui { background: #eef1ef; border-radius: var(--radius); padding: var(--space-2) var(--space-3); }
.followups { padding-left: var(--space-4); }
.followups li { margin: var(--space-1) 0; }
.actionrow { display: flex; gap: var(--space-3); flex-wrap: wrap; }
.manage { border-top: 1px solid var(--line); margin-top: var(--space-3); padding-top: var(--space-3); display: flex; gap: var(--space-3); flex-wrap: wrap; }
.danger { color: var(--error); }
.modal { position: fixed; inset: 0; background: rgba(20, 30, 26, 0.45); display: flex; align-items: center; justify-content: center; z-index: 60; }
.modal-card { background: var(--surface); border-radius: var(--radius); padding: var(--space-4); max-width: 460px; width: 90%; }
.modal-actions { display: flex; gap: var(--space-3); justify-content: flex-end; margin-top: var(--space-3); }
.small { font-size: 0.85em; }
</style>
