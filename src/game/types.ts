/** 领域类型 —— 唯一定义处（docs/01_核心契约.md v1.1 §1–§2）。 */
import type { EvidenceId } from './content-ids';

export type { EvidenceId };

export interface ExperimentRun {
  configId: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  painScore: 'HIGH' | 'LOW';
  endingLabel: 'POSITIVE' | 'NEGATIVE';
  externalConfirm: 'NONE' | 'ENDING' | 'FACT_ONLY';
  identityLost: boolean;
}

export const MAIN_PHASES = [
  'BOOT',
  'R03_PREARCHIVED',
  'IDENTITY_RESTORED',
  'THEATER_DISCOVERED',
  'DUAL_SOURCE_EXPOSED',
  'CLOSURE_PROVEN',
  'TRAIL_FORKED',
  'AUDIO_RECOVERED',
  'SCOPE_LIMITED',
  'SURGERY_READY',
] as const;
export type MainPhase = (typeof MAIN_PHASES)[number];
export type EndingId = 'A' | 'B' | 'C';
export type GamePhase = MainPhase | `ENDING_${EndingId}`;
export type Scope = 'READ' | 'FACT_ONLY' | 'ENDING';
export type PatientId = 'R01' | 'R02' | 'R03' | 'R04' | 'R05' | 'R06';
export type PuzzleId = 'p1' | 'p2' | 'p3' | 'p4' | 'p5' | 'p6' | 'p7' | 'p8' | 'a1' | 'm7' | 'rnm';
export type EdgeId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
export type ConfigId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
export type AudioId =
  | 'AUD01'
  | 'AUD02'
  | 'AUD03'
  | 'AUD04'
  | 'AUD05'
  | 'AUD06'
  | 'AUD07'
  | 'AUD08'
  | 'AUD09'
  | 'AUD10'
  | 'AUD11'
  | 'CHANNEL_03_FULL';
export type CardId = 'M-7' | 'W-F' | 'R-NM' | 'U-R';
export type StatementId = `ST_${PatientId}`;
export type IdentityRef = `${'EV01' | 'EV02'}#${PatientId}`;
export type Empty = Record<string, never>;
export type ReviewCause =
  | { kind: 'SELF'; eventId: string }
  | { kind: 'REPLAY'; archiveId: 'RV_PREV_01' };
export interface NextVisitSlots {
  identity: Partial<Record<PatientId, IdentityRef>>;
  intent: Partial<Record<PatientId, StatementId>>;
  chain: 'EV27#NEXT_SHIFT' | null;
}

