/** 恢复测试（docs/04册 v1.1 Playwright 路径 3 的纵切子集）：
 *  p1/p2 草稿刷新保留；助手弹层处理过不重现；进度刷新不丢。 */
import { expect, test } from '@playwright/test';
import { app, engineAt, injectEngineState } from './framework';

const CORRECT = ['TL_HANDOVER', 'TL_OBSERVATION', 'TL_PREFILL', 'TL_REVIEW', 'TL_RECOUNT'];

test.describe('草稿与进度恢复', () => {
  test('p1 选择草稿刷新保留，随后可提交成功', async ({ page }) => {
    const engine = await engineAt('prearchived-self');
    await injectEngineState(page, engine);
    await page.goto('/arggame/#/medication');
    await app.skipAssistantShortcut(page);

    await page.getByTestId('p05:anomaly--IDENTITY_INDEX').check();
    await page.getByTestId('p05:ev--EV01').check();
    await page.getByTestId('p05:ev--EV06').check();

    await page.reload();
    await expect(page.getByTestId('p05:tab--med')).toBeVisible();
    // 助手弹层已处理过：不重现
    await expect(page.getByTestId('p05:skip-fix')).toBeHidden();

    // 草稿保留
    await expect(page.getByTestId('p05:anomaly--IDENTITY_INDEX')).toBeChecked();
    await expect(page.getByTestId('p05:ev--EV01')).toBeChecked();
    await expect(page.getByTestId('p05:ev--EV06')).toBeChecked();

    await page.getByTestId('p05:submit-p1').click();
    await expect(page.getByText('复查已受理')).toBeVisible();
  });

  test('p2 排序草稿刷新保留，可继续排完并提交', async ({ page }) => {
    const engine = await engineAt('identity-restored');
    await injectEngineState(page, engine);
    await page.goto('/arggame/#/medication');
    await app.skipAssistantShortcut(page);
    await page.getByTestId('p05:tab--timeline').click();

    // 做一次部分移动
    await page.getByTestId('p05:tl-up--TL_OBSERVATION').click();
    const midOrder = await page
      .locator('[data-testid^="p05:tl--TL_"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')?.replace('p05:tl--', '') ?? ''));

    await page.reload();
    await page.getByTestId('p05:tab--timeline').click();
    const afterReload = await page
      .locator('[data-testid^="p05:tl--TL_"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')?.replace('p05:tl--', '') ?? ''));
    expect(afterReload).toEqual(midOrder);

    await app.reorderTimeline(page, CORRECT);
    await page.getByTestId('p05:ev11-unreliable').check();
    await page.getByTestId('p05:submit-p2').click();
    await expect(page.getByText('时间线已重建')).toBeVisible();
  });

  test('UI 完成的进度刷新不丢：恢复许棠后重载仍在', async ({ page }) => {
    await app.gotoStart(page);
    await app.startNewSession(page);
    await app.secureHandoverByFile(page);
    await app.ackRules(page);
    await app.submitReview(page);
    await page.getByTestId('p02:goto-medication').click();
    await app.skipAssistantShortcut(page);
    await app.openEvidence(page, 'EV06');
    await app.solveP1(page, ['EV01', 'EV06']);
    await app.ackAud01ByText(page);
    await app.restoreIdentity(page);

    await page.reload();
    await page.goto('/arggame/#/followup');
    await app.expectCount(page, 6);
    await expect(page.getByTestId('p02:patient-row--R03')).toContainText('许棠');
    // P00 也提供继续入口
    await page.goto('/arggame/#/');
    await expect(page.getByTestId('start:continue')).toBeVisible();
  });
});
