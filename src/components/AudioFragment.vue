<script setup lang="ts">
/** AudioFragment（docs/03册 v1.1 §2）：播放/暂停/重播、客观字幕、波形（真实峰值）、跨切点锚点。
 *  只有用户点击才出声；全局单音源（audio store）；音频缺失时字幕仍可读（等价降级）。 */
import { computed, ref } from 'vue';
import { useAudioStore } from '../stores/audio';
import { useGameStore } from '../stores/game';
import { content } from '../game/content';

const props = withDefaults(
  defineProps<{
    audioId: string;
    title?: string;
    /** 音频缺失时的等价文字（兜底字幕）。 */
    transcript?: string;
    /** 是否显示跨切点锚点层（P12 用）。 */
    showAnchors?: boolean;
    /** 客观字幕默认展开（docs：客观字幕不被关闭解释层一起隐藏）。 */
    captionsOpen?: boolean;
  }>(),
  { showAnchors: false, captionsOpen: true },
);
const emit = defineEmits<{ (e: 'played'): void }>();

const audio = useAudioStore();
const game = useGameStore();
const captionsOpen = ref(props.captionsOpen);

const timing = computed(() => content.audioTimings[props.audioId]);
/** 400 点 → 最多 80 根柱（分桶取最大）。 */
const bars = computed(() => {
  const p = timing.value?.peaks ?? [];
  if (!p.length) return Array.from({ length: 40 }, () => 0.15);
  const group = Math.ceil(p.length / 80);
  const out: number[] = [];
  for (let i = 0; i < p.length; i += group) {
    out.push(Math.max(...p.slice(i, i + group)));
  }
  return out;
});
const progress = computed(() => {
  if (audio.playing !== props.audioId) return 0;
  const d = timing.value?.durationMs ?? audio.durationMs;
  return d > 0 ? Math.min(1, audio.currentTimeMs / d) : 0;
});
const captions = computed(() => timing.value?.captionCues ?? []);
const anchors = computed(() => (props.showAnchors ? (timing.value?.anchorCues ?? []) : []));
const activeCaptionIdx = computed(() => {
  if (audio.playing !== props.audioId) return -1;
  const t = audio.currentTimeMs;
  return captions.value.findIndex((c) => t >= c.startMs && t < Math.max(c.endMs, c.startMs + 1));
});
const activeAnchorId = computed(() => {
  if (audio.playing !== props.audioId) return null;
  const t = audio.currentTimeMs;
  return anchors.value.find((a) => t >= a.startMs && t <= a.endMs)?.id ?? null;
});
const isUnavailable = computed(() => audio.isUnavailable(props.audioId));
const isPlaying = computed(() => audio.playing === props.audioId);

function play(): void {
  void game.execute({ kind: 'playAudio', audioId: props.audioId as 'AUD01' });
  audio.play(props.audioId);
  captionsOpen.value = true;
  emit('played');
}
</script>

<template>
  <div class="frag" :data-testid="`audio:frag--${audioId}`">
    <div class="row">
      <button :data-testid="`audio:play--${audioId}`" @click="isPlaying ? audio.stop() : play()">
        {{ isPlaying ? '暂停' : '播放' }}
      </button>
      <button
        v-if="isPlaying"
        class="ghost"
        :data-testid="`audio:replay--${audioId}`"
        @click="play()"
      >
        重播
      </button>
      <strong v-if="title">{{ title }}</strong>
      <span v-if="timing" class="muted small mono"
        >{{ (timing.durationMs / 1000).toFixed(1) }}s</span
      >
      <span v-if="isUnavailable" class="muted small" :data-testid="`audio:unavailable--${audioId}`">
        音频暂不可用；以下字幕与音频等价。
      </span>
      <button
        class="linklike"
        :data-testid="`audio:captions--${audioId}`"
        @click="captionsOpen = !captionsOpen"
      >
        {{ captionsOpen ? '收起客观字幕' : '展开客观字幕' }}
      </button>
    </div>

    <div class="wave" :aria-label="`${audioId} 波形`" role="img">
      <span
        v-for="(h, i) in bars"
        :key="i"
        class="bar"
        :class="{ played: i / bars.length <= progress }"
        :style="{ height: `${Math.max(6, h * 100)}%` }"
      ></span>
    </div>

    <div v-if="anchors.length" class="anchors small">
      <span
        v-for="a in anchors"
        :key="a.id"
        class="anchor"
        :class="{ active: activeAnchorId === a.id }"
      >
        {{ a.id }}（{{ a.side === 'L' ? '前半' : '后半' }}）
      </span>
    </div>

    <ul v-if="captionsOpen" class="captions" :data-testid="`audio:caption-list--${audioId}`">
      <li v-for="(c, i) in captions" :key="i" :class="{ active: i === activeCaptionIdx }">
        {{ c.text }}
      </li>
      <li v-if="!captions.length && transcript">{{ transcript }}</li>
    </ul>
    <p v-else-if="transcript && isUnavailable" class="muted small">{{ transcript }}</p>
  </div>
</template>

<style scoped>
.frag {
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: var(--space-4);
  background: #f4f7f5;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.65);
}
.row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.wave {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 62px;
  margin: var(--space-3) 0;
  border-block: 1px solid rgba(196, 206, 200, 0.75);
  padding: var(--space-2) 0;
}
.bar {
  flex: 1;
  min-width: 2px;
  max-height: 100%;
  background: #aebfb7;
  border-radius: 1px;
  opacity: 0.75;
}
.bar.played {
  background: var(--primary);
}
.captions {
  margin: var(--space-1) 0 0;
  padding: var(--space-2) var(--space-2) var(--space-2) var(--space-5);
  background: rgba(255, 255, 255, 0.55);
  color: var(--muted);
}
.captions li {
  margin: var(--space-1) 0;
  padding: 0 var(--space-1);
}
.captions li.active {
  color: var(--text);
  background: var(--clinical-soft);
  border-radius: var(--radius-sm);
}
.anchors {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.anchor {
  border: 1px dashed var(--line-strong);
  border-radius: 999px;
  padding: 1px var(--space-2);
  color: var(--warning);
}
.anchor.active {
  border-style: solid;
  background: var(--warning-soft);
}
.linklike {
  min-height: 30px;
  border: none;
  background: none;
  box-shadow: none;
  color: var(--clinical);
  text-decoration: underline;
  padding: 0;
  font-size: 0.85em;
}
.small {
  font-size: 0.85em;
}
</style>
