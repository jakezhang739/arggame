/** 实机巡检：有头浏览器从首页玩到 P05，每步做 bbox 交叠检测＋截图（用户要求的实机验证）。 */
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const BASE = 'http://localhost:5187/arggame/#';
const issues = [];
const shots = [];
let n = 0;

const DETECT = () => {
  const els = [...document.querySelectorAll('body *')].filter((el) => {
    if (!(el instanceof HTMLElement)) return false;
    // 不参与渲染树的元素（display:none / 收起 details 的 content-visibility:hidden）不算可见
    if (el.closest('details:not([open])')) return false;
    if (!(el.offsetParent instanceof HTMLElement) && getComputedStyle(el).position !== 'fixed') return false;
    const txt = [...el.childNodes].some((k) => k.nodeType === 3 && k.textContent.trim());
    const st = getComputedStyle(el);
    return txt && st.display !== 'none' && st.visibility !== 'hidden' && el.offsetWidth > 0 && el.offsetHeight > 0;
  });
  const box = (el) => el.getBoundingClientRect();
  const out = [];
  for (let i = 0; i < els.length; i++) {
    for (let j = i + 1; j < els.length; j++) {
      const a = els[i], b = els[j];
      if (a.contains(b) || b.contains(a)) continue;
      // 排除合法遮挡：浮层/全局条/顶栏 属于设计内覆盖，不算叠压
      const layered = (el) => !!el.closest('.modal-mask, .global-notice, .layout-bar, .game-dialog, dialog, [role="dialog"]');
      if (layered(a) || layered(b)) continue;
      const ra = box(a), rb = box(b);
      const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (ox > 6 && oy > 6 && !a.querySelector('svg') && !b.querySelector('svg')) {
        // 只报视口内的
        if (ra.bottom < 0 || rb.bottom < 0 || ra.top > innerHeight || rb.top > innerHeight) continue;
        out.push(`「${a.textContent.trim().slice(0, 14)}」×「${b.textContent.trim().slice(0, 14)}」 +${Math.round(ox)}x${Math.round(oy)}`);
      }
    }
  }
  return [...new Set(out)].slice(0, 12);
};

const browser = await chromium.launch({ headless: false, slowMo: 20 });
const page = await browser.newPage({ viewport: { width: 1306, height: 830 } });
page.on('pageerror', (e) => issues.push(`[pageerror] ${e.message}`));

async function check(name) {
  n += 1;
  await page.waitForTimeout(500);
  const r = await page.evaluate(DETECT);
  const file = `gui-test-screenshots/live-${String(n).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: file });
  shots.push(file);
  console.log(`[${n}] ${name}: ${r.length ? '❌ ' + JSON.stringify(r) : '✓ 无叠压'}`);
  if (r.length) issues.push({ step: name, overlaps: r, shot: file });
}

try {
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(1200);
  await check('首页');
  await page.getByRole('button', { name: '开始第一次复核' }).click();
  await page.waitForTimeout(800);
  await check('交接-进入');
  await page.getByRole('button', { name: '保存原始交接记录' }).click();
  await page.waitForTimeout(500);
  await check('交接-保存后');
  await page.getByRole('button', { name: '我已确认文件可以打开' }).click();
  await page.waitForTimeout(600);
  await check('交接-确认文件');
  for (let pass = 0; pass < 4; pass++) {
    const boxes = page.locator('ol.rules label input[type="checkbox"]');
    let all = true;
    for (let i = 0; i < await boxes.count(); i++) {
      if (!(await boxes.nth(i).isChecked())) { all = false; await boxes.nth(i).check(); await page.waitForTimeout(120); }
    }
    if (all) break;
  }
  await check('交接-规则完成');
  await page.getByRole('button', { name: '查看今晚的待办病历' }).click();
  await page.waitForTimeout(800);
  await check('病历首页');
  await page.getByText('开始复核 R03').first().click();
  await page.waitForTimeout(900);
  await check('复核R03');
  await page.getByRole('button', { name: '查看这次提交究竟会确认什么' }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: '接受预填结论并提交' }).click();
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: '确认', exact: true }).click();
  await page.waitForTimeout(1400);
  await check('提交后-异常场景');
  // 稳定关闭助手捷径弹窗（渲染时序有竞态，循环等待）
  for (let k = 0; k < 10; k++) {
    const skip = page.getByRole('button', { name: '暂不处理' });
    if ((await skip.count()) >= 1 && (await skip.first().isVisible())) {
      await skip.first().click().catch(() => {});
      await page.waitForTimeout(400);
      break;
    }
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(400);
  await page.getByRole('link', { name: '打开调查工作台' }).click();
  await page.waitForTimeout(900);
  // 进入 P05 后弹窗可能再次出现（一次性 cue 未落），再兜底关一次
  for (let k = 0; k < 6; k++) {
    const skip2 = page.getByRole('button', { name: '暂不处理' });
    if ((await skip2.count()) >= 1 && (await skip2.first().isVisible())) {
      await skip2.first().click().catch(() => {});
      await page.waitForTimeout(400);
    } else break;
  }
  await page.waitForTimeout(500);
  await check('P05-调查台');
  // —— 推进到用户贴的 DOM 状态：p1 已过＋台词展开＋音频已确认 ——
  for (let k = 0; k < 12; k++) {
    const opens = page.getByRole('button', { name: '打开', exact: true });
    if ((await opens.count()) === 0) break;
    await opens.first().click();
    await page.waitForTimeout(180);
  }
  await page.getByText('身份索引异常', { exact: false }).first().click();
  await page.waitForTimeout(200);
  for (const tt of ['离线交接联', '发药原始签收']) {
    await page.locator(`label:has-text("${tt}")`).first().locator('input[type="checkbox"]').check();
  }
  await page.getByRole('button', { name: '提交复查理由' }).click();
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: '展开完整台词' }).click().catch(() => {});
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: '已确认这段内容' }).click().catch(() => {});
  await page.waitForTimeout(600);
  await check('P05-结论列-用户状态');
  // 滚到中部与底部各查一次（sticky/浮动件在滚动时才压人）
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(400);
  await check('P05-滚动中部');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  await check('P05-页底');
  // 回交接页滚动复检
  await page.goto(`${BASE}/migration`);
  await page.waitForTimeout(900);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  await check('交接-页底');
  console.log('—— 实机巡检完成 ——');
} catch (e) {
  console.error('中断:', e.message);
  await check('FAILURE');
} finally {
  writeFileSync('gui-test-screenshots/livecheck-report.json', JSON.stringify({ issues, shots }, null, 2));
  await browser.close();
}
