/** 统一 E2E 框架：领域引擎造态 + localStorage 注入 + 高层页面对象助手。
 *  状态由与单元测试同一套 planCommand/reducer 生成（单一真相源），注入后走真实 UI 点击。 */
import { expect, type Page } from '@playwright/test';
import { TestEngine } from '../helpers';
import type { SaveData } from '../../src/game/types';

export const APP = '/arggame/#';

export function engineToSave(engine: TestEngine): SaveData {
  const last = engine.events.at(-1);
  return {
    kind: 'CW_SAVE',
    schemaVersion: 3,
    contentVersion: '1.2',
    sessionId: engine.sessionId,
    revision: 1,
    startedAtMs: Date.now(),
    savedAtMs: Date.now(),
    elapsedActiveMs: last?.elapsedMs ?? 0,
    lastRoute: '',
    hashAlgorithm: 'sha-256',
    events: engine.events,
    pinnedEvidence: [],
    drafts: {
      timelineOrder: [],
      trailOrder: [],
      trailLinks: {},
      audioOrder: [],
      audioAnchorPairs: [],
      experimentSelection: { labelPair: [], scopePair: [] },
      nextVisitSlots: { identity: {}, intent: {}, chain: null },
      semanticSelections: {},
    },
    witness: null,
    seenPresentationCues: [],
  };
}

export async function injectEngineState(page: Page, engine: TestEngine): Promise<void> {
  const json = JSON.stringify(engineToSave(engine));
  // 一次性引导：仅当本上下文尚无存档时注入，避免 reload 时覆盖 UI 已写入的进度
  await page.addInitScript((s) => {
    if (!localStorage.getItem('cw-save-v2')) {
      localStorage.setItem('cw-save-v2', s);
    }
  }, json);
}

export type Milestone = 'prearchived-self' | 'prearchived-replay' | 'identity-restored';

/** 用领域命令构造关键里程碑状态（SELF/REPLAY 两类触发来源）。 */
export async function engineAt(milestone: Milestone): Promise<TestEngine> {
  const e = new TestEngine();
  await e.run({ kind: 'boot' });
  await e.run({ kind: 'downloadHandover' });
  if (milestone === 'prearchived-self' || milestone === 'identity-restored') {
    await e.run({ kind: 'ackHandoverSaved' });
  } else {
    await e.run({ kind: 'openSnapshot' });
  }
  await e.run({ kind: 'ackRules' });
  await e.run({ kind: 'loadSnapshot' });
  await e.run(
    milestone === 'prearchived-replay' ? { kind: 'watchReplay' } : { kind: 'submitReview' },
  );
  if (milestone === 'prearchived-self' || milestone === 'prearchived-replay') {
    for (const doc of ['EV06', 'EV07']) {
      await e.run({ kind: 'openDoc', documentId: doc });
    }
  }
  if (milestone === 'identity-restored') {
    for (const doc of ['EV05', 'EV06', 'EV07']) {
      await e.run({ kind: 'openDoc', documentId: doc });
    }
    await e.run({ kind: 'recheckSubmitted', evidenceIds: ['EV01', 'EV06'] });
    await e.run({ kind: 'ackAudioContent', audioId: 'AUD01', mode: 'TEXT' });
    await e.run({ kind: 'linkIdentity', source: 'EV01' });
  }
  return e;
}

// —— 高层页面对象：全部通过真实点击/输入完成 ——

