/** Batch 3 四档宽度截图（docs/08 §8.1 / docs/09 §F3）：360 / 768 / 1280 / 1440。
 *  覆盖 P05 三栏调查台、证据抽屉（含固定托盘）与留言板周砚站务帖。
 *  产物写入 gui-test-screenshots/，用于人工核对与视觉走查。 */
import { expect, test, type Page } from '@playwright/test';
import { TestEngine } from '../helpers';
import type { SaveData } from '../../src/game/types';
import { APP, engineToSave } from './framework';

/** 直接注入一份手工调整过的存档（injectEngineState 会重建并丢弃 pinned/cue 等字段）。 */
async function injectSave(page: Page, save: SaveData): Promise<void> {
  await page.addInitScript((s) => {
    if (!localStorage.getItem('cw-save-v2')) localStorage.setItem('cw-save-v2', s);
  }, JSON.stringify(save));
}

const WIDTHS = [360, 768, 1280, 1440] as const;
const OUT = 'gui-test-screenshots';

async function buildMedicationStage(): Promise<TestEngine> {
  const engine = new TestEngine();
  await engine.run({ kind: 'boot' });
  await engine.run({ kind: 'downloadHandover' });
  await engine.run({ kind: 'ackHandoverSaved' });
  await engine.run({ kind: 'ackPaperNote' });
  await engine.run({ kind: 'ackRules' });
  await engine.run({ kind: 'loadSnapshot' });
  await engine.run({ kind: 'submitReview' });
  for (const doc of ['EV05', 'EV06', 'EV07', 'EV08', 'EV09', 'EV10', 'EV11', 'EV28']) {
    await engine.run({ kind: 'openDoc', documentId: doc });
  }
  await engine.run({ kind: 'recheckSubmitted', evidenceIds: ['EV01', 'EV06'] });
  return engine;
}

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

for (const width of WIDTHS) {
  test(`P05 三栏与证据抽屉 @${width}`, async ({ page }) => {
    const engine = await buildMedicationStage();
    const save = engineToSave(engine);
    save.pinnedEvidence = ['EV01', 'EV06', 'EV11'];
    save.seenPresentationCues = ['med-shortcut']; // 截图看调查台本身，跳过助手捷径弹窗
    await page.setViewportSize({ width, height: 960 });
    await injectSave(page, save);
    await page.goto(`${APP}/medication`);
    await expect(page.getByTestId('p05:doc--EV05')).toBeVisible();
    await shot(page, `b3-p05-desk-${width}`);

    await page.getByTestId('rail:evidence-toggle').click();
    await expect(page.getByText('对照托盘')).toBeVisible();
    await shot(page, `b3-evidence-drawer-${width}`);
    // 固定托盘上限说明：三份已固定时，第四份的固定按钮不可用
    await expect(page.getByText('已固定 3/3')).toBeVisible();
  });
}

for (const width of WIDTHS) {
  test(`留言板（周砚站务帖＋林闻私信）@${width}`, async ({ page }) => {
    const engine = await buildMedicationStage();
    await engine.run({ kind: 'playAudio', audioId: 'AUD01' });
    await engine.run({ kind: 'ackAudioContent', audioId: 'AUD01', mode: 'TEXT' });
    await engine.run({ kind: 'linkIdentity', source: 'EV01' });
    await engine.run({
      kind: 'solveTimeline',
      order: ['TL_HANDOVER', 'TL_OBSERVATION', 'TL_PREFILL', 'TL_REVIEW', 'TL_RECOUNT'],
      unreliable: ['EV11'],
    });
    await engine.run({ kind: 'tagPosts', postIds: ['post_cq', 'post_sm', 'post_xt'], tags: ['theater'] });
    await page.setViewportSize({ width, height: 960 });
    await injectSave(page, engineToSave(engine));
    await page.goto(`${APP}/forum`);
    await expect(page.getByTestId('p06:post--station')).toBeVisible();
    await expect(page.getByTestId('p06:linwen-note')).toBeVisible();
    await page.getByTestId('p06:open-ev29').click();
    await expect(page.getByTestId('p06:linwen-confession')).toBeVisible();
    await shot(page, `b4-forum-${width}`);
  });
}

