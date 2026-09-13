/** 事件与存档校验（docs/01_核心契约.md v1.1 §9/§11）。 */
import type { Digest } from './hash-chain';
import { verifyChain } from './hash-chain';
import type { GameEvent, GameState, SaveData } from './types';
import { ONCE_EVENT_CODES, SYSTEM_EVENT_CODES } from './types';
import { reduce } from './reducer';

export interface ValidationReport {
  ok: boolean;
  problems: string[];
}

/** 结构校验（不含哈希；可同步调用）。 */
export function validateEventStructure(events: GameEvent[], sessionId: string): string[] {
  const problems: string[] = [];
  const onceSeen = new Set<string>();
  let lastSeq = 0;
  let lastElapsed = 0;
  for (const e of events) {
    if (e.seq !== lastSeq + 1) problems.push(`seq 不连续：第 ${e.seq} 条（期望 ${lastSeq + 1}）。`);
    lastSeq = e.seq;
    if (e.elapsedMs < lastElapsed) problems.push(`elapsedMs 递减：第 ${e.seq} 条。`);
    lastElapsed = e.elapsedMs;
    if (!e.id.startsWith(`${sessionId}-`)) problems.push(`事件 id 与会话不符：${e.id}。`);
    if (SYSTEM_EVENT_CODES.has(e.code) && e.actor !== 'SYSTEM') {
      problems.push(`系统事件由玩家角色提交：${e.code}。`);
    }
    if (ONCE_EVENT_CODES.has(e.code)) {
      if (onceSeen.has(e.code)) problems.push(`一次性事件重复：${e.code}。`);
      onceSeen.add(e.code);
    }
  }
  return problems;
}

export async function validateEvents(
  events: GameEvent[],
  sessionId: string,
  digest: Digest,
): Promise<ValidationReport> {
  const problems = validateEventStructure(events, sessionId);
  const chain = await verifyChain(events, digest);
  if (!chain.ok) problems.push(`哈希链在第 ${chain.firstBrokenSeq} 条断裂。`);
  return { ok: problems.length === 0, problems };
}

export function validateSave(save: SaveData): ValidationReport {
  const problems: string[] = [];
  if (save.kind !== 'CW_SAVE') problems.push('存档 kind 不正确。');
  if (save.schemaVersion !== 2) problems.push('存档 schemaVersion 不正确。');
  if (save.contentVersion !== '1.1') problems.push('存档 contentVersion 不匹配。');
  if (save.hashAlgorithm !== 'sha-256') problems.push('存档哈希算法不正确。');
  problems.push(...validateEventStructure(save.events, save.sessionId));
  return { ok: problems.length === 0, problems };
}

/** 结束后不得再有改变照护结果的命令（结果突变检查）。 */
export function noMutationAfterEnding(state: GameState): boolean {
  const endingIdx = state.events.findIndex((e) => e.code === 'ENTER_ENDING');
  if (endingIdx < 0) return true;
  const mutators = new Set([
    'SUBMIT_REVIEW',
    'SEVER_EDGE',
    'FINAL_SIGN',
    'ACCEPT_ISOLATION',
    'ASSEMBLE_NEXT_VISIT',
    'WITNESS_SCOPE',
    'LINK_IDENTITY',
    'FORK_TRAIL',
    'AUDIO_ORDER_SOLVED',
    'EXPERIMENT_CONCLUDED',
  ]);
  return !state.events.slice(endingIdx + 1).some((e) => mutators.has(e.code));
}

export { reduce };
