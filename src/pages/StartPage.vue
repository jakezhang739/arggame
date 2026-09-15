<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useGameStore } from '../stores/game';
import { useAudioStore } from '../stores/audio';
import { useSettingsStore } from '../stores/settings';
import AppIcon from '../components/AppIcon.vue';

const router = useRouter();
const game = useGameStore();
const audio = useAudioStore();
const settings = useSettingsStore();
const importError = ref<string | null>(null);
const importing = ref(false);
const heroUrl = `${import.meta.env.BASE_URL}images/night-shift-hero-v2.webp`;
const pageStyle = computed(() => ({ '--hero-image': `url("${heroUrl}")` }));
const unsafeOrigin = computed(() => typeof window !== 'undefined' && !window.isSecureContext);

function startNew(): void {
  if (unsafeOrigin.value) return;
  if (game.hasSave) {
    if (!window.confirm('开始新的一局将覆盖当前进度。建议先导出本局档案。仍要继续吗？')) return;
  }
  game.startSession();
  router.push('/migration');
}

function continueGame(): void {
  router.push(game.homeRoute);
}

async function onImportFile(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  importing.value = true;
  try {
    const text = await file.text();
    const err = await game.importArchive(JSON.parse(text));
    importError.value = err;
    if (!err) router.push(game.homeRoute);
  } catch {
    importError.value = '文件无法读取。';
  } finally {
    importing.value = false;
  }
}
</script>

<template>
  <main class="start" :style="pageStyle">
    <div class="grain" aria-hidden="true"></div>
    <header class="topline">
      <span class="terminal-mark mono"><AppIcon name="moon" :size="15" /> CW·W07</span>
      <span class="connection"><i aria-hidden="true"></i> 本机调查记录</span>
    </header>

    <div class="start-shell">
      <section class="story" aria-label="明日随访简介">
        <p class="eyebrow mono">澄湾 · 夜班复核 · 案件 0617</p>
        <h1>明日随访</h1>
        <p class="premise">你将接手一次夜班外部复核。<br />六名患者，只有一份记录等待签认。</p>

        <div class="assignment">
          <div><AppIcon name="users" /><span><strong>6 名在册患者</strong><small>核对身份与当前照护</small></span></div>
          <div><AppIcon name="clipboard" /><span><strong>1 份待签记录</strong><small>阅读无害，提交前会再次确认</small></span></div>
          <div><AppIcon name="evidence" /><span><strong>本机保存证据</strong><small>不需要医学知识或外部账号</small></span></div>
        </div>

        <blockquote>“她没有要求你救她。她只是让你明天带一颗螺丝。”</blockquote>
      </section>

      <section class="terminal" aria-label="开始游戏">
        <div class="terminal-head">
          <span class="mono">外部复核终端</span>
          <span>值班接入 03:17</span>
        </div>
        <p class="section-label">今晚的任务</p>
        <h2>{{ game.hasSave ? '继续未完成的调查' : '完成第一次外部复核' }}</h2>
        <p class="terminal-copy">
          {{ game.hasSave ? '你的本机记录仍在。继续时会回到最近一个可执行任务。' : '先保存复核前名单，再核对 R03 的护理事实。任何改变案件状态的提交都会二次确认。' }}
        </p>

        <div v-if="unsafeOrigin" class="security-warning" role="alert">
          <AppIcon name="warning" />
          <span><strong>当前地址不能安全保存进度</strong>请使用 HTTPS 或本机 localhost 地址打开后再开始。</span>
        </div>

        <div class="actions">
          <button
            v-if="game.hasSave"
            class="primary main-action"
            data-testid="start:continue"
            @click="continueGame"
          >
            <span>继续上次调查</span><AppIcon name="arrow" />
          </button>
          <button
            :class="game.hasSave ? 'secondary-action' : 'primary main-action'"
            :disabled="unsafeOrigin"
            data-testid="start:new"
            @click="startNew"
          >
            <span>{{ game.hasSave ? '重新开始' : '开始第一次复核' }}</span><AppIcon name="arrow" />
          </button>
        </div>

        <div class="session-facts" aria-label="体验说明">
          <span>约 120—150 分钟</span><span>可随时暂停</span><span>全程字幕</span>
        </div>

        <details class="advanced">
          <summary>声音、字幕与档案导入</summary>
          <div class="utilities">
            <button class="ghost" data-testid="start:soundtest" @click="audio.testBeep()">
              <AppIcon name="headphones" :size="17" /> 声音测试
            </button>
            <button
              class="ghost"
              data-testid="start:subtitles"
              @click="settings.update({ subtitles: !settings.data.subtitles })"
            >
              字幕：{{ settings.data.subtitles ? '开' : '关' }}
            </button>
            <button
              class="ghost"
              data-testid="start:walkthrough"
              :class="{ active: settings.data.walkthrough }"
              @click="settings.update({ walkthrough: !settings.data.walkthrough })"
            >
              测试模式（显示通关提示）：{{ settings.data.walkthrough ? '开' : '关' }}
            </button>
          </div>
          <label class="import">
            <span class="action-label">导入之前导出的本局档案</span>
            <input
              type="file"
              accept=".json,application/json"
              data-testid="start:import"
              :disabled="importing"
              @change="onImportFile"
            />
          </label>
        </details>

        <p v-if="importError" class="anomaly-text">{{ importError }}</p>
        <p v-if="game.loadError" class="muted">本地存档读取失败：{{ game.loadError }}（可新建会话继续）</p>
        <p class="local-note"><AppIcon name="archive" :size="15" /> 进度与录音只保存在当前浏览器，不会上传。</p>
      </section>
    </div>

    <footer>
      <span>虚构互动作品</span><i></i><span>人物、机构与案件均为原创</span><i></i><span>建议使用电脑与耳机</span>
    </footer>
  </main>
