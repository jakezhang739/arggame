<script setup lang="ts">
/**
 * P09 单变量实验（docs/11 Batch 4 §4）：先选想验证的假说，再推荐最小对照组；
 * 结果用"身份保留／联系断开"可视化，配置字母退为二级元数据。
 */
import { computed, ref } from 'vue';
import { useGameStore } from '../stores/game';
import { EXPERIMENT_CONFIGS, checkP5 } from '../game/gates';
import type { ConfigId } from '../game/types';
import CompletionPanel from '../components/CompletionPanel.vue';
import HintPanel from '../components/HintPanel.vue';
import LiteratureExcerpt from '../components/LiteratureExcerpt.vue';

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

// —— 假说先行（不设门：选择只为推荐最小对照组）——
const HYPOTHESES = [
  { key: 'ENDING_LABEL', label: '结局标签本身让结论生效', recommend: '标签对照推荐 B＋D（其余字段一致，只有标签相反）' },
  { key: 'EXTERNAL_CONFIRM', label: '外部终局确认让标签落地', recommend: '范围对照推荐 A＋B、C＋D 或 B＋F（只差外部确认的有无或范围）' },
  { key: 'PAIN_SCORE', label: '疼痛评分决定一切', recommend: '注意 E：它同时改变评分，是混杂反例，不能作对照' },
] as const;
const hypothesis = ref('');
const hypothesisNote = computed(() => HYPOTHESES.find((h) => h.key === hypothesis.value)?.recommend ?? '');

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

    <!-- 第一步：假说先行 -->
    <section class="panel">
      <h2>你想验证什么？</h2>
      <p class="muted small">先说你想排除的解释，实验台再告诉你需要哪几行对照。</p>
      <fieldset class="hyp">
        <legend>我怀疑真正的触发条件是</legend>
        <label v-for="h in HYPOTHESES" :key="h.key" class="marker">
          <input type="radio" name="hypothesis" :value="h.key" v-model="hypothesis" :data-testid="`p09:hyp--${h.key}`" />
          {{ h.label }}
        </label>
      </fieldset>
      <p v-if="hypothesisNote" class="notice small" data-testid="p09:hyp-note">{{ hypothesisNote }}</p>
    </section>

    <!-- 第二步：运行配置 -->
    <section class="panel">
      <h2>归档副本 · 预置运行</h2>
      <p class="muted small">每个配置代表一种当日参数组合；字母只是台账编号。运行后看最右一列。</p>
      <div class="configs">
        <article v-for="id in CONFIG_IDS" :key="id" class="config" :data-testid="`p09:config--${id}`">
          <h3>参数组 <small class="mono muted">{{ id }}</small></h3>
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

    <!-- 第三步：结果（身份保留/联系断开可视化） -->
    <section v-if="ev23" class="panel">
      <h2>结果：身份联系还在吗？</h2>
      <table data-testid="p09:results">
        <thead><tr><th>参数组</th><th>评分</th><th>结局标签</th><th>外部确认</th><th>身份联系</th></tr></thead>
        <tbody>
          <tr v-for="id in runIds" :key="id" :data-testid="`p09:row--${id}`">
            <td class="mono muted">{{ id }}</td>
            <td>{{ VALUE_LABEL[EXPERIMENT_CONFIGS[id].painScore] }}</td>
            <td>{{ VALUE_LABEL[EXPERIMENT_CONFIGS[id].endingLabel] }}</td>
            <td>{{ VALUE_LABEL[EXPERIMENT_CONFIGS[id].externalConfirm] }}</td>
            <td>
              <span class="chip" :class="EXPERIMENT_CONFIGS[id].identityLost ? 'chip-lost' : 'chip-kept'">
                {{ EXPERIMENT_CONFIGS[id].identityLost ? '联系断开' : '身份保留' }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
      <p class="muted small">《实验运行表》已随首次运行存档。<small class="mono">EV23</small></p>
    </section>

    <!-- 第四步：对照结论 -->
    <section v-if="!facts.experimentConcluded" class="panel">
      <h2>两组对照</h2>
      <fieldset class="slots">
        <legend>① 标签对照：哪两行只差“结局标签”，而结局标签要靠外部确认才能生效？</legend>
        <label v-for="id in CONFIG_IDS" :key="id" class="marker small">
          <input type="checkbox" :checked="labelPair.includes(id)" :data-testid="`p09:label--${id}`" @change="togglePair(labelPair, id)" />
          参数组 <span class="mono">{{ id }}</span>
        </label>
      </fieldset>
      <fieldset class="slots">
        <legend>② 范围对照：哪两行只差“外部确认的有无或范围”？</legend>
        <label v-for="id in CONFIG_IDS" :key="id" class="marker small">
          <input type="checkbox" :checked="scopePair.includes(id)" :data-testid="`p09:scope--${id}`" @change="togglePair(scopePair, id)" />
          参数组 <span class="mono">{{ id }}</span>
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
      <p class="ok">✓ 实验结论已成立：外部终局确认才是让结局标签落地的变量。</p>
      <CompletionPanel
        testid="p09:concluded"
        proved="标签不咬人，「外部终局确认」才咬人。它一在场，结局标签落地，身份联系断开。评分高低、正负说法，都不是关键。"
        excluded="「结论好坏导致改写」被 B＋D 和 B＋F 两组对照堵死了。"
        opened="处理切片：看看这条错误的等式写在流程的哪一层。"
        action-label="去处理切片"
        action-to="/lab/slices"
      />
    </section>

    <!-- R-NM 可选解释卡（07册 §4.1） -->
    <section v-if="facts.dualSourceProven" class="panel shelfcard" aria-labelledby="p09-rnm-h">
      <h2 id="p09-rnm-h">旁证材料（可选）</h2>
      <LiteratureExcerpt id="R-NM" />
      <p class="muted small">可选解释卡：同一个核心值，被译成两种结论——实验结果印证了“翻译层”而非“病情层”的差异。</p>
    </section>
  </div>
</template>

<style scoped>
.banner { background: #fdf6e3; border: 1px solid #d9c58a; border-radius: var(--radius); padding: var(--space-2) var(--space-3); }
.hyp { border: 1px dashed var(--line); border-radius: var(--radius); padding: var(--space-3); display: grid; gap: var(--space-2); max-width: 620px; }
.configs { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: var(--space-3); }
.config { border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-2) var(--space-3); }
.config h3 { font-size: 0.95em; margin: 0 0 var(--space-1); }
.config dl { display: grid; grid-template-columns: auto 1fr; gap: var(--space-1) var(--space-2); margin: 0 0 var(--space-2); font-size: 0.9em; }
.config dt { color: var(--muted); }
.chip { display: inline-block; padding: 2px var(--space-2); border-radius: 999px; font-size: 0.8em; font-weight: 700; }
.chip-kept { background: rgba(36, 90, 72, 0.12); color: #245a48; }
.chip-lost { background: rgba(168, 92, 85, 0.16); color: #8d4a44; }
.slots { border: 1px solid var(--line); border-radius: var(--radius); margin: var(--space-2) 0; display: flex; gap: var(--space-3); flex-wrap: wrap; }
.literature { border-left: 4px solid var(--primary); margin: var(--space-2) 0; padding-left: var(--space-3); }
.shelfcard { border-style: dashed; }
.feedback { color: var(--error); }
.small { font-size: 0.85em; }
.ok { color: var(--clinical); }
</style>
