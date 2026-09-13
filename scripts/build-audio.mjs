#!/usr/bin/env node
/** 占位音频生产线（docs/04册 §2 T29–T30）。
 *  台词：Windows SAPI（zh-CN 声线，速率区分说话人）；音效：纯 Node 合成（可区分、不依赖外部服务）。
 *  流程：先合成 CHANNEL_03_MASTER 连续场景，再按切点切成 AUD02–07（同一声响的两半来自同一次合成），
 *  最后从【最终成品文件】计算 timings 与 400 点峰值。无 ffmpeg 时输出 WAV（浏览器原生支持）。 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'arggame', 'audio');
const TMP_DIR = join(ROOT, 'node_modules', '.cache', 'audio-build');
const MANIFEST = JSON.parse(readFileSync(join(ROOT, 'src/content/audio-manifest.json'), 'utf-8'));
const SR = 44100;

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(TMP_DIR, { recursive: true });

// —— WAV 读写（16-bit PCM 单声道）——
function writeWav(path, samples) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + samples.length * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  writeFileSync(path, buf);
}
function readWav(path) {
  const buf = readFileSync(path);
  // 遍历 RIFF 块找 data（SAPI 可能在 data 前写额外块）
  let off = 12;
  let dataLen = 0;
  let dataOff = 44;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === 'data') {
      dataOff = off + 8;
      dataLen = Math.min(size, buf.length - dataOff);
      break;
    }
    off += 8 + size + (size % 2);
  }
  const out = new Float32Array(Math.floor(dataLen / 2));
  for (let i = 0; i < out.length; i++) out[i] = buf.readInt16LE(dataOff + i * 2) / 32768;
  return out;
}

// —— 音效合成（各可区分：钟/药车双音/脚步/台灯/录音起止）——
function sec(t) {
  return Math.round(t * SR);
}
function env(i, n, attack = 0.02, release = 0.3) {
  const a = Math.min(1, i / (n * attack));
  const r = Math.min(1, (n - i) / (n * release));
  return a * r;
}
function tone(freq, dur, gain = 0.5) {
  const n = sec(dur);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = Math.sin((2 * Math.PI * freq * i) / SR) * Math.exp((-3 * i) / n) * gain * env(i, n, 0.01, 1);
  }
  return out;
}
function noiseBurst(dur, gain = 0.4, lowpass = true) {
  const n = sec(dur);
  const out = new Float32Array(n);
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    prev = lowpass ? prev * 0.86 + w * 0.14 : w;
    out[i] = prev * Math.exp((-4 * i) / n) * gain;
  }
  return out;
}
function silence(dur) {
  return new Float32Array(sec(dur));
}
function concat(...parts) {
  const n = parts.reduce((a, p) => a + p.length, 0);
  const out = new Float32Array(n);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
/** 在 buf 内偏移 offset 处叠加 add（原地）。 */
function mixAt(buf, add, offsetSamples) {
  for (let i = 0; i < add.length && offsetSamples + i < buf.length; i++) {
    buf[offsetSamples + i] += add[i];
  }
}

const SFX = {
  /** 录音启动：短促提示音 + 起始咔哒。 */
  recStart: () => concat(tone(1046, 0.09, 0.35), silence(0.08), tone(784, 0.06, 0.2)),
  /** 23:00 报时钟（双音）。 */
  chime: () => concat(tone(880, 0.5, 0.4), silence(0.18), tone(659, 0.7, 0.35)),
  /** 药车双音：两声闷响夹约 0.5s 间隙（跨切点声响，只合成这一次）。 */
  cartDouble: () => {
    const clunk = () => concat(noiseBurst(0.09, 0.5), tone(82, 0.22, 0.5));
    return concat(clunk(), silence(0.5), clunk());
  },
  /** 脚步掠过门槛：四步，先近后远。 */
  footstepPass: () => {
    const step = (g) => noiseBurst(0.07, g);
    return concat(step(0.5), silence(0.42), step(0.42), silence(0.44), step(0.3), silence(0.46), step(0.2));
  },
  /** 台灯按下+簧片回弹（跨切点声响，只合成这一次）。 */
  lampPressRelease: () => {
    const press = noiseBurst(0.03, 0.7, false);
    const release = concat(silence(0.16), noiseBurst(0.02, 0.5, false), tone(420, 0.1, 0.18));
    return concat(press, release);
  },
  /** 录音停止：单音下行。 */
  recStop: () => concat(tone(660, 0.08, 0.3), tone(440, 0.1, 0.25)),
};

