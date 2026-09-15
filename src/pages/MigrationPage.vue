<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useGameStore } from '../stores/game';
import { content } from '../game/content';
import { downloadTextFile } from '../game/export-import';
import AppIcon from '../components/AppIcon.vue';

const router = useRouter();
const game = useGameStore();
const handover = content.handover;
const rules = content.rules.v32;

const paperAcked = ref(false);
const ackedRules = ref<boolean[]>(rules.items.map(() => false));
const snapshotOpen = ref(false);
const downloadInitiated = ref(false);
const deskPhotoUrl = `${import.meta.env.BASE_URL}images/nurse-desk-v2.jpg`;
const photoMissing = ref(false);

const handoverSecured = computed(() => game.state.facts.handoverSecured);
const rulesChecked = computed(() => ackedRules.value.filter(Boolean).length);
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
    <header class="page-intro">
      <p class="eyebrow mono">夜班交接 · 记录 00</p>
      <h1>夜班交接</h1>
      <p>今晚你只需要处理一份待签病历。开始前，先留下复核发生之前的名单。</p>
      <div class="safety-line"><AppIcon name="check" :size="17" /> 查看材料不会改变案件；任何提交都会在确认前写明范围。</div>
    </header>

    <div class="step-grid">
      <section class="panel primary-step" aria-labelledby="step1">
        <div class="step-head">
          <span class="step-number">01</span>
          <div>
            <p>当前任务 · 准备 1/2</p>
            <h2 id="step1">保留复核前的原始名单</h2>
          </div>
          <span v-if="handoverSecured" class="done-badge"><AppIcon name="check" :size="15" /> 已保存</span>
        </div>
        <p class="step-copy">在线摘要会随迁移更新。请先保存一份可以独立回看的原始交接记录，后面出现冲突时会用到。</p>

        <div class="document-preview">
          <div class="document-icon"><AppIcon name="archive" :size="26" /></div>
          <div><strong>原始交接记录 00</strong><small class="mono">{{ handover.filename }} · 六名患者 · 本机副本</small></div>
        </div>

        <div class="actions">
          <button class="primary" data-testid="migration:download" @click="download">
            <AppIcon name="download" :size="18" /> 保存原始交接记录
          </button>
          <button
            :disabled="!downloadInitiated && !handoverSecured"
            data-testid="migration:ack-saved"
            @click="ackSaved"
          >
            我已确认文件可以打开
          </button>
        </div>
        <button class="snapshot-link" data-testid="migration:snapshot" @click="openSnapshot">
          无法下载？改用本机只读副本
        </button>
        <div v-if="snapshotOpen" class="snapshot mono">
          {{ content.evidenceRegistry.find((e) => e.id === 'EV02')?.display }}
        </div>
        <p v-if="handoverSecured" class="success"><AppIcon name="check" :size="17" /> ✓ 副本已确认 · 原始记录已进入你的本机调查档案。</p>
      </section>

      <aside class="witness-card" aria-labelledby="step2">
        <figure class="desk-photo" data-testid="p01:desk-photo">
          <img
            v-if="!photoMissing"
            :src="deskPhotoUrl"
            alt="护士站台灯：一盏旧台灯放在值班台上，光线安静。"
            @error="photoMissing = true"
          />
          <div v-else class="photo-fallback" aria-label="台灯（文字版）">护士站。旧台灯还亮着，灯罩下压着一张写着型号的纸条。</div>
          <figcaption class="mono">NURSE DESK / BEFORE HANDOVER</figcaption>
        </figure>
        <div class="witness-copy">
          <p class="eyebrow mono">可选 · 纸面记录</p>
          <h2 id="step2">可选：在纸上留三行</h2>
          <p>这不是谜题，也不会影响结局。它只是给在线记录之外留一个位置。</p>
          <blockquote class="copylines">
            <span class="mono">R03</span>
            <strong>许棠</strong>
            <span>“台灯还差一颗螺丝，明天你来时帮我带一颗。”</span>
          </blockquote>
          <label class="paper-check">
            <input
              type="checkbox"
              data-testid="migration:paper-ack"
              :checked="paperAcked"
              @change="ackPaper(($event.target as HTMLInputElement).checked)"
            />
            我已抄写并做了自己的记号
          </label>
        </div>
      </aside>
    </div>

    <section class="panel preparation" aria-labelledby="step3">
      <div class="step-head compact">
        <span class="step-number">02</span>
        <div>
          <p>当前任务 · 准备 2/2</p>
          <h2 id="step3">确认今晚的复核边界</h2>
        </div>
        <span class="count mono">{{ rulesChecked }}/{{ rules.items.length }}</span>
      </div>
      <p class="step-copy">不用背诵。之后遇到相关情况时，系统会再次提醒。这里仅确认你知道哪些动作可能改变记录。</p>
      <ol class="rules">
        <li v-for="(item, i) in rules.items" :key="i">
          <label>
            <input type="checkbox" :data-testid="`migration:rule--${i}`" v-model="ackedRules[i]" />
            <span><small class="mono">0{{ i + 1 }}</small>{{ item }}</span>
          </label>
        </li>
      </ol>
    </section>

    <div class="enter-bar" :class="{ ready: gateOpen }">
      <div>
        <strong>{{ gateOpen ? '交接准备完成' : '还差一步' }}</strong>
        <span v-if="!gateOpen">{{ !handoverSecured ? '先保存原始名单或启用本机只读副本。' : `再确认 ${rules.items.length - rulesChecked} 条复核边界。` }}</span>
        <span v-else>下一页只显示一份待办病历：R03 许棠。</span>
      </div>
      <button class="primary big" :disabled="!gateOpen" data-testid="migration:enter" @click="enter">
        查看今晚的待办病历 <AppIcon name="arrow" :size="18" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.page-intro { max-width: 760px; margin-bottom: var(--space-6); }
