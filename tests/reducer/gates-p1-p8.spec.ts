/** 谜题判定（docs/01_核心契约.md v1.1 §7）。 */
import { describe, expect, it } from 'vitest';
import {
  A1_CORRECT_ORDER,
  checkA1,
  checkM7,
  checkP1,
  checkP2,
  checkP3,
  checkP4,
  checkP5,
  checkP6,
  checkP8,
  checkRnm,
  EXPERIMENT_CONFIGS,
  TIMELINE_CORRECT_ORDER,
} from '../../src/game/gates';
import { TestEngine, fullSlots, fullRun } from '../helpers';
import type { EvidenceId, NextVisitSlots } from '../../src/game/types';

async function engineToPrearchived(): Promise<TestEngine> {
  const e = new TestEngine();
  await e.run({ kind: 'boot' });
  await e.run({ kind: 'ackHandoverSaved' });
  await e.run({ kind: 'ackRules' });
  await e.run({ kind: 'submitReview' });
  for (const doc of ['EV05', 'EV06', 'EV07', 'EV08', 'EV09', 'EV10', 'EV11']) {
    await e.run({ kind: 'openDoc', documentId: doc });
  }
  return e;
}

describe('p1（人数与身份索引）', () => {
  it('EV01+EV02 不通过（同源名单副本）；EV02+EV06 通过（快照路线）', async () => {
    const e = await engineToPrearchived();
    expect(checkP1(e.state, 'IDENTITY_INDEX', ['EV01', 'EV02']).ok).toBe(false);
    expect(checkP1(e.state, 'IDENTITY_INDEX', ['EV01', 'EV06']).ok).toBe(true);
    // 快照路线取得 EV02 后，EV02+EV06 同样通过
    const snap = new TestEngine();
    await snap.run({ kind: 'boot' });
    await snap.run({ kind: 'downloadHandover' });
    await snap.run({ kind: 'openSnapshot' });
    await snap.run({ kind: 'ackRules' });
    await snap.run({ kind: 'submitReview' });
    for (const doc of ['EV06', 'EV07']) await snap.run({ kind: 'openDoc', documentId: doc });
    expect(checkP1(snap.state, 'IDENTITY_INDEX', ['EV02', 'EV06']).ok).toBe(true);
  });
  it('缺名单基线或缺在场记录给出具体冲突', async () => {
    const e = await engineToPrearchived();
    const r1 = checkP1(e.state, 'IDENTITY_INDEX', ['EV06', 'EV08']);
    expect(r1.ok).toBe(false);
    expect(r1.conflicts.join()).toContain('名单基线');
    const r2 = checkP1(e.state, 'IDENTITY_INDEX', ['EV01', 'EV02']);
    expect(r2.conflicts.join()).toContain('在场记录');
    const r3 = checkP1(e.state, 'COUNT_ERROR', ['EV01', 'EV06']);
    expect(r3.ok).toBe(false);
  });
});

describe('p2（时间线）', () => {
  it('正确顺序 + 标记 EV11', () => {
    expect(checkP2([...TIMELINE_CORRECT_ORDER], ['EV11']).ok).toBe(true);
    expect(checkP2([...TIMELINE_CORRECT_ORDER].reverse(), ['EV11']).ok).toBe(false);
    expect(checkP2([...TIMELINE_CORRECT_ORDER], []).ok).toBe(false);
  });
});

describe('m7 / p3 / p4 / rnm', () => {
  it('m7 需 EV17 + 空间匹配 + 双证据', async () => {
    const e = await engineToPrearchived();
    expect(checkM7(e.state, 'INSIDE_STRUCTURE', ['EV16', 'EV17']).ok).toBe(false); // 未完成空间匹配
    await e.run({ kind: 'recheckSubmitted', evidenceIds: ['EV01', 'EV06'] });
    await e.run({ kind: 'ackAudioContent', audioId: 'AUD01', mode: 'TEXT' });
    await e.run({ kind: 'linkIdentity', source: 'EV01' });
    await e.run({
      kind: 'solveTimeline',
      order: [...TIMELINE_CORRECT_ORDER],
      unreliable: ['EV11'],
    });
    await e.run({ kind: 'tagPosts', postIds: ['a', 'b', 'c'], tags: ['t'] });
    await e.run({ kind: 'openDoc', documentId: 'THEATER_MAP' });
    await e.run({ kind: 'matchFloorplan', pairs: ['ward=backend'] });
    await e.run({ kind: 'openDoc', documentId: 'EV17' });
    expect(checkM7(e.state, 'INSIDE_STRUCTURE', ['EV16', 'EV17']).ok).toBe(true);
    expect(checkM7(e.state, 'INSIDE_STRUCTURE', ['EV17']).ok).toBe(false);
  });

  it('p3 与本局 ReviewCause 完全一致；REPLAY 不能选 SELF', async () => {
    const self = await engineToPrearchived();
    expect(checkP3(self.state, 'AFFIRM_ENDING', 'SEAT_W07', 'SELF').ok).toBe(true);
    expect(checkP3(self.state, 'AFFIRM_ENDING', 'SEAT_W07', 'REPLAY').ok).toBe(false);
    const replay = new TestEngine();
    await replay.run({ kind: 'boot' });
    await replay.run({ kind: 'ackHandoverSaved' });
    await replay.run({ kind: 'ackRules' });
    await replay.run({ kind: 'watchReplay' });
    expect(checkP3(replay.state, 'AFFIRM_ENDING', 'SEAT_W07', 'REPLAY').ok).toBe(true);
    expect(checkP3(replay.state, 'AFFIRM_ENDING', 'SEAT_W07', 'SELF').ok).toBe(false);
    expect(checkP3(self.state, 'WATCH', 'SEAT_W07', 'SELF').ok).toBe(false);
  });

  it('p4 需 TYPO + SOURCE_ID 且两文档已取得', async () => {
    const e = await engineToPrearchived();
    expect(checkP4(e.state, ['TYPO', 'SOURCE_ID']).ok).toBe(false); // EV19/EV20 未取得
    const e2 = new TestEngine();
    await e2.run({ kind: 'boot' });
    await e2.run({ kind: 'watchReplay' });
    await e2.run({ kind: 'ackHandoverSaved' });
    await e2.run({ kind: 'ackRules' });
    void e;
  });

  it('rnm 需 EV22 与正确选项', async () => {
    const e = await engineToPrearchived();
    expect(checkRnm(e.state, 'ONE_TERMINATION_INTERFACE').ok).toBe(false);
  });
});

