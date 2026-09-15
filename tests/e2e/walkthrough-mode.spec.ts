import { expect, test, type Page } from '@playwright/test';
import { TestEngine } from '../helpers';
import type { SaveData } from '../../src/game/types';
import { APP, engineToSave } from './framework';

const SETTINGS_ON = JSON.stringify({ subtitles: true, volume: 0.8, textScale: 1, reducedMotion: 'follow-system', walkthrough: true });

async function inject(page: Page, save: SaveData): Promise<void> {
  await page.addInitScript(
    (args) => {
      if (!localStorage.getItem('cw-save-v2')) localStorage.setItem('cw-save-v2', args.save);
      if (!localStorage.getItem('cw-settings-v1')) localStorage.setItem('cw-settings-v1', args.settings);
    },
    { save: JSON.stringify(save), settings: SETTINGS_ON },
  );
}

test('测试模式：P05 提示面板自动展开答案', async ({ page }) => {
  const engine = new TestEngine();
  await engine.run({ kind: 'boot' });
  await engine.run({ kind: 'downloadHandover' });
  await engine.run({ kind: 'ackHandoverSaved' });
  await engine.run({ kind: 'ackPaperNote' });
  await engine.run({ kind: 'ackRules' });
  await engine.run({ kind: 'loadSnapshot' });
  await engine.run({ kind: 'submitReview' });
  const save = engineToSave(engine);
  save.seenPresentationCues = ['med-shortcut'];
  await page.setViewportSize({ width: 1280, height: 960 });
  await inject(page, save);
  await page.goto(`${APP}/medication`);
  await expect(page.getByTestId('p05:doc--EV05')).toBeVisible();
  await expect(page.getByTestId('walkthrough:answer').first()).toBeVisible();
  await expect(page.getByText('答案（测试模式）').first()).toBeVisible();
  await expect(page.getByText('身份索引异常').first()).toBeVisible();
  await page.screenshot({ path: 'gui-test-screenshots/issue-walkthrough-mode-p05.png', fullPage: true });
});

test('测试模式：P06 通关提示卡显示', async ({ page }) => {
  const engine = new TestEngine();
  await engine.run({ kind: 'boot' });
  await engine.run({ kind: 'downloadHandover' });
  await engine.run({ kind: 'ackHandoverSaved' });
  await engine.run({ kind: 'ackPaperNote' });
  await engine.run({ kind: 'ackRules' });
  await engine.run({ kind: 'loadSnapshot' });
  await engine.run({ kind: 'submitReview' });
  await engine.run({ kind: 'recheckSubmitted', evidenceIds: ['EV01', 'EV06'] });
  await engine.run({ kind: 'ackAudioContent', audioId: 'AUD01', mode: 'TEXT' });
  await engine.run({ kind: 'linkIdentity', source: 'EV01' });
  await page.setViewportSize({ width: 1280, height: 960 });
  await inject(page, engineToSave(engine));
  await page.goto(`${APP}/forum`);
  await expect(page.getByTestId('p06:post--station')).toBeVisible();
  await expect(page.getByTestId('walkthrough:hint').first()).toBeVisible();
  await page.screenshot({ path: 'gui-test-screenshots/issue-walkthrough-mode-p06.png' });
});
