/** 纵切真实点击路线（docs/04册 v1.1 Playwright 路径 1）：
 *  SELF 用本地文件确认、REPLAY 用只读快照；AUD01 文字确认；恢复许棠。 */
import { expect, test } from '@playwright/test';
import { app } from './framework';

test.describe('纵切 SELF 路线（本地文件确认）', () => {
  test('P00→P05：新局→签认→复查→文字确认→恢复许棠', async ({ page }) => {
    await app.gotoStart(page);
    await app.startNewSession(page);
    await app.secureHandoverByFile(page);
    await app.ackRules(page);

    // P02：六行，在册 6
    await app.expectCount(page, 6);
    expect((await app.patientRows(page)).length).toBe(6);

    // P04：SELF 签认 → 在册 5、R03 空白、搜索许棠 0 条
    await app.submitReview(page);
    await app.expectCount(page, 5);
    await expect(page.getByTestId('p02:patient-row--R03')).toHaveAttribute(
      'aria-label',
      '记录关联缺失',
    );
    await app.search(page, '许棠');
    await expect(page.getByText('0 条记录')).toBeVisible();

    // 叙事轨迹：SELF 的提交与系统改写
    await app.openTrail(page);
    await expect(page.getByTestId('trail:drawer-toggle')).toBeVisible();
    await page.getByTestId('trail:close').click();

    // P05：助手捷径（跳过）→ 取证 → p1 → AUD01 文字确认 → 恢复
    await page.getByTestId('p02:goto-medication').click();
    await app.skipAssistantShortcut(page);
    await app.openEvidence(page, 'EV06');
    await app.openEvidence(page, 'EV07');
    await app.solveP1(page, ['EV01', 'EV06']);
    await app.ackAud01ByText(page);
    await app.restoreIdentity(page);

    // 回 P02：六行恢复、许棠可搜索
    await page.goto('/arggame/#/followup');
    await app.expectCount(page, 6);
    await app.search(page, '许棠');
    await expect(page.getByText('1 条记录')).toBeVisible();
    await expect(page.getByTestId('p02:patient-row--R03')).toContainText('许棠');
  });
});

test.describe('纵切 REPLAY 路线（只读快照）', () => {
  test('P00→P05：拒签→观看W06回放→同一复查流程→恢复许棠', async ({ page }) => {
    await app.gotoStart(page);
    await app.startNewSession(page);
    await app.secureHandoverBySnapshot(page);
    await app.ackRules(page);
    await app.expectCount(page, 6);

    // P04：拒签 → 历史回放（W06）→ 预归档同样发生
    await app.watchReplay(page);
    await app.expectCount(page, 5);
    await app.search(page, '许棠');
    await expect(page.getByText('0 条记录')).toBeVisible();

    // 轨迹中存在“观看W06历史复核回放”，且明确没有提交终局签认
    await app.openTrail(page);
    await expect(page.getByText('观看W06历史复核回放').first()).toBeVisible();
    await page.getByTestId('trail:close').click();

    // P05：复查 → p1（EV02 快照路线）→ 恢复（依据快照）
    await page.getByTestId('p02:goto-medication').click();
    await app.skipAssistantShortcut(page);
    await app.openEvidence(page, 'EV06');
    await app.openEvidence(page, 'EV07');
    await app.solveP1(page, ['EV02', 'EV06']);
    await app.ackAud01ByText(page);
    await app.restoreIdentity(page, 'EV02');

    await page.goto('/arggame/#/followup');
    await app.expectCount(page, 6);
    await expect(page.getByTestId('p02:patient-row--R03')).toContainText('许棠');
  });
});
