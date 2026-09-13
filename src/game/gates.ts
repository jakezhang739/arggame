/** 谜题判定（docs/01_核心契约.md v1.1 §7）。九谜题 + 两判断；语义选项，不做自由文本全等。 */
import type {
  AudioId,
  ConfigId,
  EdgeId,
  EvidenceId,
  ExperimentRun,
  GameState,
  NextVisitSlots,
  ReviewCause,
  StatementId,
  PatientId,
} from './types';
import { content } from './content';

export interface GateResult {
  ok: boolean;
  conflicts: string[];
  feedbackKey: string;
}
const pass = (feedbackKey: string): GateResult => ({ ok: true, conflicts: [], feedbackKey });
const reject = (feedbackKey: string, ...conflicts: string[]): GateResult => ({
  ok: false,
  conflicts,
  feedbackKey,
});

const PATIENTS: PatientId[] = ['R01', 'R02', 'R03', 'R04', 'R05', 'R06'];

function acquired(state: GameState): Set<EvidenceId> {
  return new Set(
    (content.evidenceRegistry as { id: EvidenceId }[]).map((e) => e.id).filter((id) =>
      isAcquired(state, id),
    ),
  );
}

/** 取得判定：acquisitionKey 命中事件且证据注册存在。 */
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
    return true; // LOAD_SNAPSHOT / RUN_EXPERIMENT / PROVE_SHARED_SOURCE / … 按“发生过”计
  });
}

// —— p1 ——
export function checkP1(
  state: GameState,
  anomaly: string,
  evidenceIds: EvidenceId[],
): GateResult {
  const have = acquired(state);
  const conflicts: string[] = [];
  if (anomaly !== 'IDENTITY_INDEX') conflicts.push('需要指出身份索引异常，而不是修正总数或猜测姓名。');
  const valid = evidenceIds.filter((id) => have.has(id));
  if (valid.length !== evidenceIds.length) conflicts.push('提交的证据中有尚未取得的条目。');
  const hasBaseline = evidenceIds.some((id) => id === 'EV01' || id === 'EV02');
  const hasPresence = evidenceIds.some((id) => id === 'EV06' || id === 'EV07');
  if (!hasBaseline) conflicts.push('缺少名单基线组（交接联或快照）。');
  if (!hasPresence) conflicts.push('缺少声称离院之后的在场记录（签收或实物交班）。');
  const groups = new Set(evidenceIds.map((id) => content.evidenceRegistry.find((e) => e.id === id)?.originGroup));
  groups.delete(undefined as unknown as string);
  if (groups.size < 2) conflicts.push('证据全部来自同一原始过程，不能互相印证。');
  return conflicts.length ? reject('p1.rejected', ...conflicts) : pass('p1.accepted');
}

// —— p2 ——
export const TIMELINE_CORRECT_ORDER = ['TL_HANDOVER', 'TL_OBSERVATION', 'TL_PREFILL', 'TL_REVIEW', 'TL_RECOUNT'];

export function checkP2(order: string[], unreliable: EvidenceId[]): GateResult {
  const conflicts: string[] = [];
  if (order.join() !== TIMELINE_CORRECT_ORDER.join())
    conflicts.push('顺序不对：请按事件时间排列（后两卡引用本局触发来源）。');
  if (!unreliable.includes('EV11'))
    conflicts.push('《离院报告与模板清单》的上传时间早于其引用的事件与模板，尚未标记为不可靠。');
  return conflicts.length ? reject('p2.rejected', ...conflicts) : pass('p2.accepted');
}

// —— m7 ——
export function checkM7(state: GameState, choice: string, evidenceIds: EvidenceId[]): GateResult {
  const conflicts: string[] = [];
  if (choice !== 'INSIDE_STRUCTURE') conflicts.push('本批材料优先支持的假说不是外部入侵。');
  if (!isAcquired(state, 'EV17')) conflicts.push('尚未取得七层架构与审计材料。');
  if (!state.facts.floorplanMatched) conflicts.push('空间匹配尚未完成。');
  if (!evidenceIds.includes('EV17') || !evidenceIds.includes('EV16'))
    conflicts.push('判断需要同时引用审计材料与空间匹配结果。');
  return conflicts.length ? reject('m7.rejected', ...conflicts) : pass('m7.accepted');
}

