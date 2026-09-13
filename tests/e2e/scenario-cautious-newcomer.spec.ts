/** 真实场景 · 谨慎的新玩家：拒签走回放、先答错两次再答对、中途暂停续玩。
 *  全程监听未捕获异常；关键节点截屏供人工核验。 */
import { expect, test, type Page } from '@playwright/test';
import { app } from './framework';

const SHOTS = 'test-results/shots';

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

test('谨慎新手：REPLAY → 错误提交×2 → 修正 → 恢复许棠 → 暂停续玩', async ({ page }) => {
  const errors = watchErrors(page);

  await app.gotoStart(page);
  await app.startNewSession(page);
  await app.secureHandoverBySnapshot(page);
  await app.ackRules(page);
  await app.expectCount(page, 6);
  await page.screenshot({ path: `${SHOTS}/sc1-p02-six.png`, fullPage: true });

  // 拒签：先不签，观看 W06 历史回放
  await app.watchReplay(page);
  await app.expectCount(page, 5);
  await app.search(page, '许棠');
  await expect(page.getByText('0 条记录')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/sc1-p02-blank-row.png`, fullPage: true });

  await page.getByTestId('p02:goto-medication').click();
  await app.skipAssistantShortcut(page);
  await app.openEvidence(page, 'EV06');
  await app.openEvidence(page, 'EV07');

  // 第一次答错：类型选成"数量统计误差"（快照路线的基线证据是 EV02）
  await page.getByTestId('p05:anomaly--COUNT_ERROR').check();
  await page.getByTestId('p05:ev--EV02').check();
  await page.getByTestId('p05:ev--EV06').check();
  await page.getByTestId('p05:submit-p1').click();
  await expect(page.locator('.conflict-list')).toContainText('身份索引异常');
  await page.screenshot({ path: `${SHOTS}/sc1-p1-wrong-1.png`, fullPage: true });

  // 第二次答错：类型对了，但只带了在场记录、缺名单基线
  await page.getByTestId('p05:anomaly--IDENTITY_INDEX').check();
  await page.getByTestId('p05:ev--EV02').uncheck();
  await page.getByTestId('p05:ev--EV07').check();
  await page.getByTestId('p05:submit-p1').click();
  await expect(page.locator('.conflict-list')).toContainText('名单基线');
  await page.screenshot({ path: `${SHOTS}/sc1-p1-wrong-2.png`, fullPage: true });

  // 修正：类型 + 名单基线（EV02）+ 在场记录（EV06）
  await page.getByTestId('p05:ev--EV07').uncheck();
  await page.getByTestId('p05:ev--EV02').check();
  await page.getByTestId('p05:submit-p1').click();
  await expect(page.getByText('复查已受理')).toBeVisible();

  // 暂停：关掉标签页（关闭上下文近似），第二天从 P00 继续进入
  const savedState = await page.evaluate(() => localStorage.getItem('cw-save-v2'));
  expect(savedState).toBeTruthy();

  await app.ackAud01ByText(page);
  await app.restoreIdentity(page, 'EV02');
  await page.goto('/arggame/#/followup');
  await app.expectCount(page, 6);
  await expect(page.getByTestId('p02:patient-row--R03')).toContainText('许棠');
  await page.screenshot({ path: `${SHOTS}/sc1-p02-restored.png`, fullPage: true });

  // 错误提交确实被记录为"尝试过的解释"（PUZZLE_ATTEMPT 事件）
  const attempts = await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('cw-save-v2') ?? '{}');
    return (save.events ?? []).filter((e: { code: string }) => e.code === 'PUZZLE_ATTEMPT').length;
  });
  expect(attempts).toBe(2);

  expect(errors, '场景内不得出现未捕获异常').toEqual([]);
});
