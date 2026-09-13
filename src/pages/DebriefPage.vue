<script setup lang="ts">
/** P16 复盘（docs/03册 v1.1 §3）：五张解释卡重排/展开；真实尝试（PUZZLE_ATTEMPT）；文学卡与结局条件。 */
import { computed, ref } from 'vue';
import { useGameStore } from '../stores/game';
import { content } from '../game/content';

const game = useGameStore();

interface DebriefCard { id: string; front: string; body: string }
const cards = ref<DebriefCard[]>(
  [...((content.endings as { debrief: { cards: DebriefCard[] } }).debrief.cards)],
);
const expanded = ref<string | null>(null);

function moveUp(i: number): void {
  if (i <= 0) return;
  const c = cards.value.splice(i, 1)[0];
  cards.value.splice(i - 1, 0, c);
}
function moveDown(i: number): void {
  if (i >= cards.value.length - 1) return;
  const c = cards.value.splice(i, 1)[0];
  cards.value.splice(i + 1, 0, c);
}

/** 只显示玩家确实提交过的尝试（feedbackKey 非 accepted）。 */
const attempts = computed(() => {
  const rows: { puzzleId: string; choiceKeys: string[]; feedbackKey: string }[] = [];
  for (const e of game.state.events) {
    if (e.code !== 'PUZZLE_ATTEMPT') continue;
    const p = e.payload as { puzzleId: string; choiceKeys: string[]; feedbackKey: string };
    rows.push(p);
  }
  return rows;
});

const endingRows = computed(() =>
  (['A', 'B', 'C'] as const).map((id) => ({
    id,
    title: (content.endings[id] as { title: string }).title,
    trigger: (content.endings[id] as { trigger: string }).trigger,
    actual: game.state.ending === id,
  })),
);

const PUZZLE_LABEL: Record<string, string> = {
  p1: 'p1 异常复查',
  p2: 'p2 时间线',
  m7: 'M-7 架构判断',
  p3: 'p3 三联',
  p4: 'p4 来源标记',
  rnm: 'R-NM 接口判断',
  p5: 'p5 实验对照',
  p6: 'p6 轨迹异议',
  a1: 'a1 录音排序',
  p7: 'p7 切除模拟',
  p8: 'p8 下一班',
};
</script>

<template>
  <div class="debrief">
    <h1>复盘</h1>
    <p class="muted small">目标 5–8 分钟；可跳过。回到实际结局不会改变任何事件。</p>

    <section class="panel">
      <h2>五张解释卡（可重排，也可直接展开）</h2>
      <ol class="deck">
        <li v-for="(c, i) in cards" :key="c.id" class="card" :data-testid="`p16:card--${c.id}`">
          <div class="card-head">
            <strong>{{ c.front }}</strong>
            <button class="ghost small" :data-testid="`p16:up--${c.id}`" @click="moveUp(i)">↑</button>
            <button class="ghost small" :data-testid="`p16:down--${c.id}`" @click="moveDown(i)">↓</button>
            <button class="ghost small" :data-testid="`p16:expand--${c.id}`" @click="expanded = expanded === c.id ? null : c.id">
              {{ expanded === c.id ? '收起' : '展开' }}
            </button>
          </div>
          <p v-if="expanded === c.id" class="small">{{ c.body }}</p>
        </li>
      </ol>
    </section>

    <section class="panel">
      <h2>你尝试过的解释</h2>
      <p v-if="attempts.length === 0" class="muted" data-testid="p16:no-attempts">本局未记录其他提交解释。</p>
      <ul v-else class="small" data-testid="p16:attempts">
        <li v-for="(a, i) in attempts" :key="i">
          {{ PUZZLE_LABEL[a.puzzleId] ?? a.puzzleId }}：提交过
          <span class="mono">{{ a.choiceKeys.filter(Boolean).join('，') || '（空）' }}</span>，未被证据支持。
        </li>
      </ul>
    </section>

    <section class="panel">
      <h2>四部文学卡回看</h2>
      <article v-for="id in (['M-7', 'W-F', 'R-NM', 'U-R'] as const)" :key="id" class="literature-card">
        <h3>{{ id }} · {{ content.literature[id].work }}</h3>
        <p>{{ content.literature[id].excerpt }}</p>
        <p class="muted small">
          版本：{{ content.literature[id].edition }}。游戏对原文有改造；出处与改造说明以卡面为准。
          <a :href="content.literature[id].sourceUrl" target="_blank" rel="noopener noreferrer">原文入口（可选）</a>
        </p>
      </article>
    </section>

    <section class="panel">
      <h2>三种结局的触发条件</h2>
      <table>
        <thead><tr><th>结局</th><th>触发条件</th><th>本局</th></tr></thead>
        <tbody>
          <tr v-for="r in endingRows" :key="r.id">
            <td>{{ r.id }} · {{ r.title }}</td>
            <td class="small">{{ r.trigger }}</td>
            <td>{{ r.actual ? '✓ 实际结局' : '' }}</td>
          </tr>
        </tbody>
      </table>
      <p class="muted small">复盘小游戏不计结局。</p>
    </section>

    <p>
      <button class="ghost" data-testid="p16:export-report" @click="game.exportReport()">导出试玩报告</button>
      <RouterLink to="/" class="button" data-testid="p16:exit">退出</RouterLink>
    </p>
  </div>
</template>

<style scoped>
.deck { list-style: none; padding: 0; display: grid; gap: var(--space-2); max-width: 640px; }
.card { border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-2) var(--space-3); }
.card-head { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
.literature-card { border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-2) var(--space-3); margin: var(--space-2) 0; }
.small { font-size: 0.85em; }
</style>