// —— p3 ——
export function checkP3(
  state: GameState,
  poemAction: string,
  seat: string,
  causeRef: 'SELF' | 'REPLAY',
): GateResult {
  const conflicts: string[] = [];
  if (poemAction !== 'AFFIRM_ENDING') conflicts.push('诗的末段中，观众是在确认并命名终局。');
  if (seat !== 'SEAT_W07') conflicts.push('席位应指向第七排中央外席（复核终端）。');
  const cause = state.facts.reviewCause;
  if (!cause) conflicts.push('尚无可引用的触发来源。');
  else if (cause.kind !== causeRef)
    conflicts.push(causeRef === 'SELF' ? '本批触发来源是历史签认，不是你的提交。' : '本批触发来源是你的提交，不是历史签认。');
  return conflicts.length ? reject('p3.rejected', ...conflicts) : pass('p3.accepted');
}

// —— p4 ——
export function checkP4(state: GameState, markers: string[]): GateResult {
  const conflicts: string[] = [];
  if (!isAcquired(state, 'EV19') || !isAcquired(state, 'EV20'))
    conflicts.push('需要先分别打开两份文档。');
  if (!markers.includes('TYPO')) conflicts.push('两份文档第 4 段的共同错字“判订”尚未标记。');
  if (!markers.includes('SOURCE_ID')) conflicts.push('相同的 SOURCE_ID 尚未标记。');
  return conflicts.length ? reject('p4.rejected', ...conflicts) : pass('p4.accepted');
}

// —— rnm ——
export function checkRnm(state: GameState, choice: string): GateResult {
  const conflicts: string[] = [];
  if (choice !== 'ONE_TERMINATION_INTERFACE') conflicts.push('核心值与界面译文是两个层次；答案不在“两种病情”。');
  if (!isAcquired(state, 'EV22')) conflicts.push('尚未取得接口捕获日志。');
  return conflicts.length ? reject('rnm.rejected', ...conflicts) : pass('rnm.accepted');
}

// —— p5 ——
export const EXPERIMENT_CONFIGS: Record<ConfigId, ExperimentRun> = {
  A: { configId: 'A', painScore: 'HIGH', endingLabel: 'POSITIVE', externalConfirm: 'NONE', identityLost: false },
  B: { configId: 'B', painScore: 'HIGH', endingLabel: 'POSITIVE', externalConfirm: 'ENDING', identityLost: true },
  C: { configId: 'C', painScore: 'HIGH', endingLabel: 'NEGATIVE', externalConfirm: 'NONE', identityLost: false },
  D: { configId: 'D', painScore: 'HIGH', endingLabel: 'NEGATIVE', externalConfirm: 'ENDING', identityLost: true },
  E: { configId: 'E', painScore: 'LOW', endingLabel: 'POSITIVE', externalConfirm: 'ENDING', identityLost: true },
  F: { configId: 'F', painScore: 'HIGH', endingLabel: 'POSITIVE', externalConfirm: 'FACT_ONLY', identityLost: false },
};

export function checkP5(
  state: GameState,
  labelPair: ConfigId[],
  scopePair: ConfigId[],
  changed: string[],
): GateResult {
  const conflicts: string[] = [];
  const runIds = new Set(
    state.events
      .filter((e) => e.code === 'RUN_EXPERIMENT')
      .map((e) => (e.payload as { configId: ConfigId }).configId),
  );
  const all = [...labelPair, ...scopePair];
  if (all.some((c) => !runIds.has(c)))
    conflicts.push('所选配置中有尚未运行的；结论只基于实际运行过的行。');

  const labelSet = new Set(labelPair);
  if (labelSet.size === 2 && labelSet.has('B') && labelSet.has('D')) {
    // 正确标签对照
  } else {
    conflicts.push('标签对照只接受 B+D（E 同时改变评分，是混杂反例）。');
  }
  const scopeSet = new Set(scopePair);
  const validScopes: ConfigId[][] = [
    ['A', 'B'],
    ['C', 'D'],
    ['B', 'F'],
  ];
  if (!(scopeSet.size === 2 && validScopes.some((p) => p.every((x) => scopeSet.has(x))))) {
    conflicts.push('范围对照只接受 A+B、C+D 或 B+F。');
  }
  const changedSet = new Set(changed);
  if (!(changedSet.has('endingLabel') && changedSet.has('externalConfirm')) || changedSet.size !== 2) {
    conflicts.push('“改变的变量”须同时且仅含：结局标签、外部终局确认。');
  }
  return conflicts.length ? reject('p5.rejected', ...conflicts) : pass('p5.accepted');
}

