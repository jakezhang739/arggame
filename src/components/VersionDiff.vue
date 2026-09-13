<script setup lang="ts">
/** 版本对照：左右原稿并列 + 标记选项（键盘可选）。同步滚动可选（docs/03册 v1.1 §2）。 */
import { ref, watch } from 'vue';

const props = defineProps<{
  leftTitle: string;
  leftText: string;
  rightTitle: string;
  rightText: string;
  options: { key: string; label: string }[];
}>();
const model = defineModel<string[]>({ default: () => [] });

const leftBox = ref<HTMLElement | null>(null);
const rightBox = ref<HTMLElement | null>(null);
const syncScroll = ref(true);

watch(
  () => [leftBox.value, rightBox.value, syncScroll.value],
  () => undefined,
);

function onScroll(which: 'l' | 'r'): void {
  if (!syncScroll.value) return;
  const a = which === 'l' ? leftBox.value : rightBox.value;
  const b = which === 'l' ? rightBox.value : leftBox.value;
  if (a && b) b.scrollTop = a.scrollTop;
}

function toggle(key: string): void {
  const i = model.value.indexOf(key);
  if (i >= 0) model.value.splice(i, 1);
  else model.value.push(key);
}
</script>

<template>
  <div class="diff">
    <label class="sync small">
      <input type="checkbox" v-model="syncScroll" data-testid="diff:sync" /> 同步滚动
    </label>
    <div class="panes">
      <div class="pane">
        <h4>{{ props.leftTitle }}</h4>
        <div ref="leftBox" class="doc" data-testid="diff:left" @scroll="onScroll('l')">{{ props.leftText }}</div>
      </div>
      <div class="pane">
        <h4>{{ props.rightTitle }}</h4>
        <div ref="rightBox" class="doc" data-testid="diff:right" @scroll="onScroll('r')">{{ props.rightText }}</div>
      </div>
    </div>
    <fieldset class="markers">
      <legend>在两份文档中共同标记：</legend>
      <label v-for="opt in props.options" :key="opt.key" class="marker">
        <input
          type="checkbox"
          :checked="model.includes(opt.key)"
          :data-testid="`diff:marker--${opt.key}`"
          @change="toggle(opt.key)"
        />
        {{ opt.label }}
      </label>
    </fieldset>
  </div>
</template>

<style scoped>
.diff { margin-top: var(--space-3); }
.panes { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
.pane h4 { margin: 0 0 var(--space-1); position: sticky; }
.doc { max-height: 320px; overflow-y: auto; white-space: pre-wrap; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-3); }
.markers { border: 1px solid var(--line); border-radius: var(--radius); margin-top: var(--space-3); display: flex; gap: var(--space-4); flex-wrap: wrap; }
.marker { cursor: pointer; }
.sync { display: inline-block; margin-bottom: var(--space-1); }
.small { font-size: 0.85em; }
@media (max-width: 768px) {
  .panes { grid-template-columns: 1fr; }
}
</style>
