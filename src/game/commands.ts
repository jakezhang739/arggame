/** 命令规划：一个用户动作 = 一个命令 = 一个原子事件批次（docs/01_核心契约.md v1.1 §3）。
 *  planCommand 只做规划与前置校验，不产生副作用；reducer 只折叠。 */
import { reduce } from './reducer';
import type {
  AudioId,
  CardId,
  ConfigId,
  EdgeId,
  EndingId,
  EvidenceId,
  EventCode,
  EventPayloads,
  GameEvent,
  GameState,
  PatientId,
  ReviewCause,
  Scope,
  StatementId,
  NextVisitSlots,
} from './types';

export interface EventDraft {
  code: EventCode;
  actor: 'PLAYER' | 'SYSTEM';
  scope?: Scope;
  payload: EventPayloads[EventCode];
}

export type Command =
  | { kind: 'boot' }
  | { kind: 'downloadHandover' }
  | { kind: 'ackHandoverSaved' }
  | { kind: 'openSnapshot' }
  | { kind: 'ackPaperNote' }
  | { kind: 'ackRules' }
  | { kind: 'loadSnapshot' }
  | { kind: 'submitReview' }
  | { kind: 'watchReplay' }
  | { kind: 'previewMedFix' }
  | { kind: 'acceptMedFix' }
  | { kind: 'cancelMedFix' }
  | { kind: 'compareRecords'; evidenceIds: EvidenceId[] }
  | { kind: 'recheckSubmitted'; evidenceIds: EvidenceId[] }
  | { kind: 'linkIdentity'; source: 'EV01' | 'EV02' }
  | { kind: 'playAudio'; audioId: AudioId }
  | { kind: 'ackAudioContent'; audioId: AudioId; mode: 'AUDIO' | 'TEXT' }
  | { kind: 'solveTimeline'; order: string[]; unreliable: EvidenceId[] }
  | { kind: 'tagPosts'; postIds: string[]; tags: string[] }
  | { kind: 'captureStatement'; patientId: PatientId; statementId: StatementId }
  | { kind: 'openDoc'; documentId: string }
  | { kind: 'matchFloorplan'; pairs: string[] }
  | { kind: 'inferMasque'; evidenceIds: EvidenceId[] }
  | { kind: 'linkAudience' }
  | { kind: 'proveSharedSource'; markers: string[] }
  | { kind: 'inferRefrain'; evidenceIds: EvidenceId[] }
  | { kind: 'runExperiment'; configId: ConfigId }
  | {
      kind: 'concludeExperiment';
      labelPair: ConfigId[];
      scopePair: ConfigId[];
      changed: string[];
    }
  | { kind: 'inspectSlice' }
  | { kind: 'forkTrail'; order: string[]; links: Record<string, EvidenceId[]> }
  | { kind: 'togglePlotHints'; enabled: boolean }
  | { kind: 'solveAudioOrder'; order: AudioId[]; anchorPairs: string[] }
  | { kind: 'witnessScope'; mode: 'VOICE' | 'TEXT'; recordingId: string | null }
  | { kind: 'ackDeskSpot' }
  | { kind: 'severPreview'; edge: EdgeId }
  | { kind: 'assembleNextVisit'; slots: NextVisitSlots }
  | { kind: 'chooseEnding'; ending: EndingId }
  | { kind: 'hint'; puzzleId: string; level: 1 | 2 | 3 }
  | { kind: 'puzzleAttempt'; puzzleId: string; choiceKeys: string[]; feedbackKey: string }
  | { kind: 'exportArchive' }
  | { kind: 'importArchive'; sourceSessionId: string };

export type PlanResult = { ok: true; drafts: EventDraft[] } | { ok: false; error: string };

const ok = (drafts: EventDraft[]): PlanResult => ({ ok: true, drafts });
const err = (error: string): PlanResult => ({ ok: false, error });

function has(state: GameState, code: EventCode, objectId?: string): boolean {
  return state.events.some((e) => {
    if (e.code !== code) return false;
    if (objectId === undefined) return true;
    const p = e.payload as Record<string, unknown>;
    return p?.documentId === objectId || p?.audioId === objectId;
  });
}

function reviewCauseOf(state: GameState): ReviewCause | null {
  const e = [...state.events].reverse().find((x) => x.code === 'REVIEW_TRIGGER_OBSERVED');
  return e ? (e.payload as EventPayloads['REVIEW_TRIGGER_OBSERVED']).cause : null;
}

