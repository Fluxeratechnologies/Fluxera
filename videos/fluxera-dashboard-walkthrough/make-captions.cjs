const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const scenes = JSON.parse(fs.readFileSync(path.join(root, 'timed-scenes.json'), 'utf8'));
const time = seconds => {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
  const m = String(Math.floor(ms / 60000) % 60).padStart(2, '0');
  const s = String(Math.floor(ms / 1000) % 60).padStart(2, '0');
  return `${h}:${m}:${s}.${String(ms % 1000).padStart(3, '0')}`;
};
let cursor = 0;
const cues = [];
for (const scene of scenes) {
  const sentences = scene.narration.match(/[^.!?]+[.!?]+/g)?.map(s => s.trim()) || [scene.narration];
  const totalWords = sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0);
  let sentenceStart = cursor + 0.15;
  for (const sentence of sentences) {
    const share = sentence.split(/\s+/).length / totalWords;
    const sentenceDuration = scene.audioDuration * share;
    cues.push({ start: sentenceStart, end: Math.min(cursor + scene.duration - 0.1, sentenceStart + sentenceDuration), text: sentence });
    sentenceStart += sentenceDuration;
  }
  cursor += scene.duration;
}
const vtt = ['WEBVTT', '', ...cues.flatMap((cue, i) => [String(i + 1), `${time(cue.start)} --> ${time(cue.end)}`, cue.text, ''])].join('\n');
const srt = cues.flatMap((cue, i) => [String(i + 1), `${time(cue.start).replace('.', ',')} --> ${time(cue.end).replace('.', ',')}`, cue.text, '']).join('\n');
const transcript = ['# Fluxera dashboard walkthrough', '', 'All interface data shown is illustrative synthetic data.', '', ...scenes.flatMap(scene => [`## ${scene.title}`, '', scene.narration, ''])].join('\n');
fs.writeFileSync(path.join(root, 'walkthrough.vtt'), vtt);
fs.writeFileSync(path.join(root, 'walkthrough.srt'), srt);
fs.writeFileSync(path.join(root, 'TRANSCRIPT.md'), transcript);
console.log(`${cues.length} cues; ${cursor.toFixed(2)} seconds`);
