/** 状态注入冒烟（docs/04册 v1.1 Playwright 路径 5 的纵切版）：
 *  领域层生成里程碑夹具 → localStorage 注入 → 只验证当前已实现页面的显示与可达性。 */
import { expect, test } from '@playwright/test';
import { app, engineAt, injectEngineState } from './framework';

test.describe('里程碑夹具注入', () => {
  test('prearchived-self：直接进入 P02 显示在册 5、搜索 0、发药页可达', async ({ page }) => {
    const engine = await engineAt('prearchived-self');
    await injectEngineState(page, engine);
    await page.goto('/arggame/#/followup');
    await app.expectCount(page, 5);
    await expect(page.getByTestId('p02:prearchive-notice')).toBeVisible();
    await app.search(page, '许棠');
    await expect(page.getByText('0 条记录')).toBeVisible();

    await page.getByTestId('p02:goto-medication').click();
    await expect(page.getByTestId('p05:tab--med')).toBeVisible();
  });

  test('prearchived-replay：回放路线同样到达预归档视图', async ({ page }) => {
    const engine = await engineAt('prearchived-replay');
    await injectEngineState(page, engine);
    await page.goto('/arggame/#/followup');
    await app.expectCount(page, 5);
    await app.openTrail(page);
    await expect(page.getByText('观看W06历史复核回放').first()).toBeVisible();
  });

  test('identity-restored：P02 恢复六行；时间线标签可用并可通过 p2', async ({ page }) => {
    const engine = await engineAt('identity-restored');
    await injectEngineState(page, engine);
    await page.goto('/arggame/#/followup');
    await app.expectCount(page, 6);
    await expect(page.getByTestId('p02:patient-row--R03')).toContainText('许棠');

    await page.getByTestId('p02:goto-timeline').click();
    await app.skipAssistantShortcut(page);
    await page.getByTestId('p05:tab--timeline').click();
    await app.reorderTimeline(page, [
      'TL_HANDOVER',
      'TL_OBSERVATION',
      'TL_PREFILL',
      'TL_REVIEW',
      'TL_RECOUNT',
    ]);
    await page.getByTestId('p05:ev11-unreliable').check();
    await page.getByTestId('p05:submit-p2').click();
    await expect(page.getByTestId('p05:p2-done')).toBeVisible();

    // P04 已成回看态：不能再签认
    await page.goto('/arggame/#/followup/review/R03');
    await expect(page.getByText('本批触发来源（回看）')).toBeVisible();
    await expect(page.getByTestId('p04:submit-review')).toBeHidden();
  });
});
