<script setup lang="ts">
/** 提示面板：三级提示（hints.json），点击即记 HINT_REQUESTED；提示不影响任何结局条件。
 *  测试模式下自动展开全部级别（只读展示，不写事件）。 */
import { computed } from 'vue';
import { useGameStore } from '../stores/game';
import { useSettingsStore } from '../stores/settings';
import { content } from '../game/content';
import type { PuzzleId } from '../game/types';

const props = defineProps<{ puzzleId: PuzzleId }>();
const game = useGameStore();
const settings = useSettingsStore();

const hints = computed<string[]>(() => content.hints[props.puzzleId] ?? []);
const walkthrough = computed(() => settings.data.walkthrough);

/** 已揭示的最高级别（由事件派生，刷新后保持）。 */
const revealed = computed(() => {
  if (walkthrough.value) return hints.value.length;
  let max = 0;
  for (const e of game.state.events) {
    if (e.code !== 'HINT_REQUESTED') continue;
    const p = e.payload as { puzzleId: string; level: number };
    if (p.puzzleId === props.puzzleId && p.level > max) max = p.level;
  }
  return max;
});

async function reveal(level: number): Promise<void> {
  if (walkthrough.value || level > revealed.value + 1) return; // 逐级展开
  await game.execute({ kind: 'hint', puzzleId: props.puzzleId, level: level as 1 | 2 | 3 });
}
</script>

<template>
  <!-- 测试模式：直接给答案，不显示分级提示 -->
  <aside v-if="walkthrough" class="hints answer-mode" data-testid="walkthrough:answer">
    <strong>答案（测试模式）</strong>
    <p>{{ hints[hints.length - 1] }}</p>
  </aside>
  <details v-else class="hints" :data-testid="`hint:panel--${puzzleId}`">
    <summary>需要提示？</summary>
    <p class="muted small">提示只指出思考方向，不替代答案；使用提示不影响结局。</p>
    <ol>
      <li v-for="(text, i) in hints" :key="i">
        <template v-if="revealed >= i + 1">
          <span :data-testid="`hint:text--${i + 1}`">{{ text }}</span>
        </template>
        <button
          v-else-if="revealed === i"
          :data-testid="`hint:btn--${i + 1}`"
          class="ghost"
          @click="reveal(i + 1)"
        >
          展开第 {{ i + 1 }} 级提示
        </button>
        <span v-else class="muted">（先看上一级）</span>
      </li>
    </ol>
  </details>
</template>

<style scoped>
.hints {
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius);
  padding: var(--space-3) var(--space-4);
  margin-top: var(--space-4);
  background: rgba(255, 255, 255, 0.38);
}
.hints summary {
  cursor: pointer;
  color: var(--muted);
  font-size: 0.88rem;
  letter-spacing: 0.02em;
}
.answer-mode {
  border: 1px dashed #b98a4f;
  border-left: 4px solid #d5aa53;
  background: rgba(213, 170, 83, 0.1);
}
.answer-mode strong { color: #805600; }
.answer-mode p { margin: var(--space-1) 0 0; line-height: 1.7; }
.small {
  font-size: 0.85em;
}
</style>
