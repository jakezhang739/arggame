<script setup lang="ts">
/** 来源检查：sourceId / originGroup / 派生关系 / 版本（docs/03册 v1.1 §2）。 */
import { computed, ref } from 'vue';
import { content } from '../game/content';
import { evidenceById } from '../game/content';
import type { EvidenceId } from '../game/content-ids';

const props = defineProps<{ id: EvidenceId }>();
const open = ref(false);

const item = computed(() => evidenceById(props.id));
const originNote = computed(() => {
  const g = item.value?.originGroup ?? '';
  const notes: Record<string, string> = {
    HANDOVER_00: '玩家本机保存的交接联原件（PLAYER_LOCAL，永不变形）。',
    SNAPSHOT_00: '站内不可变快照副本（PLAYER_LOCAL）。',
    PAPER_NOTE: '玩家纸面抄写自证（PLAYER_LOCAL）。',
    FOLLOWUP_INDEX: '随访平台首次载入生成的索引。',
    CLINICAL_R03: 'R03 临床护理事实与授权说明。',
    MED_ADMIN_0616: '0616 当班发药原始签收过程。',
    NURSE_SHIFT_0616: '0616 当班护理实物交班过程。',
    DISCHARGE_REGISTER: '去向登记原始过程。',
    TRANSIT_REGISTER: '车次登记原始过程。',
    REVIEW_TRANSACTION: '复核事务过程（本局或历史存档）。',
    NAR_0042: '叙事模板 NAR_0042 的生成过程（两份文档同源）。',
    BBS_RAW: '留言板原始帖子（未删除）。',
    LOCAL_ARCHIVE: '地方档案馆藏原件。',
    MAP_COMPARISON: '玩家完成的空间匹配结果。',
    ARCHITECTURE_AUDIT: '七层架构与审计附件。',
    SOURCE_COMPARISON: '玩家来源比较生成的结果。',
    CORE_RESPONSE_CAPTURE: '终止接口捕获日志。',
    LOCAL_EXPERIMENT: '本机归档副本上的实验。',
    BATCH_PROCESS_TRACE: '批量处理切片痕迹。',
    CHANNEL_03_REC: '通道03交班录音。',
    PLAYER_WITNESS: '玩家本地见证声明。',
    NEXT_SHIFT_0617: '下一班承接单。',
  };
  return notes[g] ?? '';
});
const derivedFrom = computed(() =>
  (item.value?.derivedFrom ?? []).map((id) => {
    const src = content.evidenceRegistry.find((e) => e.id === id);
    return src ? `${id} ${src.title}` : id;
  }),
);
</script>

<template>
  <div v-if="item" class="inspector">
    <button class="ghost small" :data-testid="`src:inspect--${id}`" @click="open = !open">
      来源检查
    </button>
    <div v-if="open" class="detail mono small" :data-testid="`src:inspector--${id}`">
      sourceId：{{ item.sourceId }}<br />
      originGroup：{{ item.originGroup }}<span v-if="originNote"> —— {{ originNote }}</span
      ><br />
      导出批次：{{ item.exportBatch ?? '无（非导出件）' }}<br />
      版本：{{ item.version }}<br />
      派生自：<template v-if="derivedFrom.length">{{ derivedFrom.join('；') }}</template
      ><template v-else>无（原始记录）</template><br />
      事件时间：{{ item.eventTime.value }}（{{ item.eventTime.kind }}）；上传时间：{{
        item.uploadTime.value
      }}
    </div>
  </div>
</template>

<style scoped>
.inspector {
  margin-top: var(--space-1);
}
.detail {
  border: 1px solid var(--line);
  border-left: 3px solid var(--clinical);
  background: var(--surface-muted);
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  margin-top: var(--space-2);
  color: #3f5149;
  line-height: 1.8;
}
.small {
  font-size: 0.85em;
}
</style>
