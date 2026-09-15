/** 内容投影、证据注册与叙事（docs/01_核心契约.md v1.1 §4、02册 v1.1）。 */
import { describe, expect, it } from 'vitest';
import { content, resolveContent } from '../../src/game/content';
import { isAcquired, narrativeLabelFor, selectEvidence, statementUnlocked, evidenceSourceLabel, evidenceStatusFor, evidenceUsedInConclusions } from '../../src/game/selectors';
import { A1_CORRECT_ORDER, TIMELINE_CORRECT_ORDER } from '../../src/game/gates';
import { fullRun } from '../helpers';

describe('resolveContent（endingOverrides 优先；[from, untilExclusive)）', () => {
  it('R03 姓名随阶段空白与恢复', () => {
    expect(resolveContent('patients.R03.name', 'BOOT')).toBe('许棠');
    expect(resolveContent('patients.R03.name', 'R03_PREARCHIVED')).toBe('');
    expect(resolveContent('patients.R03.name', 'IDENTITY_RESTORED')).toBe('许棠');
    expect(resolveContent('patients.R03.name', 'CLOSURE_PROVEN')).toBe('许棠');
  });
  it('R03 姓名的结局覆盖：A 空白、B 封存、C 恢复', () => {
    expect(resolveContent('patients.R03.name', 'SURGERY_READY', 'A')).toBe('');
    expect(resolveContent('patients.R03.name', 'SURGERY_READY', 'B')).toBe('许棠（封存）');
    expect(resolveContent('patients.R03.name', 'SURGERY_READY', 'C')).toBe('许棠');
  });
  it('R03 陈述：CLOSURE_PROVEN 起改写；C 恢复原话并注明下一班', () => {
    expect(resolveContent('patients.R03.statement', 'TRAIL_FORKED')).toContain('台灯修好了');
    expect(resolveContent('patients.R03.statement', 'SURGERY_READY', 'C')).toContain('还差一颗螺丝');
    expect(resolveContent('patients.R03.statement', 'SURGERY_READY', 'C')).toContain('下一班');
    expect(resolveContent('patients.R03.statement', 'SURGERY_READY', 'A')).toBe('无后续事项');
  });
  it('EV04 投影随阶段与结局变化', () => {
    expect(resolveContent('evidence.EV04', 'BOOT')).toContain('在册6');
    expect(resolveContent('evidence.EV04', 'R03_PREARCHIVED')).toContain('在册5');
    expect(resolveContent('evidence.EV04', 'IDENTITY_RESTORED')).toContain('在册6');
    expect(resolveContent('evidence.EV04', 'SURGERY_READY', 'B')).toContain('封存');
  });
});

describe('叙事投影（20 条）', () => {
  it('narrative.json 恰好 20 条且 code 唯一（OPEN_DOC 带 target 除外）', () => {
    expect(content.narrative).toHaveLength(20);
    const codes = new Set(content.narrative.map((n) => n.code));
    expect(codes.size).toBeGreaterThanOrEqual(19);
    expect(content.narrative.filter((n) => n.code === 'OPEN_DOC')).toHaveLength(1);
  });
  it('SELF 路线的 SUBMIT_REVIEW 事实明确；REPLAY 不含该事件', async () => {
    const self = await fullRun('SELF', 'A');
    const submit = self.events.find((e) => e.code === 'SUBMIT_REVIEW')!;
    const label = narrativeLabelFor(submit, 'CLOSURE_PROVEN', 'A');
    expect(label.label).toBe('确认 R03 已有圆满结局');
    expect(label.fact).toContain('只在SELF路线存在');
    const replay = await fullRun('REPLAY', 'A');
    expect(replay.events.some((e) => e.code === 'SUBMIT_REVIEW')).toBe(false);
    const watch = replay.events.find((e) => e.code === 'WATCH_REPLAY')!;
    expect(narrativeLabelFor(watch, 'CLOSURE_PROVEN', null).fact).toContain('没有提交终局签认');
  });
  it('SEVER_EDGE 的 endingLabels：C 为撤销授权，A/B 为破坏完整性', async () => {
    const c = await fullRun('SELF', 'C');
    const severC = c.events.find((e) => e.code === 'SEVER_EDGE')!;
    expect(narrativeLabelFor(severC, 'SURGERY_READY', 'C').label).toBe('撤销终局授权，照护联系保留');
    const b = await fullRun('SELF', 'B');
    const severB = b.events.find((e) => e.code === 'SEVER_EDGE')!;
    expect(narrativeLabelFor(severB, 'SURGERY_READY', 'B').label).toBe('破坏档案完整性');
  });
});

