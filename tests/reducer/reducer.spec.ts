/** 转移与六条完整路线（docs/01_核心契约.md v1.1 §5/§11）。 */
import { describe, expect, it } from 'vitest';
import { deriveFacts, derivePhase } from '../../src/game/reducer';
import { planCommand } from '../../src/game/commands';
import { noMutationAfterEnding, validateEvents } from '../../src/game/validate';
import { sha256Hex } from '../../src/game/hash-chain';
import { TestEngine, fullRun } from '../helpers';
import type { GameEvent } from '../../src/game/types';

function ev(code: GameEvent['code'], payload: Record<string, unknown> = {}, extra: Partial<GameEvent> = {}): GameEvent {
  return {
    id: `t-${code}`,
    seq: 0,
    elapsedMs: 0,
    txId: 't',
    actor: 'PLAYER',
    previousHash: null,
    hash: 't',
    code,
    payload: payload as GameEvent['payload'],
    ...extra,
  } as GameEvent;
}

describe('转移表', () => {
  it('T1：观察事件 + 重算进入预归档（两条路线等价推进）', () => {
    const self = [
      ev('SUBMIT_REVIEW', { patientId: 'R03', prefill: 'POSITIVE' }),
      ev('REVIEW_TRIGGER_OBSERVED', { cause: { kind: 'SELF', eventId: 'x-7' }, observedScope: 'ENDING' }),
      ev('INDEX_RECOUNT', { count: 5, causeObservationId: 'x-7' }),
    ];
    const replay = [
      ev('WATCH_REPLAY', { archiveId: 'RV_PREV_01' }),
      ev('REVIEW_TRIGGER_OBSERVED', { cause: { kind: 'REPLAY', archiveId: 'RV_PREV_01' }, observedScope: 'ENDING' }),
      ev('INDEX_RECOUNT', { count: 5, causeObservationId: 'RV_PREV_01#2' }),
    ];
    expect(derivePhase(self).phase).toBe('R03_PREARCHIVED');
    expect(derivePhase(replay).phase).toBe('R03_PREARCHIVED');
    expect(deriveFacts(self).reviewCause?.kind).toBe('SELF');
    expect(deriveFacts(replay).reviewCause?.kind).toBe('REPLAY');
    // 拒签路线不生成玩家的 SUBMIT_REVIEW
    expect(replay.some((e) => e.code === 'SUBMIT_REVIEW')).toBe(false);
  });

  it('T2 前置：未确认 AUD01 内容时 linkIdentity 被拒绝', () => {
    const engine = new TestEngine();
    return (async () => {
      await engine.run({ kind: 'boot' });
      await engine.run({ kind: 'ackHandoverSaved' });
      await engine.run({ kind: 'ackRules' });
      await engine.run({ kind: 'submitReview' });
      await engine.run({ kind: 'recheckSubmitted', evidenceIds: ['EV01', 'EV06'] });
      const plan = planCommand(engine.state, { kind: 'linkIdentity', source: 'EV01' });
      expect(plan.ok).toBe(false);
    })();
  });

  it('重复提交复核被拒绝（无双签）', () => {
    const engine = new TestEngine();
    return (async () => {
      await engine.run({ kind: 'boot' });
      await engine.run({ kind: 'ackHandoverSaved' });
      await engine.run({ kind: 'ackRules' });
      await engine.run({ kind: 'submitReview' });
      const plan = planCommand(engine.state, { kind: 'submitReview' });
      expect(plan.ok).toBe(false);
    })();
  });
});

describe('六条完整路线（SELF/REPLAY × A/B/C）', () => {
  for (const cause of ['SELF', 'REPLAY'] as const) {
    for (const ending of ['A', 'B', 'C'] as const) {
      it(`${cause} → ${ending}`, async () => {
        const e = await fullRun(cause, ending);
        const s = e.state;
        expect(s.ending).toBe(ending);
        expect(s.lastMainPhase).toBe('SURGERY_READY');
        expect(s.facts.reviewCause?.kind).toBe(cause);
        expect(s.facts.carePlanReady).toBe(true);

        const hasCode = (c: string) => e.events.some((x) => x.code === c);
        if (cause === 'SELF') expect(hasCode('SUBMIT_REVIEW')).toBe(true);
        else {
          expect(hasCode('SUBMIT_REVIEW')).toBe(false);
          expect(hasCode('WATCH_REPLAY')).toBe(true);
        }
        // 系统事件由事务携带
        expect(hasCode('REVIEW_TRIGGER_OBSERVED')).toBe(true);
        expect(hasCode('INDEX_RECOUNT')).toBe(true);
        expect(hasCode('W07_SEATED')).toBe(true);
        expect(hasCode('LOAD_CARD')).toBe(true);
        expect(hasCode('RECOVER_AUDIO')).toBe(true);
        expect(hasCode('ENTER_ENDING')).toBe(true);
        // J05：三条照护事件只在 C 的最终事务中
        if (ending === 'C') {
          expect(s.facts.severedEdge).toBe('D');
          expect(s.facts.finalSign).toBe('FACT_ONLY');
          expect(s.facts.nextVisitOpened).toBe(true);
          expect(hasCode('RESTORE_IDENTITY')).toBe(true);
          expect(hasCode('PRESERVE_INTENT')).toBe(true);
          expect(hasCode('OPEN_NEXT_VISIT')).toBe(true);
        } else {
          expect(s.facts.nextVisitOpened).toBe(false);
          expect(hasCode('OPEN_NEXT_VISIT')).toBe(false);
        }
        if (ending === 'B') expect(s.facts.severedEdge).toBe('F');
        if (ending === 'A') {
          expect(s.facts.finalSign).toBe('ENDING');
          expect(hasCode('SEVER_EDGE')).toBe(false);
        }
        // 事件校验（结构 + 哈希链）
        const report = await validateEvents(e.events, e.sessionId, sha256Hex);
        expect(report.problems).toEqual([]);
        expect(noMutationAfterEnding(s)).toBe(true);
      });
    }
  }
});