/** 卡片解锁事实（01册 §8）：解锁位从 false→true 时在同一事务补 LOAD_CARD。 */
function cardUnlockFacts(state: GameState): Record<CardId, boolean> {
  const f = state.facts;
  return {
    'M-7': f.postsLinked && f.timelineSolved,
    'W-F': f.masqueInferred,
    'R-NM': f.dualSourceProven,
    'U-R': f.trailForkCreated,
  };
}

/** 折叠 drafts 后按转移补系统事件（卡片解锁、入席标记、完整录音登记）。 */
function withSystemFollowups(state: GameState, base: EventDraft[]): EventDraft[] {
  const drafts = [...base];
  // 此处用轻量折叠判断事实翻转；完整校验由 reducer/validate 承担
  const virtualEvents = toVirtualEvents(state, drafts);
  const after = foldLite(state, virtualEvents);
  const before = cardUnlockFacts(state);
  const after2 = cardUnlockFacts(after);
  const cardOrder: CardId[] = ['M-7', 'W-F', 'R-NM', 'U-R'];
  for (const card of cardOrder) {
    if (after2[card] && !before[card]) {
      drafts.push({ code: 'LOAD_CARD', actor: 'SYSTEM', scope: 'READ', payload: { cardId: card } });
    }
  }
  if (after.phase === 'THEATER_DISCOVERED' && state.phase !== 'THEATER_DISCOVERED') {
    drafts.push({ code: 'W07_SEATED', actor: 'SYSTEM', scope: 'READ', payload: { seat: 'SEAT_W07' } });
  }
  if (after.phase === 'AUDIO_RECOVERED' && state.phase !== 'AUDIO_RECOVERED') {
    drafts.push({
      code: 'RECOVER_AUDIO',
      actor: 'SYSTEM',
      scope: 'READ',
      payload: { speaker: 'R03', intent: 'PENDING' },
    });
  }
  return drafts;
}

// —— 轻量折叠（只算 planCommand 需要的事实与阶段；完整实现见 reducer.ts） ——
function toVirtualEvents(state: GameState, drafts: EventDraft[]): GameEvent[] {
  // 虚构事件仅用于事实推导，哈希字段以占位填充，不落盘
  let seq = state.events.length;
  return drafts.map((d, i) => {
    seq += 1;
    return {
      id: `plan-${seq}`,
      seq,
      elapsedMs: (state.events.at(-1)?.elapsedMs ?? 0) + i + 1,
      txId: 'plan',
      actor: d.actor,
      ...(d.scope !== undefined ? { scope: d.scope } : {}),
      previousHash: null,
      hash: 'plan',
      code: d.code,
      payload: d.payload,
    } as GameEvent;
  });
}

function foldLite(state: GameState, virtual: GameEvent[]): GameState {
  return reduce([...state.events, ...virtual]);
}