describe('p5（单变量实验）', () => {
  it('配置表与契约一致', () => {
    expect(EXPERIMENT_CONFIGS.B.identityLost).toBe(true);
    expect(EXPERIMENT_CONFIGS.D.identityLost).toBe(true);
    expect(EXPERIMENT_CONFIGS.E.identityLost).toBe(true);
    expect(EXPERIMENT_CONFIGS.A.identityLost).toBe(false);
    expect(EXPERIMENT_CONFIGS.C.identityLost).toBe(false);
    expect(EXPERIMENT_CONFIGS.F.externalConfirm).toBe('FACT_ONLY');
  });

  it('labelPair 只接受 B+D；E+D 是混杂反例；scopePair 三选一；changed 两项', async () => {
    const e = await engineToPrearchived();
    for (const c of ['A', 'B', 'C', 'D', 'E', 'F'] as const) {
      await e.run({ kind: 'runExperiment', configId: c });
    }
    const ok1 = checkP5(e.state, ['B', 'D'], ['B', 'F'], ['endingLabel', 'externalConfirm']);
    expect(ok1.ok).toBe(true);
    expect(checkP5(e.state, ['E', 'D'], ['B', 'F'], ['endingLabel', 'externalConfirm']).ok).toBe(false);
    expect(checkP5(e.state, ['B', 'D'], ['A', 'C'], ['endingLabel', 'externalConfirm']).ok).toBe(false);
    expect(checkP5(e.state, ['B', 'D'], ['A', 'B'], ['endingLabel', 'externalConfirm']).ok).toBe(true);
    expect(checkP5(e.state, ['B', 'D'], ['C', 'D'], ['endingLabel', 'externalConfirm']).ok).toBe(true);
    expect(checkP5(e.state, ['B', 'D'], ['B', 'F'], ['endingLabel']).ok).toBe(false);
  });

  it('未运行的配置不能提交', async () => {
    const e = await engineToPrearchived(); // 未运行任何实验
    const r = checkP5(e.state, ['B', 'D'], ['B', 'F'], ['endingLabel', 'externalConfirm']);
    expect(r.ok).toBe(false);
    expect(r.conflicts.join()).toContain('尚未运行');
  });
});

describe('p6 / a1 / p8', () => {
  const links: Record<string, EvidenceId[]> = {
    SNAPSHOT_LOADED: ['EV01'],
    REVIEW_CAUSE_OBSERVED: ['EV05', 'EV10'],
    IDENTITY_LINKED: ['EV12'],
  };
  it('p6 三槽 + 双证据 + UNSUPPORTED_ENDING', async () => {
    const e = await engineToPrearchived();
    const order = ['SNAPSHOT_LOADED', 'REVIEW_CAUSE_OBSERVED', 'IDENTITY_LINKED'];
    const r = checkP6(e.state, order, links, 'UNSUPPORTED_ENDING');
    // ENGINE 尚未有 LINK_IDENTITY 事件 → 该条冲突
    expect(r.ok).toBe(false);
    expect(r.conflicts.join()).toContain('恢复关联');
    const badLinks: Record<string, EvidenceId[]> = { ...links, REVIEW_CAUSE_OBSERVED: ['EV05'] };
    expect(checkP6(e.state, order, badLinks, 'UNSUPPORTED_ENDING').ok).toBe(false);
    expect(checkP6(e.state, order, links, 'UNKNOWN').ok).toBe(false);
  });

  it('a1 顺序 + 三接续对', () => {
    expect(checkA1([...A1_CORRECT_ORDER], ['CART_SPLIT', 'FOOTSTEP_SPLIT', 'SWITCH_SPLIT']).ok).toBe(true);
    expect(checkA1([...A1_CORRECT_ORDER], ['CART_SPLIT']).ok).toBe(false);
    expect(checkA1([...A1_CORRECT_ORDER].reverse(), ['CART_SPLIT', 'FOOTSTEP_SPLIT', 'SWITCH_SPLIT']).ok).toBe(false);
  });

  it('p8 槽位归属：重复 ST_R03 六次失败；正确六人通过', async () => {
    const e = await fullRun('SELF', 'C');
    const dup: NextVisitSlots = {
      ...fullSlots(),
      intent: Object.fromEntries(
        ['R01', 'R02', 'R03', 'R04', 'R05', 'R06'].map((p) => [p, 'ST_R03']),
      ) as NextVisitSlots['intent'],
    };
    const r = checkP8(e.state, dup);
    expect(r.ok).toBe(false);
    expect(checkP8(e.state, fullSlots()).ok).toBe(true);
    const wrongOwner: NextVisitSlots = {
      ...fullSlots(),
      identity: { ...fullSlots().identity, R01: 'EV01#R02' },
    };
    expect(checkP8(e.state, wrongOwner).ok).toBe(false);
  });
});
