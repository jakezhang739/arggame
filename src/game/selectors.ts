/** 选择器：资格键、已取得证据、叙事投影、页面可用性（docs/01_核心契约.md v1.1 §4/§6/§8）。 */
import type {
  EligibilityKey,
  EndingId,
  EvidenceItem,
  GameEvent,
  GameState,
  MainPhase,
} from './types';
import { MAIN_PHASES } from './types';
import { content, resolveContent } from './content';
import type { EvidenceId } from './content-ids';

export function phaseAtLeast(current: MainPhase, required: MainPhase): boolean {
  return MAIN_PHASES.indexOf(current) >= MAIN_PHASES.indexOf(required);
}

/** §8 条件键固定映射。 */
export function eligibilityHolds(state: GameState, key: EligibilityKey): boolean {
  const f = state.facts;
  switch (key) {
    case 'session':
      return state.events.some((e) => e.code === 'BOOT_SESSION');
    case 'handoverReady':
      return f.handoverSecured && f.rulesAcknowledged;
    case 'prearchived':
      return f.r03Prearchived;
    case 'reviewObserved':
      return f.reviewTriggerObserved;
    case 'recheckAccepted':
      return f.recheckAccepted;
    case 'identityRestored':
      return f.r03IdentityRestored;
    case 'postsLinked':
      return f.postsLinked;
    case 'archiveAndTimeline':
      return f.postsLinked && f.timelineSolved;
    case 'masqueInferred':
      return f.masqueInferred;
    case 'theaterDiscovered':
      return phaseAtLeast(state.lastMainPhase, 'THEATER_DISCOVERED');
    case 'dualSourceProven':
      return f.dualSourceProven;
    case 'experimentAvailable':
      // R-NM 已降为可选解释卡（07册 §4.1）：实验只需同源成立。
      return f.dualSourceProven;
    case 'closureProven':
      return f.experimentConcluded;
    case 'trailForkCreated':
      return f.trailForkCreated;
    case 'recoveredAudioRead':
      return f.recoveredAudioRead;
    case 'audioRecovered':
      return state.events.some((e) => e.code === 'RECOVER_AUDIO');
    case 'scopeLimited':
      return f.witnessScope === 'FACT_ONLY';
  }
}

/** 证据“可打开”：资格成立（未取得时允许打开）。 */
export function canOpenEvidence(state: GameState, id: EvidenceId): boolean {
  const item = content.evidenceRegistry.find((e) => e.id === id);
  if (!item) return false;
  return eligibilityHolds(state, item.eligibilityKey);
}

/** 已取得：acquisitionKey 命中事件。 */
export function isAcquired(state: GameState, id: EvidenceId): boolean {
  const item = content.evidenceRegistry.find((e) => e.id === id);
  if (!item) return false;
  const [code, obj] = item.acquisitionKey.split(':');
  return state.events.some((e) => {
    if (e.code !== code) return false;
    if (!obj) return true;
    const p = e.payload as Record<string, unknown>;
    if (code === 'OPEN_DOC') return p?.documentId === obj;
    if (code === 'ACK_AUDIO_CONTENT') return p?.audioId === obj;
    if (code === 'ACK_HANDOVER_SAVED') return p?.documentId === 'HANDOVER_00';
    if (code === 'OPEN_SNAPSHOT') return p?.documentId === 'SNAPSHOT_00';
    return true;
  });
}

export function selectEvidence(state: GameState): EvidenceItem[] {
  return content.evidenceRegistry.filter((e) => isAcquired(state, e.id));
}

// —— 证据玩家语言（07册 §8.2 / 08册 §4.2）——

export type EvidenceSourceLabel = '归档链内' | '独立来源' | '本机证据' | '派生结论';

/** 独立来源 = 院内归档链之外的材料（论坛、地方档案、剧场研究）。 */
const INDEPENDENT_ORIGIN_GROUPS: ReadonlySet<string> = new Set(['BBS_RAW', 'LOCAL_ARCHIVE', 'NAR_0042']);

