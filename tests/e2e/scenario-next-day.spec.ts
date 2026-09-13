/** 真实场景 · 隔天继续：今天玩到身份恢复，明天打开浏览器从 P00“继续”接着查。 */
import { expect, test, type Browser, type Page } from '@playwright/test';
import { app } from './framework';

const SHOTS = 'test-results/shots';

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

test('隔天继续：localStorage 存档跨上下文恢复，P00 继续直达复查工作区', async ({ page, browser }) => {
  const errors = watchErrors(page);

  // —— 今天：SELF 玩到身份恢复 ——
  await app.gotoStart(page);
  await app.startNewSession(page);
  await app.secureHandoverByFile(page);
  await app.ackRules(page);
  await app.submitReview(page);
  await page.getByTestId('p02:goto-medication').click();
  await app.skipAssistantShortcut(page);
  await app.openEvidence(page, 'EV06');
  await app.openEvidence(page, 'EV07');
  await app.solveP1(page, ['EV01', 'EV06']);
  await app.ackAud01ByText(page);
  await app.restoreIdentity(page, 'EV01');

  // “关掉浏览器”：抓取本机存档
  const saved = await page.evaluate(() => localStorage.getItem('cw-save-v2'));
  expect(saved).toBeTruthy();
  const parsed = JSON.parse(saved!) as { events: { code: string }[]; sessionId: string };
  expect(parsed.events.some((e) => e.code === 'LINK_IDENTITY')).toBe(true);

  // —— 明天：全新浏览器上下文 ——
  const ctx2 = await (browser as Browser).newContext();
  const page2 = await ctx2.newPage();
  const errors2 = watchErrors(page2);
  await page2.addInitScript((s) => localStorage.setItem('cw-save-v2', s), saved!);

  await page2.goto('/arggame/#/');
  await expect(page2.getByTestId('start:continue')).toBeVisible();
  await page2.screenshot({ path: `${SHOTS}/sc4-nextday-p00.png`, fullPage: true });
  await page2.getByTestId('start:continue').click();

  // 身份已恢复阶段的首页是复查工作区（P05）
  await expect(page2.getByTestId('p05:tab--timeline')).toBeEnabled();
  await expect(page2.getByText('✓ EV12 已取得')).toBeVisible();

  // 时间线标签从“第二天”接着排（草稿为空则初始乱序，但身份与进度完整）
  await page2.getByTestId('p05:tab--timeline').click();
  await page2.getByTestId('p05:ev11-unreliable').check();
  await app.reorderTimeline(page2, [
    'TL_HANDOVER',
    'TL_OBSERVATION',
    'TL_PREFILL',
    'TL_REVIEW',
    'TL_RECOUNT',
  ]);
  await page2.getByTestId('p05:submit-p2').click();
  await expect(page2.getByText('时间线已重建')).toBeVisible();
  await page2.screenshot({ path: `${SHOTS}/sc4-nextday-p2-done.png`, fullPage: true });

  await ctx2.close();
  expect(errors, '今天场景无未捕获异常').toEqual([]);
  expect(errors2, '隔天场景无未捕获异常').toEqual([]);
});
