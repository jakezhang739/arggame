<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useGameStore } from '../stores/game';
import { useAudioStore } from '../stores/audio';
import { useSettingsStore } from '../stores/settings';

const router = useRouter();
const game = useGameStore();
const audio = useAudioStore();
const settings = useSettingsStore();
const importError = ref<string | null>(null);
const importing = ref(false);
const deskPhotoUrl = `${import.meta.env.BASE_URL}images/nurse-desk.png`;

function startNew(): void {
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
  <main class="start">
    <div class="start-shell">
      <section class="visual" aria-label="空置的护士站值班台">
        <img :src="deskPhotoUrl" alt="夜间护士站里，一盏旧台灯照着交接文件。" />
        <div class="visual-shade"></div>
        <div class="brand">
          <p class="brand-code mono">CHENGWAN / CASE 0617</p>
          <h2>明日随访</h2>
          <p>一份应该继续的记录，正在等待下一班。</p>
        </div>
        <p class="visual-caption mono">NIGHT DESK · 03:17</p>
      </section>

      <section class="login panel" aria-label="外部复核终端">
        <header class="terminal-head">
          <span class="terminal-mark mono">CW·W07</span>
          <span class="terminal-status"><i aria-hidden="true"></i> 本机连接</span>
        </header>
        <p class="eyebrow mono">EXTERNAL REVIEW TERMINAL</p>
        <h1>外部复核终端</h1>
        <p class="waiting"><span aria-hidden="true"></span>等待交接</p>
        <div class="actions">
          <button
            v-if="game.hasSave"
            class="primary"
            data-testid="start:continue"
            @click="continueGame"
          >
            继续上次会话
          </button>
          <button :class="game.hasSave ? '' : 'primary'" data-testid="start:new" @click="startNew">
            新建 W07 会话
          </button>
          <label class="import">
            <span class="action-label">导入本局档案</span>
            <input
              type="file"
              accept=".json,application/json"
              data-testid="start:import"
              @change="onImportFile"
            />
          </label>
          <div class="utilities">
            <button class="ghost" data-testid="start:soundtest" @click="audio.testBeep()">
              声音测试
            </button>
            <button
              class="ghost"
              data-testid="start:subtitles"
              @click="settings.update({ subtitles: !settings.data.subtitles })"
            >
              字幕：{{ settings.data.subtitles ? '开' : '关' }}
            </button>
          </div>
        </div>
        <p v-if="importError" class="anomaly-text">{{ importError }}</p>
        <p v-if="game.loadError" class="muted">
          本地存档读取失败：{{ game.loadError }}（可新建会话继续）
        </p>
        <p class="local-note">
          <span class="mono">LOCAL ONLY</span> 进度与录音只保存在当前浏览器。
        </p>
      </section>
    </div>

    <footer class="intro muted">
      <p class="intro-lead">这是一部虚构互动作品。人物、机构与案件均为原创。</p>
      <p>预计用时 180–240 分钟 · 建议使用电脑与耳机 · 纸笔可选 · 可随时暂停续玩</p>
    </footer>
  </main>
</template>

<style scoped>
.start {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-5);
  padding: clamp(var(--space-4), 4vw, var(--space-7));
  background:
    linear-gradient(90deg, rgba(31, 63, 51, 0.035) 1px, transparent 1px),
    linear-gradient(rgba(31, 63, 51, 0.035) 1px, transparent 1px), #dfe6e1;
  background-size: 32px 32px;
}
.start-shell {
  display: grid;
  width: min(1080px, 100%);
  min-height: min(680px, calc(100vh - 150px));
  grid-template-columns: minmax(0, 1.25fr) minmax(360px, 0.75fr);
  overflow: hidden;
  border: 1px solid #98a69e;
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow:
    0 28px 75px rgba(16, 37, 29, 0.19),
    0 3px 9px rgba(16, 37, 29, 0.11);
}
.visual {
  position: relative;
  min-height: 560px;
  overflow: hidden;
  background: var(--room-black);
  color: #fff;
}
.visual img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 54% center;
  filter: saturate(0.78) contrast(1.04) brightness(0.82);
}
.visual-shade {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(5, 16, 12, 0.08) 25%, rgba(5, 16, 12, 0.78) 100%),
    linear-gradient(90deg, rgba(5, 16, 12, 0.12), transparent 55%);
}
.brand {
  position: absolute;
  right: var(--space-6);
  bottom: var(--space-7);
  left: var(--space-6);
  max-width: 520px;
}
.brand-code,
.eyebrow {
  margin: 0 0 var(--space-2);
  font-size: 0.69rem;
  font-weight: 700;
  letter-spacing: 0.14em;
}
.brand-code {
  color: rgba(225, 236, 229, 0.8);
}
.brand h2 {
  margin: 0 0 var(--space-3);
  color: #fff;
  font-family: var(--font-serif);
  font-size: clamp(2.6rem, 5vw, 4.5rem);
  font-weight: 500;
  letter-spacing: 0.12em;
  text-shadow: 0 2px 18px rgba(0, 0, 0, 0.28);
}
.brand p:last-child {
  margin: 0;
  color: rgba(242, 246, 243, 0.84);
  font-size: 1rem;
  letter-spacing: 0.08em;
}
.visual-caption {
  position: absolute;
  top: var(--space-5);
  left: var(--space-5);
  margin: 0;
  color: rgba(235, 242, 238, 0.68);
  font-size: 0.65rem;
  letter-spacing: 0.12em;
}
.login {
  display: flex;
  width: auto;
  flex-direction: column;
  justify-content: center;
  border: 0;
  border-radius: 0;
  padding: clamp(var(--space-5), 4vw, var(--space-7));
  background:
    linear-gradient(90deg, var(--clinical) 0 54px, transparent 54px) top left / 100% 3px no-repeat,
    rgba(249, 251, 249, 0.98);
  box-shadow: none;
}
.terminal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-6);
  border-bottom: 1px solid var(--line);
  padding-bottom: var(--space-3);
}
.terminal-mark {
  background: var(--clinical-deep);
  padding: 5px var(--space-2);
  color: #fff;
  font-size: 0.68rem;
  font-weight: 750;
  letter-spacing: 0.08em;
}
.terminal-status {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--muted);
  font-size: 0.7rem;
}
.terminal-status i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #5b856f;
  box-shadow: 0 0 0 3px rgba(36, 90, 72, 0.1);
}
.login h1 {
  margin: 0;
  font-size: clamp(1.65rem, 3vw, 2.15rem);
  letter-spacing: -0.03em;
}
.eyebrow {
  color: var(--clinical);
}
.waiting {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: var(--space-2) 0 var(--space-5);
  color: var(--muted);
  font-size: 0.9rem;
}
.waiting span {
  width: 18px;
  height: 2px;
  background: var(--warning);
}
.actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  align-items: stretch;
}
.actions > button {
  width: 100%;
  min-height: 46px;
}
.import {
  display: grid;
  gap: 6px;
}
.action-label {
  color: var(--muted);
  font-size: 0.75rem;
  font-weight: 650;
  letter-spacing: 0.04em;
}
.import input {
  width: 100%;
}
.utilities {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
}
.local-note {
  margin: var(--space-5) 0 0;
  border-top: 1px solid var(--line);
  padding-top: var(--space-3);
  color: var(--muted);
  font-size: 0.72rem;
}
.local-note .mono {
  margin-right: var(--space-1);
  color: var(--clinical);
  font-size: 0.67rem;
  font-weight: 750;
  letter-spacing: 0.08em;
}
.intro {
  text-align: center;
  font-size: 0.76rem;
  max-width: 760px;
}
.intro p {
  margin: var(--space-1) 0;
}
.intro-lead {
  color: var(--text);
}

@media (max-width: 900px) {
  .start-shell {
    grid-template-columns: 1fr;
  }
  .visual {
    min-height: 360px;
  }
  .login {
    padding: var(--space-6);
  }
}

@media (max-width: 560px) {
  .start {
    justify-content: flex-start;
    padding: 0;
  }
  .start-shell {
    min-height: 100vh;
    border: 0;
    border-radius: 0;
    box-shadow: none;
  }
  .visual {
    min-height: 300px;
  }
  .brand {
    right: var(--space-4);
    bottom: var(--space-5);
    left: var(--space-4);
  }
  .brand h2 {
    font-size: 2.4rem;
  }
  .visual-caption {
    top: var(--space-4);
    left: var(--space-4);
  }
  .login {
    padding: var(--space-5) var(--space-4) var(--space-6);
  }
  .terminal-head {
    margin-bottom: var(--space-5);
  }
  .intro {
    padding: var(--space-4);
  }
}
</style>
