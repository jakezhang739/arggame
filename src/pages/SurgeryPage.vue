<script setup lang="ts">
/** P13 连接切除模拟（docs/03册 v1.1 §3）：九节点六边，全部只预览；无正式切除按钮。 */
import { computed, ref } from 'vue';
import { useGameStore } from '../stores/game';
import { content } from '../game/content';
import type { EdgeId } from '../game/types';

const game = useGameStore();
const facts = computed(() => game.state.facts);
const surgery = content.surgery as Record<
  EdgeId,
  { edge: EdgeId; label: string; preview: string; formalOption: boolean }
>;

const NODES = [
  { id: 'patient', label: '患者', x: 90, y: 80 },
  { id: 'statement', label: '本人陈述', x: 320, y: 80 },
  { id: 'queue', label: '公示队列', x: 550, y: 80 },
  { id: 'nursing', label: '护理记录', x: 90, y: 240 },
  { id: 'index', label: '身份索引', x: 320, y: 240 },
  { id: 'ending', label: '终局声明', x: 550, y: 240 },
  { id: 'followup', label: '后续随访', x: 90, y: 400 },
  { id: 'witness', label: '外部见证', x: 320, y: 400 },
  { id: 'fact', label: '护理事实', x: 550, y: 400 },
] as const;

/** 边端点（与列表等价）。 */
const EDGES: { id: EdgeId; from: string; to: string }[] = [
  { id: 'A', from: 'patient', to: 'statement' },
  { id: 'B', from: 'nursing', to: 'index' },
  { id: 'C', from: 'witness', to: 'fact' },
  { id: 'D', from: 'witness', to: 'ending' },
  { id: 'E', from: 'followup', to: 'nursing' },
  { id: 'F', from: 'ending', to: 'queue' },
];
function node(id: string) {
  return NODES.find((n) => n.id === id)!;
}
function edgePath(e: { from: string; to: string }): string {
  const a = node(e.from);
  const b = node(e.to);
  return `M ${a.x + 70} ${a.y + 24} L ${b.x} ${b.y + 24}`;
}

const selected = ref<EdgeId | null>(null);
const previewed = computed(() => facts.value.simulatedEdges);
const wipeShown = ref(false);

async function preview(edge: EdgeId): Promise<void> {
  selected.value = edge;
  await game.execute({ kind: 'severPreview', edge });
}
</script>

<template>
  <div class="surgery">
    <h1>连接切除模拟 · 副本</h1>
    <p class="muted">lab.chengwan/surgery · 九节点六边。点击任一边只在副本中预览；撤销不影响存档事实。</p>

    <div class="split">
      <section class="panel">
        <h2>关系图</h2>
        <svg viewBox="0 0 700 480" role="img" aria-label="九节点六边关系图：患者、本人陈述、公示队列、护理记录、身份索引、终局声明、后续随访、外部见证、护理事实" data-testid="p13:svg">
          <g v-for="e in EDGES" :key="e.id">
            <path
              :d="edgePath(e)"
              :class="['edge', { selected: selected === e.id, previewed: previewed.includes(e.id) }]"
              @click="preview(e.id)"
            />
            <text class="edgelabel" :x="(node(e.from).x + node(e.to).x) / 2 + 28" :y="(node(e.from).y + node(e.to).y) / 2 + 18">{{ e.id }}</text>
          </g>
          <g v-for="n in NODES" :key="n.id">
            <rect :x="n.x" :y="n.y" width="140" height="48" rx="8" class="node" />
            <text :x="n.x + 70" :y="n.y + 30">{{ n.label }}</text>
          </g>
        </svg>
        <p class="muted small">图上点击与下方列表按钮等价；键盘可用列表操作。</p>
      </section>

      <aside class="panel">
        <h2>关系列表（等价）</h2>
        <button
          v-for="e in EDGES"
          :key="e.id"
          class="ghost edgebtn"
          :data-testid="`p13:edge--${e.id}`"
          @click="preview(e.id)"
        >
          {{ e.id }} · {{ surgery[e.id].label }}
          <span v-if="previewed.includes(e.id)" class="ok">✓ 已预览</span>
        </button>
        <button class="ghost edgebtn muted" data-testid="p13:wipe" @click="wipeShown = !wipeShown">
          “清空全档”（仅解释卡）
        </button>
        <p v-if="wipeShown" class="muted small" data-testid="p13:wipe-card">
          清空全档会把九个节点全部断开：证据尽失，任何后续都无法承接。本模拟不提供执行按钮——这不是可选方案。
        </p>
      </aside>
    </div>

    <section v-if="selected" class="panel" :data-testid="`p13:preview--${selected}`">
      <h2>预览 · 边 {{ selected }}（{{ surgery[selected].label }}）</h2>
      <p>{{ surgery[selected].preview }}</p>
      <p class="muted small">
        后果区分身份、意愿、护理与传播；这只是副本上的解释，不改变任何存档事实。
        <span v-if="surgery[selected].formalOption">此边可作为正式方案（在“下一班与最终处理”页执行）。</span>
        <span v-else>此边不提供正式执行。</span>
      </p>
    </section>

    <p v-if="previewed.includes('D') || previewed.includes('F')" class="notice">
      已预览{{ [previewed.includes('D') ? 'D' : '', previewed.includes('F') ? 'F' : ''].filter(Boolean).join('、') }}的后果。
      <RouterLink to="/handover/next" data-testid="p13:goto-next">去整理下一班依据 →</RouterLink>
    </p>
  </div>
</template>

<style scoped>
.split { display: grid; grid-template-columns: 3fr 2fr; gap: var(--space-4); }
svg { width: 100%; height: auto; background: var(--surface); border: 1px solid var(--line); }
.node { fill: #e7ecea; stroke: var(--primary); stroke-width: 2; }
svg text { font-size: 20px; fill: var(--text); text-anchor: middle; }
.edgelabel { font-size: 22px; fill: #805600; font-weight: bold; }
.edge { stroke: var(--line); stroke-width: 5; fill: none; cursor: pointer; }
.edge.previewed { stroke: #b98a4f; }
.edge.selected { stroke: var(--primary); }
.edgebtn { display: block; width: 100%; text-align: left; margin: var(--space-1) 0; }
.small { font-size: 0.85em; }
.ok { color: var(--clinical); }
@media (max-width: 768px) { .split { grid-template-columns: 1fr; } }
</style>
