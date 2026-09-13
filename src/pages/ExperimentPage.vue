<script setup lang="ts">
/** P09 单变量实验（docs/03册 v1.1 §3）：六个预置配置、只列实际运行行、两对照槽（p5）。 */
import { computed, ref } from 'vue';
import { useGameStore } from '../stores/game';
import { EXPERIMENT_CONFIGS, checkP5 } from '../game/gates';
import type { ConfigId } from '../game/types';
import HintPanel from '../components/HintPanel.vue';

const game = useGameStore();
const facts = computed(() => game.state.facts);

const CONFIG_IDS = ['A', 'B', 'C', 'D', 'E', 'F'] as ConfigId[];
const FIELD_LABEL: Record<string, string> = {
  painScore: '疼痛评分',
  endingLabel: '结局标签',
  externalConfirm: '外部确认',
};
const VALUE_LABEL: Record<string, string> = {
  HIGH: '高',
  LOW: '低',
  POSITIVE: '阳性（可结案）',
  NEGATIVE: '阴性（不可结案）',
  NONE: '无',
  ENDING: '终局',
  FACT_ONLY: '仅事实',
};

/** 实际运行过的配置（去重；表只列实际运行项）。 */
const runIds = computed<ConfigId[]>(() => {
  const seen: ConfigId[] = [];
  for (const e of game.state.events) {
    if (e.code !== 'RUN_EXPERIMENT') continue;
    const id = (e.payload as { configId: ConfigId }).configId;
    if (!seen.includes(id)) seen.push(id);
  }
  return seen;
});
const ev23 = computed(() => runIds.value.length > 0);

// —— 结论槽（草稿持久化）——
const labelPair = ref<ConfigId[]>([...game.save.drafts.experimentSelection.labelPair]);
const scopePair = ref<ConfigId[]>([...game.save.drafts.experimentSelection.scopePair]);
const changed = ref<string[]>([]);
const p5Feedback = ref<string[]>([]);
const CHANGED_OPTIONS = [
  { key: 'endingLabel', label: '结局标签' },
  { key: 'externalConfirm', label: '外部终局确认' },
  { key: 'painScore', label: '疼痛评分（干扰项）' },
];

function persistDraft(): void {
  game.updateDrafts((d) => {
    d.experimentSelection.labelPair = [...labelPair.value];
    d.experimentSelection.scopePair = [...scopePair.value];
  });
}

function togglePair(list: ConfigId[], id: ConfigId): void {
  const i = list.indexOf(id);
  if (i >= 0) list.splice(i, 1);
  else {
    if (list.length >= 2) list.shift();
    list.push(id);
  }
  persistDraft();
}

function toggleChanged(key: string): void {
  const i = changed.value.indexOf(key);
  if (i >= 0) changed.value.splice(i, 1);
  else changed.value.push(key);
}

async function submitP5(): Promise<void> {
  const result = checkP5(game.state, labelPair.value, scopePair.value, changed.value);
  p5Feedback.value = result.conflicts;
  if (!result.ok) {
    await game.execute({ kind: 'puzzleAttempt', puzzleId: 'p5', choiceKeys: [...labelPair.value, ...scopePair.value, ...changed.value], feedbackKey: result.feedbackKey });
    return;
  }
  const okExec = await game.execute({
    kind: 'concludeExperiment',
    labelPair: [...labelPair.value],
    scopePair: [...scopePair.value],
    changed: [...changed.value],
  });
  if (okExec) persistDraft();
}
</script>