/** Batch 4：P07 叠合 / P08 对照 / P09 实验台。 */
async function buildTheaterStage(): Promise<TestEngine> {
  const engine = await buildMedicationStage();
  await engine.run({ kind: 'playAudio', audioId: 'AUD01' });
  await engine.run({ kind: 'ackAudioContent', audioId: 'AUD01', mode: 'TEXT' });
  await engine.run({ kind: 'linkIdentity', source: 'EV01' });
  await engine.run({
    kind: 'solveTimeline',
    order: ['TL_HANDOVER', 'TL_OBSERVATION', 'TL_PREFILL', 'TL_REVIEW', 'TL_RECOUNT'],
    unreliable: ['EV11'],
  });
  await engine.run({ kind: 'tagPosts', postIds: ['post_cq', 'post_sm', 'post_xt'], tags: ['theater'] });
  return engine;
}

for (const width of WIDTHS) {
  test(`P07 图纸叠合与 W-F @${width}`, async ({ page }) => {
    const engine = await buildTheaterStage();
    await page.setViewportSize({ width, height: 960 });
    await injectSave(page, engineToSave(engine));
    await page.goto(`${APP}/archive`);
    await page.getByTestId('p07:open-ev15').click();
    await expect(page.getByTestId('p07:view--overlay')).toBeVisible();
    await shot(page, `b4-p07-overlay-${width}`);
    // 空间匹配后 W-F 出现（无需 M-7 假说）
    await page.getByTestId('p07:pair--ward').selectOption('后台');
    await page.getByTestId('p07:pair--desk').selectOption('提词位');
    await page.getByTestId('p07:pair--seat').selectOption('观众席外席');
    await page.getByTestId('p07:submit-pairs').click();
    await expect(page.getByText('读者研究卡 W-F')).toBeVisible();
    await expect(page.getByTestId('p07:submit-p3')).toBeVisible();
    await shot(page, `b4-p07-wf-${width}`);
  });
}

async function buildCompareStage(): Promise<TestEngine> {
  const engine = await buildTheaterStage();
  await engine.run({ kind: 'openDoc', documentId: 'THEATER_MAP' });
  await engine.run({
    kind: 'matchFloorplan',
    pairs: ['ward=backend', 'station=prompter', 'terminal=outer-seat'],
  });
  await engine.run({ kind: 'linkAudience' });
  return engine;
}

for (const width of WIDTHS) {
  test(`P08 同源对照与周砚联络 @${width}`, async ({ page }) => {
    const engine = await buildCompareStage();
    await page.setViewportSize({ width, height: 960 });
    await injectSave(page, engineToSave(engine));
    await page.goto(`${APP}/compare`);
    await expect(page.getByTestId('p08:zhouyan-contact2')).toBeVisible();
    await page.getByTestId('p08:open-ev19').click();
    await page.getByTestId('p08:open-ev20').click();
    await page.getByTestId('diff:marker--TYPO').check();
    await expect(page.getByTestId('diff:inline--TYPO').first()).toHaveClass(/marked/);
    await shot(page, `b4-p08-compare-${width}`);
  });
}

async function buildExperimentStage(): Promise<TestEngine> {
  const engine = await buildCompareStage();
  await engine.run({ kind: 'openDoc', documentId: 'EV19' });
  await engine.run({ kind: 'openDoc', documentId: 'EV20' });
  await engine.run({ kind: 'proveSharedSource', markers: ['TYPO', 'SOURCE_ID'] });
  return engine;
}

for (const width of WIDTHS) {
  test(`P09 实验台（身份保留/联系断开）@${width}`, async ({ page }) => {
    const engine = await buildExperimentStage();
    await page.setViewportSize({ width, height: 960 });
    await injectSave(page, engineToSave(engine));
    await page.goto(`${APP}/lab/experiment`);
    await page.getByTestId('p09:hyp--EXTERNAL_CONFIRM').check();
    await expect(page.getByTestId('p09:hyp-note')).toBeVisible();
    for (const id of ['A', 'B', 'C', 'D', 'E', 'F'] as const) {
      await page.getByTestId(`p09:run--${id}`).click();
    }
    await expect(page.getByText('联系断开').first()).toBeVisible();
    await expect(page.getByText('身份保留').first()).toBeVisible();
    await shot(page, `b4-p09-experiment-${width}`);
  });
}

