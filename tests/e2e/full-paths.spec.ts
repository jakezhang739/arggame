/** full-paths（docs/04册 v1.1 §3-2）：SELF/REPLAY × A/B/C 六条完整路径，全部从 P00 新局真实点击，
 *  不从 SURGERY_READY 夹具开始。 */
import { expect, test } from '@playwright/test';
import { app } from './framework';

type Cause = 'SELF' | 'REPLAY';
type Ending = 'A' | 'B' | 'C';

const COMBOS: [Cause, Ending][] = [
  ['SELF', 'A'],
  ['SELF', 'B'],
  ['SELF', 'C'],
  ['REPLAY', 'A'],
  ['REPLAY', 'B'],
  ['REPLAY', 'C'],
];

for (const [cause, ending] of COMBOS) {
  test(`完整路径 ${cause} → 结局${ending}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const base = cause === 'SELF' ? 'EV01' : 'EV02';

    // —— 前段（M1 纵切）——
    await app.gotoStart(page);
    await app.startNewSession(page);
    if (cause === 'SELF') await app.secureHandoverByFile(page);
    else await app.secureHandoverBySnapshot(page);
    await app.ackRules(page);
    if (cause === 'SELF') await app.submitReview(page);
    else await app.watchReplay(page);

    await page.getByTestId('p02:goto-medication').click();
    await app.skipAssistantShortcut(page);
    await app.openEvidence(page, 'EV06');
    await app.openEvidence(page, 'EV07');
    await app.openEvidence(page, 'EV10'); // p6 需要复核事务日志
    await app.solveP1(page, [base, 'EV06']);
    await app.ackAud01ByText(page);
    await app.restoreIdentity(page, base);

    // —— p2 时间线 ——
    await page.getByTestId('p05:tab--timeline').click();
    await page.getByTestId('p05:ev11-unreliable').check();
    await app.reorderTimeline(page, ['TL_HANDOVER', 'TL_OBSERVATION', 'TL_PREFILL', 'TL_REVIEW', 'TL_RECOUNT']);
    await page.getByTestId('p05:submit-p2').click();
    await expect(page.getByText('时间线已重建')).toBeVisible();

    // —— EV05（p6 证据）——
    await app.openEv05(page);

    // —— P06 论坛 ——
    await app.solveForumTagging(page);
    await page.getByTestId('p06:capture--R01').click();
    await page.getByTestId('p06:capture--R02').click();

    // —— P07 档案 ——
    await app.solveArchive(page, cause);

    // —— P08 平行复核 ——
    await app.solveCompare(page);

    // —— R04（剧场后）/ R05（同源后）陈述 ——
    await app.captureOnP03(page, 'R04');
    await app.captureOnP03(page, 'R05');

    // —— P09 实验 ——
    await app.solveExperiment(page, ['A', 'B', 'D', 'F']);
    await app.captureOnP03(page, 'R06');

    // —— P10/P11 ——
    await app.solveSlices(page);
    await app.solveTrailObjection(page, base);

    // —— P12 录音台（文字见证路线）——
    await app.solveAudioConsole(page);

    // —— P13/P14 ——
    await app.previewEdges(page, ending === 'B' ? ['D', 'F'] : ['D']);
    await app.solveNextHandover(page, base, ending);

    // —— P16 复盘可达 ——
    await page.getByTestId('p15:goto-debrief').click();
    await expect(page.getByTestId('p16:exit')).toBeVisible();
    const attempts = await page.locator('[data-testid="p16:attempts"] li').count();
    expect(attempts).toBe(0); // 全程一次通过，无失败尝试记录

    expect(errors, '完整路径无未捕获异常').toEqual([]);
  });
}
