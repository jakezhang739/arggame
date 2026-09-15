<script setup lang="ts">
/** P06 病友留言板（docs/03册 v1.1 §3）：三段梦境帖与普通帖混排；打标签关联；作者变形。 */
import { computed, ref } from 'vue';
import { useGameStore } from '../stores/game';
import { content, resolveContent, dialogue } from '../game/content';
import { isAcquired, phaseAtLeast, statementUnlocked } from '../game/selectors';
import SourceInspector from '../components/SourceInspector.vue';
import CompletionPanel from '../components/CompletionPanel.vue';
import WalkthroughHint from '../components/WalkthroughHint.vue';

const game = useGameStore();
const phase = computed(() => game.state.lastMainPhase);
const ending = computed(() => game.state.ending);
const facts = computed(() => game.state.facts);

const ev14Acquired = computed(() => isAcquired(game.state, 'EV14'));
const ev29Acquired = computed(() => isAcquired(game.state, 'EV29'));
const theaterReached = computed(() => phaseAtLeast(phase.value, 'THEATER_DISCOVERED'));

interface Post {
  id: string;
  author: string;
  text: string;
  reply?: string;
  dream: boolean;
  tags?: string[];
}

/** 混排：梦境帖与普通帖交错，标题不写“线索”。 */
const posts = computed<Post[]>(() => {
  const dreams: Post[] = (['R01', 'R02', 'R03'] as const).map((id) => {
    const p = content.patients[id];
    return { id, author: p.name, text: p.dream ?? '', dream: true, tags: p.dreamTags };
  });
  const fillers: Post[] = (dialogue.forumFiller as { author: string; text: string; reply: string }[]).map(
    (f, i) => ({ id: `F${i}`, author: f.author, text: f.text, reply: f.reply, dream: false }),
  );
  return [dreams[0], fillers[0], dreams[1], fillers[1], dreams[2], fillers[2], fillers[3]];
});

function authorLabel(post: Post): string {
  if (post.dream && theaterReached.value) {
    return resolveContent('forum.authors', phase.value, ending.value);
  }
  return post.author;
}

// —— 标签关联 ——
const TAGS = ['地点', '结构', '角色'] as const;
const selectedPosts = ref<string[]>([]);
const selectedTags = ref<string[]>([]);
const feedback = ref<string[]>([]);
const sourceCheck = ref<string | null>(null);

function toggle<T>(list: T[], v: T): void {
  const i = list.indexOf(v);
  if (i >= 0) list.splice(i, 1);
  else list.push(v);
}

const FILLER_REASONS: Record<string, string> = {
  F0: '这条是报修信息：走廊饮水机。没有三段梦境共同的地点、结构或角色对应。',
  F1: '这条是普通康复闲聊：“有人梦见考试”只是一个普通梦，不构成三帖互证的结构。',
  F2: '这条是维修栏公告，与患者梦境无关。',
  F3: '这条是家属事项，内容正常，不参与关联。',
};

async function submitTags(): Promise<void> {
  feedback.value = [];
  const wrongPosts = selectedPosts.value.filter((id) => !id.startsWith('R'));
  const missing = ['R01', 'R02', 'R03'].filter((id) => !selectedPosts.value.includes(id));
  const missingTags = TAGS.filter((t) => !selectedTags.value.includes(t));
  if (wrongPosts.length) {
    for (const id of wrongPosts) feedback.value.push(FILLER_REASONS[id] ?? '所选帖子与三段梦境不对应。');
  }
  if (missing.length) feedback.value.push(`还有梦境帖未被选入（${missing.join('、')}）。三个梦讲的是同一处地方。`);
  if (missingTags.length) feedback.value.push(`标签需同时使用：${TAGS.join('、')}（缺少 ${missingTags.join('、')}）。`);
  if (feedback.value.length) return;
  const okExec = await game.execute({
    kind: 'tagPosts',
    postIds: [...selectedPosts.value].sort(),
    tags: [...selectedTags.value],
  });
  if (!okExec && game.commandError) feedback.value.push(game.commandError);
}