// —— SAPI 台词合成 ——
const RATE_BY_SPEAKER = { LIN_WEN: 0, XU_TANG: -2, ASSISTANT: 1, NONE: 0 };
function synthSpeech(id, speaker, text) {
  const outPath = join(TMP_DIR, `${id}.wav`).replace(/\\/g, '/');
  const safe = text.replace(/'/g, "''");
  const ps = [
    'Add-Type -AssemblyName System.Speech',
    '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer',
    '$s.SelectVoice("Microsoft Huihui Desktop")',
    `$s.Rate = ${RATE_BY_SPEAKER[speaker] ?? 0}`,
    '$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(44100, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)',
    `$s.SetOutputToWaveFile('${outPath}', $fmt)`,
    `$s.Speak('${safe}')`,
    '$s.Dispose()',
  ].join('\n');
  execFileSync('powershell', ['-NoProfile', '-Command', ps], { stdio: 'pipe' });
  return readWav(outPath);
}

// —— 主场景装配 ——
const clip = (id) => MANIFEST.clips[id];
const cue = (key) => MANIFEST.production.speechCueKeys.find((c) => c.id === key);

console.log('合成台词…');
const speech = {};
for (const key of MANIFEST.production.speechCueKeys) {
  speech[key.id] = synthSpeech(key.id, key.speaker, key.text);
  console.log(`  ${key.id} (${(speech[key.id].length / SR).toFixed(1)}s)`);
}

console.log('装配 CHANNEL_03_MASTER…');
const GAP = 0.35; // 台词间自然停顿
const parts = [];
const layout = [];
function push(label, samples) {
  layout.push({ label, at: parts.reduce((a, p) => a + p.length, 0) });
  parts.push(samples);
  parts.push(silence(GAP));
}
push('REC_START', SFX.recStart());
push('CHIME', SFX.chime());
push('AUD02_speech', speech.AUD02_speech);
push('CART_DOUBLE', SFX.cartDouble());
push('AUD03_speech', speech.AUD03_speech);
push('FOOTSTEP_PASS', SFX.footstepPass());
push('AUD04_speech', speech.AUD04_speech);
push('AUD05_speech', speech.AUD05_speech);
push('LAMP_PRESS_RELEASE', SFX.lampPressRelease());
push('AUD06_speech', speech.AUD06_speech);
push('AUD07_speech', speech.AUD07_speech);
push('REC_STOP', SFX.recStop());
const master = concat(...parts);
const at = (label) => layout.find((l) => l.label === label).at;
const len = (label) => parts[layout.findIndex((l) => l.label === label) * 2].length;

writeWav(join(OUT_DIR, 'CHANNEL_03_FULL.wav'), master);
console.log(`  master ${(master.length / SR).toFixed(1)}s`);

// —— 按跨切点中点切分（左半归左片段，右半归右片段）——
function cutAt(sfxLabel, half) {
  const start = at(sfxLabel);
  const n = len(sfxLabel);
  return half === 'L' ? start + Math.floor(n / 2) : start + Math.floor(n / 2);
}
const CUTS = {
  AUD02: cutAt('CART_DOUBLE', 'L'),
  AUD03: cutAt('CART_DOUBLE', 'R'),
  AUD04: cutAt('FOOTSTEP_PASS', 'R'),
  AUD05: cutAt('LAMP_PRESS_RELEASE', 'L'),
  AUD06: cutAt('LAMP_PRESS_RELEASE', 'R'),
};
// AUD03 结束在脚步中点；AUD04 从脚步中点开始
CUTS['AUD03_END'] = cutAt('FOOTSTEP_PASS', 'L');
const SEGMENTS = {
  AUD02: [0, CUTS.AUD02],
  AUD03: [CUTS.AUD03, CUTS.AUD03_END],
  AUD04: [CUTS.AUD04, at('AUD05_speech') + len('AUD05_speech') + sec(GAP) + Math.floor(len('LAMP_PRESS_RELEASE') / 2)],
  AUD05: [at('AUD05_speech'), CUTS.AUD05],
  AUD06: [CUTS.AUD06, at('AUD07_speech') + len('AUD07_speech') + sec(GAP) + len('REC_STOP')],
  AUD07: [at('AUD07_speech'), master.length],
};
// 修正：AUD05 应从其台词前（含上一片段结尾后的间隙）开始
SEGMENTS.AUD05 = [CUTS.AUD04 - 0, CUTS.AUD05];
SEGMENTS.AUD04[1] = at('AUD05_speech');
SEGMENTS.AUD06[0] = CUTS.AUD06;
SEGMENTS.AUD06[1] = at('AUD07_speech');
SEGMENTS.AUD07[0] = at('AUD07_speech');
SEGMENTS.AUD07[1] = master.length;

// —— anchor 半段在成品片段内的时间 ——
function anchorIn(assetId, anchorId, sfxLabel, side) {
  const segStart = SEGMENTS[assetId][0];
  const sfxAt = at(sfxLabel);
  const n = len(sfxLabel);
  const mid = sfxAt + Math.floor(n / 2);
  if (side === 'L') {
    const s = Math.max(segStart, sfxAt);
    return { id: anchorId, startMs: ((s - segStart) / SR) * 1000, endMs: ((mid - segStart) / SR) * 1000, side };
  }
  const e = Math.min(SEGMENTS[assetId][1], sfxAt + n);
  return { id: anchorId, startMs: ((mid - segStart) / SR) * 1000, endMs: ((e - segStart) / SR) * 1000, side };
}

const timings = {};

function peaksOf(samples) {
  const N = 400;
  const bucket = Math.floor(samples.length / N) || 1;
  const out = [];
  for (let i = 0; i < N; i++) {
    let m = 0;
    for (let j = i * bucket; j < Math.min((i + 1) * bucket, samples.length); j++) {
      m = Math.max(m, Math.abs(samples[j]));
    }
    out.push(Number(m.toFixed(3)));
  }
  return out;
}
function entryFor(samples, captionCues, anchorCues) {
  return {
    durationMs: Math.round((samples.length / SR) * 1000),
    captionCues,
    anchorCues,
    peaks: peaksOf(samples),
  };
}
function speechCue(assetId, speechKey) {
  const segStart = SEGMENTS[assetId]?.[0] ?? 0;
  const s = at(`${speechKey}_speech`) ?? at(speechKey);
  const n = len(`${speechKey}_speech`);
  const rel = Math.max(0, s - segStart);
  return {
    startMs: Math.round((rel / SR) * 1000),
    endMs: Math.round(((rel + n) / SR) * 1000),
    text: cue(`${speechKey}_speech`).text,
  };
}

console.log('切分 AUD02–07…');
for (const id of ['AUD02', 'AUD03', 'AUD04', 'AUD05', 'AUD06', 'AUD07']) {
  const seg = master.slice(SEGMENTS[id][0], SEGMENTS[id][1]);
  writeWav(join(OUT_DIR, `${id}.wav`), seg);
  const anchors = [];
  if (id === 'AUD02') anchors.push(anchorIn('AUD02', 'CART_SPLIT', 'CART_DOUBLE', 'L'));
  if (id === 'AUD03') anchors.push(anchorIn('AUD03', 'CART_SPLIT', 'CART_DOUBLE', 'R'), anchorIn('AUD03', 'FOOTSTEP_SPLIT', 'FOOTSTEP_PASS', 'L'));
  if (id === 'AUD04') anchors.push(anchorIn('AUD04', 'FOOTSTEP_SPLIT', 'FOOTSTEP_PASS', 'R'));
  if (id === 'AUD05') anchors.push(anchorIn('AUD05', 'SWITCH_SPLIT', 'LAMP_PRESS_RELEASE', 'L'));
  if (id === 'AUD06') anchors.push(anchorIn('AUD06', 'SWITCH_SPLIT', 'LAMP_PRESS_RELEASE', 'R'));
  timings[id] = entryFor(
    seg,
    [speechCue(id, id), ...(clip(id).objectiveCaptions ?? []).map((text) => ({ startMs: 0, endMs: Math.round((seg.length / SR) * 1000), text: `客观标记：${text}` }))],
    anchors,
  );
  console.log(`  ${id}.wav ${(seg.length / SR).toFixed(1)}s anchors=${anchors.length}`);
}
timings.CHANNEL_03_FULL = entryFor(master, [], []);

// —— 独立资产 ——
console.log('合成独立资产…');
const standalone = [
  ['AUD01', 'LIN_WEN'],
  ['AUD08', 'ASSISTANT'],
  ['AUD10', 'LIN_WEN'],
  ['AUD11', 'LIN_WEN'],
];
for (const [id, speaker] of standalone) {
  const text = clip(id).speech.trim();
  const samples = synthSpeech(id, speaker, text);
  writeWav(join(OUT_DIR, `${id}.wav`), samples);
  timings[id] = entryFor(
    samples,
    [{ startMs: 0, endMs: Math.round((samples.length / SR) * 1000), text }],
    [],
  );
  console.log(`  ${id}.wav ${(samples.length / SR).toFixed(1)}s`);
}

// AUD09：18s 安静，开关声在 12s（docs §2.3）
{
  const total = sec(18);
  const buf = silence(18);
  mixAt(buf, SFX.lampPressRelease(), sec(12));
  writeWav(join(OUT_DIR, 'AUD09.wav'), buf);
  timings.AUD09 = {
    durationMs: 18000,
    captionCues: [
      { startMs: 0, endMs: 12000, text: '（安静）' },
      { startMs: 12000, endMs: 12500, text: '台灯开关：按下，回弹。没有亮。' },
      { startMs: 12500, endMs: 18000, text: '（安静）' },
    ],
    anchorCues: [{ id: 'AUD09_SWITCH', startMs: 12000, endMs: 12500, side: 'L' }],
    peaks: peaksOf(buf),
  };
  console.log('  AUD09.wav 18.0s（开关在 12s）');
}

writeFileSync(join(ROOT, 'src/content/audio-timings.json'), JSON.stringify(timings, null, 1));
console.log('完成：public/arggame/audio/*.wav + src/content/audio-timings.json');
