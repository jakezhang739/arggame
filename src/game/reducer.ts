/** 状态折叠：reduce(events) → GameState（docs/01_核心契约.md v1.1 §5）。纯函数，无副作用。 */
import type { CompletionFacts, GameEvent, GamePhase, GameState, MainPhase } from './types';
import { MAIN_PHASES } from './types';

export function emptyFacts(): CompletionFacts {
  return {
    handoverSecured: false,
    rulesAcknowledged: false,
    reviewCause: null,
    reviewTriggerObserved: false,
    r03Prearchived: false,
    recheckAccepted: false,
    r03IdentityRestored: false,
    timelineSolved: false,
    postsLinked: false,
    floorplanMatched: false,
    masqueInferred: false,
    audienceConfirmed: false,
    dualSourceProven: false,
    refrainInferred: false,
    experimentConcluded: false,
    sliceInspected: false,
    trailForkCreated: false,
    audioOrderSolved: false,
    recoveredAudioRead: false,
    witnessScope: 'NONE',
    aud01Read: false,
    capturedStatements: [],
    simulatedEdges: [],
    carePlanReady: false,
    nextVisitOpened: false,
    severedEdge: null,
    finalSign: null,
  };
}

export function hasEvent(
  events: GameEvent[],
  code: GameEvent['code'],
  objectId?: string,
): boolean {
  return events.some((e) => {
    if (e.code !== code) return false;
    if (objectId === undefined) return true;
    const p = e.payload as Record<string, unknown>;
    return p?.documentId === objectId || p?.audioId === objectId;
  });
}

/** 有效 ASSEMBLE：六身份 + 六意愿 + 承接（p8 判定在 gates；此处做最低限度结构校验）。 */
function validAssemble(e: GameEvent): boolean {
  if (e.code !== 'ASSEMBLE_NEXT_VISIT') return false;
  const slots = (e.payload as { slots: { identity: object; intent: object; chain: string | null } }).slots;
  return (
    Object.keys(slots.identity).length >= 6 &&
    Object.keys(slots.intent).length >= 6 &&
    slots.chain === 'EV27#NEXT_SHIFT'
  );
}

export function deriveFacts(events: GameEvent[]): CompletionFacts {
  const f = emptyFacts();
  for (const e of events) {
    const p = e.payload as Record<string, unknown>;
    switch (e.code) {
      case 'ACK_HANDOVER_SAVED':
      case 'OPEN_SNAPSHOT':
        f.handoverSecured = true;
        break;
      case 'ACK_RULES':
        f.rulesAcknowledged = true;
        break;
      case 'REVIEW_TRIGGER_OBSERVED':
        f.reviewTriggerObserved = true;
        f.reviewCause = p.cause as CompletionFacts['reviewCause'];
        break;
      case 'INDEX_RECOUNT':
        if (p.count === 5) f.r03Prearchived = true;
        break;
      case 'RECHECK_SUBMITTED':
        f.recheckAccepted = true;
        break;
      case 'LINK_IDENTITY':
        f.r03IdentityRestored = true;
        break;
      case 'ACK_AUDIO_CONTENT':
        if (p.audioId === 'AUD01') f.aud01Read = true;
        if (p.audioId === 'CHANNEL_03_FULL') f.recoveredAudioRead = true;
        break;
      case 'TIMELINE_SOLVED':
        f.timelineSolved = true;
        break;
      case 'TAG_POSTS':
        f.postsLinked = true;
        break;
      case 'MATCH_FLOORPLAN':
        f.floorplanMatched = true;
        break;
      case 'INFER_MASQUE':
        if (p.choice === 'INSIDE_STRUCTURE') f.masqueInferred = true;
        break;
      case 'LINK_AUDIENCE':
        f.audienceConfirmed = true;
        break;
      case 'PROVE_SHARED_SOURCE':
        f.dualSourceProven = true;
        break;
      case 'INFER_REFRAIN':
        if (p.choice === 'ONE_TERMINATION_INTERFACE') f.refrainInferred = true;
        break;
      case 'EXPERIMENT_CONCLUDED':
        f.experimentConcluded = true;
        break;
      case 'INSPECT_SLICE':
        f.sliceInspected = true;
        break;
      case 'FORK_TRAIL':
        f.trailForkCreated = true;
        break;
      case 'AUDIO_ORDER_SOLVED':
        f.audioOrderSolved = true;
        break;
      case 'WITNESS_SCOPE':
        f.witnessScope = 'FACT_ONLY';
        break;
      case 'CAPTURE_STATEMENT': {
        const sid = p.statementId as CompletionFacts['capturedStatements'][number];
        if (!f.capturedStatements.includes(sid)) f.capturedStatements.push(sid);
        break;
      }
      case 'SEVER_PREVIEW': {
        const edge = p.edge as CompletionFacts['simulatedEdges'][number];
        if (!f.simulatedEdges.includes(edge)) f.simulatedEdges.push(edge);
        break;
      }
      case 'ASSEMBLE_NEXT_VISIT':
        if (validAssemble(e)) f.carePlanReady = true;
        break;
      case 'OPEN_NEXT_VISIT':
        f.nextVisitOpened = true;
        break;
      case 'SEVER_EDGE':
        f.severedEdge = p.edge as CompletionFacts['severedEdge'];
        break;
      case 'FINAL_SIGN':
        f.finalSign = p.choice as CompletionFacts['finalSign'];
        break;
      default:
        break;
    }
  }
  return f;
}

