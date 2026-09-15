<script setup lang="ts">
/** 通关提示（测试模式）：设置开启后显示各关答案；不写事件、不影响结局。 */
import { useSettingsStore } from '../stores/settings';
import AppIcon from './AppIcon.vue';

const settings = useSettingsStore();
</script>

<template>
  <aside v-if="settings.data.walkthrough" class="walkthrough" data-testid="walkthrough:hint">
    <strong><AppIcon name="warning" :size="14" /> 测试提示（通关答案）</strong>
    <p><slot /></p>
  </aside>
</template>

<style scoped>
.walkthrough {
  border: 1px dashed #b98a4f;
  border-left: 4px solid #d5aa53;
  border-radius: var(--radius);
  background: rgba(213, 170, 83, 0.1);
  padding: var(--space-2) var(--space-3);
  margin: var(--space-2) 0;
  font-size: 0.85em;
}
.walkthrough strong {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #805600;
}
.walkthrough p { margin: var(--space-1) 0 0; line-height: 1.7; }
</style>
