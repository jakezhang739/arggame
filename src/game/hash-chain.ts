/** 哈希链（docs/01_核心契约.md v1.1 §9）。SHA-256 only；canonical 为 stableStringify JSON。 */
import type { GameEvent } from './types';

export type Digest = (s: string) => Promise<string>;

export function stableStringify(v: unknown): string {
  if (v === undefined) throw new Error('canonical JSON 不允许 undefined');
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  if (v !== null && typeof v === 'object') {
    const entries = Object.entries(v as Record<string, unknown>).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    );
    if (entries.some(([, val]) => val === undefined)) {
      throw new Error('canonical JSON 不允许 undefined 属性');
    }
    return '{' + entries.map(([k, val]) => `${JSON.stringify(k)}:${stableStringify(val)}`).join(',') + '}';
  }
  if (typeof v === 'number' && !Number.isFinite(v)) {
    throw new Error('canonical JSON 不允许 NaN/Infinity');
  }
  const s = JSON.stringify(v);
  if (s === undefined) throw new Error('canonical JSON 不允许该值');
  return s;
}

/** canonical：除 hash 以外的全部字段做 stableStringify。 */
export function canonical(e: Omit<GameEvent, 'hash'>): string {
  return stableStringify(e);
}

export const sha256Hex: Digest = async (s) => {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('当前环境缺少 Web Crypto（SHA-256）；请使用 HTTPS 或 localhost 打开');
  const buf = await subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

export interface HashAppendInput {
  sessionId: string;
  elapsedMs: number;
  txId: string;
  actor: 'PLAYER' | 'SYSTEM';
  code: GameEvent['code'];
  scope?: GameEvent['scope'];
  payload: Record<string, unknown>;
}

export async function buildEvent(
  prev: GameEvent | undefined,
  input: HashAppendInput,
  digest: Digest,
): Promise<GameEvent> {
  const seq = prev ? prev.seq + 1 : 1;
  const base = {
    id: `${input.sessionId}-${seq}`,
    seq,
    elapsedMs: input.elapsedMs,
    txId: input.txId,
    actor: input.actor,
    ...(input.scope !== undefined ? { scope: input.scope } : {}),
    previousHash: prev?.hash ?? null,
    code: input.code,
    payload: input.payload,
  };
  const hash = await digest(canonical(base as unknown as Omit<GameEvent, 'hash'>));
  return { ...base, hash } as GameEvent;
}

export interface ChainVerification {
  ok: boolean;
  firstBrokenSeq?: number;
}

export async function verifyChain(events: GameEvent[], digest: Digest): Promise<ChainVerification> {
  let prev: GameEvent | undefined;
  for (const e of events) {
    const { hash, ...rest } = e;
    const expected = await digest(canonical(rest));
    if (hash !== expected || e.previousHash !== (prev?.hash ?? null)) {
      return { ok: false, firstBrokenSeq: e.seq };
    }
    prev = e;
  }
  return { ok: true };
}
