/** 游戏主 store：命令事务、活跃时钟、草稿与持久化（docs/01_核心契约.md v1.1 §3/§10）。 */
import { computed, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import type { Command, EventDraft } from '../game/commands';
import { planCommand } from '../game/commands';
import type { GameEvent, SaveData, SettingsData } from '../game/types';
import { reduce } from '../game/reducer';
import { buildEvent, sha256Hex, verifyChain } from '../game/hash-chain';
import {
  clearStorage,
  emptyWitness,
  freshSave,
  KVStorage,
  loadFromStorage,
  writeToStorage,
} from '../game/persistence';
import { buildExportFile, downloadTextFile, exportFileName, parseImportFile } from '../game/export-import';
import { buildPlayReport } from '../game/stats';
import { homeRouteFor, selectEvidence, selectNarrativeTrail } from '../game/selectors';

function safeStorage(): KVStorage {
  if (typeof localStorage !== 'undefined') return localStorage;
  return { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };
}

export const useGameStore = defineStore('game', () => {
  const loaded = loadFromStorage(safeStorage());
  const save = ref<SaveData>(loaded && loaded.ok ? loaded.save : freshSave());
  const loadError = ref(loaded && !loaded.ok ? loaded.error : null);
  const commandError = ref<string | null>(null);

  const state = computed(() => reduce(save.value.events));
  const trailRows = computed(() => selectNarrativeTrail(state.value));
  const acquiredEvidence = computed(() => selectEvidence(state.value));
  const hasSave = computed(() => save.value.events.length > 0);

  // —— Web Locks 独占写权（docs/01册 v1.1 §10）：另一窗口持锁时本窗口进入临时只读模式 ——
  const lockHeld = ref(true);
  const externalUpdate = ref(false);
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    navigator.locks
      .request(
        'cw-save-v2',
        { mode: 'exclusive', ifAvailable: true },
        (lock) => {
          if (!lock) {
            lockHeld.value = false;
            return undefined;
          }
          return new Promise(() => undefined); // 持有至页面关闭
        },
      )
      .catch(() => {
        /* 锁 API 异常不阻塞游玩；按可写处理 */
      });
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (ev) => {
      if (ev.key === 'cw-save-v2') externalUpdate.value = true;
    });
  }

  // —— 活跃时钟：可见、非 P00 时累计 ——
  let lastTick = Date.now();
  let ticking = true;
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        lastTick = Date.now();
        ticking = true;
      } else {
        ticking = false;
      }
    });
    setInterval(() => {
      if (ticking && document.visibilityState === 'visible') {
        const now = Date.now();
        save.value.elapsedActiveMs += now - lastTick;
        lastTick = now;
      } else {
        lastTick = Date.now();
      }
    }, 1000);
  }
  function elapsedNow(): number {
    return Math.floor(save.value.elapsedActiveMs);
  }

  function persist(): void {
    if (!lockHeld.value) return; // 临时视图不写入
    save.value.savedAtMs = Date.now();
    try {
      writeToStorage(safeStorage(), save.value);
    } catch {
      /* 存储不可用时保持内存态 */
    }
  }

  // 串行命令队列：同一时刻只有一个事务在写入
  let queueTail: Promise<unknown> = Promise.resolve();
  function enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = queueTail.then(fn, fn);
    queueTail = run.catch(() => undefined);
    return run;
  }

  function isOnceDuplicate(drafts: EventDraft[]): boolean {
    return drafts.some(
      (d) =>
        d.actor === 'PLAYER' &&
        save.value.events.some((e) => {
          if (e.code !== d.code) return false;
          // 带对象 id 的事件按对象判重（如 ACK_AUDIO_CONTENT 的不同 audioId）
          const p = e.payload as Record<string, unknown>;
          const obj = p?.documentId ?? p?.audioId;
          const dObj = (d.payload as Record<string, unknown>)?.documentId ?? (d.payload as Record<string, unknown>)?.audioId;
          if (obj !== undefined && dObj !== undefined) return obj === dObj;
          return true;
        }) &&
        !['PLAY_AUDIO', 'OPEN_DOC', 'RUN_EXPERIMENT', 'SEVER_PREVIEW', 'HINT_REQUESTED', 'PUZZLE_ATTEMPT', 'TOGGLE_PLOT_HINTS', 'CAPTURE_STATEMENT', 'COMPARE_RECORDS'].includes(d.code),
    );
  }

  /** 执行命令：规划 → 建链 → 原子追加 → 保存。 */
  async function execute(command: Command): Promise<boolean> {
    if (!lockHeld.value) {
      commandError.value = '另一窗口正在推进本存档。此窗口为临时视图；请重新载入接管。';
      return false;
    }
    return enqueue(async () => {
      try {
        commandError.value = null;
        const plan = planCommand(state.value, command);
        if (!plan.ok) {
          commandError.value = plan.error;
          return false;
        }
        if (isOnceDuplicate(plan.drafts)) {
          commandError.value = '该操作已生效，不能重复提交。';
          return false;
        }
        const txId =
          typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `tx-${Date.now()}`;
        const appended: GameEvent[] = [];
        let prev = save.value.events.at(-1);
        for (const d of plan.drafts) {
          const ev = await buildEvent(
            prev,
            {
              sessionId: save.value.sessionId,
              elapsedMs: Math.max(elapsedNow(), prev?.elapsedMs ?? 0),
              txId,
              actor: d.actor,
              ...(d.scope !== undefined ? { scope: d.scope } : {}),
              code: d.code,
              payload: d.payload as Record<string, unknown>,
            },
            sha256Hex,
          );
          appended.push(ev);
          prev = ev;
        }
        save.value.events.push(...appended);
        save.value.revision += 1;
        persist();
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : '操作未能完成。';
        commandError.value = message.includes('Web Crypto')
          ? '当前打开方式不支持安全存档。请使用 HTTPS 或本机 localhost 地址重新打开；你的现有进度不会被改写。'
          : `操作未能完成：${message}`;
        return false;
      }
    });
  }

  function clearCommandError(): void {
    commandError.value = null;
  }

  async function ensureSnapshotLoaded(): Promise<void> {
    if (!save.value.events.some((e) => e.code === 'LOAD_SNAPSHOT') && state.value.facts.handoverSecured && state.value.facts.rulesAcknowledged) {
      await execute({ kind: 'loadSnapshot' });
    }
  }

  function startSession(): void {
    if (!lockHeld.value) {
      commandError.value = '另一窗口正在推进本存档；此窗口不能新建会话。请重新载入接管。';
      return;
    }
    save.value = freshSave();
    lastTick = Date.now();
    persist();
    void execute({ kind: 'boot' });
  }

  function resetSave(): void {
    if (!lockHeld.value) {
      commandError.value = '另一窗口正在推进本存档；此窗口不能清除进度。请重新载入接管。';
      return;
    }
    save.value = freshSave();
    lastTick = Date.now();
    clearStorage(safeStorage());
  }

  // —— 草稿（未提交选择；200ms 节流持久化；隐藏/退出时同步刷新）——
  let draftTimer: ReturnType<typeof setTimeout> | null = null;
  function flushDrafts(): void {
    if (draftTimer) {
      clearTimeout(draftTimer);
      draftTimer = null;
      persist();
    }
  }
  function updateDrafts(updater: (drafts: SaveData['drafts']) => void): void {
    updater(save.value.drafts);
    if (draftTimer) clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      draftTimer = null;
      persist();
    }, 200);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flushDrafts);
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushDrafts();
    });
  }

  function togglePin(evidenceId: string): void {
    const list = save.value.pinnedEvidence;
    const i = list.indexOf(evidenceId as SaveData['pinnedEvidence'][number]);
    if (i >= 0) list.splice(i, 1);
    else list.push(evidenceId as SaveData['pinnedEvidence'][number]);
    persist();
  }

  function markPresentationCue(cueId: string): void {
    if (!save.value.seenPresentationCues.includes(cueId)) {
      save.value.seenPresentationCues.push(cueId);
      persist();
    }
  }

  function exportArchive(): void {
    const file = buildExportFile(save.value);
    downloadTextFile(exportFileName(save.value), JSON.stringify(file, null, 2));
    void execute({ kind: 'exportArchive' });
  }

  /** 试玩报告导出（T33.1）：只含事件派生统计，不含录音、自由文本或身份信息。 */
  function exportReport(): void {
    const report = buildPlayReport({
      sessionId: save.value.sessionId,
      events: save.value.events,
      elapsedActiveMs: save.value.elapsedActiveMs,
      ending: state.value.ending,
      reviewCause: state.value.facts.reviewCause,
      lastRoute: save.value.lastRoute,
    });
    downloadTextFile(
      `cw-report-${save.value.sessionId}.json`,
      JSON.stringify(report, null, 2),
    );
  }

  async function importArchive(raw: unknown): Promise<string | null> {
    if (!lockHeld.value) return '另一窗口正在推进本存档；此窗口不能导入。请重新载入接管。';
    const result = parseImportFile(raw);
    if (!result.ok) return result.error;
    // 预览确认由调用方 UI 完成；此处执行覆盖
    const sourceSessionId = result.save.sessionId;
    save.value = result.save;
    lastTick = Date.now();
    persist();
    await execute({ kind: 'importArchive', sourceSessionId });
    return null;
  }

  async function checkChain(): Promise<string> {
    const v = await verifyChain(save.value.events, sha256Hex);
    return v.ok ? '轨迹完整。' : `轨迹在第 ${v.firstBrokenSeq} 条之后被改动。`;
  }

  function setWitness(mode: 'VOICE' | 'TEXT', recordingId: string | null): void {
    const base = save.value.witness ?? emptyWitness();
    save.value.witness = { ...base, mode, recordingId, recordingAvailable: recordingId !== null };
    persist();
  }

  /** 数据管理：录音已从本机删除；见证事实与文字声明保留。 */
  function markRecordingsDeleted(): void {
    if (save.value.witness) {
      save.value.witness = { ...save.value.witness, recordingAvailable: false };
      persist();
    }
  }

  function setLastRoute(route: string): void {
    if (route === '/' || route === '') return;
    if (save.value.lastRoute !== route) {
      save.value.lastRoute = route;
      persist();
    }
  }

  watch(
    () => state.value.phase,
    () => undefined, // 阶段变化的表现层 cue 由页面按 seenPresentationCues 处理
  );

  return {
    save,
    loadError,
    commandError,
    clearCommandError,
    state,
    trailRows,
    acquiredEvidence,
    hasSave,
    lockHeld,
    externalUpdate,
    elapsedNow,
    execute,
    ensureSnapshotLoaded,
    startSession,
    resetSave,
    updateDrafts,
    togglePin,
    markPresentationCue,
    exportArchive,
    exportReport,
    importArchive,
    checkChain,
    setWitness,
    markRecordingsDeleted,
    setLastRoute,
    homeRoute: computed(() => homeRouteFor(state.value)),
  };
});

export type { SettingsData };