// —— 陈述采集（R01/R02 随 postsLinked 开放，03册 P06）——
function stId(pid: string): string {
  return `ST_${pid}`;
}
function stUnlocked(pid: string): boolean {
  return statementUnlocked(game.state, stId(pid));
}
function stCaptured(pid: string): boolean {
  return facts.value.capturedStatements.includes(stId(pid) as never);
}
async function capture(pid: string): Promise<void> {
  await game.execute({
    kind: 'captureStatement',
    patientId: pid as 'R01',
    statementId: stId(pid) as 'ST_R01',
  });
}
</script>

<template>
  <div class="forum">
    <h1>澄湾病友留言板</h1>
    <p class="muted">bbs.chengwan.help · 康复期患者与家属的公开留言。</p>

    <section v-if="!ev14Acquired" class="panel">
      <h2>站务</h2>
      <p class="muted">本板的原始数据可以整体打开核对，用于和院内记录对照。</p>
      <button class="primary" data-testid="p06:open-ev14" @click="game.execute({ kind: 'openDoc', documentId: 'EV14' })">
        打开留言板原始数据 <small class="mono">EV14</small>
      </button>
    </section>
    <section v-else class="panel">
      <h2>已取得：《梦境帖》原始数据</h2>
      <SourceInspector id="EV14" />
    </section>

    <!-- 周砚版本签名站务帖（docs/10 §1.2 ①）：给“迁移故障”一个有署名的官方口径。 -->
    <article class="post station" data-testid="p06:post--station">
      <header>
        <span class="avatar staff" aria-hidden="true"></span>
        <strong>迁移项目组 · 周砚</strong>
        <span class="mono muted small">v0.9.3-rc2</span>
      </header>
      <p class="post-body prewrap">{{ dialogue.zhouyan.notice }}</p>
    </article>

    <div class="timeline">
      <article
        v-for="post in posts"
        :key="post.id"
        class="post"
        :class="{ 'dream-post': post.dream }"
        :data-testid="`p06:post--${post.id}`"
      >
      <header>
        <span class="avatar" aria-hidden="true"></span>
        <strong>{{ authorLabel(post) }}</strong>
        <button
          v-if="post.dream && theaterReached"
          class="ghost small"
          @click="sourceCheck = sourceCheck === post.id ? null : post.id"
        >
          来源检查
        </button>
        <span v-if="post.dream && sourceCheck === post.id" class="muted small">原发帖人：{{ post.author }}（{{ post.id }} 床）</span>
      </header>
      <p class="post-body">{{ post.text }}</p>
      <p v-if="post.reply" class="reply muted">回复：{{ post.reply }}</p>
      <label v-if="!facts.postsLinked" class="small">
        <input
          type="checkbox"
          :value="post.id"
          :checked="selectedPosts.includes(post.id)"
          :data-testid="`p06:post-check--${post.id}`"
          @change="toggle(selectedPosts, post.id)"
        />
        选入关联
      </label>
    </article>
    </div>

    <section v-if="!facts.postsLinked" class="panel">
      <h2>关联梦境帖</h2>
      <p class="muted small">三个帖子如果在讲同一件事，可以用标签把关系固定下来。</p>
      <WalkthroughHint>勾选陈桥、宋渺、许棠三人的梦境帖（不要选报修、闲聊那些）；「地点、结构、角色」三个标签全部勾上，然后提交关联。</WalkthroughHint>
      <fieldset class="tags">
        <legend>使用标签</legend>
        <label v-for="t in TAGS" :key="t" class="marker">
          <input
            type="checkbox"
            :checked="selectedTags.includes(t)"
            :data-testid="`p06:tag--${t}`"
            @change="toggle(selectedTags, t)"
          />
          {{ t }}
        </label>
      </fieldset>
      <button class="primary" data-testid="p06:submit-tag" @click="submitTags">提交关联</button>
      <ul v-if="feedback.length" class="feedback" data-testid="p06:tag-feedback">
        <li v-for="(f, i) in feedback" :key="i">{{ f }}</li>
      </ul>
    </section>

    <section v-else class="panel okbox">
      <CompletionPanel
        testid="p06:linked-done"
        proved="三个梦说的是同一个地方。「地点、结构、角色」三张标签，把话钉死了。"
        excluded="「三个互不相干的怪梦」——不，它们共用同一副骨架。"
        opened="接下来可以留下陈桥、宋渺的原话；地方档案也对你打开了。"
        action-label="去地方档案"
        action-to="/archive"
      />
      <template v-for="pid in ['R01', 'R02']" :key="pid">
        <p v-if="stCaptured(pid)" class="ok small">✓ {{ content.patients[pid].name }}的本人陈述已保留。</p>
        <button v-else-if="stUnlocked(pid)" class="ghost" :data-testid="`p06:capture--${pid}`" @click="capture(pid)">
          保留 {{ content.patients[pid].name }} 的本人陈述
        </button>
      </template>
    </section>

    <!-- 林闻旧签认（10册 §2，已批）：关联完成后揭示，制造可疑窗口。 -->
    <section v-if="facts.postsLinked" class="panel linwen-panel" aria-labelledby="linwen-h">
      <h2 id="linwen-h">林闻的私信</h2>
      <article class="message-card" data-testid="p06:linwen-note">
        <header>林闻 · 只发给你</header>
        <p class="prewrap">{{ dialogue.linwen.prevSignNote }}</p>
      </article>
      <button v-if="!ev29Acquired" data-testid="p06:open-ev29" @click="game.execute({ kind: 'openDoc', documentId: 'EV29' })">
        查看她保留的本机备份《上一批次签认记录》 <small class="mono">EV29</small>
      </button>
      <article v-else class="message-card confession" data-testid="p06:linwen-confession">
        <header>林闻 · 承认</header>
        <p class="prewrap">{{ dialogue.linwen.prevSignConfession }}</p>
        <p class="muted small">
          她签过一次「护理事实已核对」，第二天 R00 就没了。这一批的事故，真是迁移闹的？
          还是跟她没说出口的那件事有关？
        </p>
      </article>
    </section>
  </div>