export function evidenceSourceLabel(item: EvidenceItem): EvidenceSourceLabel {
  if (item.sourceType === 'PLAYER_LOCAL') return '本机证据';
  if (item.sourceType === 'DERIVED') return '派生结论';
  return INDEPENDENT_ORIGIN_GROUPS.has(item.originGroup) ? '独立来源' : '归档链内';
}

export type EvidenceStatus = 'unseen' | 'acquired' | 'pinned' | 'conflict' | 'used';

export const EVIDENCE_STATUS_LABEL: Record<EvidenceStatus, string> = {
  unseen: '未查看',
  acquired: '已取得',
  pinned: '已固定',
  conflict: '存在冲突',
  used: '已用于结论',
};

/** 与其他记录存在已知矛盾的 EvidenceId（上传时间早于其引用事件）。 */
export const CONFLICTING_EVIDENCE: ReadonlySet<EvidenceId> = new Set<EvidenceId>(['EV11']);

/** 已被通过的结论采纳的证据（复查提交、身份恢复、时间线判定）。 */
export function evidenceUsedInConclusions(state: GameState): Set<EvidenceId> {
  const used = new Set<EvidenceId>();
  for (const e of state.events) {
    const p = e.payload as Record<string, unknown>;
    if (e.code === 'RECHECK_SUBMITTED' && Array.isArray(p?.evidenceIds)) {
      for (const id of p.evidenceIds as string[]) used.add(id as EvidenceId);
    }
    if (e.code === 'LINK_IDENTITY' && typeof p?.source === 'string') used.add(p.source as EvidenceId);
    if (e.code === 'TIMELINE_SOLVED' && Array.isArray(p?.unreliable)) {
      for (const id of p.unreliable as string[]) used.add(id as EvidenceId);
    }
  }
  return used;
}

export function evidenceStatusFor(
  state: GameState,
  id: EvidenceId,
  pinned: readonly EvidenceId[],
): EvidenceStatus {
  if (!isAcquired(state, id)) return 'unseen';
  if (CONFLICTING_EVIDENCE.has(id)) return 'conflict';
  if (pinned.includes(id)) return 'pinned';
  if (evidenceUsedInConclusions(state).has(id)) return 'used';
  return 'acquired';
}

/** 未取得材料的取得位置提示（按资格键映射到玩家可理解的站点）。 */
const ELIGIBILITY_LOCATION: Record<EligibilityKey, string> = {
  session: '夜班交接',
  handoverReady: '病例与复核',
  prearchived: '发药对照 · 材料箱',
  reviewObserved: '发药对照 · 材料箱',
  recheckAccepted: '发药对照 · 结论区',
  identityRestored: '发药对照 · 时间线',
  postsLinked: '病友留言板',
  archiveAndTimeline: '地方档案',
  masqueInferred: '地方档案 · 研究卡',
  theaterDiscovered: '正负文档比较',
  dualSourceProven: '审校实验室',
  experimentAvailable: '单变量实验',
  closureProven: '授权切片',
  trailForkCreated: '叙事轨迹',
  audioRecovered: '录音台',
  recoveredAudioRead: '录音台 · 结论',
  scopeLimited: '切除模拟',
};

export function evidenceLocationHint(item: EvidenceItem): string {
  return ELIGIBILITY_LOCATION[item.eligibilityKey] ?? '继续调查';
}

export function evidenceView(
  state: GameState,
  id: EvidenceId,
): { text: string; projectionUsed: boolean } {
  const item = content.evidenceRegistry.find((e) => e.id === id);
  if (!item) return { text: '', projectionUsed: false };
  if (item.projectionKey) {
    return { text: resolveContent(item.projectionKey, state.lastMainPhase, state.ending), projectionUsed: true };
  }
  return { text: item.display, projectionUsed: false };
}

// —— 叙事投影（20 条，narrative.json）——
export interface TrailRow {
  event: GameEvent;
  systemLabel: string;
  isRewritten: boolean;
  fact: string | null;
}