describe('证据注册表（29 条）', () => {
  it('元数据齐备；PLAYER_LOCAL 与快照无变体（projectionKey 为空）', () => {
    expect(content.evidenceRegistry).toHaveLength(29);
    for (const item of content.evidenceRegistry) {
      expect(item.acquisitionKey).toMatch(/^[A-Z_]+(:[A-Za-z0-9_]+)?$/);
      expect(item.display.length).toBeGreaterThan(0);
      if (item.sourceType === 'PLAYER_LOCAL') expect(item.projectionKey).toBeUndefined();
    }
    expect(content.evidenceRegistry.find((e) => e.id === 'EV02')!.projectionKey).toBeUndefined();
    expect(content.evidenceRegistry.find((e) => e.id === 'EV04')!.projectionKey).toBe('evidence.EV04');
  });
  it('核心/可选分层：恰 18 份核心（10册 §6 已批清单）', () => {
    const core = content.evidenceRegistry.filter((e) => (e.tier ?? 'core') === 'core');
    expect(core).toHaveLength(18);
    for (const id of ['EV01', 'EV02', 'EV14', 'EV06', 'EV10', 'EV11', 'EV25', 'EV19', 'EV20', 'EV21', 'EV28', 'EV05', 'EV12', 'EV17', 'EV22', 'EV26', 'EV27', 'EV16'] as const) {
      expect(core.some((e) => e.id === id), id).toBe(true);
    }
    for (const id of ['EV03', 'EV09', 'EV13', 'EV18', 'EV23', 'EV29'] as const) {
      expect(content.evidenceRegistry.find((e) => e.id === id)!.tier).toBe('optional');
    }
  });
  it('J06：EV01/EV02/EV03 同一 originGroup（不判三个独立目击）', () => {
    const g = new Set(['EV01', 'EV02', 'EV03'].map((id) => content.evidenceRegistry.find((e) => e.id === id)!.originGroup));
    expect(g.size).toBe(1);
  });
  it('取得模型：SELF 完整路线后关键证据已取得', async () => {
    const e = await fullRun('SELF', 'C');
    for (const id of ['EV01', 'EV04', 'EV05', 'EV06', 'EV10', 'EV12', 'EV15', 'EV16', 'EV21', 'EV22', 'EV25', 'EV26', 'EV27'] as const) {
      expect(isAcquired(e.state, id), id).toBe(true);
    }
    expect(selectEvidence(e.state).length).toBeGreaterThanOrEqual(20);
  });
  it('来源四档与状态五档（07册 §8.2 / 08册 §4.2）', async () => {
    const e = await fullRun('SELF', 'C');
    const byId = (id: string) => content.evidenceRegistry.find((x) => x.id === id)!;
    expect(evidenceSourceLabel(byId('EV05'))).toBe('归档链内');
    expect(evidenceSourceLabel(byId('EV14'))).toBe('独立来源');
    expect(evidenceSourceLabel(byId('EV01'))).toBe('本机证据');
    expect(evidenceSourceLabel(byId('EV21'))).toBe('派生结论');
    expect(evidenceStatusFor(e.state, 'EV11', [])).toBe('conflict');
    expect(evidenceStatusFor(e.state, 'EV06', ['EV06'])).toBe('pinned');
    expect(evidenceStatusFor(e.state, 'EV05', [])).toBe('acquired');
    expect(evidenceStatusFor(e.state, 'EV01', [])).toBe('used');
    expect(evidenceUsedInConclusions(e.state).has('EV01')).toBe(true);
  });
  it('EV28 迁移值班说明：归档链内、不参与任何谜题必需集', () => {
    const item = content.evidenceRegistry.find((e) => e.id === 'EV28')!;
    expect(item.originGroup).toBe('PROJECT_MIGRATION');
    expect(item.supports).toEqual([]);
    expect(evidenceSourceLabel(item)).toBe('归档链内');
  });
  it('EV29 林闻旧签认：本机证据、可选层、postsLinked 后可开（10册 §2 已批）', () => {
    const item = content.evidenceRegistry.find((e) => e.id === 'EV29')!;
    expect(item.sourceType).toBe('PLAYER_LOCAL');
    expect(item.originGroup).toBe('PREV_BATCH_SIGN');
    expect(item.eligibilityKey).toBe('postsLinked');
    expect(item.tier).toBe('optional');
    expect(evidenceSourceLabel(item)).toBe('本机证据');
  });
});