<template>
  <div class="lab">
    <h1>单变量实验 · 归档副本</h1>
    <p class="banner" data-testid="p09:banner">本实验运行在归档副本上：暂停或重跑都不影响正式患者记录。</p>

    <section class="panel">
      <h2>预置配置</h2>
      <p class="muted small">左侧三个字段固定：疼痛评分 / 结局标签 / 外部确认。不提供自定义组合。</p>
      <div class="configs">
        <article v-for="id in CONFIG_IDS" :key="id" class="config" :data-testid="`p09:config--${id}`">
          <h3>配置 {{ id }}</h3>
          <dl>
            <template v-for="(v, k) in EXPERIMENT_CONFIGS[id]" :key="k">
              <dt v-if="k !== 'configId' && k !== 'identityLost'">{{ FIELD_LABEL[k] }}</dt>
              <dd v-if="k !== 'configId' && k !== 'identityLost'">{{ VALUE_LABEL[v as string] }}</dd>
            </template>
          </dl>
          <button :data-testid="`p09:run--${id}`" @click="game.execute({ kind: 'runExperiment', configId: id })">
            运行
          </button>
          <span v-if="runIds.includes(id)" class="ok small">✓ 已运行</span>
        </article>
      </div>
    </section>

    <section v-if="ev23" class="panel">
      <h2>身份索引结果（只列实际运行项）</h2>
      <table data-testid="p09:results">
        <thead><tr><th>配置</th><th>评分</th><th>结局标签</th><th>外部确认</th><th>身份索引</th></tr></thead>
        <tbody>
          <tr v-for="id in runIds" :key="id" :data-testid="`p09:row--${id}`">
            <td class="mono">{{ id }}</td>
            <td>{{ VALUE_LABEL[EXPERIMENT_CONFIGS[id].painScore] }}</td>
            <td>{{ VALUE_LABEL[EXPERIMENT_CONFIGS[id].endingLabel] }}</td>
            <td>{{ VALUE_LABEL[EXPERIMENT_CONFIGS[id].externalConfirm] }}</td>
            <td :class="EXPERIMENT_CONFIGS[id].identityLost ? 'anomaly-text' : 'ok'">
              {{ EXPERIMENT_CONFIGS[id].identityLost ? '丢失' : '保留' }}
            </td>
          </tr>
        </tbody>
      </table>
      <p class="muted small">✓ EV23 已随首次运行取得。</p>
    </section>

    <section v-if="!facts.experimentConcluded" class="panel">
      <h2>两组对照（p5）</h2>
      <fieldset class="slots">
        <legend>① 标签对照：哪两行只差“结局标签”，而结局标签要靠外部确认才能生效？</legend>
        <label v-for="id in CONFIG_IDS" :key="id" class="marker small">
          <input type="checkbox" :checked="labelPair.includes(id)" :data-testid="`p09:label--${id}`" @change="togglePair(labelPair, id)" />
          {{ id }}
        </label>
      </fieldset>
      <fieldset class="slots">
        <legend>② 范围对照：哪两行只差“外部确认的有无或范围”？</legend>
        <label v-for="id in CONFIG_IDS" :key="id" class="marker small">
          <input type="checkbox" :checked="scopePair.includes(id)" :data-testid="`p09:scope--${id}`" @change="togglePair(scopePair, id)" />
          {{ id }}
        </label>
      </fieldset>
      <fieldset class="slots">
        <legend>③ 改变的变量（须同时且仅含两项）</legend>
        <label v-for="opt in CHANGED_OPTIONS" :key="opt.key" class="marker small">
          <input type="checkbox" :checked="changed.includes(opt.key)" :data-testid="`p09:changed--${opt.key}`" @change="toggleChanged(opt.key)" />
          {{ opt.label }}
        </label>
      </fieldset>
      <button class="primary" data-testid="p09:submit-p5" @click="submitP5">提交结论</button>
      <ul v-if="p5Feedback.length" class="feedback"><li v-for="(f, i) in p5Feedback" :key="i">{{ f }}</li></ul>
      <HintPanel puzzle-id="p5" />
    </section>

    <section v-else class="panel">
      <p class="ok">✓ 实验结论已成立（CLOSURE_PROVEN）：外部终局确认才是让标签落地的变量。</p>
      <p>
        <RouterLink to="/lab/slices" data-testid="p09:goto-slices">去处理切片 →</RouterLink>
      </p>
      <p class="muted small">待补交班事项：R06 程枝有新的本人表达，可在病历页保留。</p>
    </section>
  </div>
</template>

<style scoped>
.banner { background: #fdf6e3; border: 1px solid #d9c58a; border-radius: var(--radius); padding: var(--space-2) var(--space-3); }
.configs { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: var(--space-3); }
.config { border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-2) var(--space-3); }
.config dl { display: grid; grid-template-columns: auto 1fr; gap: var(--space-1) var(--space-2); margin: 0 0 var(--space-2); font-size: 0.9em; }
.config dt { color: var(--muted); }
.slots { border: 1px solid var(--line); border-radius: var(--radius); margin: var(--space-2) 0; display: flex; gap: var(--space-3); flex-wrap: wrap; }
.feedback { color: var(--error); }
.small { font-size: 0.85em; }
.ok { color: var(--clinical); }
</style>
