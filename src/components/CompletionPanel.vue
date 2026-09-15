<script setup lang="ts">
/** 四段式完成反馈（08册 §4.3）：证明了什么／排除了什么／开放了什么／唯一继续按钮。 */
import { RouterLink } from 'vue-router';
import AppIcon from './AppIcon.vue';

withDefaults(
  defineProps<{
    proved: string;
    excluded: string;
    opened: string;
    actionLabel: string;
    actionTo?: string;
    testid?: string;
  }>(),
  { actionTo: undefined, testid: 'completion-panel' },
);
const emit = defineEmits<{ action: [] }>();
</script>

<template>
  <section class="completion" :data-testid="testid">
    <h3><AppIcon name="check" :size="16" /> 刚才这一步</h3>
    <ul>
      <li><strong>查实了</strong><span>{{ proved }}</span></li>
      <li><strong>能排除</strong><span>{{ excluded }}</span></li>
      <li><strong>下一步</strong><span>{{ opened }}</span></li>
    </ul>
    <RouterLink
      v-if="actionTo"
      class="button primary completion-action"
      :to="actionTo"
      :data-testid="`${testid}--action`"
    >
      {{ actionLabel }} <AppIcon name="arrow" :size="16" />
    </RouterLink>
    <button
      v-else
      type="button"
      class="button primary completion-action"
      :data-testid="`${testid}--action`"
      @click="emit('action')"
    >
      {{ actionLabel }} <AppIcon name="arrow" :size="16" />
    </button>
  </section>
</template>

<style scoped>
.completion {
  border: 1px solid #6f867b;
  border-left: 4px solid var(--clinical);
  border-radius: var(--radius);
  padding: var(--space-3) var(--space-4);
  background: #f4f8f5;
  display: grid;
  gap: var(--space-2);
}
.completion h3 {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  font-size: 0.92rem;
  color: var(--clinical);
}
.completion ul { margin: 0; padding: 0; list-style: none; display: grid; gap: var(--space-1); }
.completion li { display: grid; grid-template-columns: 4.5em 1fr; gap: var(--space-2); font-size: 0.85rem; line-height: 1.6; }
.completion strong { color: var(--muted); font-weight: 600; }
.completion-action { justify-content: space-between; }
</style>
