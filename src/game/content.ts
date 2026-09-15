/** 内容加载与投影（docs/01_核心契约.md v1.1 §4 / 02册 v1.1）。 */
import type { ContentEntry, EndingId, EvidenceItem, MainPhase } from './types';
import { MAIN_PHASES } from './types';
import type { EvidenceId } from './content-ids';
import handoverJson from '../content/handover.json';
import patientsJson from '../content/patients.json';
import contentEntriesJson from '../content/content-entries.json';
import evidenceJson from '../content/evidence.json';
import rulesJson from '../content/rules.json';
import literatureJson from '../content/literature.json';
import dialogueJson from '../content/dialogue.json';
import narrativeJson from '../content/narrative.json';
import audioManifestJson from '../content/audio-manifest.json';
import endingsJson from '../content/endings.json';
import timelineJson from '../content/timeline.json';
import reviewSourceJson from '../content/review-source.json';
import statementsJson from '../content/statements.json';
import hintsJson from '../content/hints.json';
import surgeryJson from '../content/surgery.json';
import audioTimingsJson from '../content/audio-timings.json';

export interface PatientRecord {
  id: string;
  name: string;
  age: number;
  occupation: string;
  admittedOn: string;
  clinicalNote: string;
  selfStatement: string;
  nursingItems: string[];
  nextHandover: string;
  dream: string | null;
  dreamTags?: string[];
  statementId: string;
}

export interface NarrativeEntry {
  code: string;
  target?: string;
  original: string;
  rewrites: { from: MainPhase; label: string }[];
  fact: string;
  endingLabels?: Partial<Record<EndingId, string>>;
}

export interface StatementRecord {
  id: string;
  patientId: string;
  text: string;
  /** 当前医疗选择（10册 §4 已批）："继续随访"≠"强迫继续一切治疗"。 */
  currentChoice?: string;
  sourceEvidence: string;
  unlockKey: string;
  page: string;
}

export const content = {
  handover: handoverJson as { filename: string; body: string },
  patients: patientsJson as unknown as Record<string, PatientRecord>,
  entries: contentEntriesJson as unknown as ContentEntry[],
  evidenceRegistry: Object.values(evidenceJson) as unknown as EvidenceItem[],
  rules: rulesJson,
  literature: literatureJson,
  dialogue: dialogueJson,
  narrative: narrativeJson as unknown as NarrativeEntry[],
  audioManifest: audioManifestJson,
  endings: endingsJson,
  timeline: timelineJson,
  reviewSource: reviewSourceJson,
  statements: statementsJson as unknown as Record<string, StatementRecord>,
  hints: hintsJson as Record<string, string[]>,
  surgery: surgeryJson,
  audioTimings: audioTimingsJson as Record<string, {
    durationMs: number;
    captionCues: { startMs: number; endMs: number; text: string }[];
    anchorCues: { id: string; startMs: number; endMs: number; side: string }[];
    peaks: number[];
  }>,
};

export function evidenceById(id: EvidenceId): EvidenceItem | undefined {
  return content.evidenceRegistry.find((e) => e.id === id);
}

/** 页面常用快捷导出。 */
export const dialogue = content.dialogue;

function phaseIndex(p: MainPhase): number {
  return MAIN_PHASES.indexOf(p);
}

/** resolveContent：endingOverrides 优先；区间 [from, untilExclusive)。 */
export function resolveContent(key: string, lastMainPhase: MainPhase, ending?: EndingId | null): string {
  const entry = content.entries.find((e) => e.key === key);
  if (!entry) return '';
  if (ending && entry.endingOverrides && entry.endingOverrides[ending] !== undefined) {
    return entry.endingOverrides[ending]!;
  }
  for (const v of entry.phaseVariants) {
    const from = phaseIndex(v.from);
    const until = v.untilExclusive === undefined ? Infinity : phaseIndex(v.untilExclusive);
    const now = phaseIndex(lastMainPhase);
    if (now >= from && now < until) return v.text;
  }
  return entry.default;
}
