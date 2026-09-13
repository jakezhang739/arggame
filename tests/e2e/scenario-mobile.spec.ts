/** 真实场景 · 手机窄屏（375×812）：表格卡片化、核心链路可点通。 */
import { expect, test, type Page } from '@playwright/test';
import { app } from './framework';

const SHOTS = 'test-results/shots';

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

test('手机窄屏：SELF 到恢复许棠，表格退化为卡片且无横向溢出', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 375, height: 812 });

  await app.gotoStart(page);
  await app.startNewSession(page);
  await app.secureHandoverByFile(page);
  await app.ackRules(page);
  await app.expectCount(page, 6);
  await page.screenshot({ path: `${SHOTS}/sc3-mobile-p02-six.png`, fullPage: true });

  await app.submitReview(page);
  await app.expectCount(page, 5);
  await app.search(page, '许棠');
  await expect(page.getByText('0 条记录')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/sc3-mobile-p02-blank.png`, fullPage: true });

  // 窄屏无横向溢出
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  // 叙事轨迹按钮完整可见（不被右缘裁切）
  const toggleBox = await page.getByTestId('trail:drawer-toggle').boundingBox();
  expect(toggleBox).toBeTruthy();
  if (toggleBox) {
    expect(toggleBox.x + toggleBox.width).toBeLessThanOrEqual(376);
    expect(toggleBox.y).toBeGreaterThanOrEqual(0);
  }

  await page.getByTestId('p02:goto-medication').click();
  await app.skipAssistantShortcut(page);
  await app.openEvidence(page, 'EV06');
  await app.openEvidence(page, 'EV07');
  await app.solveP1(page, ['EV01', 'EV06']);
  await app.ackAud01ByText(page);
  await app.restoreIdentity(page, 'EV01');
  await page.screenshot({ path: `${SHOTS}/sc3-mobile-p05-restored.png`, fullPage: true });

  await page.goto('/arggame/#/followup');
  await app.expectCount(page, 6);
  await expect(page.getByTestId('p02:patient-row--R03')).toContainText('许棠');

  expect(errors, '场景内不得出现未捕获异常').toEqual([]);
});
