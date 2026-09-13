/** 试玩统计（docs/04_任务块与测试部署.md v1.1 §6 T33.1）。
 *  只从事件派生：随机 sessionId、分支、结局、活跃分钟、各题首次成功/失败次数/提示最高级、离开点。
 *  语音 blob、自由文本与个人身份不进入报告。 */
import type { GameEvent, PuzzleId, ReviewCause } from './types';

export interface PuzzleStat {
  solvedMs: number | null;
  failures: number;
  maxHintLevel: number;
}
export interface PlayReport {
  kind: 'CW_REPORT';
  schemaVersion: 1;
  sessionId: string;
  chosenBranch: ReviewCause['kind'] | null;
  ending: string | null;
  activeMinutes: number;
  puzzles: Partial<Record<PuzzleId, PuzzleStat>>;
  lastRoute: string;
  eventCount: number;
}

const PUZZLE_SUCCESS: Record<string, PuzzleId> = {
  RECHECK_SUBMITTED: 'p1',
  TIMELINE_SOLVED: 'p2',
  INFER_MASQUE: 'm7',
  LINK_AUDIENCE: 'p3',
  PROVE_SHARED_SOURCE: 'p4',
  INFER_REFRAIN: 'rnm',
  EXPERIMENT_CONCLUDED: 'p5',
  FORK_TRAIL: 'p6',
  AUDIO_ORDER_SOLVED: 'a1',
  ASSEMBLE_NEXT_VISIT: 'p8',
};

export function buildPlayReport(input: {
  sessionId: string;
  events: GameEvent[];
  elapsedActiveMs: number;
  ending: string | null;
  reviewCause: ReviewCause | null;
  lastRoute: string;
}): PlayReport {
  const puzzles: Partial<Record<PuzzleId, PuzzleStat>> = {};
  const stat = (id: PuzzleId): PuzzleStat => {
    return (puzzles[id] ??= { solvedMs: null, failures: 0, maxHintLevel: 0 });
  };
  let causeKind: ReviewCause['kind'] | null = input.reviewCause?.kind ?? null;
  for (const e of input.events) {
    const p = e.payload as Record<string, unknown>;
    switch (e.code) {
      case 'REVIEW_TRIGGER_OBSERVED':
        causeKind = (p.cause as ReviewCause).kind;
        break;
      case 'PUZZLE_ATTEMPT':
        stat(p.puzzleId as PuzzleId).failures += 1;
        break;
      case 'HINT_REQUESTED':
        stat(p.puzzleId as PuzzleId).maxHintLevel = Math.max(
          stat(p.puzzleId as PuzzleId).maxHintLevel,
          p.level as number,
        );
        break;
      case 'SEVER_PREVIEW':
        // p7 无“通过”概念：预览过 D 或 F 即视为达成
        if ((p.edge as string) === 'D' || (p.edge as string) === 'F') {
          const s = stat('p7');
          if (s.solvedMs === null) s.solvedMs = e.elapsedMs;
        }
        break;
      default: {
        const pid = PUZZLE_SUCCESS[e.code];
        if (pid && !['SEVER_PREVIEW'].includes(e.code)) {
          const s = stat(pid);
          if (s.solvedMs === null) s.solvedMs = e.elapsedMs;
        }
      }
    }
  }
  return {
    kind: 'CW_REPORT',
    schemaVersion: 1,
    sessionId: input.sessionId,
    chosenBranch: causeKind,
    ending: input.ending,
    activeMinutes: Math.round(input.elapsedActiveMs / 60000),
    puzzles,
    lastRoute: input.lastRoute,
    eventCount: input.events.length,
  };
}
