<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useGameStore } from '../stores/game';
import { content } from '../game/content';
import { downloadTextFile } from '../game/export-import';

const router = useRouter();
const game = useGameStore();
const handover = content.handover;
const rules = content.rules.v32;

const paperAcked = ref(false);
const ackedRules = ref<boolean[]>(rules.items.map(() => false));
const snapshotOpen = ref(false);
const downloadInitiated = ref(false);
// T31：图片资产经 BASE_URL 引用；缺失时回退文字氛围
const deskPhotoUrl = `${import.meta.env.BASE_URL}images/nurse-desk.png`;
const photoMissing = ref(false);

const handoverSecured = computed(() => game.state.facts.handoverSecured);
const rulesDone = computed(() => ackedRules.value.every(Boolean));
const gateOpen = computed(() => handoverSecured.value && rulesDone.value);

function download(): void {
  downloadTextFile(handover.filename, handover.body, 'text/plain');
  downloadInitiated.value = true;
  void game.execute({ kind: 'downloadHandover' });
}
function ackSaved(): Promise<void> {
  return game.execute({ kind: 'ackHandoverSaved' }).then(() => undefined);
}
function openSnapshot(): void {
  snapshotOpen.value = true;
  void game.execute({ kind: 'openSnapshot' });
}
function ackPaper(v: boolean): void {
  paperAcked.value = v;
  if (v) void game.execute({ kind: 'ackPaperNote' });
}
watch(rulesDone, (done) => {
  if (done) void game.execute({ kind: 'ackRules' });
});
function enter(): void {
  if (!gateOpen.value) return;
  router.push('/followup');
}
</script>

<template>
  <div class="migration">
    <h1>迁移交接页</h1>
    <p class="muted">澄湾康复中心 · 内部迁移批次 CW-ARCHIVE-BATCH-0617 · 扫描日期 2026-06-17</p>

    <section class="panel" aria-labelledby="step1">
      <h2 id="step1">① 保存交接联 00</h2>
      <p>进入随访平台前，请把这份纯文本交接联保存到你的设备，并保留到游戏结束。</p>
      <div class="actions">
        <button class="primary" data-testid="migration:download" @click="download">
          保存交接联 00（{{ handover.filename }}）
        </button>
        <button
          :disabled="!downloadInitiated && !handoverSecured"
          data-testid="migration:ack-saved"
          @click="ackSaved"
        >
          我已打开保存的文件
        </button>
        <button data-testid="migration:snapshot" @click="openSnapshot">打开只读快照</button>
      </div>
      <div v-if="snapshotOpen" class="snapshot mono">
        {{ content.evidenceRegistry.find((e) => e.id === 'EV02')?.display }}
      </div>
      <p v-if="handoverSecured" class="ok">✓ 副本已确认（交接联或快照均可回看）。</p>
      <p v-if="!downloadInitiated && !handoverSecured" class="muted small">
        下载只代表发起；确认文件可以打开，或直接使用只读快照。
      </p>
    </section>

    <section class="panel" aria-labelledby="step2">
      <h2 id="step2">② 抄写三行（可选）</h2>
      <!-- T31：护士站旧台灯的安静画面。最终照片放 public/arggame/images/nurse-desk.jpg；
           无图时回退为文字氛围，不闪灯、不作为验证线索。 -->
      <figure class="desk-photo" data-testid="p01:desk-photo">
        <img
          :src="deskPhotoUrl"
          alt="护士站台灯：一盏旧台灯放在值班台上，光线安静。"
          @error="photoMissing = true"
          v-if="!photoMissing"
        />
        <div v-else class="photo-fallback" aria-label="台灯（文字版）">
          <p>护士站，旧台灯还亮着。灯罩下压着一张写着型号的纸条。</p>
          <p class="muted small">（现场照片尚未接入；此处不影响任何谜题。）</p>
        </div>
        <figcaption>值班台，交接前夜</figcaption>
      </figure>
      <blockquote class="copylines">
        <p>R03</p>
        <p>许棠</p>
        <p>“台灯还差一颗螺丝，明天你来时帮我带一颗。”</p>
      </blockquote>
      <label class="check">
        <input
          type="checkbox"
          data-testid="migration:paper-ack"
          :checked="paperAcked"
          @change="ackPaper(($event.target as HTMLInputElement).checked)"
        />
        我已抄写到纸上并做了记号（可跳过）
      </label>
    </section>

    <section class="panel" aria-labelledby="step3">
      <h2 id="step3">③ 六条值班须知（{{ rules.version }} · {{ rules.issuedOn }}）</h2>
      <ol class="rules">
        <li v-for="(item, i) in rules.items" :key="i">
          <label>
            <input type="checkbox" :data-testid="`migration:rule--${i}`" v-model="ackedRules[i]" />
            {{ item }}
          </label>
        </li>
      </ol>
    </section>

    <div class="enter">
      <button
        class="primary big"
        :disabled="!gateOpen"
        data-testid="migration:enter"
        @click="enter"
      >
        进入随访平台
      </button>
      <p v-if="!gateOpen" class="muted">
        {{
          !handoverSecured ? '需要先确认交接联保存，或打开只读快照。' : '需要逐条确认六条值班须知。'
        }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.desk-photo {
  margin: 0 0 var(--space-4);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
  background: #151e1a;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.05);
}
.desk-photo img {
  display: block;
  width: 100%;
  max-height: 320px;
  object-fit: cover;
  object-position: 55% center;
  filter: saturate(0.78) contrast(1.03) brightness(0.9);
}
.photo-fallback {
  padding: var(--space-4);
}
.photo-fallback p {
  margin: var(--space-1) 0;
}
.desk-photo figcaption {
  padding: var(--space-2) var(--space-3);
  font-family: var(--font-mono);
  font-size: 0.7em;
  letter-spacing: 0.06em;
  color: #c7d1cb;
  border-top: 1px solid #33443c;
  background: #1b2923;
}
.migration h1 {
  margin: 0 0 var(--space-2);
}
.actions {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  flex-wrap: wrap;
}
.snapshot {
  background: #eef1ef;
  border: 1px dashed var(--line);
  border-radius: var(--radius);
  padding: var(--space-3);
  white-space: pre-wrap;
  margin: var(--space-3) 0 0;
}
.ok {
  color: var(--clinical);
}
.copylines {
  border-left: 4px solid var(--line);
  margin: var(--space-2) 0;
  padding-left: var(--space-3);
}
.rules {
  padding-left: 1.4em;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.enter {
  margin-top: var(--space-5);
  text-align: center;
}
.big {
  font-size: 1.1em;
  padding: var(--space-3) var(--space-6);
}
.small {
  font-size: 0.85em;
}
</style>