export function narrativeLabelFor(
  event: GameEvent,
  lastMainPhase: MainPhase,
  ending: EndingId | null,
): { label: string; isRewritten: boolean; fact: string | null } {
  const entry = content.narrative.find(
    (n) =>
      n.code === event.code &&
      (n.target === undefined ||
        n.target === (event.payload as Record<string, unknown>)?.documentId),
  );
  if (!entry) return { label: `${event.code}`, isRewritten: false, fact: null };
  let label = entry.original;
  if (ending && entry.endingLabels && entry.endingLabels[ending] !== undefined) {
    label = entry.endingLabels[ending]!;
  } else {
    for (const r of entry.rewrites) {
      if (phaseAtLeast(lastMainPhase, r.from)) label = r.label;
    }
  }
  return { label, isRewritten: label !== entry.original, fact: entry.fact };
}

export function selectNarrativeTrail(state: GameState): TrailRow[] {
  return state.events
    .map((event) => {
      const { label, isRewritten, fact } = narrativeLabelFor(event, state.lastMainPhase, state.ending);
      return { event, systemLabel: label, isRewritten, fact };
    })
    .filter((row) => content.narrative.some((n) => n.code === row.event.code));
}

export function formatGameTime(elapsedMs: number): string {
  const totalSec = Math.floor(elapsedMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// —— 页面可用性（§6 开放矩阵）——
export function pageAvailable(state: GameState, page: string): boolean {
  const f = state.facts;
  const p = state.lastMainPhase;
  switch (page) {
    case 'start':
    case 'migration':
      return true;
    case 'followup':
    case 'patient':
    case 'review':
      return f.handoverSecured && f.rulesAcknowledged;
    case 'medication':
      return f.r03Prearchived;
    case 'forum':
      return f.r03IdentityRestored;
    case 'archive':
      return f.postsLinked;
    case 'compare':
      return phaseAtLeast(p, 'THEATER_DISCOVERED');
    case 'experiment':
      return f.dualSourceProven;
    case 'slices':
      return f.experimentConcluded;
    case 'trail':
      return f.sliceInspected;
    case 'audioConsole':
      return f.trailForkCreated;
    case 'surgery':
      return f.witnessScope === 'FACT_ONLY';
    case 'nextHandover':
      return f.witnessScope === 'FACT_ONLY' && (f.simulatedEdges.includes('D') || f.simulatedEdges.includes('F'));
    case 'ending':
      return state.ending !== null;
    case 'debrief':
      return state.ending !== null;
    default:
      return false;
  }
}

/** 当前阶段首页（§6）。 */
export function homeRouteFor(state: GameState): string {
  const f = state.facts;
  if (state.ending) return `/ending/${state.ending}`;
  switch (state.lastMainPhase) {
    case 'BOOT':
      return f.handoverSecured && f.rulesAcknowledged ? '/followup' : '/migration';
    case 'R03_PREARCHIVED':
      return '/medication';
    case 'IDENTITY_RESTORED':
      return '/medication';
    case 'THEATER_DISCOVERED':
      return '/compare';
    case 'DUAL_SOURCE_EXPOSED':
      return '/compare';
    case 'CLOSURE_PROVEN':
      return '/lab/slices';
    case 'TRAIL_FORKED':
    case 'AUDIO_RECOVERED':
      return '/audio/channel-03';
    case 'SCOPE_LIMITED':
      return '/lab/surgery';
    case 'SURGERY_READY':
      return '/handover/next';
  }
}

/** 陈述解锁（statements.json unlockKey）。 */
export function statementUnlocked(state: GameState, statementId: string): boolean {
  const st = content.statements[statementId];
  if (!st) return false;
  const map: Record<string, EligibilityKey> = {
    postsLinked: 'postsLinked',
    recoveredAudioRead: 'recoveredAudioRead',
    theaterDiscovered: 'theaterDiscovered',
    dualSourceProven: 'dualSourceProven',
    closureProven: 'closureProven',
  };
  const key = map[st.unlockKey];
  return key ? eligibilityHolds(state, key) : false;
}