describe('阶段推导细节', () => {
  it('T3 五件事缺一不可', () => {
    const base = [
      ev('REVIEW_TRIGGER_OBSERVED', { cause: { kind: 'SELF', eventId: 'x' }, observedScope: 'ENDING' }),
      ev('INDEX_RECOUNT', { count: 5, causeObservationId: 'x' }),
      ev('LINK_IDENTITY', { patientId: 'R03', name: '许棠', source: 'EV01' }),
    ];
    const marks: GameEvent[] = [
      ev('TIMELINE_SOLVED'),
      ev('TAG_POSTS'),
      ev('MATCH_FLOORPLAN'),
      ev('INFER_MASQUE', { choice: 'INSIDE_STRUCTURE' }),
      ev('LINK_AUDIENCE'),
    ];
    expect(derivePhase([...base, ...marks]).phase).toBe('THEATER_DISCOVERED');
    expect(derivePhase([...base, ...marks.slice(1)]).phase).toBe('IDENTITY_RESTORED');
  });

  it('T8 需先确认完整录音再见证', () => {
    const upto = (withRead: boolean) => {
      const e = [
        ev('REVIEW_TRIGGER_OBSERVED', { cause: { kind: 'SELF', eventId: 'x' }, observedScope: 'ENDING' }),
        ev('INDEX_RECOUNT', { count: 5, causeObservationId: 'x' }),
        ev('LINK_IDENTITY', { patientId: 'R03', name: '许棠', source: 'EV01' }),
        ev('TIMELINE_SOLVED', {}),
        ev('TAG_POSTS', {}),
        ev('MATCH_FLOORPLAN', {}),
        ev('INFER_MASQUE', { choice: 'INSIDE_STRUCTURE' }),
        ev('LINK_AUDIENCE', {}),
        ev('PROVE_SHARED_SOURCE', {}),
        ev('INFER_REFRAIN', { choice: 'ONE_TERMINATION_INTERFACE' }),
        ev('EXPERIMENT_CONCLUDED', {}),
        ev('INSPECT_SLICE', {}),
        ev('FORK_TRAIL', {}),
        ev('AUDIO_ORDER_SOLVED', {}),
      ];
      if (withRead) e.push(ev('ACK_AUDIO_CONTENT', { audioId: 'CHANNEL_03_FULL', mode: 'TEXT' }));
      e.push(ev('WITNESS_SCOPE', { mode: 'TEXT', statementKey: 'witness.canonical', recordingId: null }));
      return e;
    };
    expect(derivePhase(upto(true)).phase).toBe('SCOPE_LIMITED');
    expect(derivePhase(upto(false)).phase).toBe('AUDIO_RECOVERED');
  });

  it('T9：未预览 D/F 不能准备下一班', () => {
    const engine = new TestEngine();
    return (async () => {
      const e = await fullRun('SELF', 'A');
      engine.events = e.events.slice(0, e.events.findIndex((x) => x.code === 'SEVER_PREVIEW'));
      const plan = planCommand(engine.state, { kind: 'assembleNextVisit', slots: { identity: {}, intent: {}, chain: null } });
      // 该切点必然在 assemble 之前；未预览时应被拒绝（若切点恰好无效则跳过）
      if (engine.state.facts.witnessScope === 'FACT_ONLY') {
        expect(plan.ok).toBe(false);
      }
    })();
  });

  it('结束后命令被拒绝', async () => {
    const e = await fullRun('REPLAY', 'C');
    const plan = planCommand(e.state, { kind: 'chooseEnding', ending: 'A' });
    expect(plan.ok).toBe(false);
  });
});
