<script setup lang="ts">
/** 双语文学摘录（用户反馈：原文必须附中文翻译）：中文译文为主，英文原文折叠可核对。 */
import { content } from '../game/content';

const props = defineProps<{ id: 'M-7' | 'W-F' | 'R-NM' | 'U-R' }>();
const card = content.literature[props.id];
</script>

<template>
  <blockquote class="literature">
    <p class="zh">{{ card.excerptZh }}</p>
    <details class="orig">
      <summary>英文原文（点开核对）</summary>
      <p class="en">{{ card.excerpt }}</p>
      <footer class="muted small">
        —— {{ card.work }}（{{ card.edition }}）｜{{ card.translationNote }}
        <a :href="card.sourceUrl" target="_blank" rel="noopener noreferrer">原文入口（可选）</a>
      </footer>
    </details>
  </blockquote>
</template>

<style scoped>
.literature { border-left: 4px solid var(--primary); margin: var(--space-2) 0; padding-left: var(--space-3); }
.zh { margin: 0 0 var(--space-1); line-height: 1.8; }
.orig { font-size: 0.85em; }
.orig summary { cursor: pointer; color: var(--muted); }
.en { margin: var(--space-1) 0; white-space: pre-wrap; color: #4c5f57; font-style: italic; line-height: 1.7; }
.small { font-size: 0.85em; }
</style>
