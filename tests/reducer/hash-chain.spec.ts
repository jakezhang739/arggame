/** 哈希链（docs/01_核心契约.md v1.1 §9）：canonical JSON、SHA-256 only。 */
import { describe, expect, it } from 'vitest';
import { buildEvent, canonical, stableStringify, verifyChain, sha256Hex } from '../../src/game/hash-chain';

describe('canonical JSON', () => {
  it('键序稳定；拒绝 undefined', () => {
    expect(stableStringify({ b: 1, a: [2, 1] })).toBe(stableStringify({ a: [2, 1], b: 1 }));
    expect(() => stableStringify({ x: undefined })).toThrow();
    expect(() => stableStringify(NaN)).toThrow();
  });
  it('payload 含分隔符不产生歧义（JSON 串行化）', () => {
    const c1 = canonical({
      id: 'a-1', seq: 1, elapsedMs: 5, txId: 't', actor: 'PLAYER',
      previousHash: null, code: 'OPEN_DOC', payload: { documentId: 'a|b:c' },
    } as never);
    expect(c1).toContain('"a|b:c"');
  });
});

describe('成链与校验', () => {
  it('首条 previousHash=null；后续严格衔接；SHA-256 hex', async () => {
    const e1 = await buildEvent(undefined, {
      sessionId: 'W07-T', elapsedMs: 100, txId: 't1', actor: 'PLAYER',
      code: 'BOOT_SESSION', payload: {},
    }, async () => 'fake');
    expect(e1.previousHash).toBeNull();
    expect(e1.seq).toBe(1);
    const e2 = await buildEvent(e1, {
      sessionId: 'W07-T', elapsedMs: 200, txId: 't1', actor: 'SYSTEM', scope: 'READ',
      code: 'LOAD_SNAPSHOT', payload: { count: 6 },
    }, async () => 'fake');
    expect(e2.previousHash).toBe(e1.hash);
    const v = await verifyChain([e1, e2], async () => 'fake');
    expect(v.ok).toBe(true);
  });

  it('篡改 payload 或 hash 被定位到 seq', async () => {
    const d = sha256Hex; // 真实摘要，避免长度型假摘要碰撞
    const e1 = await buildEvent(undefined, { sessionId: 'W07-T', elapsedMs: 1, txId: 't', actor: 'PLAYER', code: 'BOOT_SESSION', payload: {} }, d);
    const e2 = await buildEvent(e1, { sessionId: 'W07-T', elapsedMs: 2, txId: 't', actor: 'PLAYER', scope: 'ENDING', code: 'SUBMIT_REVIEW', payload: { patientId: 'R03', prefill: 'POSITIVE' } }, d);
    const tampered = { ...e2, payload: { ...(e2.payload as object), prefill: 'NEGATIVE' } as never };
    const v1 = await verifyChain([e1, tampered], d);
    expect(v1.ok).toBe(false);
    expect(v1.firstBrokenSeq).toBe(2);
    const forged = { ...e1, hash: 'nope' };
    const v2 = await verifyChain([forged, e2], d);
    expect(v2.firstBrokenSeq).toBe(1);
  });
});
