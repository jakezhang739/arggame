<script setup lang="ts">
import { computed } from 'vue';
import FakeAddressBar from '../components/FakeAddressBar.vue';
import StableControls from '../components/StableControls.vue';
import InvestigationRail from '../components/InvestigationRail.vue';
import AppIcon from '../components/AppIcon.vue';

const props = defineProps<{ address?: string; skin?: string }>();

const system = computed(() => {
  const systems: Record<string, { code: string; name: string; desk: string }> = {
    hospital: { code: 'CW·INTRA', name: '澄湾康复中心', desk: '内部业务系统' },
    forum: { code: 'CW·BBS', name: '澄湾病友互助站', desk: '社区镜像' },
    archive: { code: 'CW·ARC', name: '澄湾地方档案', desk: '馆藏索引' },
    lab: { code: 'CW·LAB', name: '澄湾审校实验室', desk: '归档副本' },
  };
  return systems[props.skin ?? 'hospital'] ?? systems.hospital;
});

const nightImage = `${import.meta.env.BASE_URL}images/night-shift-hero-v2.webp`;
const archiveImage = `${import.meta.env.BASE_URL}images/archive-desk-v2.webp`;
const layoutStyle = computed(() => ({
  '--night-image': `url("${nightImage}")`,
  '--archive-image': `url("${archiveImage}")`,
}));
</script>

<template>
  <div class="layout" :class="skin ? `skin-${skin}` : ''" :data-system="skin" :style="layoutStyle">
    <header class="layout-bar">
      <div class="system-identity">
        <span class="system-mark mono" aria-hidden="true"><AppIcon name="archive" :size="16" /> {{ system.code }}</span>
        <div class="system-copy">
          <p class="system-name">
            {{ system.name }} <span>/ {{ system.desk }}</span>
          </p>
          <FakeAddressBar :address="address" />
        </div>
      </div>
      <StableControls />
    </header>
    <div class="workspace-shell">
      <main class="layout-body">
        <slot />
      </main>
      <InvestigationRail />
    </div>
    <footer class="layout-foot">
      <span class="foot-rule" aria-hidden="true"></span>
      <span>游戏内系统视图</span>
      <span aria-hidden="true">·</span>
      <span>澄湾康复中心（虚构作品）</span>
    </footer>
  </div>
</template>

<style scoped>
.layout {
  --skin-accent: var(--clinical);
  --skin-background: var(--bg);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--skin-background);
  background-image:
    linear-gradient(180deg, rgba(228, 237, 232, .86) 0, var(--skin-background) 390px),
    linear-gradient(rgba(55, 78, 68, 0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(55, 78, 68, 0.025) 1px, transparent 1px),
    var(--night-image);
  background-size:
    100% 520px,
    32px 32px,
    32px 32px,
    100% 520px;
  background-position: top 78px center, top, top, top 78px center;
  background-repeat: no-repeat, repeat, repeat, no-repeat;
}

.layout-bar {
  position: sticky;
  top: 0;
  z-index: 35;
  display: flex;
  min-height: 78px;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-3) clamp(var(--space-4), 3vw, var(--space-6));
  border-bottom: 1px solid rgba(151, 166, 157, 0.9);
  background: rgba(248, 250, 248, 0.98);
  box-shadow: 0 2px 12px rgba(19, 43, 34, 0.06);
  backdrop-filter: blur(14px) saturate(120%);
}

.layout-bar::after {
  content: '';
  position: absolute;
  right: 0;
  bottom: -1px;
  left: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--skin-accent) 0 22%, transparent 22%);
  opacity: 0.85;
}

.system-identity {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--space-3);
}

.system-mark {
  display: inline-flex;
  min-width: 76px;
  height: 46px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid color-mix(in srgb, var(--skin-accent) 65%, var(--line));
  background: var(--skin-accent);
  box-shadow: inset 0 0 0 3px rgba(255, 255, 255, 0.16);
  color: #fff;
  font-size: 0.71rem;
  font-weight: 750;
  letter-spacing: 0.06em;
}

.system-copy {
  min-width: 0;
}

.system-name {
  margin: 0 0 3px;
  color: var(--text-strong);
  font-size: 0.76rem;
  font-weight: 750;
  letter-spacing: 0.08em;
  line-height: 1.2;
}

.system-name span {
  color: var(--muted);
  font-weight: 560;
}

.workspace-shell {
  flex: 1;
  display: grid;
  width: min(1440px, calc(100% - clamp(32px, 5vw, 80px)));
  margin: 0 auto;
  grid-template-columns: minmax(0, 1fr) 294px;
  gap: clamp(var(--space-4), 2.6vw, var(--space-6));
  align-items: start;
  padding: clamp(var(--space-6), 4vw, var(--space-7)) 0 72px;
}