/** Batch 5：P12 时间带 / P13 人物后果 / P15 收益与代价。 */
async function buildSurgeryStage(): Promise<TestEngine> {
  const engine = await buildExperimentStage();
  await engine.run({
    kind: 'concludeExperiment',
    labelPair: ['B', 'D'],
    scopePair: ['B', 'F'],
    changed: ['endingLabel', 'externalConfirm'],
  });
  await engine.run({ kind: 'inspectSlice' });
  await engine.run({
    kind: 'forkTrail',
    order: ['SNAPSHOT_LOADED', 'REVIEW_CAUSE_OBSERVED', 'IDENTITY_LINKED'],
    links: { SNAPSHOT_LOADED: ['EV01'], REVIEW_CAUSE_OBSERVED: ['EV05', 'EV10'], IDENTITY_LINKED: ['EV12'] },
  });
  await engine.run({
    kind: 'solveAudioOrder',
    order: ['AUD02', 'AUD03', 'AUD04', 'AUD05', 'AUD06', 'AUD07'],
    anchorPairs: ['CART_SPLIT', 'FOOTSTEP_SPLIT', 'SWITCH_SPLIT'],
  });
  await engine.run({ kind: 'ackAudioContent', audioId: 'CHANNEL_03_FULL', mode: 'TEXT' });
  await engine.run({ kind: 'witnessScope', mode: 'TEXT', recordingId: null });
  return engine;
}

for (const width of WIDTHS) {
  test(`P12 横向时间带＋锚点说明 @${width}`, async ({ page }) => {
    const engine = await buildExperimentStage();
    await engine.run({
      kind: 'concludeExperiment',
      labelPair: ['B', 'D'],
      scopePair: ['B', 'F'],
      changed: ['endingLabel', 'externalConfirm'],
    });
    await engine.run({ kind: 'inspectSlice' });
    await engine.run({
      kind: 'forkTrail',
      order: ['SNAPSHOT_LOADED', 'REVIEW_CAUSE_OBSERVED', 'IDENTITY_LINKED'],
      links: { SNAPSHOT_LOADED: ['EV01'], REVIEW_CAUSE_OBSERVED: ['EV05', 'EV10'], IDENTITY_LINKED: ['EV12'] },
    });
    await page.setViewportSize({ width, height: 960 });
    await injectSave(page, engineToSave(engine));
    await page.goto(`${APP}/audio/channel-03`);
    await expect(page.getByText('锚点设计')).toBeVisible();
    await page.getByTestId('p12:band--AUD02').waitFor();
    await shot(page, `b5-p12-timeband-${width}`);
  });
}

for (const width of WIDTHS) {
  test(`P13 切除人物后果 @${width}`, async ({ page }) => {
    const engine = await buildSurgeryStage();
    await page.setViewportSize({ width, height: 960 });
    await injectSave(page, engineToSave(engine));
    await page.goto(`${APP}/lab/surgery`);
    await page.getByTestId('p13:edge--D').click();
    await expect(page.getByTestId('p13:humancost--D')).toBeVisible();
    await expect(page.getByText('六个人保住什么')).toBeVisible();
    await shot(page, `b5-p13-humancost-${width}`);
  });
}

for (const width of WIDTHS) {
  for (const ending of ['A', 'C'] as const) {
    test(`P15 结局${ending} 收益与代价 @${width}`, async ({ page }) => {
      const engine = await buildSurgeryStage();
      await engine.run({ kind: 'openDoc', documentId: 'EV14' });
      await engine.run({ kind: 'openDoc', documentId: 'EV27' });
      for (const pid of ['R01', 'R02', 'R03', 'R04', 'R05', 'R06'] as const) {
        await engine.run({ kind: 'captureStatement', patientId: pid, statementId: `ST_${pid}` as 'ST_R01' });
      }
      await engine.run({ kind: 'severPreview', edge: ending === 'C' ? 'D' : 'F' });
      if (ending === 'C') await engine.run({ kind: 'severPreview', edge: 'F' });
      await engine.run({
        kind: 'assembleNextVisit',
        slots: {
          identity: Object.fromEntries(['R01', 'R02', 'R03', 'R04', 'R05', 'R06'].map((p) => [p, `EV01#${p}`])),
          intent: Object.fromEntries(['R01', 'R02', 'R03', 'R04', 'R05', 'R06'].map((p) => [p, `ST_${p}`])),
          chain: 'EV27#NEXT_SHIFT',
        },
      });
      await engine.run({ kind: 'chooseEnding', ending });
      await page.setViewportSize({ width, height: 960 });
      await injectSave(page, engineToSave(engine));
      await page.goto(`${APP}/`);
      await page.getByTestId('start:continue').click();
      await expect(page.getByTestId(`p15:ending--${ending}`)).toBeVisible();
      await expect(page.getByText('真实收益')).toBeVisible();
      await expect(page.getByText('真实代价')).toBeVisible();
      await shot(page, `b5-p15-ending${ending}-${width}`);
    });
  }
}