</template>

<style scoped>
.post { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-3) var(--space-4); margin: var(--space-3) 0; }
.post.station { background: #f7f5ef; border-color: #d8d2c0; }
.post header { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
.avatar { display: inline-block; width: 22px; height: 22px; border-radius: 50%; background: linear-gradient(135deg, #8aa39a, #5d7a70); }
.avatar.staff { background: linear-gradient(135deg, #b7a77e, #8a7a4e); }
.prewrap { white-space: pre-wrap; }

/* 时间流：左轨＋发帖圆点，帖子按发布先后排列 */
.timeline { position: relative; padding-left: var(--space-4); }
.timeline::before {
  content: '';
  position: absolute;
  top: 8px;
  bottom: 8px;
  left: 5px;
  width: 2px;
  background: linear-gradient(180deg, #cfc9b8, #e2ddd0);
}
.timeline .post { position: relative; }
.timeline .post::before {
  content: '';
  position: absolute;
  left: calc(-1 * var(--space-4) - 7px);
  top: 24px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid #65725b;
  box-shadow: 0 0 0 3px var(--surface);
}
.timeline .post.dream-post::before { border-color: #795d3d; }

.linwen-panel { border-left: 3px solid #65725b; }
.message-card { border: 1px solid var(--line); border-radius: var(--radius); background: #fbfaf6; padding: var(--space-2) var(--space-3); }
.message-card header { color: var(--muted); font-size: 0.78rem; font-weight: 700; margin-bottom: var(--space-1); }
.message-card p { margin: 0; font-size: 0.86em; line-height: 1.7; }
.message-card.confession { border-color: #b98a4f; background: #faf5ea; }
.post-body { margin: var(--space-2) 0 var(--space-1); }
.reply { border-left: 3px solid var(--line); padding-left: var(--space-2); font-size: 0.9em; }
.tags { display: flex; gap: var(--space-4); flex-wrap: wrap; border: 1px solid var(--line); border-radius: var(--radius); }
.feedback { color: var(--error); }
.okbox .ok { color: var(--clinical); }
.small { font-size: 0.85em; }
</style>