export const app = {
  async gotoStart(page: Page): Promise<void> {
    await page.goto(`${APP}/`);
    await expect(page.getByTestId('start:new')).toBeVisible();
  },

  async startNewSession(page: Page): Promise<void> {
    await page.getByTestId('start:new').click();
    await expect(page.getByTestId('migration:download')).toBeVisible();
  },

  /** P01 路线 A：发起下载 + 确认本地文件（EV01）。 */
  async secureHandoverByFile(page: Page): Promise<void> {
    await page.getByTestId('migration:download').click();
    await page.getByTestId('migration:ack-saved').click();
    await expect(page.getByText('✓ 副本已确认')).toBeVisible();
  },

  /** P01 路线 B：只读快照（EV02）。 */
  async secureHandoverBySnapshot(page: Page): Promise<void> {
    await page.getByTestId('migration:snapshot').click();
    await expect(page.getByText('✓ 副本已确认')).toBeVisible();
  },

  async ackRules(page: Page): Promise<void> {
    for (let i = 0; i < 6; i++) {
      await page.getByTestId(`migration:rule--${i}`).check();
    }
    await page.getByTestId('migration:enter').click();
    await expect(page.getByTestId('p02:list-title')).toBeVisible();
  },

  async expectCount(page: Page, n: number): Promise<void> {
    await expect(page.getByTestId('p02:count')).toHaveText(String(n));
  },

  async patientRows(page: Page): Promise<string[]> {
    return page.locator('[data-testid^="p02:patient-row--"]').evaluateAll((els) =>
      els.map((e) => e.getAttribute('data-testid')?.replace('p02:patient-row--', '') ?? ''),
    );
  },

  async search(page: Page, q: string): Promise<void> {
    await page.getByTestId('p02:search').fill(q);
  },

  /** P04：SELF 提交（二次确认）。 */
  async submitReview(page: Page): Promise<void> {
    await page.getByTestId('p02:goto-review').click();
    await page.getByTestId('p04:submit-review').click();
    await page.getByTestId('p04:confirm-submit').click();
    await expect(page.getByTestId('p02:prearchive-notice')).toBeVisible();
  },

  /** P04：REPLAY 拒签并观看历史回放。 */
  async watchReplay(page: Page): Promise<void> {
    await page.getByTestId('p02:goto-review').click();
    await page.getByTestId('p04:refuse').click();
    await page.getByTestId('p04:watch-replay').click();
    await expect(page.getByTestId('p02:prearchive-notice')).toBeVisible();
  },

  /** P05：跳过归档助手的数量修正。 */
  async skipAssistantShortcut(page: Page): Promise<void> {
    await page.getByTestId('p05:skip-fix').click();
    await expect(page.getByTestId('p05:skip-fix')).toBeHidden();
    await page.waitForTimeout(150); // 等待异步命令与持久化落定
  },

  async openEvidence(page: Page, id: string): Promise<void> {
    await page.getByTestId(`p05:open--${id}`).click();
    await expect(page.getByTestId(`p05:doc--${id}`)).toContainText('✓ 已取得');
  },

  async solveP1(page: Page, evidence: string[]): Promise<void> {
    await page.getByTestId('p05:anomaly--IDENTITY_INDEX').check();
    for (const id of evidence) {
      await page.getByTestId(`p05:ev--${id}`).check();
    }
    await page.getByTestId('p05:submit-p1').click();
    await expect(page.getByTestId('p05:p1-done')).toBeVisible();
  },

  async ackAud01ByText(page: Page): Promise<void> {
    await page.getByTestId('p05:transcript').click();
    await expect(page.locator('p.transcript')).toContainText('你那边的交接联，还写着名字吗？');
    await page.getByTestId('p05:ack-aud01').click();
    await expect(page.getByText('林闻的留言已保存为证据')).toBeVisible();
  },

  async restoreIdentity(page: Page, source?: 'EV01' | 'EV02'): Promise<void> {
    if (source) {
      await page.getByTestId(`p05:restore-source--${source}`).check();
    }
    await page.getByTestId('p05:submit-restore').click();
    await expect(page.getByText('R03／许棠的关联已按原始交接恢复')).toBeVisible();
  },

  /** 把时间线排成正确顺序（读 DOM 当前序，用上移按钮冒泡到位）。 */
  async reorderTimeline(page: Page, target: string[]): Promise<void> {
    for (let guard = 0; guard < 60; guard++) {
      const current = await page
        .locator('[data-testid^="p05:tl--TL_"]')
        .evaluateAll((els) =>
          els.map((e) => e.getAttribute('data-testid')?.replace('p05:tl--', '') ?? ''),
        );
      if (current.join() === target.join()) return;
      const i = current.findIndex((id, idx) => id !== target[idx]);
      if (i < 0) return;
      const want = target[i];
      const j = current.indexOf(want);
      for (let k = 0; k < j - i; k++) {
        await page.getByTestId(`p05:tl-up--${want}`).click();
      }
    }
    throw new Error('时间线重排未收敛');
  },

  async openTrail(page: Page): Promise<void> {
    await page.getByTestId('trail:drawer-toggle').click();
  },

  // —— M2：后段页面对象（同样全部真实点击）——

  /** P03：打开 R03 护理事实（EV05，p6 需要）。 */
  async openEv05(page: Page): Promise<void> {
    await page.goto(`${APP}/followup/patient/R03`);
    await page.getByTestId('p03:open-ev05').click();
    await expect(page.getByText('✓ 护理事实与授权说明（EV05）已取得')).toBeVisible();
  },

  /** P03：保留指定患者的当前陈述。 */
  async captureOnP03(page: Page, pid: string): Promise<void> {
    await page.goto(`${APP}/followup/patient/${pid}`);
    await page.getByTestId(`p03:capture--${pid}`).click();
    await expect(page.getByText(`✓ 已保留这条本人陈述（ST_${pid}）`)).toBeVisible();
  },

  /** P06：打开原始数据并完成三帖关联。 */
  async solveForumTagging(page: Page): Promise<void> {
    await page.goto(`${APP}/forum`);
    await page.getByTestId('p06:open-ev14').click();
    await expect(page.getByText('已取得：《梦境帖》原始数据')).toBeVisible();
    for (const pid of ['R01', 'R02', 'R03']) {
      await page.getByTestId(`p06:post-check--${pid}`).check();
    }
    for (const tag of ['地点', '结构', '角色']) {
      await page.getByTestId(`p06:tag--${tag}`).check();
    }
    await page.getByTestId('p06:submit-tag').click();
    await expect(page.getByTestId('p06:linked-done')).toBeVisible();
  },

  /** P07：两图配对 + p3 三联 + EV18（M-7 已降为可选短材料，不再是主线谜题）。 */
  async solveArchive(page: Page, cause: 'SELF' | 'REPLAY'): Promise<void> {
    await page.goto(`${APP}/archive`);
    await page.getByTestId('p07:open-ev15').click();
    await page.getByTestId('p07:pair--ward').selectOption('后台');
    await page.getByTestId('p07:pair--desk').selectOption('提词位');
    await page.getByTestId('p07:pair--seat').selectOption('观众席外席');
    await page.getByTestId('p07:submit-pairs').click();
    await expect(page.getByText('✓ 空间匹配完成')).toBeVisible();

    await page.getByTestId('p07:p3-action').selectOption('AFFIRM_ENDING');
    await page.getByTestId('p07:p3-seat').selectOption('SEAT_W07');
    await page.getByTestId('p07:p3-cause').selectOption(cause);
    await page.getByTestId('p07:submit-p3').click();
    await expect(page.getByText('✓ 剧场关系已确认')).toBeVisible();
    await page.getByTestId('p07:open-ev18').click();
    await expect(page.getByText('《第七份记录》已取得')).toBeVisible();
  },

  /** P08：p4 标记（R-NM 已降为可选解释卡，不再是通关门槛）。 */
  async solveCompare(page: Page): Promise<void> {
    await page.goto(`${APP}/compare`);
    await page.getByTestId('p08:open-ev19').click();
    await page.getByTestId('p08:open-ev20').click();
    await page.getByTestId('diff:marker--TYPO').check();
    await page.getByTestId('diff:marker--SOURCE_ID').check();
    await page.getByTestId('p08:submit-p4').click();
    await expect(page.getByTestId('p08:p4-done')).toBeVisible();
    await page.getByTestId('p08:open-ev22').click();
    await expect(page.getByText('《终止接口捕获日志》已取得')).toBeVisible();
  },

  /** P09：跑指定配置并提交正确结论（B+D / B+F / 双变量）。 */
  async solveExperiment(page: Page, runIds: string[]): Promise<void> {
    await page.goto(`${APP}/lab/experiment`);
    for (const id of runIds) {
      await page.getByTestId(`p09:run--${id}`).click();
      await expect(page.getByTestId(`p09:row--${id}`)).toBeVisible();
    }
    for (const id of ['B', 'D']) await page.getByTestId(`p09:label--${id}`).check();
    for (const id of ['B', 'F']) await page.getByTestId(`p09:scope--${id}`).check();
    await page.getByTestId('p09:changed--endingLabel').check();
    await page.getByTestId('p09:changed--externalConfirm').check();
    await page.getByTestId('p09:submit-p5').click();
    await expect(page.getByText('✓ 实验结论已成立')).toBeVisible();
  },

  /** P10：放大并确认授权句。 */
  async solveSlices(page: Page): Promise<void> {
    await page.goto(`${APP}/lab/slices`);
    await page.getByTestId('p10:magnify').click();
    await page.getByTestId('p10:inspect').click();
    await expect(page.getByText('✓ EV24 已取得')).toBeVisible();
  },

  /** P11：三槽排序 + 证据链接 + 范围结论。base = 路线的名单基线证据。 */
  async solveTrailObjection(page: Page, base: 'EV01' | 'EV02'): Promise<void> {
    await page.goto(`${APP}/trail`);
    const target = ['SNAPSHOT_LOADED', 'REVIEW_CAUSE_OBSERVED', 'IDENTITY_LINKED'];
    for (let guard = 0; guard < 30; guard++) {
      const current = await page
        .locator('[data-testid^="p11:slot--"]')
        .evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')?.replace('p11:slot--', '') ?? ''));
      if (current.join() === target.join()) break;
      const i = current.findIndex((id, idx) => id !== target[idx]);
      const want = target[i];
      for (let k = 0; k < current.indexOf(want) - i; k++) {
        await page.getByTestId(`p11:up--${want}`).click();
      }
    }
    await page.getByTestId(`p11:link--SNAPSHOT_LOADED--${base}`).check();
    await page.getByTestId('p11:link--REVIEW_CAUSE_OBSERVED--EV05').check();
    await page.getByTestId('p11:link--REVIEW_CAUSE_OBSERVED--EV10').check();
    await page.getByTestId('p11:link--IDENTITY_LINKED--EV12').check();
    await page.getByTestId('p11:finding--UNSUPPORTED_ENDING').check();
    await page.getByTestId('p11:submit').click();
    await expect(page.getByText('✓ 异议分支已保存')).toBeVisible();
  },

  /** P12：a1 排序 + 接续对 + 完整录音确认 + ST_R03 + 文字见证。 */
  async solveAudioConsole(page: Page): Promise<void> {
    await page.goto(`${APP}/audio/channel-03`);
    const target = ['AUD02', 'AUD03', 'AUD04', 'AUD05', 'AUD06', 'AUD07'];
    for (let guard = 0; guard < 60; guard++) {
      const current = await page
        .locator('[data-testid^="p12:frag--"]')
        .evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')?.replace('p12:frag--', '') ?? ''));
      if (current.join() === target.join()) break;
      const i = current.findIndex((id, idx) => id !== target[idx]);
      const want = target[i];
      for (let k = 0; k < current.indexOf(want) - i; k++) {
        await page.getByTestId(`p12:up--${want}`).click();
      }
    }
    for (const anchor of ['CART_SPLIT', 'FOOTSTEP_SPLIT', 'SWITCH_SPLIT']) {
      await page.getByTestId(`p12:anchor--${anchor}`).check();
    }
    await page.getByTestId('p12:submit-a1').click();
    await expect(page.getByText('完整交班（按正确顺序重组）')).toBeVisible();

    await page.getByTestId('p12:ack-full').click();
    await expect(page.getByText('许棠的当前意愿（ST_R03）')).toBeVisible();
    await page.getByTestId('p12:capture-r03').click();
    await expect(page.getByText('✓ ST_R03 已保留')).toBeVisible();

    await page.getByTestId('witness:text-ok').check();
    await page.getByTestId('witness:confirm').click();
    await expect(page.getByTestId('p12:scope-ok')).toBeVisible();
  },

  /** P13：预览指定边。 */
  async previewEdges(page: Page, edges: string[]): Promise<void> {
    await page.goto(`${APP}/lab/surgery`);
    for (const e of edges) {
      await page.getByTestId(`p13:edge--${e}`).click();
      await expect(page.getByTestId(`p13:preview--${e}`)).toBeVisible();
    }
  },

  /** P14：装槽（base 路线的身份子记录）→ 组装 → 选结局。 */
  async solveNextHandover(page: Page, base: 'EV01' | 'EV02', ending: 'A' | 'B' | 'C'): Promise<void> {
    await page.goto(`${APP}/handover/next`);
    for (const pid of ['R01', 'R02', 'R03', 'R04', 'R05', 'R06']) {
      await page.getByTestId(`p14:identity--${pid}`).selectOption(`${base}#${pid}`);
    }
    await page.getByTestId('p14:open-ev27').click();
    await page.getByTestId('p14:chain').check();
    await page.getByTestId('p14:assemble').click();
    await expect(page.getByTestId('p14:ready')).toBeVisible();

    await page.getByTestId(`p14:choose--${ending}`).click();
    await page.getByTestId(`p14:modal--${ending}`).waitFor();
    await page.getByTestId('p14:modal-confirm').click();
    await expect(page.getByTestId(`p15:ending--${ending}`)).toBeVisible();
  },

  /** 通用列表重排（上移冒泡）。 */
  async reorderList(page: Page, itemPrefix: string, upPrefix: string, target: string[]): Promise<void> {
    for (let guard = 0; guard < 60; guard++) {
      const current = await page
        .locator(`[data-testid^="${itemPrefix}"]`)
        .evaluateAll(
          (els, prefix) => els.map((e) => e.getAttribute('data-testid')?.slice(prefix.length) ?? ''),
          itemPrefix,
        );
      if (current.join() === target.join()) return;
      const i = current.findIndex((id, idx) => id !== target[idx]);
      if (i < 0) return;
      const want = target[i];
      for (let k = 0; k < current.indexOf(want) - i; k++) {
        await page.getByTestId(`${upPrefix}${want}`).click();
      }
    }
    throw new Error('列表重排未收敛');
  },
};
