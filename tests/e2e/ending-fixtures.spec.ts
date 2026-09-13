/** ending-fixtures（docs/04册 v1.1 §3-5）：领域引擎生成六路线结局夹具，快速回归最终面板显示。
 *  只验证 P15/P16 渲染，不替代 full-paths 的完整点击验证。 */
import { expect, test } from '@playwright/test';
import { TestEngine, fullRun } from '../helpers';
import { engineToSave, injectEngineState } from './framework';

type Cause = 'SELF' | 'REPLAY';
type Ending = 'A' | 'B' | 'C';
const COMBOS: [Cause, Ending][] = [
  ['SELF', 'A'],
  ['SELF', 'B'],
  ['SELF', 'C'],
  ['REPLAY', 'A'],
  ['REPLAY', 'B'],
  ['REPLAY', 'C'],
];

for (const [cause, ending] of COMBOS) {
  test(`结局夹具 ${cause}→${ending}：P15 面板与 P16 复盘渲染`, async ({ page }) => {
    const engine: TestEngine = await fullRun(cause, ending);
    await injectEngineState(page, engine);

    await page.goto('/arggame/#/');
    await expect(page.getByTestId('start:continue')).toBeVisible();
    await page.getByTestId('start:continue').click();

    await expect(page.getByTestId(`p15:ending--${ending}`)).toBeVisible();
    await expect(page.getByTestId('p15:ui')).toBeVisible();

    if (ending === 'C') {
      await expect(page.getByTestId('p15:followup--R03')).toContainText('许棠');
      // C 才有恢复事件：进入复盘能看到实际结局标记
      await expect(page.getByText('已恢复后续随访 6')).toBeVisible();
    }
    if (ending === 'A') {
      await expect(page.getByText('当前患者 0')).toBeVisible();
    }

    await page.getByTestId('p15:goto-debrief').click();
    await expect(page.getByTestId('p16:exit')).toBeVisible();
    await expect(page.getByText('✓ 实际结局')).toBeVisible();
  });
}

test('结局夹具不携带录音：witness 为文字时 P15 删除录音仍可操作', async ({ page }) => {
  const engine = await fullRun('SELF', 'C');
  const save = engineToSave(engine);
  save.witness = { mode: 'TEXT', canonicalText: '我只确认许棠仍在表达，不确认她的结局。', note: '', recordingId: null, recordingAvailable: false };
  const json = JSON.stringify(save);
  await page.addInitScript((s) => {
    if (!localStorage.getItem('cw-save-v2')) localStorage.setItem('cw-save-v2', s);
  }, json);
  await page.goto('/arggame/#/');
  await page.getByTestId('start:continue').click();
  await expect(page.getByTestId('p15:ending--C')).toBeVisible();
  await page.getByTestId('p15:manage').click();
  await page.getByTestId('p15:delete-recordings').click();
  await expect(page.getByTestId('p15:manage-panel')).toBeHidden();
});
