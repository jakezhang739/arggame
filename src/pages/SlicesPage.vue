<script setup lang="ts">
/** P10 处理切片（docs/03册 v1.1 §3）：六层可开关的病例处理图 + 明确检查点（不找像素）。 */
import { computed, reactive, ref } from 'vue';
import { useGameStore } from '../stores/game';
import { isAcquired } from '../game/selectors';

const game = useGameStore();
const ev24 = computed(() => isAcquired(game.state, 'EV24'));

const LAYERS = [
  { id: 'L1', label: '原始记录' },
  { id: 'L2', label: '身份关联' },
  { id: 'L3', label: '摘要生成' },
  { id: 'L4', label: '预填终局' },
  { id: 'L5', label: '外部确认' },
  { id: 'L6', label: '归档投影' },
] as const;
const active = reactive<Record<string, boolean>>({ L1: true, L2: true, L3: true, L4: false, L5: false, L6: false });

/** “长形空白”仅在含终局确认的阶段连通（L4/L5/L6 任一开启）。 */
const gapConnected = computed(() => active.L4 || active.L5 || active.L6);

const magnified = ref(false);
async function inspect(): Promise<void> {
  await game.execute({ kind: 'inspectSlice' });
}
</script>

<template>
  <div class="slices">
    <h1>处理切片 · 批量流程透视</h1>
    <p class="muted">lab.chengwan/slices · 归档副本上的渲染结构，不模拟真实医学影像。</p>

    <div class="split">
      <section class="panel">
        <h2>六层切片</h2>
        <fieldset class="layer-toggles">
          <legend>开关各层</legend>
          <label v-for="l in LAYERS" :key="l.id" class="marker small">
            <input type="checkbox" v-model="active[l.id]" :data-testid="`p10:layer--${l.id}`" />
            {{ l.label }}
          </label>
        </fieldset>
        <svg viewBox="0 0 640 420" role="img" aria-label="病例处理切片：六层横向堆叠；开启含终局确认的层后出现一条从姓名缺口到签名位的长形空白" data-testid="p10:svg">
          <g v-for="(l, i) in LAYERS" :key="l.id">
            <rect
              v-if="active[l.id]"
              :x="40" :y="30 + i * 62" width="560" height="46"
              rx="6"
              :class="['L4', 'L5', 'L6'].includes(l.id) ? 'band ending' : 'band'"
            />
            <text v-if="active[l.id]" :x="60" :y="30 + i * 62 + 30">{{ l.label }}</text>
            <text v-if="active[l.id]" class="mono detail" :x="200" :y="30 + i * 62 + 30">
              {{ l.id === 'L1' ? 'R01–R06 护理数据（原始）' : '' }}
              {{ l.id === 'L2' ? '姓名 → 索引（R03 缺口）' : '' }}
              {{ l.id === 'L3' ? 'NAR_0042 摘要生成' : '' }}
              {{ l.id === 'L4' ? '预填：可申请整批结案' : '' }}
              {{ l.id === 'L5' ? '外部确认：终局' : '' }}
              {{ l.id === 'L6' ? '公示队列投影' : '' }}
            </text>
          </g>
          <!-- 长形空白：姓名缺口经删线到签名位，仅在含终局确认的阶段连通 -->
          <g v-if="gapConnected" data-testid="p10:long-gap">
            <path d="M 520 46 V 374" class="gap" />
            <text class="mono gaplabel" x="530" y="210">长形空白</text>
          </g>
        </svg>
        <button
          class="ghost"
          data-testid="p10:magnify"
          @click="magnified = !magnified"
        >
          {{ magnified ? '收起放大' : '放大检查授权句' }}
        </button>
        <div v-if="magnified" class="zoombox" data-testid="p10:zoom">
          <p class="mono">「已核对事实，因此接受终局」</p>
          <p class="muted small">这一句出现在预填终局层的签名位旁。它核对的是护理事实，接受的却是人生终局。</p>
          <button v-if="!ev24" class="primary" data-testid="p10:inspect" @click="inspect">
            已核对事实，确认发现
          </button>
          <p v-else class="ok">✓ EV24 已取得（授权句已核对）。</p>
        </div>
      </section>

      <aside class="panel">
        <h2>阶段文字列表（与图等价）</h2>
        <ol class="small">
          <li :class="{ dim: !active.L1 }">原始记录：当班护理数据。</li>
          <li :class="{ dim: !active.L2 }">身份关联：姓名指向索引；R03 的联系在此被断开。</li>
          <li :class="{ dim: !active.L3 }">摘要生成：NAR_0042 模板把记录改写为叙事。</li>
          <li :class="{ dim: !active.L4 }">预填终局：给出可结案的结论草稿。</li>
          <li :class="{ dim: !active.L5 }">外部确认：终局在此生效。</li>
          <li :class="{ dim: !active.L6 }">归档投影：对外显示的名单与状态。</li>
        </ol>
        <p class="muted small">不需要找像素：列表与放大按钮给出相同结论。</p>
        <p v-if="ev24">
          <RouterLink to="/trail" data-testid="p10:goto-trail">去轨迹异议工作台 →</RouterLink>
        </p>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.split { display: grid; grid-template-columns: 2fr 1fr; gap: var(--space-4); }
.layer-toggles { display: flex; gap: var(--space-3); flex-wrap: wrap; border: 1px solid var(--line); border-radius: var(--radius); }
svg { width: 100%; height: auto; background: var(--surface); border: 1px solid var(--line); margin-top: var(--space-2); }
.band { fill: #e7ecea; stroke: var(--line); }
.band.ending { fill: #f3e3d3; stroke: #b98a4f; }
.detail { font-size: 18px; fill: var(--muted); }
.gap { stroke: #9F3030; stroke-width: 10; stroke-dasharray: 4 6; opacity: 0.55; }
.gaplabel { font-size: 16px; fill: #9F3030; }
.zoombox { border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-3); margin-top: var(--space-2); background: #fbf8f1; }
.dim { opacity: 0.35; }
.small { font-size: 0.85em; }
.ok { color: var(--clinical); }
@media (max-width: 768px) { .split { grid-template-columns: 1fr; } }
</style>