export function derivePhase(events: GameEvent[]): { phase: GamePhase; lastMainPhase: MainPhase } {
  let idx = 0; // MAIN_PHASES 中的位置
  let theaterMarks = 0; // T3 五件事：时间线/帖子/平面/假说/观众
  let severedF = false;
  let severedD = false;

  const advanceTo = (i: number) => {
    idx = Math.max(idx, i);
  };

  for (const e of events) {
    const p = e.payload as Record<string, unknown>;
    switch (idx) {
      case 0: // BOOT → T1：观察事件 + 重算
        if (e.code === 'REVIEW_TRIGGER_OBSERVED' && p.observedScope === 'ENDING') idx = 1;
        break;
      case 1: // R03_PREARCHIVED → T2
        if (e.code === 'LINK_IDENTITY') advanceTo(2);
        break;
      case 2: // IDENTITY_RESTORED → T3（五件事）
        if (e.code === 'TIMELINE_SOLVED') theaterMarks |= 1;
        if (e.code === 'TAG_POSTS') theaterMarks |= 2;
        if (e.code === 'MATCH_FLOORPLAN') theaterMarks |= 4;
        if (e.code === 'INFER_MASQUE' && p.choice === 'INSIDE_STRUCTURE') theaterMarks |= 8;
        if (e.code === 'LINK_AUDIENCE') theaterMarks |= 16;
        if (theaterMarks === 31) advanceTo(3);
        break;
      case 3: // THEATER_DISCOVERED → T4
        if (e.code === 'PROVE_SHARED_SOURCE') advanceTo(4);
        break;
      case 4: // DUAL_SOURCE_EXPOSED → T5
        if (e.code === 'EXPERIMENT_CONCLUDED') advanceTo(5);
        break;
      case 5: // CLOSURE_PROVEN → T6
        if (e.code === 'FORK_TRAIL') advanceTo(6);
        break;
      case 6: // TRAIL_FORKED → T7
        if (e.code === 'AUDIO_ORDER_SOLVED') advanceTo(7);
        break;
      case 7: // AUDIO_RECOVERED → T8
        if (e.code === 'ACK_AUDIO_CONTENT' && p.audioId === 'CHANNEL_03_FULL') theaterMarks = 100;
        if (theaterMarks === 100 && e.code === 'WITNESS_SCOPE') advanceTo(8);
        break;
      case 8: // SCOPE_LIMITED → T9
        if (e.code === 'ASSEMBLE_NEXT_VISIT' && validAssemble(e)) advanceTo(9);
        break;
      case 9: // SURGERY_READY → T10（只经最终命令事务）
        if (e.code === 'SEVER_EDGE' && p.edge === 'F') severedF = true;
        if (e.code === 'SEVER_EDGE' && p.edge === 'D') severedD = true;
        if (e.code === 'ENTER_ENDING') {
          if (p.ending === 'A') return { phase: 'ENDING_A', lastMainPhase: 'SURGERY_READY' };
          if (p.ending === 'B' && severedF) return { phase: 'ENDING_B', lastMainPhase: 'SURGERY_READY' };
          if (p.ending === 'C' && severedD) return { phase: 'ENDING_C', lastMainPhase: 'SURGERY_READY' };
        }
        break;
      default:
        break;
    }
  }
  void severedF;
  void severedD;
  return { phase: MAIN_PHASES[idx], lastMainPhase: MAIN_PHASES[idx] };
}

export function reduce(events: GameEvent[]): GameState {
  const facts = deriveFacts(events);
  const { phase, lastMainPhase } = derivePhase(events);
  const ending =
    phase === 'ENDING_A' ? 'A' : phase === 'ENDING_B' ? 'B' : phase === 'ENDING_C' ? 'C' : null;
  return { phase, lastMainPhase: ending ? 'SURGERY_READY' : lastMainPhase, ending, facts, events };
}