export function planCommand(state: GameState, command: Command): PlanResult {
  const f = state.facts;
  const phase = state.lastMainPhase;

  switch (command.kind) {
    case 'boot':
      if (state.events.length > 0) return err('会话已存在。');
      return ok([{ code: 'BOOT_SESSION', actor: 'PLAYER', scope: 'READ', payload: {} }]);

    case 'downloadHandover':
      return ok([
        { code: 'DOWNLOAD_HANDOVER', actor: 'PLAYER', scope: 'READ', payload: { documentId: 'HANDOVER_00' } },
      ]);

    case 'ackHandoverSaved':
      return ok([
        { code: 'ACK_HANDOVER_SAVED', actor: 'PLAYER', scope: 'READ', payload: { documentId: 'HANDOVER_00' } },
      ]);

    case 'openSnapshot':
      return ok([
        { code: 'OPEN_SNAPSHOT', actor: 'PLAYER', scope: 'READ', payload: { documentId: 'SNAPSHOT_00' } },
      ]);

    case 'ackPaperNote':
      return ok([{ code: 'ACK_PAPER_NOTE', actor: 'PLAYER', scope: 'READ', payload: {} }]);

    case 'ackRules':
      return ok([{ code: 'ACK_RULES', actor: 'PLAYER', scope: 'READ', payload: { version: 'v3.2' } }]);

    case 'loadSnapshot':
      if (phase !== 'BOOT') return err('迁移快照只在首次进入随访页时载入。');
      if (has(state, 'LOAD_SNAPSHOT')) return err('迁移快照已载入。');
      return ok([{ code: 'LOAD_SNAPSHOT', actor: 'SYSTEM', scope: 'READ', payload: { count: 6 } }]);

    case 'submitReview': {
      if (f.reviewCause) return err('本批已有触发来源；复核页仅供回看。');
      const eventId = `${sessionIdOf(state)}-${state.events.length + 1}`;
      return ok([
        {
          code: 'SUBMIT_REVIEW',
          actor: 'PLAYER',
          scope: 'ENDING',
          payload: { patientId: 'R03', prefill: 'POSITIVE' },
        },
        {
          code: 'REVIEW_TRIGGER_OBSERVED',
          actor: 'SYSTEM',
          scope: 'READ',
          payload: { cause: { kind: 'SELF', eventId }, observedScope: 'ENDING' },
        },
        {
          code: 'INDEX_RECOUNT',
          actor: 'SYSTEM',
          scope: 'READ',
          payload: { count: 5, causeObservationId: eventId },
        },
      ]);
    }

    case 'watchReplay': {
      if (f.reviewCause) return err('本批已有触发来源；回放仅供回看。');
      return ok([
        {
          code: 'WATCH_REPLAY',
          actor: 'PLAYER',
          scope: 'READ',
          payload: { archiveId: 'RV_PREV_01' },
        },
        {
          code: 'REVIEW_TRIGGER_OBSERVED',
          actor: 'SYSTEM',
          scope: 'READ',
          payload: {
            cause: { kind: 'REPLAY', archiveId: 'RV_PREV_01' },
            observedScope: 'ENDING',
          },
        },
        {
          code: 'INDEX_RECOUNT',
          actor: 'SYSTEM',
          scope: 'READ',
          payload: { count: 5, causeObservationId: 'RV_PREV_01#2' },
        },
      ]);
    }

    case 'previewMedFix':
      return ok([{ code: 'PREVIEW_MED_FIX', actor: 'PLAYER', scope: 'FACT_ONLY', payload: {} }]);
    case 'acceptMedFix':
      return ok([{ code: 'ACCEPT_MED_FIX', actor: 'PLAYER', scope: 'FACT_ONLY', payload: {} }]);
    case 'cancelMedFix':
      return ok([{ code: 'CANCEL_MED_FIX', actor: 'PLAYER', scope: 'FACT_ONLY', payload: {} }]);

    case 'compareRecords': {
      const ids = [...new Set(command.evidenceIds)];
      if (ids.length < 2) return err('至少钉住两份已取得的记录。');
      return ok([
        { code: 'COMPARE_RECORDS', actor: 'PLAYER', scope: 'READ', payload: { evidenceIds: ids } },
      ]);
    }

    case 'recheckSubmitted':
      if (f.recheckAccepted) return err('复查已受理。');
      return ok([
        {
          code: 'RECHECK_SUBMITTED',
          actor: 'PLAYER',
          scope: 'FACT_ONLY',
          payload: { anomaly: 'IDENTITY_INDEX', evidenceIds: command.evidenceIds },
        },
      ]);

    case 'linkIdentity':
      if (phase !== 'R03_PREARCHIVED' || !f.recheckAccepted || !f.aud01Read)
        return err('需要先受理复查并确认 AUD01 内容。');
      return ok([
        {
          code: 'LINK_IDENTITY',
          actor: 'PLAYER',
          scope: 'FACT_ONLY',
          payload: { patientId: 'R03', name: '许棠', source: command.source },
        },
      ]);

    case 'playAudio':
      return ok([
        { code: 'PLAY_AUDIO', actor: 'PLAYER', scope: 'READ', payload: { audioId: command.audioId } },
      ]);

    case 'ackAudioContent':
      return ok([
        {
          code: 'ACK_AUDIO_CONTENT',
          actor: 'PLAYER',
          scope: 'READ',
          payload: { audioId: command.audioId, mode: command.mode },
        },
      ]);

    case 'solveTimeline':
      return ok(
        withSystemFollowups(state, [
          {
            code: 'TIMELINE_SOLVED',
            actor: 'PLAYER',
            scope: 'FACT_ONLY',
            payload: { order: command.order, unreliable: command.unreliable },
          },
        ]),
      );

    case 'tagPosts':
      return ok(
        withSystemFollowups(state, [
          {
            code: 'TAG_POSTS',
            actor: 'PLAYER',
            scope: 'FACT_ONLY',
            payload: { postIds: command.postIds, tags: command.tags },
          },
        ]),
      );

    case 'captureStatement':
      return ok([
        {
          code: 'CAPTURE_STATEMENT',
          actor: 'PLAYER',
          scope: 'FACT_ONLY',
          payload: { patientId: command.patientId, statementId: command.statementId },
        },
      ]);

    case 'openDoc':
      return ok([
        { code: 'OPEN_DOC', actor: 'PLAYER', scope: 'READ', payload: { documentId: command.documentId } },
      ]);

    case 'matchFloorplan':
      return ok(
        withSystemFollowups(state, [
          {
            code: 'MATCH_FLOORPLAN',
            actor: 'PLAYER',
            scope: 'FACT_ONLY',
            payload: { pairs: command.pairs },
          },
        ]),
      );

    case 'inferMasque':
      return ok(
        withSystemFollowups(state, [
          {
            code: 'INFER_MASQUE',
            actor: 'PLAYER',
            scope: 'FACT_ONLY',
            payload: { choice: 'INSIDE_STRUCTURE', evidenceIds: command.evidenceIds },
          },
        ]),
      );

    case 'linkAudience': {
      const cause = reviewCauseOf(state);
      if (!cause) return err('尚无可引用的触发来源。');
      return ok(
        withSystemFollowups(state, [
          {
            code: 'LINK_AUDIENCE',
            actor: 'PLAYER',
            scope: 'FACT_ONLY',
            payload: { poemAction: 'AFFIRM_ENDING', seat: 'SEAT_W07', cause },
          },
        ]),
      );
    }

    case 'proveSharedSource':
      return ok(
        withSystemFollowups(state, [
          {
            code: 'PROVE_SHARED_SOURCE',
            actor: 'PLAYER',
            scope: 'FACT_ONLY',
            payload: { markers: command.markers },
          },
        ]),
      );

    case 'inferRefrain':
      return ok([
        {
          code: 'INFER_REFRAIN',
          actor: 'PLAYER',
          scope: 'FACT_ONLY',
          payload: { choice: 'ONE_TERMINATION_INTERFACE', evidenceIds: command.evidenceIds },
        },
      ]);

    case 'runExperiment':
      return ok([
        { code: 'RUN_EXPERIMENT', actor: 'PLAYER', scope: 'FACT_ONLY', payload: { configId: command.configId } },
      ]);

    case 'concludeExperiment':
      return ok([
        {
          code: 'EXPERIMENT_CONCLUDED',
          actor: 'PLAYER',
          scope: 'FACT_ONLY',
          payload: {
            labelPair: command.labelPair,
            scopePair: command.scopePair,
            changed: command.changed,
          },
        },
      ]);

    case 'inspectSlice':
      return ok([
        { code: 'INSPECT_SLICE', actor: 'PLAYER', scope: 'READ', payload: { found: 'AUTHZ_LINE' } },
      ]);

    case 'forkTrail': {
      const cause = reviewCauseOf(state);
      if (!cause) return err('尚无可引用的触发来源。');
      return ok(
        withSystemFollowups(state, [
          {
            code: 'FORK_TRAIL',
            actor: 'PLAYER',
            scope: 'FACT_ONLY',
            payload: { order: command.order, links: command.links, scopeFinding: 'UNSUPPORTED_ENDING', cause },
          },
        ]),
      );
    }

    case 'togglePlotHints':
      return ok([
        {
          code: 'TOGGLE_PLOT_HINTS',
          actor: 'PLAYER',
          scope: 'READ',
          payload: { enabled: command.enabled },
        },
      ]);

    case 'solveAudioOrder':
      return ok(
        withSystemFollowups(state, [
          {
            code: 'AUDIO_ORDER_SOLVED',
            actor: 'PLAYER',
            scope: 'FACT_ONLY',
            payload: { order: command.order, anchorPairs: command.anchorPairs },
          },
        ]),
      );

    case 'witnessScope':
      if (!f.recoveredAudioRead) return err('需先确认完整录音内容。');
      return ok([
        {
          code: 'WITNESS_SCOPE',
          actor: 'PLAYER',
          scope: 'FACT_ONLY',
          payload: {
            mode: command.mode,
            statementKey: 'witness.canonical',
            recordingId: command.recordingId,
          },
        },
      ]);

    case 'ackDeskSpot':
      return ok([{ code: 'ACK_DESK_SPOT', actor: 'PLAYER', scope: 'READ', payload: {} }]);

    case 'severPreview':
      return ok([{ code: 'SEVER_PREVIEW', actor: 'PLAYER', scope: 'READ', payload: { edge: command.edge } }]);

    case 'assembleNextVisit': {
      if (phase !== 'SCOPE_LIMITED') return err('下一班整理在见证范围确认后开放。');
      if (!f.simulatedEdges.includes('D') && !f.simulatedEdges.includes('F'))
        return err('需要先在副本中预览 D 或 F 的后果。');
      return ok([
        {
          code: 'ASSEMBLE_NEXT_VISIT',
          actor: 'PLAYER',
          scope: 'FACT_ONLY',
          payload: { slots: command.slots },
        },
      ]);
    }

    case 'chooseEnding': {
      if (phase !== 'SURGERY_READY' || !f.carePlanReady)
        return err('最终操作需要先准备下一班依据。');
      if (state.ending) return err('本局已结束。');
      switch (command.ending) {
        case 'A':
          return ok([
            {
              code: 'FINAL_SIGN',
              actor: 'PLAYER',
              scope: 'ENDING',
              payload: { choice: 'ENDING' },
            },
            { code: 'ENTER_ENDING', actor: 'SYSTEM', scope: 'READ', payload: { ending: 'A' } },
          ]);
        case 'B':
          if (!f.simulatedEdges.includes('F')) return err('选择隔离方案前需先预览 F 的后果。');
          return ok([
            { code: 'SEVER_EDGE', actor: 'PLAYER', scope: 'FACT_ONLY', payload: { edge: 'F' } },
            { code: 'ACCEPT_ISOLATION', actor: 'PLAYER', scope: 'FACT_ONLY', payload: {} },
            { code: 'ENTER_ENDING', actor: 'SYSTEM', scope: 'READ', payload: { ending: 'B' } },
          ]);
        case 'C':
          if (!f.simulatedEdges.includes('D')) return err('执行救援方案前需先预览 D 的后果。');
          if (f.witnessScope !== 'FACT_ONLY') return err('需要 FACT_ONLY 见证范围。');
          return ok([
            { code: 'SEVER_EDGE', actor: 'PLAYER', scope: 'FACT_ONLY', payload: { edge: 'D' } },
            {
              code: 'FINAL_SIGN',
              actor: 'PLAYER',
              scope: 'FACT_ONLY',
              payload: { choice: 'FACT_ONLY' },
            },
            { code: 'RESTORE_IDENTITY', actor: 'SYSTEM', scope: 'FACT_ONLY', payload: { batch: 'R01-R06' } },
            { code: 'PRESERVE_INTENT', actor: 'SYSTEM', scope: 'FACT_ONLY', payload: { batch: 'R01-R06' } },
            { code: 'OPEN_NEXT_VISIT', actor: 'SYSTEM', scope: 'FACT_ONLY', payload: { batch: 'R01-R06' } },
            { code: 'ENTER_ENDING', actor: 'SYSTEM', scope: 'READ', payload: { ending: 'C' } },
          ]);
      }
    }

    case 'hint':
      return ok([
        {
          code: 'HINT_REQUESTED',
          actor: 'PLAYER',
          scope: 'READ',
          payload: { puzzleId: command.puzzleId as EventPayloads['HINT_REQUESTED']['puzzleId'], level: command.level },
        },
      ]);

    case 'puzzleAttempt':
      return ok([
        {
          code: 'PUZZLE_ATTEMPT',
          actor: 'PLAYER',
          scope: 'FACT_ONLY',
          payload: {
            puzzleId: command.puzzleId as EventPayloads['PUZZLE_ATTEMPT']['puzzleId'],
            choiceKeys: command.choiceKeys,
            feedbackKey: command.feedbackKey,
          },
        },
      ]);

    case 'exportArchive':
      return ok([{ code: 'EXPORT_ARCHIVE', actor: 'PLAYER', scope: 'READ', payload: {} }]);

    case 'importArchive':
      return ok([
        {
          code: 'IMPORT_ARCHIVE',
          actor: 'PLAYER',
          scope: 'READ',
          payload: { sourceSessionId: command.sourceSessionId },
        },
      ]);
  }
}

function sessionIdOf(state: GameState): string {
  // 事件 id 形如 `${sessionId}-${seq}`；从首条事件还原
  const first = state.events[0];
  if (!first) return 'W07-UNKNOWN';
  return first.id.slice(0, Math.max(0, first.id.lastIndexOf('-')));
}