</template>

<style scoped>
.start {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: clamp(20px, 4vw, 54px);
  background:
    linear-gradient(90deg, rgba(5, 15, 12, .28), rgba(5, 15, 12, .72) 58%, rgba(5, 15, 12, .94)),
    linear-gradient(0deg, rgba(4, 12, 10, .7), transparent 45%),
    var(--hero-image) center / cover no-repeat;
  color: #eef5f1;
}
.grain { position: absolute; inset: 0; pointer-events: none; opacity: .16; background-image: radial-gradient(rgba(255,255,255,.2) .5px, transparent .5px); background-size: 4px 4px; mix-blend-mode: overlay; }
.topline { position: relative; z-index: 1; display: flex; align-items: center; justify-content: space-between; width: min(1420px, 100%); margin: 0 auto; }
.terminal-mark { display: inline-flex; align-items: center; gap: 8px; border: 1px solid rgba(214,228,220,.42); padding: 8px 12px; color: #fff; font-size: .72rem; font-weight: 750; letter-spacing: .08em; }
.connection { display: inline-flex; align-items: center; gap: 8px; color: #c4d1ca; font-size: .74rem; }
.connection i { width: 7px; height: 7px; border-radius: 50%; background: #91b39f; box-shadow: 0 0 0 4px rgba(145,179,159,.12); }
.start-shell { position: relative; z-index: 1; flex: 1; display: grid; width: min(1420px, 100%); margin: 0 auto; grid-template-columns: minmax(0, 1.35fr) minmax(390px, .65fr); gap: clamp(40px, 7vw, 110px); align-items: center; padding: clamp(42px, 7vh, 90px) 0; }
.story { max-width: 720px; align-self: end; padding-bottom: clamp(12px, 4vh, 48px); }
.eyebrow { margin: 0 0 var(--space-3); color: #c7d4cd; font-size: .74rem; font-weight: 700; letter-spacing: .16em; }
.story h1 { margin: 0; color: #fff; font-family: var(--font-serif); font-size: clamp(3.8rem, 7.5vw, 7.7rem); font-weight: 500; letter-spacing: .09em; line-height: 1; text-shadow: 0 8px 30px rgba(0,0,0,.32); }
.premise { margin: var(--space-5) 0; color: #edf3ef; font-size: clamp(1.15rem, 1.9vw, 1.55rem); line-height: 1.7; letter-spacing: .04em; }
.assignment { display: grid; max-width: 680px; grid-template-columns: repeat(3, 1fr); border-top: 1px solid rgba(228,238,232,.25); border-bottom: 1px solid rgba(228,238,232,.25); }
.assignment > div { display: grid; grid-template-columns: 24px 1fr; gap: 10px; padding: var(--space-4) var(--space-3); border-right: 1px solid rgba(228,238,232,.18); }
.assignment > div:last-child { border-right: 0; }
.assignment span { display: grid; }
.assignment strong { color: #f4f7f5; font-size: .82rem; }
.assignment small { color: #aebdb5; font-size: .7rem; line-height: 1.45; }
.story blockquote { margin: var(--space-5) 0 0; border-left-color: #d0a44d; color: #d8e1dc; font-family: var(--font-serif); font-size: 1rem; letter-spacing: .05em; }
.terminal { align-self: center; border: 1px solid rgba(180,200,190,.42); border-radius: var(--radius-lg); padding: clamp(24px, 3.5vw, 42px); background: rgba(241,246,242,.95); box-shadow: 0 30px 80px rgba(0,0,0,.38); color: var(--text); backdrop-filter: blur(14px); }
.terminal-head { display: flex; justify-content: space-between; gap: var(--space-3); margin: -4px 0 var(--space-6); border-bottom: 1px solid var(--line); padding-bottom: var(--space-3); color: var(--muted); font-size: .66rem; letter-spacing: .08em; }
.section-label { margin: 0 0 var(--space-1); color: var(--warning); font-size: .72rem; font-weight: 750; letter-spacing: .1em; }
.terminal h2 { margin: 0; font-size: clamp(1.55rem, 2.4vw, 2.15rem); }
.terminal-copy { margin: var(--space-3) 0 var(--space-5); color: var(--muted); font-size: .9rem; line-height: 1.75; }
.actions { display: grid; gap: var(--space-2); }
.main-action { width: 100%; min-height: 52px; justify-content: space-between; padding-inline: var(--space-5); font-size: 1rem; }
.secondary-action { width: 100%; }
.session-facts { display: flex; gap: 0; margin: var(--space-4) 0; color: var(--muted); font-size: .7rem; }
.session-facts span { border-right: 1px solid var(--line); padding: 0 var(--space-2); }
.session-facts span:first-child { padding-left: 0; }
.session-facts span:last-child { border-right: 0; }
.advanced { border-top: 1px solid var(--line); padding-top: var(--space-3); }
.advanced summary { color: var(--muted); font-size: .76rem; }
.utilities { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2); margin-top: var(--space-3); }
.import { display: grid; gap: 6px; margin-top: var(--space-3); }
.action-label { color: var(--muted); font-size: .72rem; font-weight: 650; }
.local-note { display: flex; align-items: center; gap: var(--space-2); margin: var(--space-4) 0 0; color: var(--muted); font-size: .7rem; }
.security-warning { display: grid; grid-template-columns: 24px 1fr; gap: var(--space-2); margin-bottom: var(--space-4); border: 1px solid #c58a83; border-radius: var(--radius); padding: var(--space-3); background: var(--anomaly-soft); color: var(--anomaly); }
.security-warning span { display: grid; font-size: .78rem; }
.start footer { position: relative; z-index: 1; display: flex; justify-content: center; align-items: center; flex-wrap: wrap; gap: var(--space-3); color: #aebbb4; font-size: .68rem; letter-spacing: .04em; }
.start footer i { width: 3px; height: 3px; border-radius: 50%; background: #75857d; }

@media (max-width: 980px) {
  .start { overflow: auto; }
  .start-shell { grid-template-columns: 1fr; align-items: start; }
  .story { align-self: auto; padding-bottom: 0; }
  .terminal { width: min(620px, 100%); }
}
@media (max-width: 620px) {
  .start { padding: var(--space-4); background-position: 35% center; }
  .topline { align-items: flex-start; }
  .connection { max-width: 120px; justify-content: flex-end; text-align: right; }
  .start-shell { gap: var(--space-5); padding: var(--space-6) 0; }
  .story h1 { font-size: 3.25rem; }
  .premise { font-size: 1rem; }
  .assignment { grid-template-columns: 1fr; }
  .assignment > div { border-right: 0; border-bottom: 1px solid rgba(228,238,232,.18); }
  .assignment > div:last-child { border-bottom: 0; }
  .story blockquote { display: none; }
  .terminal { padding: var(--space-5) var(--space-4); }
  .terminal-head { align-items: flex-start; flex-direction: column; }
}
</style>
