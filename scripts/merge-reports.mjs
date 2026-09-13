#!/usr/bin/env node
/** 组织者合并试玩报告（docs/04册 §6）：node scripts/merge-reports.mjs 报告1.json 报告2.json …
 *  汇总各题失败/提示/完成率、结局分布与活跃时长；不读取录音或身份信息。 */
import { readFileSync, writeFileSync } from 'node:fs';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('用法：node scripts/merge-reports.mjs <报告.json> [更多报告…]');
  process.exit(1);
}

const reports = files.map((f) => JSON.parse(readFileSync(f, 'utf-8')));
const bad = reports.filter((r) => r?.kind !== 'CW_REPORT');
if (bad.length) {
  console.error(`${bad.length} 个文件不是 CW_REPORT，已忽略。`);
}

const PUZZLES = ['p1', 'p2', 'm7', 'p3', 'p4', 'rnm', 'p5', 'p6', 'a1', 'p7', 'p8'];
const rows = PUZZLES.map((pid) => {
  const stats = reports.map((r) => r.puzzles?.[pid]).filter(Boolean);
  const solved = stats.filter((s) => s.solvedMs !== null).length;
  const failures = stats.reduce((a, s) => a + (s.failures ?? 0), 0);
  const hinted = stats.filter((s) => (s.maxHintLevel ?? 0) > 0).length;
  const maxHint = Math.max(0, ...stats.map((s) => s.maxHintLevel ?? 0));
  return { puzzle: pid, solved: `${solved}/${reports.length}`, failures, hinted, maxHint };
});
const endings = reports.reduce((acc, r) => {
  const k = r.ending ?? '未完成';
  acc[k] = (acc[k] ?? 0) + 1;
  return acc;
}, {});
const minutes = reports.map((r) => r.activeMinutes ?? 0).sort((a, b) => a - b);
const median = minutes.length ? minutes[Math.floor(minutes.length / 2)] : 0;
const leftAt = reports.map((r) => ({ id: r.sessionId, ending: r.ending ?? '未完成', lastRoute: r.lastRoute }));

const merged = { count: reports.length, endings, medianActiveMinutes: median, puzzles: rows, leftAt };
writeFileSync('merged-report.json', JSON.stringify(merged, null, 2));

console.log(`样本：${reports.length} 份；结局分布：`, endings);
console.log(`活跃时长中位数：${median} 分钟（目标 180–240）`);
console.table(rows);
console.log('未完成离开点：', leftAt.filter((x) => x.ending === '未完成'));
console.log('已写入 merged-report.json');
