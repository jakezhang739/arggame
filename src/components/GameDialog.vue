<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  speaker: string;
  lines: string[];
  open: boolean;
}>();
const emit = defineEmits<{ (e: 'update:open', v: boolean): void; (e: 'done'): void }>();

const index = ref(0);
watch(
  () => props.open,
  (v) => {
    if (v) index.value = 0;
  },
);

function advance(): void {
  if (index.value < props.lines.length - 1) {
    index.value += 1;
  } else {
    emit('update:open', false);
    emit('done');
  }
}
</script>

<template>
  <div
    v-if="open"
    class="dialog panel"
    role="dialog"
    :aria-label="`${speaker}的话`"
    @click="advance"
    @keydown.space.prevent="advance"
    @keydown.enter.prevent="advance"
    tabindex="0"
  >
    <p class="speaker">{{ speaker }}</p>
    <p class="line">{{ lines[index] }}</p>
    <p class="muted hint">
      {{ index < lines.length - 1 ? '（点击或按空格继续）' : '（点击结束）' }}
    </p>
    <slot />
  </div>
</template>

<style scoped>
.dialog {
  max-width: 560px;
  border-left: 4px solid var(--clinical);
  cursor: pointer;
}
.speaker {
  margin: 0 0 var(--space-1);
  font-weight: 600;
  color: var(--clinical);
  font-size: 0.78rem;
  letter-spacing: 0.08em;
}
.line {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 1.08rem;
  line-height: 1.85;
  white-space: pre-wrap;
}
.hint {
  font-size: 0.8em;
  margin: var(--space-2) 0 0;
}
</style>