.layout-body {
  min-width: 0;
}

.layout-body :deep(> * > h1:first-child) {
  position: relative;
  padding-top: var(--space-4);
}

.layout-body :deep(> * > h1:first-child)::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 36px;
  height: 3px;
  background: var(--skin-accent);
}

.layout-foot {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border-top: 1px solid rgba(157, 171, 163, 0.72);
  padding: var(--space-4);
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 0.69rem;
  letter-spacing: 0.05em;
}

.foot-rule {
  width: 28px;
  height: 1px;
  background: var(--skin-accent);
}

.skin-hospital {
  --skin-accent: #245a48;
  --skin-background: #e8eeea;
}

.skin-forum {
  --skin-accent: #65725b;
  --skin-background: #ece9df;
  background-image:
    linear-gradient(180deg, rgba(236, 233, 223, .9) 0, var(--skin-background) 360px),
    radial-gradient(circle at 12% -5%, rgba(255, 255, 255, 0.65), transparent 32rem),
    linear-gradient(rgba(84, 78, 62, 0.025) 1px, transparent 1px);
  background-size:
    100% 420px,
    auto,
    100% 28px;
  background-position: top 78px center, top, top;
  background-repeat: no-repeat, no-repeat, repeat;
}

.skin-archive {
  --skin-accent: #795d3d;
  --skin-background: #f0eadf;
  --surface: #fbf8f0;
  --surface-muted: #f3ede1;
  --line: #d6cbbb;
  --line-strong: #ad9e89;
  background-image:
    linear-gradient(180deg, rgba(240, 234, 223, .7) 0, var(--skin-background) 430px),
    linear-gradient(90deg, rgba(116, 87, 54, 0.025) 1px, transparent 1px),
    var(--archive-image);
  background-size:
    100% 520px,
    40px 40px,
    100% 520px;
  background-position: top 78px center, top, top 78px center;
  background-repeat: no-repeat, repeat, no-repeat;
}

.skin-lab {
  --skin-accent: #376b69;
  --skin-background: #e4ebea;
  background-image:
    linear-gradient(180deg, rgba(228, 237, 235, .9) 0, var(--skin-background) 360px),
    linear-gradient(rgba(41, 78, 76, 0.038) 1px, transparent 1px),
    linear-gradient(90deg, rgba(41, 78, 76, 0.038) 1px, transparent 1px),
    radial-gradient(circle at 50% -10%, rgba(255, 255, 255, 0.7), transparent 36rem);
  background-size:
    100% 420px,
    24px 24px,
    24px 24px,
    auto;
  background-position: top 78px center, top, top, top;
  background-repeat: no-repeat, repeat, repeat, no-repeat;
}

.skin-forum :deep(.post) {
  border-left: 3px solid color-mix(in srgb, var(--skin-accent) 55%, var(--line));
  box-shadow: 0 5px 18px rgba(50, 48, 40, 0.055);
}

.skin-archive :deep(h1),
.skin-archive :deep(h2),
.skin-archive :deep(h3) {
  font-family: var(--font-serif);
  font-weight: 600;
  letter-spacing: 0.02em;
}

.skin-archive :deep(.panel) {
  background:
    linear-gradient(90deg, var(--skin-accent) 0 42px, transparent 42px) top left / 100% 2px
      no-repeat,
    rgba(251, 248, 240, 0.96);
}

.skin-lab :deep(.panel) {
  background:
    linear-gradient(90deg, var(--skin-accent) 0 42px, transparent 42px) top left / 100% 2px
      no-repeat,
    rgba(247, 250, 249, 0.95);
}

@media (max-width: 760px) {
  .layout-bar {
    position: relative;
    min-height: 0;
    align-items: flex-start;
    padding: var(--space-3) var(--space-4);
  }

  .system-mark,
  .system-name {
    display: none;
  }

  .system-identity {
    flex: 1 1 140px;
    min-width: 120px;
  }

  .workspace-shell {
    width: min(100% - 28px, var(--content-width));
    padding-top: var(--space-6);
    padding-bottom: 132px; /* 右下角固定「叙事轨迹」入口预留空间，避免遮挡内容末行 */
  }

  .layout-foot {
    flex-wrap: wrap;
    padding-right: 80px;
    text-align: center;
  }
}

@media (max-width: 1020px) {
  .workspace-shell {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 520px) {
  .layout-bar {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .system-identity {
    width: 100%;
  }
}
</style>