export interface EventPayloads {
  BOOT_SESSION: Empty;
  IMPORT_ARCHIVE: { sourceSessionId: string };
  EXPORT_ARCHIVE: Empty;
  HINT_REQUESTED: { puzzleId: PuzzleId; level: 1 | 2 | 3 };
  DOWNLOAD_HANDOVER: { documentId: 'HANDOVER_00' };
  ACK_HANDOVER_SAVED: { documentId: 'HANDOVER_00' };
  OPEN_SNAPSHOT: { documentId: 'SNAPSHOT_00' };
  ACK_PAPER_NOTE: Empty;
  ACK_RULES: { version: 'v3.2' };
  LOAD_SNAPSHOT: { count: 6 };
  SUBMIT_REVIEW: { patientId: 'R03'; prefill: 'POSITIVE' };
  WATCH_REPLAY: { archiveId: 'RV_PREV_01' };
  REVIEW_TRIGGER_OBSERVED: { cause: ReviewCause; observedScope: 'ENDING' };
  INDEX_RECOUNT: { count: 5; causeObservationId: string };
  PREVIEW_MED_FIX: Empty;
  ACCEPT_MED_FIX: Empty;
  CANCEL_MED_FIX: Empty;
  COMPARE_RECORDS: { evidenceIds: EvidenceId[] };
  RECHECK_SUBMITTED: { anomaly: 'IDENTITY_INDEX'; evidenceIds: EvidenceId[] };
  LINK_IDENTITY: { patientId: 'R03'; name: '许棠'; source: 'EV01' | 'EV02' };
  PLAY_AUDIO: { audioId: AudioId };
  ACK_AUDIO_CONTENT: { audioId: AudioId; mode: 'AUDIO' | 'TEXT' };
  TIMELINE_SOLVED: { order: string[]; unreliable: EvidenceId[] };
  TAG_POSTS: { postIds: string[]; tags: string[] };
  CAPTURE_STATEMENT: { patientId: PatientId; statementId: StatementId };
  OPEN_DOC: { documentId: string };
  MATCH_FLOORPLAN: { pairs: string[] };
  LOAD_CARD: { cardId: CardId };
  INFER_MASQUE: { choice: 'INSIDE_STRUCTURE'; evidenceIds: EvidenceId[] };
  LINK_AUDIENCE: { poemAction: 'AFFIRM_ENDING'; seat: 'SEAT_W07'; cause: ReviewCause };
  PROVE_SHARED_SOURCE: { markers: string[] };
  INFER_REFRAIN: { choice: 'ONE_TERMINATION_INTERFACE'; evidenceIds: EvidenceId[] };
  RUN_EXPERIMENT: { configId: ConfigId };
  EXPERIMENT_CONCLUDED: { labelPair: ConfigId[]; scopePair: ConfigId[]; changed: string[] };
  INSPECT_SLICE: { found: 'AUTHZ_LINE' };
  W07_SEATED: { seat: 'SEAT_W07' };
  FORK_TRAIL: {
    order: string[];
    links: Record<string, EvidenceId[]>;
    scopeFinding: 'UNSUPPORTED_ENDING';
    cause: ReviewCause;
  };
  TOGGLE_PLOT_HINTS: { enabled: boolean };
  AUDIO_ORDER_SOLVED: { order: AudioId[]; anchorPairs: string[] };
  RECOVER_AUDIO: { speaker: 'R03'; intent: 'PENDING' };
  WITNESS_SCOPE: {
    mode: 'VOICE' | 'TEXT';
    statementKey: 'witness.canonical';
    recordingId: string | null;
  };
  ACK_DESK_SPOT: Empty;
  SEVER_PREVIEW: { edge: EdgeId };
  SEVER_EDGE: { edge: 'D' | 'F' };
  ASSEMBLE_NEXT_VISIT: { slots: NextVisitSlots };
  RESTORE_IDENTITY: { batch: 'R01-R06' };
  PRESERVE_INTENT: { batch: 'R01-R06' };
  OPEN_NEXT_VISIT: { batch: 'R01-R06' };
  ACCEPT_ISOLATION: Empty;
  FINAL_SIGN: { choice: 'ENDING' | 'FACT_ONLY' };
  ENTER_ENDING: { ending: EndingId };
  PUZZLE_ATTEMPT: { puzzleId: PuzzleId; choiceKeys: string[]; feedbackKey: string };
}
export type EventCode = keyof EventPayloads;
export const EVENT_CODES: readonly EventCode[] = [
  'BOOT_SESSION',
  'IMPORT_ARCHIVE',
  'EXPORT_ARCHIVE',
  'HINT_REQUESTED',
  'DOWNLOAD_HANDOVER',
  'ACK_HANDOVER_SAVED',
  'OPEN_SNAPSHOT',
  'ACK_PAPER_NOTE',
  'ACK_RULES',
  'LOAD_SNAPSHOT',
  'SUBMIT_REVIEW',
  'WATCH_REPLAY',
  'REVIEW_TRIGGER_OBSERVED',
  'INDEX_RECOUNT',
  'PREVIEW_MED_FIX',
  'ACCEPT_MED_FIX',
  'CANCEL_MED_FIX',
  'COMPARE_RECORDS',
  'RECHECK_SUBMITTED',
  'LINK_IDENTITY',
  'PLAY_AUDIO',
  'ACK_AUDIO_CONTENT',
  'TIMELINE_SOLVED',
  'TAG_POSTS',
  'CAPTURE_STATEMENT',
  'OPEN_DOC',
  'MATCH_FLOORPLAN',
  'LOAD_CARD',
  'INFER_MASQUE',
  'LINK_AUDIENCE',
  'PROVE_SHARED_SOURCE',
  'INFER_REFRAIN',
  'RUN_EXPERIMENT',
  'EXPERIMENT_CONCLUDED',
  'INSPECT_SLICE',
  'W07_SEATED',
  'FORK_TRAIL',
  'TOGGLE_PLOT_HINTS',
  'AUDIO_ORDER_SOLVED',
  'RECOVER_AUDIO',
  'WITNESS_SCOPE',
  'ACK_DESK_SPOT',
  'SEVER_PREVIEW',
  'SEVER_EDGE',
  'ASSEMBLE_NEXT_VISIT',
  'RESTORE_IDENTITY',
  'PRESERVE_INTENT',
  'OPEN_NEXT_VISIT',
  'ACCEPT_ISOLATION',
  'FINAL_SIGN',
  'ENTER_ENDING',
  'PUZZLE_ATTEMPT',
] as const;

