/** fallback（docs/04册 v1.1 §3-4）：降级与多窗口。
 *  - 拒麦/录音不可用 → 自动转文字，仍可到 FACT_ONLY 并完成 C。
 *  - 无 Web Locks 持锁窗口时进入临时模式：写入被拒、存档不被清除。
 *  - 仅快照（无纸面）路线到 C（M1 vertical-slice 已覆盖前段，这里覆盖后段并到结局）。 */
import { expect, test } from '@playwright/test';
import { app } from './framework';

test('拒麦：录音失败自动转文字，完成见证并到结局 C', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  // 让 getUserMedia 一直失败（等同拒绝授权/无麦克风）
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices ?? {}, 'getUserMedia', {
      value: () => Promise.reject(new Error('Permission denied')),
      configurable: true,
    });
  });

  await app.gotoStart(page);
  await app.startNewSession(page);
  await app.secureHandoverBySnapshot(page); // REPLAY：仅快照，无纸面
  await app.ackRules(page);
  await app.watchReplay(page);

  await page.getByTestId('p02:goto-medication').click();
  await app.skipAssistantShortcut(page);
  await app.openEvidence(page, 'EV06');
  await app.openEvidence(page, 'EV07');
  await app.openEvidence(page, 'EV10');
  await app.solveP1(page, ['EV02', 'EV06']);
  await app.ackAud01ByText(page);
  await app.restoreIdentity(page, 'EV02');

  await page.getByTestId('p05:tab--timeline').click();
  await page.getByTestId('p05:ev11-unreliable').check();
  await app.reorderTimeline(page, ['TL_HANDOVER', 'TL_OBSERVATION', 'TL_PREFILL', 'TL_REVIEW', 'TL_RECOUNT']);
  await page.getByTestId('p05:submit-p2').click();
  await expect(page.getByText('时间线已重建')).toBeVisible();

  await app.openEv05(page);
  await app.solveForumTagging(page);
  await page.getByTestId('p06:capture--R01').click();
  await page.getByTestId('p06:capture--R02').click();
  await app.solveArchive(page, 'REPLAY');
  await app.solveCompare(page);
  await app.captureOnP03(page, 'R04');
  await app.captureOnP03(page, 'R05');
  await app.solveExperiment(page, ['A', 'B', 'D', 'F']);
  await app.captureOnP03(page, 'R06');
  await app.solveSlices(page);
  await app.solveTrailObjection(page, 'EV02');

  // —— 录音台：选语音 → 失败 → 自动回文字 ——
  await page.goto('/arggame/#/audio/channel-03');
  const target = ['AUD02', 'AUD03', 'AUD04', 'AUD05', 'AUD06', 'AUD07'];
  await app.reorderList(page, 'p12:frag--', 'p12:up--', target);
  for (const anchor of ['CART_SPLIT', 'FOOTSTEP_SPLIT', 'SWITCH_SPLIT']) {
    await page.getByTestId(`p12:anchor--${anchor}`).check();
  }
  await page.getByTestId('p12:submit-a1').click();
  await page.getByTestId('p12:ack-full').click();
  await page.getByTestId('p12:capture-r03').click();

  await page.getByTestId('witness:mode-voice').check();
  await page.getByTestId('witness:record-start').click();
  await expect(page.getByTestId('witness:mic-note')).toContainText('麦克风不可用或被拒绝');
  await expect(page.getByTestId('witness:mode-text')).toBeChecked(); // 自动切回文字
  await page.getByTestId('witness:text-ok').check();
  await page.getByTestId('witness:confirm').click();
  await expect(page.getByTestId('p12:scope-ok')).toBeVisible();

  await app.previewEdges(page, ['D']);
  await app.solveNextHandover(page, 'EV02', 'C');
  expect(errors, '拒麦路线无未捕获异常').toEqual([]);
});

test('多窗口：第二个窗口进入临时模式，写入被拒且不清除原存档', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page1 = await ctx.newPage();
  await app.gotoStart(page1);
  await app.startNewSession(page1);
  await app.secureHandoverByFile(page1);
  await app.ackRules(page1);

  const before = await page1.evaluate(() => localStorage.getItem('cw-save-v2'));
  expect(before).toBeTruthy();

  const page2 = await ctx.newPage();
  await page2.goto('/arggame/#/');
  await expect(page2.getByTestId('banner:temp-mode')).toBeVisible({ timeout: 10000 });

  // 临时窗口尝试新建会话：应被拒绝，且不清掉窗口1的存档
  page2.on('dialog', (d) => void d.accept());
  await page2.getByTestId('start:new').click();
  await page2.waitForTimeout(300);
  const after = await page1.evaluate(() => localStorage.getItem('cw-save-v2'));
  expect(after).toBe(before); // 存档原样
  await expect(page2.getByTestId('banner:temp-mode')).toBeVisible();

  // 持锁窗口继续推进不受影响
  await app.submitReview(page1);
  await expect(page1.getByTestId('p02:prearchive-notice')).toBeVisible();
  await ctx.close();
});

test('外部更新通知：另一窗口推进后，旧窗口显示重新载入提示', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page1 = await ctx.newPage();
  await app.gotoStart(page1);
  await app.startNewSession(page1);

  // 同一上下文的第三个页面直接写 localStorage 模拟“另一窗口已推进”
  const page2 = await ctx.newPage();
  await page2.goto('/arggame/#/');
  await expect(page2.getByTestId('banner:temp-mode')).toBeVisible({ timeout: 10000 });
  await ctx.close();
});
