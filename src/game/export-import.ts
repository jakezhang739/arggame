/** 导入导出（docs/01_核心契约.md v1.1 §10）。ExportData 包裹完整 SaveData；不含录音 blob。 */
import type { ExportData, SaveData } from './types';
import { CONTENT_VERSION, type KVStorage, type LoadResult, parseSave } from './persistence';

export function buildExportFile(save: SaveData): ExportData {
  return {
    kind: 'CW_EXPORT',
    schemaVersion: 2,
    contentVersion: CONTENT_VERSION,
    save,
  };
}

export function exportFileName(save: SaveData): string {
  return `CW_ARCHIVE_${save.sessionId.slice(0, 8)}.json`;
}

export type ImportResult = { ok: true; save: SaveData } | { ok: false; error: string };

export function parseImportFile(raw: unknown): ImportResult {
  if (!raw || typeof raw !== 'object') return { ok: false, error: '文件不是有效的本局档案。' };
  const o = raw as Record<string, unknown>;
  if (o.kind !== 'CW_EXPORT') return { ok: false, error: '文件缺少 CW_EXPORT 标识。' };
  const parsed: LoadResult = parseSave(o.save);
  if (!parsed.ok) return parsed;
  return { ok: true, save: parsed.save };
}

/** 浏览器端触发下载；非浏览器环境静默跳过。 */
export function downloadTextFile(filename: string, text: string, mime = 'application/json'): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export { type KVStorage };