export interface EventBase {
  id: string;
  seq: number;
  elapsedMs: number;
  txId: string;
  actor: 'PLAYER' | 'SYSTEM';
  scope?: Scope;
  previousHash: string | null;
  hash: string;
}
export type GameEvent = {
  [C in EventCode]: EventBase & { code: C; payload: EventPayloads[C] };
}[EventCode];

export interface CompletionFacts {
  handoverSecured: boolean;
  rulesAcknowledged: boolean;
  reviewCause: ReviewCause | null;
  reviewTriggerObserved: boolean;
  r03Prearchived: boolean;
  recheckAccepted: boolean;
  r03IdentityRestored: boolean;
  timelineSolved: boolean;
  postsLinked: boolean;
  floorplanMatched: boolean;
  masqueInferred: boolean;
  audienceConfirmed: boolean;
  dualSourceProven: boolean;
  refrainInferred: boolean;
  experimentConcluded: boolean;
  sliceInspected: boolean;
  trailForkCreated: boolean;
  audioOrderSolved: boolean;
  recoveredAudioRead: boolean;
  witnessScope: 'NONE' | 'FACT_ONLY';
  aud01Read: boolean;
  capturedStatements: StatementId[];
  simulatedEdges: EdgeId[];
  carePlanReady: boolean;
  nextVisitOpened: boolean;
  severedEdge: 'D' | 'F' | null;
  finalSign: 'ENDING' | 'FACT_ONLY' | null;
}

export interface GameState {
  phase: GamePhase;
  lastMainPhase: MainPhase;
  ending: EndingId | null;
  facts: CompletionFacts;
  events: GameEvent[];
}

export type SourceType = 'PRIMARY' | 'DERIVED' | 'PLAYER_LOCAL';
export type EligibilityKey =
  | 'session'
  | 'handoverReady'
  | 'prearchived'
  | 'reviewObserved'
  | 'recheckAccepted'
  | 'identityRestored'
  | 'postsLinked'
  | 'archiveAndTimeline'
  | 'masqueInferred'
  | 'theaterDiscovered'
  | 'dualSourceProven'
  | 'experimentAvailable'
  | 'closureProven'
  | 'trailForkCreated'
  | 'audioRecovered'
  | 'recoveredAudioRead'
  | 'scopeLimited';

export interface TimeRef {
  kind: 'FIXED' | 'PLAYER_EVENT' | 'REVIEW_CAUSE' | 'UNKNOWN';
  value: string;
}

export interface EvidenceItem {
  id: EvidenceId;
  title: string;
  sourceType: SourceType;
  sourceId: string;
  exportBatch: string | null;
  originGroup: string;
  derivedFrom: EvidenceId[];
  eligibilityKey: EligibilityKey;
  acquisitionKey: string;
  eventTime: TimeRef;
  uploadTime: TimeRef;
  version: string;
  display: string;
  projectionKey?: string;
  generatedKey?: string;
  supports: PuzzleId[];
  /** 核心/可选分层（10册 §6 已批清单）：仅影响呈现分组，不影响取得与判定。 */
  tier?: 'core' | 'optional';
}

