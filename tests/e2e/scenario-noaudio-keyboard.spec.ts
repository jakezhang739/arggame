/** 真实场景 · 无音频 + 纯键盘 + 200% 字体：
 *  不点任何播放按钮（音频资产尚未生产）、全程用焦点+键盘操作、放大字号验证无溢出。 */
import { expect, test, type Page } from '@playwright/test';
import { app } from './framework';

const SHOTS = 'test-results/shots';

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

async function kEnter(page: Page, testid: string): Promise<void> {
  await page.getByTestId(testid).focus();
  await page.keyboard.press('Enter');
}
async function kSpace(page: Page, testid: string): Promise<void> {
  await page.getByTestId(testid).focus();
  await page.keyboard.press('Space');
}

test('无音频纯键盘：SELF 全程焦点操作，200% 字体无横向溢出', async ({ page }) => {
  const errors = watchErrors(page);

  // —— 纯键盘启动 ——
  await page.goto('/arggame/#/');
  await kEnter(page, 'start:new');
  await expect(page.getByTestId('migration:download')).toBeVisible();

  // 下载 → 确认已保存（键盘）
  await kEnter(page, 'migration:download');
  await kEnter(page, 'migration:ack-saved');
  await expect(page.getByText('✓ 副本已确认')).toBeVisible();

  // 六条须知逐条勾选（键盘空格）
  for (let i = 0; i < 6; i++) {
    await kSpace(page, `migration:rule--${i}`);
  }
  await kEnter(page, 'migration:enter');
  await expect(page.getByTestId('p02:list-title')).toBeVisible();

  // —— SELF 签认（键盘完成二次确认）——
  await kEnter(page, 'p02:goto-review');
  await kEnter(page, 'p04:submit-review');
  await kEnter(page, 'p04:confirm-submit');
  await app.expectCount(page, 5);

  // —— 200% 字体：设置面板调整并验证（调完关闭面板）——
  await page.getByTestId('controls:settings').click();
  await page.getByTestId('settings:text-scale').selectOption('2');
  await page.getByTestId('controls:settings').click(); // 收起面板
  const fontSize = await page.evaluate(() => document.documentElement.style.fontSize);
  expect(fontSize).toBe('32px');
  await page.screenshot({ path: `${SHOTS}/sc2-p02-200pct.png`, fullPage: true });

  // 无横向溢出（P02）
  const overflow02 = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow02).toBeLessThanOrEqual(1);

  // —— P05：键盘完成取证与 p1（不播放任何音频）——
  await page.getByTestId('p02:goto-medication').click();
  await app.skipAssistantShortcut(page);
  await kEnter(page, 'p05:open--EV06');
  await expect(page.getByTestId('p05:doc--EV06')).toContainText('✓ 已取得');
  await kSpace(page, 'p05:anomaly--IDENTITY_INDEX');
  await kSpace(page, 'p05:ev--EV01');
  await kSpace(page, 'p05:ev--EV06');
  await kEnter(page, 'p05:submit-p1');
  await expect(page.getByText('复查已受理')).toBeVisible();

  // 无音频路径：展开字幕 → 文字确认（不点播放）
  await kEnter(page, 'p05:transcript');
  await expect(page.locator('p.transcript')).toContainText('你那边的交接联，还写着名字吗？');
  await kEnter(page, 'p05:ack-aud01');
  await expect(page.getByText('✓ EV12 已取得')).toBeVisible();
  await kEnter(page, 'p05:submit-restore');
  await expect(page.getByText('R03／许棠的关联已按原始交接恢复')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/sc2-p05-restored-200pct.png`, fullPage: true });

  // 200% 下 P05 也无横向溢出
  const overflow05 = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow05).toBeLessThanOrEqual(1);

  expect(errors, '场景内不得出现未捕获异常').toEqual([]);
});
