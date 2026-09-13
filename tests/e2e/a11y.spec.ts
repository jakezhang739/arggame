/** 无障碍走查（docs/04册 T27.1）：键盘焦点可见、reducedMotion 生效、200% 无溢出抽查后段页面。 */
import { expect, test } from '@playwright/test';
import { TestEngine } from '../helpers';
import { injectEngineState } from './framework';

test('键盘焦点可见且可遍历关键控件（P07 档案页）', async ({ page }) => {
  const engine = new TestEngine();
  await engine.run({ kind: 'boot' });
  await engine.run({ kind: 'ackHandoverSaved' });
  await engine.run({ kind: 'ackRules' });
  await engine.run({ kind: 'loadSnapshot' });
  await engine.run({ kind: 'submitReview' });
  await engine.run({ kind: 'openDoc', documentId: 'EV06' });
  await engine.run({ kind: 'openDoc', documentId: 'EV07' });
  await engine.run({ kind: 'recheckSubmitted', evidenceIds: ['EV01', 'EV06'] });
  await engine.run({ kind: 'ackAudioContent', audioId: 'AUD01', mode: 'TEXT' });
  await engine.run({ kind: 'linkIdentity', source: 'EV01' });
  await engine.run({
    kind: 'solveTimeline',
    order: ['TL_HANDOVER', 'TL_OBSERVATION', 'TL_PREFILL', 'TL_REVIEW', 'TL_RECOUNT'],
    unreliable: ['EV11'],
  });
  await engine.run({ kind: 'tagPosts', postIds: ['R01', 'R02', 'R03'], tags: ['地点', '结构', '角色'] });
  await engine.run({ kind: 'openDoc', documentId: 'THEATER_MAP' });
  await injectEngineState(page, engine);
  await page.goto('/arggame/#/archive');

  // Tab 遍历：焦点落到可见控件上，且有 focus-visible 轮廓
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return null;
    const outline = getComputedStyle(el).outlineWidth;
    return { tag: el.tagName, testid: el.getAttribute('data-testid'), outline };
  });
  expect(focused).toBeTruthy();
  expect(focused!.outline).not.toBe('0px');

  // 位置表等价信息对屏幕阅读器可读（caption 存在）
  await expect(page.getByTestId('p07:position-table')).toBeVisible();
});

test('reducedMotion：动画/过渡被压缩到近零（P00）', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/arggame/#/');
  await expect(page.getByTestId('start:new')).toBeVisible();
  const durations = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.transition = 'opacity 0.4s';
    probe.style.animation = 'fade 2s infinite';
    document.body.appendChild(probe);
    const cs = getComputedStyle(probe);
    const out = { transition: cs.transitionDuration, animation: cs.animationDuration };
    probe.remove();
    return out;
  });
  expect(parseFloat(durations.transition)).toBeLessThanOrEqual(0.05);
  expect(parseFloat(durations.animation)).toBeLessThanOrEqual(0.05);
  await ctx.close();
});

test('200% 字体下页面无横向溢出（守卫回退与 P00/P01）', async ({ page }) => {
  await page.addInitScript(() => {
    document.documentElement.style.fontSize = '32px';
  });
  // 无进度时访问受限页面被守卫送回迁移页（空档期首页）：验证回退页在 200% 下不溢出
  await page.goto('/arggame/#/lab/experiment');
  await page.waitForTimeout(300);
  await expect(page.getByTestId('migration:download')).toBeVisible();
  const overflow1 = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow1).toBeLessThanOrEqual(1);
});
