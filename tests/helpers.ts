/** 测试引擎：命令 → 原子事件批次 → 哈希链 → 折叠。与 store 同构但无 Vue 依赖。 */
import { planCommand, type Command } from '../src/game/commands';
import { buildEvent, sha256Hex } from '../src/game/hash-chain';
import { reduce } from '../src/game/reducer';
import type { EndingId, GameEvent, GameState, NextVisitSlots, PatientId } from '../src/game/types';

const PATIENTS: PatientId[] = ['R01', 'R02', 'R03', 'R04', 'R05', 'R06'];

export class TestEngine {
  events: GameEvent[] = [];
  sessionId = 'W07-TEST0001';

  get state(): GameState {
    return reduce(this.events);
  }

  async run(cmd: Command): Promise<boolean> {
    const plan = planCommand(this.state, cmd);
    if (!plan.ok) throw new Error(`命令 ${cmd.kind} 被拒绝：${plan.error}`);
    let prev = this.events.at(-1);
    for (const d of plan.drafts) {
      const ev = await buildEvent(
        prev,
        {
          sessionId: this.sessionId,
          elapsedMs: (prev?.elapsedMs ?? 0) + 1000,
          txId: `tx-${this.events.length}`,
          actor: d.actor,
          ...(d.scope !== undefined ? { scope: d.scope } : {}),
          code: d.code,
          payload: d.payload as Record<string, unknown>,
        },
        sha256Hex,
      );
      this.events.push(ev);
      prev = ev;
    }
    return true;
  }
}

export function fullSlots(): NextVisitSlots {
  const identity: NextVisitSlots['identity'] = {};
  const intent: NextVisitSlots['intent'] = {};
  for (const p of PATIENTS) {
    identity[p] = `EV01#${p}` as `EV01#${PatientId}`;
    intent[p] = `ST_${p}` as `ST_${PatientId}`;
  }
  return { identity, intent, chain: 'EV27#NEXT_SHIFT' };
}

/** SELF/REPLAY × A/B/C 六条完整路线。 */
export async function fullRun(cause: 'SELF' | 'REPLAY', ending: EndingId): Promise<TestEngine> {
  const e = new TestEngine();
  await e.run({ kind: 'boot' });
  await e.run({ kind: 'downloadHandover' });
  await e.run({ kind: 'ackHandoverSaved' });
  await e.run({ kind: 'ackPaperNote' });
  await e.run({ kind: 'ackRules' });
  await e.run({ kind: 'loadSnapshot' });
  await e.run(cause === 'SELF' ? { kind: 'submitReview' } : { kind: 'watchReplay' });
  for (const doc of ['EV05', 'EV06', 'EV07', 'EV08', 'EV09', 'EV10', 'EV11']) {
    await e.run({ kind: 'openDoc', documentId: doc });
  }
  await e.run({ kind: 'recheckSubmitted', evidenceIds: ['EV01', 'EV06'] });
  await e.run({ kind: 'playAudio', audioId: 'AUD01' });
  await e.run({ kind: 'ackAudioContent', audioId: 'AUD01', mode: 'TEXT' });
  await e.run({ kind: 'linkIdentity', source: 'EV01' });
  await e.run({
    kind: 'solveTimeline',
    order: ['TL_HANDOVER', 'TL_OBSERVATION', 'TL_PREFILL', 'TL_REVIEW', 'TL_RECOUNT'],
    unreliable: ['EV11'],
  });
  await e.run({ kind: 'tagPosts', postIds: ['post_cq', 'post_sm', 'post_xt'], tags: ['theater'] });
  await e.run({ kind: 'openDoc', documentId: 'THEATER_MAP' });
  await e.run({ kind: 'matchFloorplan', pairs: ['ward=backend', 'station=prompter', 'terminal=outer-seat'] });
  await e.run({ kind: 'openDoc', documentId: 'EV17' });
  await e.run({ kind: 'inferMasque', evidenceIds: ['EV16', 'EV17'] });
  await e.run({ kind: 'linkAudience' });
  await e.run({ kind: 'openDoc', documentId: 'EV19' });
  await e.run({ kind: 'openDoc', documentId: 'EV20' });
  await e.run({ kind: 'proveSharedSource', markers: ['TYPO', 'SOURCE_ID'] });
  await e.run({ kind: 'openDoc', documentId: 'EV22' });
  await e.run({ kind: 'inferRefrain', evidenceIds: ['EV22'] });
  for (const c of ['A', 'B', 'C', 'D', 'E', 'F'] as const) {
    await e.run({ kind: 'runExperiment', configId: c });
  }
  await e.run({
    kind: 'concludeExperiment',
    labelPair: ['B', 'D'],
    scopePair: ['B', 'F'],
    changed: ['endingLabel', 'externalConfirm'],
  });
  await e.run({ kind: 'inspectSlice' });
  await e.run({
    kind: 'forkTrail',
    order: ['SNAPSHOT_LOADED', 'REVIEW_CAUSE_OBSERVED', 'IDENTITY_LINKED'],
    links: { SNAPSHOT_LOADED: ['EV01'], REVIEW_CAUSE_OBSERVED: ['EV05', 'EV10'], IDENTITY_LINKED: ['EV12'] },
  });
  await e.run({ kind: 'togglePlotHints', enabled: false });
  await e.run({
    kind: 'solveAudioOrder',
    order: ['AUD02', 'AUD03', 'AUD04', 'AUD05', 'AUD06', 'AUD07'],
    anchorPairs: ['CART_SPLIT', 'FOOTSTEP_SPLIT', 'SWITCH_SPLIT'],
  });
  await e.run({ kind: 'ackAudioContent', audioId: 'CHANNEL_03_FULL', mode: 'TEXT' });
  await e.run({ kind: 'witnessScope', mode: 'TEXT', recordingId: null });
  await e.run({ kind: 'openDoc', documentId: 'EV14' });
  await e.run({ kind: 'openDoc', documentId: 'EV27' });
  for (const pid of PATIENTS) {
    await e.run({ kind: 'captureStatement', patientId: pid, statementId: `ST_${pid}` as 'ST_R01' });
  }
  if (ending === 'B') await e.run({ kind: 'severPreview', edge: 'F' });
  else await e.run({ kind: 'severPreview', edge: 'D' });
  await e.run({ kind: 'assembleNextVisit', slots: fullSlots() });
  await e.run({ kind: 'chooseEnding', ending });
  return e;
}
