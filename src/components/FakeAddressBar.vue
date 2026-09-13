<script setup lang="ts">
defineProps<{ address?: string }>();
</script>

<template>
  <div class="fakebar" role="img" :aria-label="`站内地址：${address || '（无）'}`">
    <span class="status-dot" aria-hidden="true"></span>
    <span class="tag">站内视图</span>
    <span class="addr mono">{{ address || 'about:blank' }}</span>
  </div>
</template>

<style scoped>
.fakebar {
  display: inline-flex;
  max-width: min(560px, 52vw);
  align-items: center;
  gap: 7px;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 3px var(--space-3) 3px var(--space-2);
  min-width: 0;
  box-shadow: inset 0 1px 1px rgba(27, 50, 41, 0.04);
}
.status-dot {
  width: 6px;
  height: 6px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--clinical);
  box-shadow: 0 0 0 3px rgba(36, 90, 72, 0.1);
}
.addr {
  font-size: 0.73rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: 0.01em;
}
.tag {
  font-size: 0.67rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--muted);
  border-right: 1px solid var(--line);
  padding-right: var(--space-2);
  white-space: nowrap;
}

@media (max-width: 760px) {
  .fakebar {
    max-width: 100%;
  }
  .tag {
    display: none;
  }
}
</style>
