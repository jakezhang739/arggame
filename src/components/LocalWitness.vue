<script setup lang="ts">
/** 本地见证：固定范围声明 → 录音或文字 → 试听/预览 → 确认（docs/03册 v1.1 §2）。
 *  拒麦、失败、无 MediaRecorder 均转文字；录音 blob 存 IndexedDB，不进存档。 */
import { computed, onBeforeUnmount, ref } from 'vue';
import { useGameStore } from '../stores/game';
import { resolveContent } from '../game/content';
import { getRecording, putRecording } from '../game/idb';

const emit = defineEmits<{ confirm: [payload: { mode: 'VOICE' | 'TEXT'; recordingId: string | null }] }>();
const game = useGameStore();

const canonical = computed(() => resolveContent('witness.canonical', game.state.lastMainPhase, game.state.ending));
const mode = ref<'VOICE' | 'TEXT'>('TEXT');
const micState = ref<'IDLE' | 'RECORDING' | 'DONE' | 'FAILED'>('IDLE');
const micNote = ref('');
const recordingId = ref<string | null>(null);
const textOk = ref(false);
const audioEl = ref<HTMLAudioElement | null>(null);

let recorder: MediaRecorder | null = null;
let chunks: Blob[] = [];
let stream: MediaStream | null = null;

const canConfirm = computed(() =>
  mode.value === 'TEXT' ? textOk.value : micState.value === 'DONE' && recordingId.value !== null,
);

async function startRecord(): Promise<void> {
  micNote.value = '';
  try {
    if (typeof MediaRecorder === 'undefined') throw new Error('unsupported');
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recorder = new MediaRecorder(stream);
    chunks = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = async () => {
      const blob = new Blob(chunks, { type: recorder?.mimeType || 'audio/webm' });
      recordingId.value = `witness-${game.save.sessionId}-${Date.now()}`;
      try {
        await putRecording(recordingId.value, blob);
        micState.value = 'DONE';
      } catch {
        micState.value = 'FAILED';
        micNote.value = '录音保存失败；可改用文字确认，效力相同。';
      }
      releaseStream();
    };
    recorder.start();
    micState.value = 'RECORDING';
  } catch {
    micState.value = 'FAILED';
    micNote.value = '麦克风不可用或被拒绝；可改用文字确认，效力相同。';
    mode.value = 'TEXT';
    releaseStream();
  }
}

function stopRecord(): void {
  if (recorder && recorder.state !== 'inactive') recorder.stop();
}

function releaseStream(): void {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
}

async function replay(): Promise<void> {
  if (!recordingId.value) return;
  const blob = await getRecording(recordingId.value);
  if (!blob) {
    micNote.value = '本机录音已不存在（导入件不含录音）；文字声明仍然有效。';
    return;
  }
  const url = URL.createObjectURL(blob);
  if (audioEl.value) {
    audioEl.value.src = url;
    void audioEl.value.play().catch(() => {
      micNote.value = '播放失败；录音文件仍在，文字声明仍然有效。';
    });
  }
}

function confirm(): void {
  if (!canConfirm.value) return;
  if (mode.value === 'VOICE' && recordingId.value) {
    game.setWitness('VOICE', recordingId.value);
    emit('confirm', { mode: 'VOICE', recordingId: recordingId.value });
  } else {
    game.setWitness('TEXT', null);
    emit('confirm', { mode: 'TEXT', recordingId: null });
  }
}

onBeforeUnmount(() => {
  stopRecord();
  releaseStream();
});
</script>

<template>
  <section class="witness panel">
    <h3>本地见证</h3>
    <p class="canonical" data-testid="witness:canonical">
      固定范围声明：<strong>{{ canonical }}</strong>
    </p>
    <p class="muted small">
      声明只覆盖护理事实的持续，不对其人生终局作证。录音仅保存在本机，导出件与试玩报告不携带录音。
    </p>

    <fieldset>
      <legend>确认方式（两者效力相同）</legend>
      <label class="radio">
        <input type="radio" value="TEXT" v-model="mode" data-testid="witness:mode-text" /> 文字确认
      </label>
      <label class="radio">
        <input type="radio" value="VOICE" v-model="mode" data-testid="witness:mode-voice" /> 录一段本地语音
      </label>
    </fieldset>

    <div v-if="mode === 'VOICE'" class="voicebox">
      <button
        v-if="micState !== 'RECORDING'"
        class="primary"
        data-testid="witness:record-start"
        @click="startRecord"
      >
        开始录音
      </button>
      <button v-else class="primary" data-testid="witness:record-stop" @click="stopRecord">
        停止录音
      </button>
      <button v-if="micState === 'DONE'" class="ghost" data-testid="witness:replay" @click="replay">
        试听
      </button>
      <audio ref="audioEl" controls hidden></audio>
      <span v-if="micState === 'DONE'" class="ok" data-testid="witness:recorded">✓ 已录一段本地语音</span>
    </div>
    <p v-if="micNote" class="muted small" data-testid="witness:mic-note">{{ micNote }}</p>

    <div v-if="mode === 'TEXT'" class="textbox">
      <label class="small">
        <input type="checkbox" v-model="textOk" data-testid="witness:text-ok" />
        我确认以上固定范围声明（不改写、不添加结论）。
      </label>
    </div>

    <button class="primary" :disabled="!canConfirm" data-testid="witness:confirm" @click="confirm">
      确认见证范围
    </button>
  </section>
</template>

<style scoped>
.canonical { background: #f6f1e7; border-left: 4px solid var(--primary); padding: var(--space-2) var(--space-3); }
.radio { margin-right: var(--space-4); }
.voicebox, .textbox { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; margin: var(--space-2) 0; }
.ok { color: var(--clinical); }
.small { font-size: 0.85em; }
</style>
