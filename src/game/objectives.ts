import type { GameState } from './types';

export interface CurrentObjective {
  chapter: string;
  step: string;
  title: string;
  description: string;
  action: string;
  route: string;
  progress: number;
  tone: 'normal' | 'warning' | 'anomaly';
}

/** 玩家层任务语言。内部阶段与谜题编号不在这里暴露。 */
export function currentObjective(state: GameState): CurrentObjective {
  const f = state.facts;

  if (state.ending) {
    return {
      chapter: '值班结束', step: '已完成', title: '查看本次复核结果',
      description: '案件已经落入一个确定结果。你仍可回看证据与调查经过。',
      action: '返回结局', route: `/ending/${state.ending}`, progress: 100, tone: 'normal',
    };
  }
  if (!f.handoverSecured) {
    return {
      chapter: '夜班交接', step: '准备 1/2', title: '保留复核前的原始名单',
      description: '在线记录可能在迁移后更新。先留一份不会被在线摘要覆盖的副本。',
      action: '保存原始记录', route: '/migration', progress: 4, tone: 'normal',
    };
  }
  if (!f.rulesAcknowledged) {
    return {
      chapter: '夜班交接', step: '准备 2/2', title: '确认今晚的复核边界',
      description: '只记三件事：冲突不能抹平、提交前看范围、本人没说过的结论先留空。',
      action: '完成交接', route: '/migration', progress: 8, tone: 'normal',
    };
  }
  if (!f.reviewTriggerObserved) {
    return {
      chapter: '第一章', step: '唯一待办', title: '完成 R03 的外部复核',
      description: '先核对护理事实和许棠的本人补记，再决定是否接受系统预填结论。',
      action: '开始复核 R03', route: '/followup/review/R03', progress: 12, tone: 'warning',
    };
  }
  if (!f.recheckAccepted) {
    return {
      chapter: '第一章', step: '异常复查', title: '少掉的是一条数据，还是一个人？',
      description: '把复核前名单与发药、去向记录放在一起，找出最早发生改变的位置。',
      action: '打开发药与出院对照', route: '/medication', progress: 20, tone: 'anomaly',
    };
  }
  if (!f.r03IdentityRestored) {
    return {
      chapter: '第一章', step: '恢复联系', title: '把 R03 重新指向许棠',
      description: '使用归档链之外的原始名单恢复床位、姓名和本人补记之间的联系。',
      action: '恢复身份联系', route: '/medication', progress: 28, tone: 'anomaly',
    };
  }
  if (!f.timelineSolved) {
    return {
      chapter: '第二章', step: '事件顺序', title: '重建复核前后的五个时刻',
      description: '不要按上传顺序排列。比较护理发生时间、预填、签认和索引重算。',
      action: '继续时间线复查', route: '/medication', progress: 35, tone: 'warning',
    };
  }
  if (!f.postsLinked) {
    return {
      chapter: '第二章', step: '独立来源', title: '核对三段重复出现的剧场梦境',
      description: '病友留言板不属于本批在线归档链。找出三段梦共同指向的结构。',
      action: '前往病友留言板', route: '/forum', progress: 42, tone: 'normal',
    };
  }
  if (!f.audienceConfirmed) {
    return {
      chapter: '第二章', step: '旧址调查', title: '找出远程复核者在旧剧场中的位置',
      description: '叠合旧剧场与康复中心平面图，再核对观众在终场做了什么。',
      action: '打开地方档案', route: '/archive', progress: 50, tone: 'warning',
    };
  }
  if (!f.dualSourceProven || !f.refrainInferred) {
    return {
      chapter: '第三章', step: '来源对照', title: '比较两个相反的结案出口',
      description: '正向康复与负向申诉看似对立。检查它们是否真是两份独立资料。',
      action: '进入平行复核', route: '/compare', progress: 60, tone: 'anomaly',
    };
  }
  if (!f.experimentConcluded) {
    return {
      chapter: '第三章', step: '副本实验', title: '验证什么变量会让身份消失',
      description: '一次只改变一个变量。实验只运行在副本，不会影响正在调查的患者。',
      action: '运行最小对照', route: '/lab/experiment', progress: 68, tone: 'warning',
    };
  }
  if (!f.sliceInspected) {
    return {
      chapter: '第三章', step: '流程透视', title: '定位被扩大解释的授权语句',
      description: '逐层查看原始护理事实怎样被改写成终局声明。',
      action: '检查处理切片', route: '/lab/slices', progress: 74, tone: 'anomaly',
    };
  }
  if (!f.trailForkCreated) {
    return {
      chapter: '第四章', step: '记录异议', title: '用原始事件重写你的调查经过',
      description: '系统已经改写了动作含义。只保留时间、对象、来源和实际范围。',
      action: '打开调查记录', route: '/trail', progress: 80, tone: 'anomaly',
    };
  }
  if (!f.audioOrderSolved || !f.recoveredAudioRead || f.witnessScope !== 'FACT_ONLY') {
    return {
      chapter: '第四章', step: '通道 03', title: '找回终局之后仍在发生的声音',
      description: '关闭情节提示，按环境声重建顺序，并明确你只见证事实。',
      action: '打开交班录音台', route: '/audio/channel-03', progress: 87, tone: 'warning',
    };
  }
  if (!f.simulatedEdges.includes('D') && !f.simulatedEdges.includes('F')) {
    return {
      chapter: '第五章', step: '切除模拟', title: '找出不该存在的那条联系',
      description: '保留患者、护理、本人表达与后续承接，只撤销越界的终局授权。',
      action: '进入连接切除模拟', route: '/lab/surgery', progress: 93, tone: 'anomaly',
    };
  }
  return {
    chapter: '第五章', step: '最终处理', title: '为六个人建立下一班依据',
    description: '身份、本人当前表达和明确承接缺一不可。最后一次提交将决定本批结果。',
    action: '准备最终交接', route: '/handover/next', progress: 97, tone: 'warning',
  };
}
