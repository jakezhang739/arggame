/** 音频资产与播放器（docs/04册 §2 T30）：资产可达、波形/字幕渲染、点击出声路径与降级路径共存。 */
import { expect, test } from '@playwright/test';
import { TestEngine } from '../helpers';
import { injectEngineState } from './framework';

const AUDIOS = [
  'AUD01',
  'AUD02',
  'AUD03',
  'AUD04',
  'AUD05',
  'AUD06',
  'AUD07',
  'AUD08',
  'AUD09',
  'AUD10',
  'AUD11',
  'CHANNEL_03_FULL',
];

for (const id of AUDIOS) {
  test(`资产可加载：${id}.wav`, async ({ request }) => {
    const res = await request.get(`/arggame/audio/${id}.wav`);
    expect(res.status()).toBe(200);
  });
}

test('P05 AUD01：波形渲染、点击播放不进入不可用降级', async ({ page }) => {
  const engine = new TestEngine();
  await engine.run({ kind: 'boot' });
  await engine.run({ kind: 'ackHandoverSaved' });
  await engine.run({ kind: 'ackRules' });
  await engine.run({ kind: 'loadSnapshot' });
  await engine.run({ kind: 'submitReview' });
  await engine.run({ kind: 'openDoc', documentId: 'EV06' });
  await injectEngineState(page, engine);

  await page.goto('/arggame/#/medication');
  await page.getByTestId('p05:skip-fix').click();
  await page.waitForTimeout(200);
  await page.getByTestId('p05:ev--EV06').check();
  await page.getByTestId('p05:ev--EV01').check();
  await page.getByTestId('p05:anomaly--IDENTITY_INDEX').check();
  await page.getByTestId('p05:submit-p1').click();
  await expect(page.getByTestId('p05:p1-done')).toBeVisible();

  const frag = page.getByTestId('audio:frag--AUD01');
  await expect(frag).toBeVisible();
  await expect(frag.locator('.bar').first()).toBeVisible(); // 波形（真实峰值）
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.getByTestId('audio:play--AUD01').click();
  await page.waitForTimeout(1200);
  // 无头环境可能拒绝播放：此时必须走字幕等价降级（设计行为），页面不得报错
  await expect(page.getByTestId('audio:caption-list--AUD01')).toBeVisible();
  expect(errors).toEqual([]);
});

test('P12 片段：锚点层与字幕同时存在（不听声可解）', async ({ page }) => {
  const engine = new TestEngine();
  // 快进到 TRAIL_FORKED：借助 fullRun 截断不可行，直接按命令序列
  const e = engine;
  await e.run({ kind: 'boot' });
  await e.run({ kind: 'ackHandoverSaved' });
  await e.run({ kind: 'ackRules' });
  await e.run({ kind: 'loadSnapshot' });
  await e.run({ kind: 'submitReview' });
  for (const doc of ['EV05', 'EV06', 'EV07', 'EV10']) {
    await e.run({ kind: 'openDoc', documentId: doc });
  }
  await e.run({ kind: 'recheckSubmitted', evidenceIds: ['EV01', 'EV06'] });
  await e.run({ kind: 'ackAudioContent', audioId: 'AUD01', mode: 'TEXT' });
  await e.run({ kind: 'linkIdentity', source: 'EV01' });
  await e.run({
    kind: 'solveTimeline',
    order: ['TL_HANDOVER', 'TL_OBSERVATION', 'TL_PREFILL', 'TL_REVIEW', 'TL_RECOUNT'],
    unreliable: ['EV11'],
  });
  await e.run({ kind: 'tagPosts', postIds: ['R01', 'R02', 'R03'], tags: ['地点', '结构', '角色'] });
  await e.run({ kind: 'openDoc', documentId: 'THEATER_MAP' });
  await e.run({ kind: 'matchFloorplan', pairs: ['WARD=后台', 'DESK=提词位', 'SEAT=外席'] });
  await e.run({ kind: 'openDoc', documentId: 'EV17' });
  await e.run({ kind: 'inferMasque', evidenceIds: ['EV16', 'EV17'] });
  await e.run({ kind: 'linkAudience' });
  await e.run({ kind: 'proveSharedSource', markers: ['TYPO', 'SOURCE_ID'] });
  await e.run({ kind: 'openDoc', documentId: 'EV22' });
  await e.run({ kind: 'inferRefrain', evidenceIds: ['EV21', 'EV22'] });
  await e.run({
    kind: 'concludeExperiment',
    labelPair: ['B', 'D'],
    scopePair: ['B', 'F'],
    changed: ['endingLabel', 'externalConfirm'],
  });
  await e.run({ kind: 'inspectSlice' });
  await e.run({
    kind: 'forkTrail',
    order: ['SNAPSHOT_LOADED', 'REVIEW_CAUSE_OBSERVED', 'IDENTITY_LINKED'],
    links: { SNAPSHOT_LOADED: ['EV01'], REVIEW_CAUSE_OBSERVED: ['EV05', 'EV10'], IDENTITY_LINKED: ['EV12'] },
  });
  await injectEngineState(page, e);

  await page.goto('/arggame/#/audio/channel-03');
  const frag = page.getByTestId('audio:frag--AUD02');
  await expect(frag).toBeVisible();
  await expect(frag.locator('.anchor')).toContainText('CART_SPLIT'); // 跨切点锚点
  await expect(page.getByTestId('audio:caption-list--AUD02')).toBeVisible();
});
