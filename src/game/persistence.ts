/** 存档（docs/01_核心契约.md v1.1 §10）。localStorage cw-save-v2 / cw-settings-v1；IndexedDB 见 witness。 */
import type { GameEvent, PuzzleDrafts, SaveData, SettingsData, WitnessRecord } from './types';
import { ONCE_EVENT_CODES, EVENT_CODES } from './types';

export const SAVE_KEY = 'cw-save-v2';
export const SETTINGS_KEY = 'cw-settings-v1';
export const CONTENT_VERSION = '1.2';
export const SAVE_SCHEMA_VERSION = 3;

export type LoadResult = { ok: true; save: SaveData } | { ok: false; error: string };

export interface KVStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function defaultDrafts(): PuzzleDrafts {
  return {
    timelineOrder: [],
    trailOrder: [],
    trailLinks: {},
    audioOrder: [],
    audioAnchorPairs: [],
    experimentSelection: { labelPair: [], scopePair: [] },
    nextVisitSlots: { identity: {}, intent: {}, chain: null },
    semanticSelections: {},
  };
}

export function emptyWitness(): WitnessRecord {
  return {
    mode: 'TEXT',
    canonicalText: '我只确认许棠仍在表达，不确认她的结局。',
    note: '',
    recordingId: null,
    recordingAvailable: false,
  };
}

export function newSessionId(): string {
  const c = globalThis.crypto;
  const rnd = c?.randomUUID ? c.randomUUID().slice(0, 8) : Math.random().toString(16).slice(2, 10);
  return 'W07-' + rnd.toUpperCase();
}

export function freshSave(sessionId: string = newSessionId()): SaveData {
  const now = Date.now();
  return {
    kind: 'CW_SAVE',
    schemaVersion: SAVE_SCHEMA_VERSION,
    contentVersion: CONTENT_VERSION,
    sessionId,
    revision: 1,
    startedAtMs: now,
    savedAtMs: now,
    elapsedActiveMs: 0,
    lastRoute: '',
    hashAlgorithm: 'sha-256',
    events: [],
    pinnedEvidence: [],
    drafts: defaultDrafts(),
    witness: null,
    seenPresentationCues: [],
  };
}

function isValidEvent(e: unknown): e is GameEvent {
  if (!e || typeof e !== 'object') return false;
  const o = e as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.seq === 'number' &&
    typeof o.txId === 'string' &&
    typeof o.hash === 'string' &&
    typeof o.code === 'string' &&
    (EVENT_CODES as readonly string[]).includes(o.code) &&
    (o.previousHash === null || typeof o.previousHash === 'string') &&
    (o.actor === 'PLAYER' || o.actor === 'SYSTEM')
  );
}

export function parseSave(raw: unknown): LoadResult {
  if (!raw || typeof raw !== 'object') return { ok: false, error: '存档格式不正确。' };
  const o = raw as Record<string, unknown>;
  if (o.kind !== 'CW_SAVE' && o.kind !== undefined) return { ok: false, error: '这不是随访平台的存档文件。' };
  const v = o.schemaVersion;
  if (v === 1) {
    return {
      ok: false,
      error: '该存档来自旧版本（schema 1），与本版不兼容；可另开新局，旧文件已保留。',
    };
  }
  if (v === 2) {
    return {
      ok: false,
      error: '该存档来自证据系统改版前的版本（schema 2），进度不能直接延续。可另开新局重新开始；原文件不会被覆盖，如需保留请先导出备份。',
    };
  }
  if (typeof v !== 'number' || v > SAVE_SCHEMA_VERSION)
    return { ok: false, error: '存档来自更新版本的游戏，请升级后再试。' };
  if (typeof o.sessionId !== 'string' || !Array.isArray(o.events))
    return { ok: false, error: '存档结构不完整。' };
  if (!o.events.every(isValidEvent)) return { ok: false, error: '事件日志含无法识别的条目。' };
  const onceSeen = new Set<string>();
  for (const e of o.events as GameEvent[]) {
    if (ONCE_EVENT_CODES.has(e.code)) {
      if (onceSeen.has(e.code)) return { ok: false, error: `事件 ${e.code} 出现了两次，日志不合法。` };
      onceSeen.add(e.code);
    }
  }
  const cv = o.contentVersion === undefined ? CONTENT_VERSION : String(o.contentVersion);
  if (cv !== CONTENT_VERSION) {
    return { ok: false, error: `存档内容版本（${cv}）与当前版本（${CONTENT_VERSION}）不一致。` };
  }
  return {
    ok: true,
    save: {
      kind: 'CW_SAVE',
      schemaVersion: SAVE_SCHEMA_VERSION,
      contentVersion: CONTENT_VERSION,
      sessionId: o.sessionId,
      revision: typeof o.revision === 'number' ? o.revision : 1,
      startedAtMs: typeof o.startedAtMs === 'number' ? o.startedAtMs : Date.now(),
      savedAtMs: typeof o.savedAtMs === 'number' ? o.savedAtMs : Date.now(),
      elapsedActiveMs: typeof o.elapsedActiveMs === 'number' ? o.elapsedActiveMs : 0,
      lastRoute: typeof o.lastRoute === 'string' ? o.lastRoute : '',
      hashAlgorithm: 'sha-256',
      events: o.events,
      pinnedEvidence: Array.isArray(o.pinnedEvidence) ? (o.pinnedEvidence as SaveData['pinnedEvidence']) : [],
      drafts: { ...defaultDrafts(), ...(o.drafts ?? {}) },
      witness: (o.witness ?? null) as WitnessRecord | null,
      seenPresentationCues: Array.isArray(o.seenPresentationCues) ? o.seenPresentationCues : [],
    },
  };
}

export function loadFromStorage(storage: KVStorage): LoadResult | null {
  const raw = storage.getItem(SAVE_KEY);
  if (raw === null) return null;
  try {
    return parseSave(JSON.parse(raw));
  } catch {
    return { ok: false, error: '存档无法解析。' };
  }
}

export function writeToStorage(storage: KVStorage, save: SaveData): void {
  storage.setItem(SAVE_KEY, JSON.stringify(save));
}

export function clearStorage(storage: KVStorage): void {
  storage.removeItem(SAVE_KEY);
}

export const DEFAULT_SETTINGS: SettingsData = {
  subtitles: true,
  volume: 0.8,
  textScale: 1,
  reducedMotion: 'follow-system',
  walkthrough: false,
};

export function loadSettings(storage: KVStorage): SettingsData {
  const raw = storage.getItem(SETTINGS_KEY);
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<SettingsData>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function writeSettings(storage: KVStorage, s: SettingsData): void {
  storage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

// —— IndexedDB：本地见证录音 ——
const DB_NAME = 'cw-audio';
const STORE = 'witness';

export interface WitnessBlobRecord {
  id: string;
  mime: string;
  blob: Blob;
  createdAtMs: number;
}

function openWitnessDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('此环境不支持 IndexedDB'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB 打开失败'));
  });
}

export async function putWitnessBlob(rec: WitnessBlobRecord): Promise<void> {
  const db = await openWitnessDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(rec);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('写入失败'));
  });
  db.close();
}

export async function getWitnessBlob(id: string): Promise<WitnessBlobRecord | undefined> {
  const db = await openWitnessDb();
  const rec = await new Promise<WitnessBlobRecord | undefined>((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result as WitnessBlobRecord | undefined);
    req.onerror = () => reject(req.error ?? new Error('读取失败'));
  });
  db.close();
  return rec;
}

export async function clearWitnessBlobs(): Promise<void> {
  const db = await openWitnessDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('清除失败'));
  });
  db.close();
}
