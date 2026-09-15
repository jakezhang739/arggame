/** 存档与导入导出（docs/01_核心契约.md v1.1 §10）。 */
import { describe, expect, it } from 'vitest';
import {
  clearStorage,
  freshSave,
  loadFromStorage,
  loadSettings,
  parseSave,
  SAVE_KEY,
  writeToStorage,
  type KVStorage,
} from '../../src/game/persistence';
import { buildExportFile, parseImportFile } from '../../src/game/export-import';
import { fullRun } from '../helpers';

function memoryStorage(): KVStorage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  };
}

describe('SaveData v3', () => {
  it('freshSave 结构完整', () => {
    const s = freshSave('W07-ABCD1234');
    expect(s.kind).toBe('CW_SAVE');
    expect(s.schemaVersion).toBe(3);
    expect(s.contentVersion).toBe('1.2');
    expect(s.hashAlgorithm).toBe('sha-256');
    expect(s.drafts.timelineOrder).toEqual([]);
  });

  it('v1 存档明确拒绝（不自动伪造升级）', () => {
    const r = parseSave({ kind: 'CW_SAVE', schemaVersion: 1, sessionId: 'W07-X', events: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('不兼容');
  });

  it('v2 存档（Batch 3 之前）明确拒绝并提示重开', () => {
    const r = parseSave({ kind: 'CW_SAVE', schemaVersion: 2, sessionId: 'W07-X', events: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain('重新开始');
      expect(r.error).toContain('schema 2');
    }
  });

  it('更高版本与坏结构拒绝', () => {
    expect(parseSave({ schemaVersion: 4 }).ok).toBe(false);
    expect(parseSave({ schemaVersion: 3 }).ok).toBe(false);
    expect(
      parseSave({
        kind: 'CW_SAVE', schemaVersion: 3, contentVersion: '1.2',
        sessionId: 'W07-X', events: [{ id: 'x', seq: 1, code: 'NOT_REAL' }],
      }).ok,
    ).toBe(false);
  });

  it('一次性事件重复的日志被拒绝', () => {
    const fake = freshSave('W07-DUP');
    fake.events = [
      { id: 'W07-DUP-1', seq: 1, elapsedMs: 1, txId: 't', actor: 'PLAYER', previousHash: null, hash: 'a', code: 'SUBMIT_REVIEW', payload: { patientId: 'R03', prefill: 'POSITIVE' } },
      { id: 'W07-DUP-2', seq: 2, elapsedMs: 2, txId: 't', actor: 'PLAYER', previousHash: 'a', hash: 'b', code: 'SUBMIT_REVIEW', payload: { patientId: 'R03', prefill: 'POSITIVE' } },
    ] as never;
    expect(parseSave(fake).ok).toBe(false);
  });

  it('roundtrip：完整六路线日志存取一致', async () => {
    const storage = memoryStorage();
    expect(loadFromStorage(storage)).toBeNull();
    const engine = await fullRun('REPLAY', 'B');
    const save = freshSave(engine.sessionId);
    save.events = engine.events;
    writeToStorage(storage, save);
    const loaded = loadFromStorage(storage);
    expect(loaded && loaded.ok).toBe(true);
    if (loaded && loaded.ok) {
      expect(loaded.save.events).toHaveLength(engine.events.length);
      expect(loaded.save.events.at(-1)?.code).toBe('ENTER_ENDING');
    }
    clearStorage(storage);
    expect(storage.getItem(SAVE_KEY)).toBeNull();
  });

  it('设置读取合并默认值', () => {
    const storage = memoryStorage();
    expect(loadSettings(storage).textScale).toBe(1);
  });
});

describe('导入导出', () => {
  it('ExportData 包裹完整存档；导入 roundtrip（追加 IMPORT 前的前缀一致）', async () => {
    const engine = await fullRun('SELF', 'C');
    const save = freshSave(engine.sessionId);
    save.events = engine.events;
    const file = buildExportFile(save);
    expect(file.kind).toBe('CW_EXPORT');
    expect(file.save.events).toHaveLength(engine.events.length);
    const back = parseImportFile(JSON.parse(JSON.stringify(file)));
    expect(back.ok).toBe(true);
    if (back.ok) {
      expect(back.save.events).toHaveLength(engine.events.length);
      // 前缀比较：导入后在末尾追加 IMPORT_ARCHIVE，不比较整个数组
      expect(back.save.events.every((e, i) => e.id === engine.events[i].id)).toBe(true);
    }
  });

  it('缺少 CW_EXPORT 标识或坏存档拒绝且不触及当前进度', () => {
    expect(parseImportFile({ schemaVersion: 2 }).ok).toBe(false);
    expect(parseImportFile({ kind: 'CW_EXPORT', save: { schemaVersion: 1 } }).ok).toBe(false);
  });
});
