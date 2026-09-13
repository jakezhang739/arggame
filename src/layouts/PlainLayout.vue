<script setup lang="ts">
import StableControls from '../components/StableControls.vue';
</script>

<template>
  <div class="layout">
    <header class="bar">
      <div class="identity">
        <span class="mark mono">CW·W07</span>
        <span class="label">外部复核记录</span>
      </div>
      <StableControls />
    </header>
    <main class="body">
      <slot />
    </main>
    <footer class="foot">游戏内系统视图 · 澄湾康复中心（虚构作品）</footer>
  </div>
</template>

<style scoped>
.layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(circle at 20% 0, rgba(255, 255, 255, 0.78), transparent 34rem), var(--bg);
}
.bar {
  position: sticky;
  top: 0;
  z-index: 35;
  display: flex;
  min-height: 72px;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-3) clamp(var(--space-4), 3vw, var(--space-6));
  border-bottom: 1px solid var(--line-strong);
  background: rgba(248, 250, 248, 0.94);
  box-shadow: 0 2px 12px rgba(19, 43, 34, 0.06);
  backdrop-filter: blur(14px);
}
.identity {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.mark {
  padding: var(--space-2) var(--space-3);
  background: var(--room-black);
  color: #fff;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
}
.label {
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}
.body {
  flex: 1;
  width: min(var(--content-width), calc(100% - clamp(32px, 7vw, 96px)));
  margin: 0 auto;
  padding: clamp(var(--space-6), 5vw, var(--space-7)) 0 72px;
}
.foot {
  border-top: 1px solid var(--line);
  padding: var(--space-4);
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 0.69rem;
  letter-spacing: 0.05em;
  text-align: center;
}
@media (max-width: 640px) {
  .bar {
    position: relative;
    align-items: flex-start;
  }
  .label {
    display: none;
  }
  .body {
    width: calc(100% - 28px);
    padding-bottom: 88px;
  }
}
</style>