// —— p6 ——
export const P6_SLOT_ORDER = ['SNAPSHOT_LOADED', 'REVIEW_CAUSE_OBSERVED', 'IDENTITY_LINKED'];

export function checkP6(
  state: GameState,
  order: string[],
  links: Record<string, EvidenceId[]>,
  scopeFinding: string,
): GateResult {
  const conflicts: string[] = [];
  if (order.join() !== P6_SLOT_ORDER.join())
    conflicts.push('里程碑顺序应为：快照载入 → 观察到预归档原因 → 恢复身份关联。');
  const l0 = links['SNAPSHOT_LOADED'] ?? [];
  if (!l0.some((id) => id === 'EV01' || id === 'EV02'))
    conflicts.push('快照载入需要关联交接联或快照。');
  const l1 = links['REVIEW_CAUSE_OBSERVED'] ?? [];
  if (!(l1.includes('EV05') && l1.includes('EV10')))
    conflicts.push('观察到原因需要同时关联授权说明与复核事务日志。');
  const l2 = links['IDENTITY_LINKED'] ?? [];
  if (!l2.includes('EV12')) conflicts.push('恢复关联需要护士留言（EV03 只能作纸面旁证）。');
  if (!state.events.some((e) => e.code === 'LINK_IDENTITY'))
    conflicts.push('本局尚未发生恢复关联事件。');
  if (scopeFinding !== 'UNSUPPORTED_ENDING')
    conflicts.push('尚未指出：护理事实不足以支持关于人生终局的结论。');
  return conflicts.length ? reject('p6.rejected', ...conflicts) : pass('p6.accepted');
}

// —— a1 ——
export const A1_CORRECT_ORDER: AudioId[] = ['AUD02', 'AUD03', 'AUD04', 'AUD05', 'AUD06', 'AUD07'];
export const A1_ANCHOR_PAIRS = ['CART_SPLIT', 'FOOTSTEP_SPLIT', 'SWITCH_SPLIT'];

export function checkA1(order: AudioId[], anchorPairs: string[]): GateResult {
  const conflicts: string[] = [];
  if (order.join() !== A1_CORRECT_ORDER.join())
    conflicts.push('片段顺序仍不对；用跨切点的连续声响（同一次声音的两半）建立顺序。');
  const missing = A1_ANCHOR_PAIRS.filter((p) => !anchorPairs.includes(p));
  if (missing.length) conflicts.push(`尚未确认接续对：${missing.join('、')}。`);
  return conflicts.length ? reject('a1.rejected', ...conflicts) : pass('a1.accepted');
}

// —— p7 ——
export function isRescueEdge(edge: EdgeId): boolean {
  return edge === 'D';
}

// —— p8 ——
export function checkP8(state: GameState, slots: NextVisitSlots): GateResult {
  const conflicts: string[] = [];
  for (const pid of PATIENTS) {
    const ref = slots.identity[pid];
    if (!ref) conflicts.push(`缺少 ${pid} 的身份子记录。`);
    else if (!ref.endsWith(`#${pid}`)) conflicts.push(`${pid} 的身份子记录归属不符。`);
    else if (!isAcquired(state, ref.split('#')[0] as EvidenceId))
      conflicts.push(`${pid} 的身份子记录尚未取得。`);
  }
  const used = new Set<StatementId>();
  for (const pid of PATIENTS) {
    const st = slots.intent[pid];
    if (!st) conflicts.push(`缺少 ${pid} 的当前意愿。`);
    else if (used.has(st)) conflicts.push('同一份陈述不能重复用于两名患者。');
    else if (st !== `ST_${pid}`) conflicts.push(`${pid} 的意愿陈述归属不符。`);
    else if (!state.facts.capturedStatements.includes(st)) conflicts.push(`${pid} 的陈述尚未采集。`);
    if (st) used.add(st);
  }
  if (slots.chain !== 'EV27#NEXT_SHIFT') conflicts.push('后续承接需要已打开的下一班承接单（EV27）。');
  else if (!isAcquired(state, 'EV27')) conflicts.push('下一班承接单尚未打开。');
  return conflicts.length ? reject('p8.rejected', ...conflicts) : pass('p8.accepted');
}

export type { ReviewCause };
