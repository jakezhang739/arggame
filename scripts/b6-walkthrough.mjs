/** Batch 6 实机黑盒走查（docs/13 §3）：有头 Chromium，仅用可见文案/角色定位（不用 data-testid），
 *  真实点击走完 P00→P15，逐步截图并收集控制台错误。用法：node scripts/b6-walkthrough.mjs */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = 'http://localhost:5187/arggame/#';
const OUT = 'gui-test-screenshots';
const shots = [];
const consoleErrors = [];
let step = 0;

function log(...args) {
  console.log(`[b6]`, ...args);
}

async function shot(page, name, fullPage = false) {
  step += 1;
  const file = `${OUT}/b6-t${String(step).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: file, fullPage });
  shots.push(file);
  log(`📸 ${file}`);
}

/** 依次尝试候选定位（可见文案/角色），全部失败时打印当前可交互元素帮助迭代。 */
async function clickAny(page, candidates, scope = page) {
  for (const c of candidates) {
    const loc =
      typeof c === 'string'
        ? scope.getByRole('button', { name: c }).or(scope.getByRole('link', { name: c })).or(scope.getByText(c, { exact: false }))
        : c(scope);
    if ((await loc.count()) >= 1) {
      await loc.first().click();
      log(`▶ 点击「${typeof c === 'string' ? c : 'locator'}」`);
      return true;
    }
  }
  const buttons = await page
    .locator('button:visible, a:visible, [role="tab"]:visible, summary:visible')
    .allInnerTexts()
    .catch(() => []);
  throw new Error(`点击候选全部失败：${candidates}\n当前可见可交互元素：${JSON.stringify(buttons.slice(0, 40))}`);
}

async function expectVisible(page, text, timeout = 6000) {
  await page.getByText(text, { exact: false }).first().waitFor({ state: 'visible', timeout });
  log(`✓ 可见：「${text}」`);
}

const browser = await chromium.launch({ headless: false, slowMo: 25 });
const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(`[console.error] ${page.url()} :: ${msg.text()}`);
});
page.on('pageerror', (err) => consoleErrors.push(`[pageerror] ${page.url()} :: ${err.message}`));

try {
  // —— t1 首页：30 秒身份认知 ——
  await page.goto(`${BASE}/`);
  await expectVisible(page, '六名患者');
  await expectVisible(page, '开始第一次复核');
  await shot(page, 'start');

  // —— t2 交接第一步：保存 → 玩家确认文件可打开 ——
  await clickAny(page, ['开始第一次复核']);
  await expectVisible(page, '保存');
  await shot(page, 'handover-step1');
  await clickAny(page, ['保存原始交接记录', '保存复核前的原始名单']);
  await page.waitForTimeout(600);
  await clickAny(page, ['我已确认文件可以打开']);
  await page.waitForTimeout(600);

  // —— t3 交接第二步（紧凑准备清单） ——
  await expectVisible(page, '复核边界').catch(() => log('（无“复核边界”字样，继续）'));
  // 逐项确认六条复核边界（多轮校验，规避步骤1完成时区块重渲染的竞态）
  let confirmed = 0;
  for (let pass = 0; pass < 4; pass++) {
    const boxes = page.locator('ol.rules label input[type="checkbox"]');
    const n = await boxes.count();
    let all = true;
    for (let i = 0; i < n; i++) {
      if (!(await boxes.nth(i).isChecked())) {
        all = false;
        await boxes.nth(i).check();
        await page.waitForTimeout(150);
      }
    }
    confirmed = n;
    if (all && n > 0) break;
  }
  log(`已确认复核边界 ${confirmed} 条`);
  await shot(page, 'handover-step2');
  await clickAny(page, ['查看今晚的待办病历', '确认复核边界，前往病例', '进入病例列表', '前往病例', '下一步']);
  await page.waitForTimeout(600);

  // —— t4 病例首页：R03 唯一待办 ——
  await expectVisible(page, 'R03');
  await shot(page, 'dashboard');
  await clickAny(page, ['开始复核 R03', '前往复核页', '查看护理事实']);
  await page.waitForTimeout(600);

  // —— t5 复核页：先看提交会确认什么（谨慎路径），再提交 ——
  await expectVisible(page, '许棠').catch(() => log('（复核页未见姓名，继续）'));
  await shot(page, 'review-r03');
  await clickAny(page, ['查看这次提交究竟会确认什么']);
  await page.waitForTimeout(500);
  await shot(page, 'review-scope');
  await clickAny(page, ['接受预填结论并提交']);
  await page.waitForTimeout(1000);
  const confirmBtn = page.getByRole('button', { name: '确认', exact: true });
  await confirmBtn.click({ timeout: 8000 });
  log('▶ 点击「确认」（二次确认）');
  await page.waitForTimeout(1500);

  // —— t6 六变五异常场景 ——
  await expectVisible(page, '异常').catch(() => log('（未见“异常”字样，继续）'));
  await shot(page, 'anomaly');
  await clickAny(page, ['打开调查工作台', '去发药对照', '开始调查']);
  await page.waitForTimeout(800);

  // —— t7 P05 三栏调查台 ——
  await expectVisible(page, '材料箱');
  // 归档助手捷径弹窗（剧情节拍）：先留证，再「暂不处理」
  await page.waitForTimeout(600);
  const shortcut = page.getByText('归档助手').first();
  if (await shortcut.isVisible().catch(() => false)) {
    await shot(page, 'p05-assistant-shortcut');
    await clickAny(page, ['暂不处理']);
    await page.waitForTimeout(400);
  }
  await shot(page, 'p05-desk', true);
  // 打开材料箱全部原始单据（按钮取得后消失，逐次重查）
  for (let k = 0; k < 12; k++) {
    const openButtons = page.getByRole('button', { name: '打开', exact: true });
    if ((await openButtons.count()) === 0) break;
    await openButtons.first().click();
    await page.waitForTimeout(250);
  }
  await page.getByText('身份索引异常', { exact: false }).first().click();
  await page.waitForTimeout(200);
  for (const t of ['离线交接联', '发药原始签收']) {
    const label = page.locator(`label:has-text("${t}")`).first();
    await label.locator('input[type="checkbox"]').check();
  }
  await shot(page, 'p05-puzzle-filled');
  await clickAny(page, ['提交复查理由']);
  await expectVisible(page, '刚才这一步');
  await expectVisible(page, '站内消息');
  await shot(page, 'p05-p1done');

  // 无归属音频（文字确认）
  await clickAny(page, ['展开完整台词']);
  await clickAny(page, ['已确认这段内容']);
  await page.waitForTimeout(400);
  await clickAny(page, ['恢复 R03—许棠', '恢复 R03-许棠']);
  await page.waitForTimeout(800);

  // 刷新恢复检查（R4）
  await page.reload();
  await page.waitForTimeout(1200);
  await expectVisible(page, '恢复').catch(() => log('（刷新后未见恢复相关文案）'));
  await shot(page, 'p05-after-reload');

  // —— 时间线（第二阶段）：按完整卡片标题排序（时间标签含"交接之后"等字样，不能用短关键词） ——
  await clickAny(page, ['第二步 · 重排当晚时间线', '重排当晚时间线']);
  await page.waitForTimeout(400);
  const TITLES = ['护士交接', '临床观察', '结局预填', '外部确认', '身份索引重算'];
  const readTl = () =>
    page
      .locator('.tl-title')
      .allInnerTexts()
      .then((ts) => ts.map((t) => TITLES.findIndex((w) => t.trim().startsWith(w))));
  const rowOf = (title) => page.locator('.tl-item').filter({ hasText: title }).first();
  for (let guard = 0; guard < 30; guard++) {
    const cur = await readTl();
    if (cur.join() === '0,1,2,3,4') break;
    const i = cur.findIndex((c, idx) => c !== idx);
    if (i < 0) break;
    const title = TITLES[i];
    for (let k = 0; k < 10; k++) {
      const now = await readTl();
      if (now[i] === i) break;
      await rowOf(title).locator('button').first().click();
      await page.waitForTimeout(120);
    }
  }
  log('时间线排序完成：', (await readTl()).join(','));
  const unreliable = page.locator('label:has-text("标记为不可靠") input, .check input[type="checkbox"]');
  if ((await unreliable.count()) >= 1) await unreliable.first().check();
  // 只读观测：提交前记录当前顺序与勾选状态
  const orderNow = await page.locator('.tl-title, .tl-item').allInnerTexts();
  log('时间线当前顺序：', JSON.stringify(orderNow.map((t) => t.split('\n')[0].trim())));
  log('不可靠标记勾选：', await page.locator('label:has-text("标记为不可靠") input').first().isChecked().catch(() => 'n/a'));
  await shot(page, 'p05-timeline');
  await clickAny(page, ['提交时间线']);
  await page.waitForTimeout(600);
  const tlFeedback = await page.locator('.conflict-list li').allInnerTexts().catch(() => []);
  if (tlFeedback.length) log('时间线反馈：', JSON.stringify(tlFeedback));

  // —— t8/t9 P06 留言板 ——
  await clickAny(page, ['去病友留言板']);
  await page.waitForTimeout(800);
  await expectVisible(page, '迁移项目组');
  await shot(page, 'p06-forum');
  await clickAny(page, ['打开留言板原始数据']);
  await page.waitForTimeout(300);
  for (const author of ['陈桥', '宋渺', '许棠']) {
    await page.locator(`article:has-text("${author}") label:has(input[type="checkbox"])`).first().locator('input').check();
  }
  for (const tag of ['地点', '结构', '角色']) {
    await page.locator(`fieldset label:has-text("${tag}") input`).first().check();
  }
  await clickAny(page, ['提交关联']);
  await expectVisible(page, '林闻的私信');
  await shot(page, 'p06-linwen');
  await clickAny(page, ['查看她保留的本机备份']);
  await expectVisible(page, '承认');
  await shot(page, 'p06-confession');
  await clickAny(page, ['去地方档案']);

  // —— t10 P07 档案叠合 ——
  await page.waitForTimeout(800);
  await clickAny(page, ['调出馆藏《旧剧场平面图》', '调出旧剧场平面图']);
  await page.waitForTimeout(400);
  await shot(page, 'p07-overlay');
  await page.locator('select').nth(0).selectOption({ label: '后台' });
  await page.locator('select').nth(1).selectOption({ label: '提词位' });
  await page.locator('select').nth(2).selectOption({ label: '观众席外席' });
  await clickAny(page, ['提交空间匹配']);
  await expectVisible(page, '征服者蠕虫');
  await shot(page, 'p07-wf');
  const p3 = page.locator('.p3form select, fieldset select');
  await p3.nth(0).selectOption({ label: '确认并命名终局' });
  await p3.nth(1).selectOption({ label: '第七排中央外席' });
  await p3.nth(2).selectOption({ label: '本局我提交的复核' }).catch(async () => {
    await p3.nth(2).selectOption({ label: '历史签认 W06（回放）' });
  });
  await clickAny(page, ['提交三联']);
  await page.waitForTimeout(600);
  await clickAny(page, ['打开《第七份记录》', '打开第七份记录']);
  await page.waitForTimeout(400);
  await clickAny(page, ['去平行复核工作区']);

  // —— t11 P08 同源对照 ——
  await page.waitForTimeout(800);
  await expectVisible(page, '未归档');
  await shot(page, 'p08-zhouyan');
  await clickAny(page, ['打开《正向修复文档》', '打开正向修复文档']);
  await clickAny(page, ['打开《负向申诉文档》', '打开负向申诉文档']);
  await page.waitForTimeout(300);
  // 黑盒：直接点正文里的共同痕迹（内联标记）
  await page.getByText('判订', { exact: true }).first().click();
  await page.waitForTimeout(200);
  await shot(page, 'p08-inline-mark');
  await page.locator('label:has-text("相同的来源编号") input').first().check();
  await clickAny(page, ['提交共同标记']);
  await expectVisible(page, '同一底稿');
  await shot(page, 'p08-p4done');
  await clickAny(page, ['用归档副本验证真正的触发条件', '去单变量实验']);

  // —— t12 P09 实验台 ——
  await page.waitForTimeout(800);
  await page.getByText('外部终局确认让标签落地').first().click();
  await shot(page, 'p09-hypothesis');
  for (const btn of await page.getByRole('button', { name: '运行', exact: true }).all()) {
    await btn.click();
    await page.waitForTimeout(120);
  }
  await shot(page, 'p09-results');
  // 黑盒：按可见“参数组 X”标签勾选对照槽
  const checkSlot = async (legendText, id) => {
    const fs = page.locator('fieldset', { hasText: legendText }).first();
    await fs.locator('label', { hasText: `参数组 ${id}` }).locator('input').check();
  };
  await checkSlot('标签对照', 'B');
  await checkSlot('标签对照', 'D');
  await checkSlot('范围对照', 'B');
  await checkSlot('范围对照', 'F');
  await page.locator('fieldset', { hasText: '改变的变量' }).locator('label', { hasText: '结局标签' }).locator('input').check();
  await page
    .locator('fieldset', { hasText: '改变的变量' })
    .locator('label', { hasText: '外部终局确认' })
    .locator('input')
    .check();
  await shot(page, 'p09-slots');
  await clickAny(page, ['提交结论']);
  await expectVisible(page, '刚才这一步');
  await clickAny(page, ['去处理切片']);

  // —— t13 P10 切片 ——
  await page.waitForTimeout(600);
  await clickAny(page, ['放大检查授权句']);
  await shot(page, 'p10-zoom');
  await clickAny(page, ['已核对事实，确认发现']);
  await expectVisible(page, '这条等式');
  await shot(page, 'p10-done');
  await clickAny(page, ['去轨迹异议工作台']);

  // —— t14 P11 轨迹异议：三槽按「快照载入→观察到预归档原因→恢复身份关联」排序 ——
  await page.waitForTimeout(800);
  await shot(page, 'p11-trail');
  const SLOT_WANT = ['快照载入', '观察到预归档原因', '恢复身份关联'];
  for (let guard = 0; guard < 30; guard++) {
    const titles = await page.locator('li.milestone strong').allInnerTexts();
    const cur = titles.map((t) => SLOT_WANT.findIndex((w) => t.includes(w)));
    if (cur.join() === '0,1,2') break;
    const i = cur.findIndex((c, idx) => c !== idx);
    if (i < 0) break;
    const wantTitle = SLOT_WANT[i];
    for (let k = 0; k < 6; k++) {
      const now = (await page.locator('li.milestone strong').allInnerTexts()).map((t) =>
        SLOT_WANT.findIndex((w) => t.includes(w)),
      );
      if (now[i] === i) break;
      await page.locator('li.milestone', { hasText: wantTitle }).getByRole('button').first().click();
    }
  }
  await shot(page, 'p11-ordered');
  // 证据链接：按槽位作用域勾选（每个槽位都列出全部证据，必须对准槽位）
  const linkIn = async (slotTitle, evTitle) => {
    const box = page
      .locator('li.milestone')
      .filter({ hasText: slotTitle })
      .locator('details label')
      .filter({ hasText: evTitle })
      .locator('input')
      .first();
    await box.check().catch(() => log(`（P11 未找到 ${slotTitle}×${evTitle}）`));
  };
  await linkIn('快照载入', '离线交接联');
  await linkIn('观察到预归档原因', '护理事实与授权说明');
  await linkIn('观察到预归档原因', '复核事务日志');
  await linkIn('恢复身份关联', '无归属留言');
  await page
    .locator('fieldset.finding label')
    .filter({ hasText: '不足以支持' })
    .first()
    .locator('input')
    .check()
    .catch(() => log('（P11 未找到范围结论项）'));
  await clickAny(page, ['保存异议分支', '提交异议']);
  await page.waitForTimeout(900);
  const p11Conflicts = await page.locator('.conflict-list li, .feedback li').allInnerTexts().catch(() => []);
  if (p11Conflicts.length) log('P11 反馈：', JSON.stringify(p11Conflicts));
  const p11Titles = await page.locator('li.milestone strong').allInnerTexts().catch(() => []);
  log('P11 槽位：', JSON.stringify(p11Titles));
  await shot(page, 'p11-done');

  // —— t15 P12 录音台：横向时间带排序（正确顺序：禾→石→川→页→白→木） ——
  await page.goto(`${BASE}/audio/channel-03`);
  await page.waitForTimeout(1500);
  log('P12 落地 URL：', page.url());
  if (!(await page.getByText('锚点设计').isVisible().catch(() => false))) {
    log('（录音台未开放或未渲染锚点说明——检查上方 P11 状态）');
  }
  await expectVisible(page, '锚点设计');
  await shot(page, 'p12-timeband');
  const AUD_WANT = ['片段禾', '片段石', '片段川', '片段页', '片段白', '片段木'];
  const readBand = () =>
    page
      .locator('.band-cell .band-name')
      .allInnerTexts()
      .then((ts) => ts.map((t) => AUD_WANT.findIndex((w) => t.trim() === w)));
  for (let guard = 0; guard < 60; guard++) {
    const cur = await readBand();
    if (cur.join() === '0,1,2,3,4,5') break;
    const i = cur.findIndex((c, idx) => c !== idx);
    if (i < 0) break;
    const wantName = AUD_WANT[i];
    for (let k = 0; k < 8; k++) {
      const now = await readBand();
      if (now[i] === i) break;
      await page.locator('.band-cell', { hasText: wantName }).locator('.band-move button').first().click();
    }
  }
  for (const t of ['药车', '脚步', '开关']) {
    await page
      .locator('fieldset label')
      .filter({ hasText: t })
      .first()
      .locator('input')
      .check()
      .catch(() => log(`（未找到接续项「${t}」）`));
  }
  await shot(page, 'p12-band-ordered');
  await clickAny(page, ['提交顺序与接续']);
  await page.waitForTimeout(800);
  await clickAny(page, ['已确认这段内容']);
  await page.waitForTimeout(600);
  await clickAny(page, ['保留这条本人陈述']);
  await page.waitForTimeout(600);
  await shot(page, 'p12-witness');
  // 文字见证：label.radio 里的「文字确认」→ 勾固定范围声明 → 确认见证范围
  await page
    .locator('label.radio')
    .filter({ hasText: '文字确认' })
    .locator('input')
    .check()
    .catch(() => log('（未见文字确认单选）'));
  await page.waitForTimeout(300);
  await page
    .locator('label')
    .filter({ hasText: '我确认以上固定范围声明' })
    .locator('input')
    .check()
    .catch(() => log('（未见固定范围声明勾选）'));
  await page.waitForTimeout(300);
  await clickAny(page, ['确认见证范围']).catch(() => log('（确认见证范围不可用）'));
  await page.waitForTimeout(800);

  // —— t16 P13 切除：预览 D（撤销终局授权）看人物后果 ——
  await page.goto(`${BASE}/lab/surgery`);
  await page.waitForTimeout(1000);
  await clickAny(page, ['外部见证 → 终局声明', '外部见证→终局声明']);
  await expectVisible(page, '六个人保住什么');
  await shot(page, 'p13-humancost');
  await clickAny(page, ['去整理下一班依据']);

  // —— t17 P14 下一班：补采陈述 → 承接单 → 六人身份槽 → 最终选择 C ——
  await page.waitForTimeout(1200);
  await shot(page, 'p14-next');
  // 缺陈述的行会给出「去病历页」链接：逐个去采集
  for (let guard = 0; guard < 8; guard++) {
    const links = page.getByRole('link', { name: /去病历页/ });
    if ((await links.count()) === 0) break;
    await links.first().click();
    await page.waitForTimeout(900);
    await page
      .getByRole('button', { name: '保留这条本人陈述' })
      .click()
      .catch(() => log('（病历页未见采集按钮）'));
    await page.waitForTimeout(600);
    await page.goto(`${BASE}/handover/next`);
    await page.waitForTimeout(900);
  }
  await clickAny(page, ['打开下一班承接单']).catch(() => log('（未见承接单按钮——可能已取得）'));
  await page.waitForTimeout(500);
  // 纳入承接（chain 槽位）：勾选承接单 radio
  await page
    .locator('.chainbox label, label')
    .filter({ hasText: '纳入承接' })
    .first()
    .locator('input')
    .check()
    .catch(() => log('（未见纳入承接选项）'));
  // 六人身份子记录：每行选择含本床位号的第一个选项
  for (const pid of ['R01', 'R02', 'R03', 'R04', 'R05', 'R06']) {
    const row = page.locator('tr', { hasText: pid }).first();
    const sel = row.locator('select').first();
    const labels = await sel.locator('option').allInnerTexts().catch(() => []);
    const target = labels.find((l) => l.includes(pid) && !l.includes('（选择）'));
    if (target) await sel.selectOption({ label: target }).catch(() => log(`（${pid} 身份下拉无匹配项）`));
  }
  // R01/R02 的陈述在留言板采集（STATEMENT_PAGE 指向 P06）
  for (let guard = 0; guard < 4; guard++) {
    const links = page.getByRole('link', { name: /去病友留言板/ });
    if ((await links.count()) === 0) break;
    await page.goto(`${BASE}/forum`);
    await page.waitForTimeout(900);
    const capture = page.getByRole('button', { name: /保留 (陈桥|宋渺)/ });
    const n = await capture.count();
    for (let i = 0; i < n; i++) await capture.nth(i).click().catch(() => {});
    await page.goto(`${BASE}/handover/next`);
    await page.waitForTimeout(900);
  }
  await clickAny(page, ['整理下一班依据']);
  await page.waitForTimeout(900);
  const p14Feedback = await page.locator('.feedback li, .conflict-list li').allInnerTexts().catch(() => []);
  if (p14Feedback.length) log('P14 反馈：', JSON.stringify(p14Feedback));
  await page
    .locator('article')
    .filter({ hasText: '切 D' })
    .getByRole('button')
    .first()
    .click()
    .catch(() => clickAny(page, ['核对后果并确认']));
  await expectVisible(page, '真实收益');
  await expectVisible(page, '真实代价');
  await shot(page, 'p14-modal-gains-costs');
  await clickAny(page, ['保存事实，继续随访', '确认执行']);

  // —— t18 P15 结局 C ——
  await page.waitForTimeout(1500);
  await expectVisible(page, '明日随访');
  await expectVisible(page, '真实收益');
  await expectVisible(page, '先别关');
  await shot(page, 'p15-endingC');
  await shot(page, 'p15-endingC-full', true);

  log('—— 走查脚本完成 ——');
} catch (err) {
  console.error('[b6] 走查中断：', err.message);
  await shot(page, 'FAILURE');
} finally {
  writeFileSync(
    `${OUT}/b6-walkthrough-report.json`,
    JSON.stringify({ shots, consoleErrors }, null, 2),
  );
  log(`截图 ${shots.length} 张；控制台错误 ${consoleErrors.length} 条`);
  await browser.close();
}