.eyebrow { margin: 0 0 var(--space-2); color: var(--clinical); font-size: .7rem; font-weight: 750; letter-spacing: .12em; }
.page-intro h1 { margin-bottom: var(--space-2); }
.page-intro > p:not(.eyebrow) { margin: 0; color: var(--muted); font-size: 1.02rem; }
.safety-line { display: inline-flex; align-items: center; gap: var(--space-2); margin-top: var(--space-4); border: 1px solid rgba(71,111,91,.28); border-radius: 999px; padding: 6px 12px; background: rgba(235,244,239,.86); color: var(--clinical-deep); font-size: .75rem; }
.step-grid { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(300px, .75fr); gap: var(--space-4); align-items: stretch; }
.primary-step { margin: 0; }
.step-head { display: grid; grid-template-columns: 48px 1fr auto; gap: var(--space-3); align-items: start; }
.step-head.compact { grid-template-columns: 48px 1fr auto; }
.step-head p { margin: 0 0 2px; color: var(--muted); font-size: .7rem; font-weight: 700; letter-spacing: .07em; }
.step-head h2 { margin: 0; }
.step-number { display: grid; width: 42px; height: 42px; place-items: center; border-radius: 50%; background: var(--clinical-deep); color: #fff; font-family: var(--font-mono); font-size: .73rem; font-weight: 700; }
.done-badge { display: inline-flex; align-items: center; gap: 5px; border-radius: 999px; padding: 4px 9px; background: var(--clinical-soft); color: var(--clinical); font-size: .7rem; font-weight: 700; }
.step-copy { max-width: 720px; margin: var(--space-4) 0; color: var(--muted); font-size: .88rem; }
.document-preview { display: grid; grid-template-columns: 46px 1fr; gap: var(--space-3); align-items: center; margin: var(--space-4) 0; border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-3); background: var(--surface-muted); }
.document-icon { display: grid; width: 42px; height: 42px; place-items: center; border-radius: var(--radius-sm); background: var(--clinical-deep); color: #fff; }
.document-preview > div:last-child { display: grid; }
.document-preview small { color: var(--muted); font-size: .68rem; }
.actions { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.snapshot-link { min-height: 32px; margin-top: var(--space-3); border: 0; padding: 0; background: transparent; box-shadow: none; color: var(--clinical); font-size: .76rem; text-decoration: underline; }
.snapshot-link:hover { background: transparent; box-shadow: none; transform: none; }
.snapshot { max-height: 150px; overflow: auto; margin-top: var(--space-3); border: 1px dashed var(--line-strong); border-radius: var(--radius); padding: var(--space-3); background: #eef1ef; white-space: pre-wrap; font-size: .72rem; }
.success { display: flex; align-items: center; gap: var(--space-2); margin: var(--space-3) 0 0; color: var(--clinical); font-size: .8rem; font-weight: 650; }
.witness-card { overflow: hidden; border: 1px solid #576b62; border-radius: var(--radius-lg); background: #13251f; box-shadow: var(--shadow-md); color: #e8efeb; }
.desk-photo { position: relative; height: 190px; margin: 0; overflow: hidden; background: #0b1511; }
.desk-photo img { width: 100%; height: 100%; object-fit: cover; filter: saturate(.72) contrast(1.06) brightness(.72); }
.desk-photo::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, transparent 45%, rgba(6,14,11,.76)); }
.desk-photo figcaption { position: absolute; z-index: 1; right: var(--space-3); bottom: var(--space-2); color: #b7c4bd; font-size: .62rem; letter-spacing: .08em; }
.photo-fallback { padding: var(--space-4); color: #b7c4bd; }
.witness-copy { padding: var(--space-4); }
.witness-copy .eyebrow { color: #d4ad5e; }
.witness-copy h2 { margin-bottom: var(--space-2); color: #fff; font-size: 1.15rem; }
.witness-copy > p:not(.eyebrow) { color: #aebeb6; font-size: .78rem; }
.copylines { display: grid; gap: 2px; margin: var(--space-3) 0; border-left-color: #d0a44d; font-size: .82rem; }
.copylines strong { color: #fff; font-size: 1.05rem; }
.paper-check { display: flex; gap: var(--space-2); align-items: flex-start; color: #c8d4ce; font-size: .75rem; }
.preparation { margin-top: var(--space-4); }
.count { display: grid; min-width: 52px; height: 34px; place-items: center; border: 1px solid var(--line); border-radius: 999px; color: var(--muted); font-size: .72rem; }
.rules { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2); margin: 0; padding: 0; list-style: none; }
.rules label { display: flex; min-height: 62px; gap: var(--space-3); align-items: flex-start; border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-3); background: var(--surface); }
.rules label:has(input:checked) { border-color: #7c9a8b; background: var(--clinical-soft); }
.rules input { margin-top: 3px; }
.rules span { display: grid; grid-template-columns: 24px 1fr; gap: var(--space-2); align-items: start; font-size: .78rem; line-height: 1.55; }
.rules small { color: var(--muted); font-size: .63rem; }
.enter-bar { position: static; z-index: 12; display: flex; justify-content: space-between; gap: var(--space-4); align-items: center; margin-top: var(--space-4); border: 1px solid #b7a678; border-radius: var(--radius-lg); padding: var(--space-3) var(--space-4); background: rgba(247,240,221,.96); box-shadow: 0 6px 18px rgba(38,31,17,.1); }
.enter-bar.ready { border-color: #557a68; background: rgba(231,241,235,.97); }
.enter-bar > div { display: grid; }
.enter-bar strong { font-size: .83rem; }
.enter-bar span { color: var(--muted); font-size: .72rem; }
.big { min-height: 48px; padding-inline: var(--space-5); white-space: nowrap; }

@media (max-width: 820px) {
  .step-grid, .rules { grid-template-columns: 1fr; }
  .enter-bar { position: static; align-items: stretch; flex-direction: column; }
  .big { width: 100%; }
}
@media (max-width: 520px) {
  .step-head { grid-template-columns: 42px 1fr; }
  .step-head > :last-child { grid-column: 2; justify-self: start; }
  .actions { display: grid; }
}
</style>
