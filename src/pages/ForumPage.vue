<script setup lang="ts">
/** P06 病友留言板（docs/03册 v1.1 §3）：三段梦境帖与普通帖混排；打标签关联；作者变形。 */
import { computed, ref } from 'vue';
import { useGameStore } from '../stores/game';
import { content, resolveContent, dialogue } from '../game/content';
import { isAcquired, phaseAtLeast, statementUnlocked } from '../game/selectors';
import SourceInspector from '../components/SourceInspector.vue';

const game = useGameStore();
const phase = computed(() => game.state.lastMainPhase);
const ending = computed(() => game.state.ending);
const facts = computed(() => game.state.facts);

const ev14Acquired = computed(() => isAcquired(game.state, 'EV14'));
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
      <p class="muted">本板原始数据（BBS_RAW）可整体打开核对。</p>
      <button class="primary" data-testid="p06:open-ev14" @click="game.execute({ kind: 'openDoc', documentId: 'EV14' })">
        打开留言板原始数据（EV14）
      </button>
    </section>
    <section v-else class="panel">
      <h2>已取得：梦境帖原始数据（EV14）</h2>
      <SourceInspector id="EV14" />
    </section>

    <article v-for="post in posts" :key="post.id" class="post" :data-testid="`p06:post--${post.id}`">
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

    <section v-if="!facts.postsLinked" class="panel">
      <h2>关联梦境帖</h2>
      <p class="muted small">三个帖子如果在讲同一件事，可以用标签把关系固定下来。</p>
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
      <h2>已关联</h2>
      <p class="ok">✓ 三段梦境帖已用「地点 / 结构 / 角色」关联（陈桥、宋渺、许棠）。</p>
      <template v-for="pid in ['R01', 'R02']" :key="pid">
        <p v-if="stCaptured(pid)" class="ok small">✓ {{ pid }} 的本人陈述已保留（{{ stId(pid) }}）。</p>
        <button v-else-if="stUnlocked(pid)" class="ghost" :data-testid="`p06:capture--${pid}`" @click="capture(pid)">
          保留 {{ pid }} {{ content.patients[pid].name }} 的本人陈述
        </button>
      </template>
      <p>
        <RouterLink to="/archive" data-testid="p06:goto-archive">去地方档案与研究卡 →</RouterLink>
      </p>
    </section>
  </div>
</template>

<style scoped>
.post { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-3) var(--space-4); margin: var(--space-3) 0; }
.post header { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
.avatar { display: inline-block; width: 22px; height: 22px; border-radius: 50%; background: linear-gradient(135deg, #8aa39a, #5d7a70); }
.post-body { margin: var(--space-2) 0 var(--space-1); }
.reply { border-left: 3px solid var(--line); padding-left: var(--space-2); font-size: 0.9em; }
.tags { display: flex; gap: var(--space-4); flex-wrap: wrap; border: 1px solid var(--line); border-radius: var(--radius); }
.feedback { color: var(--error); }
.okbox .ok { color: var(--clinical); }
.small { font-size: 0.85em; }
</style>
