<script setup lang="ts">
/** 版本对照（docs/11 Batch 4 §3）：同步滚动＋共用痕迹内联可视化＋相反语气同一栅格。
 *  内联片段与复选框等价（键盘/触屏均可），标记后两栏同步高亮暴露同源。 */
import { computed, ref } from 'vue';

const props = defineProps<{
  leftTitle: string;
  leftText: string;
  rightTitle: string;
  rightText: string;
  options: { key: string; label: string }[];
  inlineMarks?: { key: string; needle: string }[];
}>();
const model = defineModel<string[]>({ default: () => [] });

const leftBox = ref<HTMLElement | null>(null);
const rightBox = ref<HTMLElement | null>(null);
const syncScroll = ref(true);

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

interface Segment {
  text: string;
  mark?: { key: string; needle: string };
}

/** 把正文按内联痕迹切段；标记后高亮。 */
function segment(text: string): Segment[] {
  const marks = props.inlineMarks ?? [];
  if (!marks.length) return [{ text }];
  const found: { index: number; mark: { key: string; needle: string } }[] = [];
  for (const mark of marks) {
    const index = text.indexOf(mark.needle);
    if (index >= 0) found.push({ index, mark });
  }
  found.sort((a, b) => a.index - b.index);
  const out: Segment[] = [];
  let cursor = 0;
  for (const f of found) {
    if (f.index > cursor) out.push({ text: text.slice(cursor, f.index) });
    out.push({ text: f.mark.needle, mark: f.mark });
    cursor = f.index + f.mark.needle.length;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor) });
  return out;
}

const leftSegments = computed(() => segment(props.leftText));
const rightSegments = computed(() => segment(props.rightText));
const marked = (key: string): boolean => model.value.includes(key);
</script>

<template>
  <div class="diff">
    <label class="sync small">
      <input type="checkbox" v-model="syncScroll" data-testid="diff:sync" /> 同步滚动
    </label>
    <div class="panes">
      <div class="pane">
        <h4 class="tone-positive">{{ props.leftTitle }}</h4>
        <div ref="leftBox" class="doc tone-positive" data-testid="diff:left" @scroll="onScroll('l')"><template
            v-for="(s, i) in leftSegments"
            :key="i"
          ><span
            v-if="s.mark"
            class="inline-mark"
            :class="{ marked: marked(s.mark.key) }"
            role="button"
            tabindex="0"
            :data-testid="`diff:inline--${s.mark.key}`"
            :aria-pressed="marked(s.mark.key)"
            @click="toggle(s.mark.key)"
            @keydown.enter="toggle(s.mark.key)"
          >{{ s.text }}</span><template v-else>{{ s.text }}</template></template></div>
      </div>
      <div class="pane">
        <h4 class="tone-negative">{{ props.rightTitle }}</h4>
        <div ref="rightBox" class="doc tone-negative" data-testid="diff:right" @scroll="onScroll('r')"><template
            v-for="(s, i) in rightSegments"
            :key="i"
          ><span
            v-if="s.mark"
            class="inline-mark"
            :class="{ marked: marked(s.mark.key) }"
            role="button"
            tabindex="0"
            :data-testid="`diff:inline--${s.mark.key}`"
            :aria-pressed="marked(s.mark.key)"
            @click="toggle(s.mark.key)"
            @keydown.enter="toggle(s.mark.key)"
          >{{ s.text }}</span><template v-else>{{ s.text }}</template></template></div>
      </div>
    </div>
    <fieldset class="markers">
      <legend>在两份文档中共同标记（与正文点选等价）：</legend>
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
.pane h4 { margin: 0 0 var(--space-1); position: sticky; font-size: 0.9em; }
.doc {
  max-height: 320px;
  overflow-y: auto;
  white-space: pre-wrap;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: var(--space-3);
  font-size: 0.92em;
  line-height: 1.75;
}
/* 相反语气，同一栅格：左冷静、右激烈，字号行距完全一致 */
.tone-positive { background: #f3f7f4; border-color: #c3d2c8; }
.tone-positive h4, h4.tone-positive { color: #44625a; }
.tone-negative { background: #f8f2ee; border-color: #d6c2b8; }
.tone-negative h4, h4.tone-negative { color: #7a4a3d; }
.inline-mark {
  cursor: pointer;
  border-bottom: 2px dashed var(--muted);
  padding: 0 1px;
}
.inline-mark:hover { background: rgba(213, 170, 83, 0.18); }
.inline-mark.marked {
  background: rgba(213, 170, 83, 0.32);
  border-bottom: 2px solid #ad8a42;
  font-weight: 600;
}
.inline-mark:focus-visible { outline: 3px solid #2f6db8; outline-offset: 1px; }
.markers { border: 1px solid var(--line); border-radius: var(--radius); margin-top: var(--space-3); display: flex; gap: var(--space-4); flex-wrap: wrap; }
.marker { cursor: pointer; }
.sync { display: inline-block; margin-bottom: var(--space-1); }
.small { font-size: 0.85em; }
@media (max-width: 768px) {
  .panes { grid-template-columns: 1fr; }
}
</style>