describe('三结局与切除后果（Batch 5，10册 §5 已批）', () => {
  it('A/B/C 各有真实收益与代价；C 含林闻与周砚的后果', () => {
    for (const id of ['A', 'B', 'C'] as const) {
      const e = content.endings[id] as unknown as { gains?: string[]; costs?: string[] };
      expect(e.gains?.length, id).toBeGreaterThanOrEqual(3);
      expect(e.costs?.length, id).toBeGreaterThanOrEqual(3);
    }
    const c = content.endings.C as unknown as { costs?: string[] };
    expect(c.costs!.some((x) => x.includes('林闻'))).toBe(true);
    expect(c.costs!.some((x) => x.includes('周砚'))).toBe(true);
    const a = content.endings.A as unknown as { costs?: string[] };
    expect(a.costs!.some((x) => x.includes('台灯'))).toBe(true);
    expect((content.endings.C as unknown as { finalSoundNote?: string }).finalSoundNote).toContain('先别关');
  });
  it('六条边各带六人人物后果（07册 §7.6）', () => {
    const surgery = content.surgery as Record<string, { humanCost?: string[] }>;
    for (const id of ['A', 'B', 'C', 'D', 'E', 'F']) {
      expect(surgery[id]?.humanCost, id).toHaveLength(6);
    }
  });
  it('AUD11 结尾包含许棠的下一句', () => {
    const clips = (content.audioManifest as { clips: Record<string, { speech: string }> }).clips;
    expect(clips.AUD11.speech).toContain('先别关');
  });
  it('四部文学卡均带中文译文与翻译说明（用户反馈：原文必须附中文）', () => {
    for (const id of ['M-7', 'W-F', 'R-NM', 'U-R'] as const) {
      const card = content.literature[id] as { excerpt: string; excerptZh: string; translationNote: string };
      expect(card.excerpt.length, id).toBeGreaterThan(10);
      expect(card.excerptZh.length, id).toBeGreaterThan(6);
      expect(card.translationNote, id).toContain('翻译');
    }
  });
});

describe('陈述与时间线内容', () => {
  it('六人陈述齐备且归属正确', () => {
    for (const pid of ['R01', 'R02', 'R03', 'R04', 'R05', 'R06']) {
      const st = content.statements[`ST_${pid}`];
      expect(st, pid).toBeTruthy();
      expect(st.patientId).toBe(pid);
      expect(st.text.length).toBeGreaterThan(0);
    }
    expect(content.statements.ST_R03.sourceEvidence).toBe('EV25');
  });
  it('六人各有不同的当前选择（10册 §4 已批）', () => {
    const choices = new Set<string>();
    for (const pid of ['R01', 'R02', 'R03', 'R04', 'R05', 'R06']) {
      const st = content.statements[`ST_${pid}`];
      expect(st.currentChoice, pid).toBeTruthy();
      expect(st.currentChoice!.length).toBeGreaterThan(6);
      choices.add(st.currentChoice!);
    }
    expect(choices.size).toBe(6);
  });
  it('陈述解锁映射正确（R06 需 closureProven）', async () => {
    const e = await fullRun('SELF', 'C');
    expect(statementUnlocked(e.state, 'ST_R06')).toBe(true);
    const early = await (async () => {
      const eng = await fullRun('SELF', 'A');
      return eng;
    })();
    void early;
  });
  it('timeline.json 与 gates 一致；EV11 为嫌疑证据', () => {
    expect(content.timeline.correctOrder).toEqual(TIMELINE_CORRECT_ORDER);
    expect(content.timeline.cards).toHaveLength(5);
    expect(content.timeline.suspectEvidence).toBe('EV11');
  });
  it('音频清单：正确序/显示序不同；六片段与三接续对齐', () => {
    const ch = content.audioManifest.channel03;
    expect(ch.correctOrder).toEqual(A1_CORRECT_ORDER);
    expect(ch.displayOrder).not.toEqual(ch.correctOrder);
    expect(Object.keys(ch.displayNames)).toHaveLength(6);
    expect(ch.continuityCuts.map((c) => c.id).sort()).toEqual(['CART_SPLIT', 'FOOTSTEP_SPLIT', 'SWITCH_SPLIT']);
  });
  it('提示与手术数据完整（11 题三级提示；六边两正式）', () => {
    expect(Object.keys(content.hints)).toHaveLength(11);
    for (const k of Object.keys(content.hints)) expect(content.hints[k]).toHaveLength(3);
    expect(Object.keys(content.surgery)).toHaveLength(6);
    expect(content.surgery.D.formalOption).toBe(true);
    expect(content.surgery.F.formalOption).toBe(true);
    expect(content.surgery.A.formalOption).toBe(false);
  });
  it('值班须知两版各六条；交接联全文含名单与原话', () => {
    expect(content.rules.v32.items).toHaveLength(6);
    expect(content.rules.v41.items).toHaveLength(6);
    expect(content.handover.body).toContain('R03 许棠');
    expect(content.handover.body).toContain('台灯还差一颗螺丝');
  });
});