export interface ContentEntry {
  key: string;
  default: string;
  phaseVariants: { text: string; from: MainPhase; untilExclusive?: MainPhase }[];
  endingOverrides?: Partial<Record<EndingId, string>>;
}

export interface PuzzleDrafts {
  timelineOrder: string[];
  trailOrder: string[];
  trailLinks: Record<string, EvidenceId[]>;
  audioOrder: AudioId[];
  audioAnchorPairs: string[];
  experimentSelection: { labelPair: ConfigId[]; scopePair: ConfigId[] };
  nextVisitSlots: NextVisitSlots;
  semanticSelections: Partial<Record<PuzzleId, string[]>>;
}

export interface WitnessRecord {
  mode: 'VOICE' | 'TEXT';
  canonicalText: string;
  note: string;
  recordingId: string | null;
  recordingAvailable: boolean;
}

export interface SaveData {
  kind: 'CW_SAVE';
  schemaVersion: 3;
  contentVersion: '1.2';
  sessionId: string;
  revision: number;
  startedAtMs: number;
  savedAtMs: number;
  elapsedActiveMs: number;
  lastRoute: string;
  hashAlgorithm: 'sha-256';
  events: GameEvent[];
  pinnedEvidence: EvidenceId[];
  drafts: PuzzleDrafts;
  witness: WitnessRecord | null;
  seenPresentationCues: string[];
}

export interface SettingsData {
  subtitles: boolean;
  volume: number;
  textScale: 1 | 1.25 | 1.5 | 2;
  reducedMotion: 'follow-system' | 'on' | 'off';
  /** 测试模式：直接显示各谜题的通关答案（不影响结局与事件日志）。 */
  walkthrough: boolean;
}

export interface ExportData {
  kind: 'CW_EXPORT';
  schemaVersion: 3;
  contentVersion: '1.2';
  save: SaveData;
}

/** 系统事件（store 层在命令事务中产生，页面不可直接提交）。 */
export const SYSTEM_EVENT_CODES: ReadonlySet<EventCode> = new Set<EventCode>([
  'LOAD_SNAPSHOT',
  'REVIEW_TRIGGER_OBSERVED',
  'INDEX_RECOUNT',
  'LOAD_CARD',
  'W07_SEATED',
  'RECOVER_AUDIO',
  'RESTORE_IDENTITY',
  'PRESERVE_INTENT',
  'OPEN_NEXT_VISIT',
  'ENTER_ENDING',
]);

/** 幂等事件：一局一次。 */
export const ONCE_EVENT_CODES: ReadonlySet<EventCode> = new Set<EventCode>([
  'BOOT_SESSION',
  'ACK_HANDOVER_SAVED',
  'OPEN_SNAPSHOT',
  'ACK_PAPER_NOTE',
  'ACK_RULES',
  'LOAD_SNAPSHOT',
  'SUBMIT_REVIEW',
  'WATCH_REPLAY',
  'REVIEW_TRIGGER_OBSERVED',
  'INDEX_RECOUNT',
  'RECHECK_SUBMITTED',
  'LINK_IDENTITY',
  'TIMELINE_SOLVED',
  'TAG_POSTS',
  'MATCH_FLOORPLAN',
  'INFER_MASQUE',
  'LINK_AUDIENCE',
  'PROVE_SHARED_SOURCE',
  'INFER_REFRAIN',
  'EXPERIMENT_CONCLUDED',
  'INSPECT_SLICE',
  'FORK_TRAIL',
  'AUDIO_ORDER_SOLVED',
  'RECOVER_AUDIO',
  'WITNESS_SCOPE',
  'ASSEMBLE_NEXT_VISIT',
  'SEVER_EDGE',
  'ACCEPT_ISOLATION',
  'FINAL_SIGN',
  'ENTER_ENDING',
  'W07_SEATED',
]);
