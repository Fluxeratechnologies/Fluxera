// Uses the user's selected ClipAgent exporter as an offline production tool.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const clipRoot = process.env.CLIP_AGENT_ROOT;
if (!clipRoot) throw new Error('Set CLIP_AGENT_ROOT to a built ClipAgent checkout');
const { renderProjectVideo } = await import(pathToFileURL(path.join(clipRoot, 'mcp-server/dist/staticLayoutExporter.js')));
const { saveProject } = await import(pathToFileURL(path.join(clipRoot, 'mcp-server/dist/projectStore.js')));
const source = path.resolve('output/tours');
const destination = path.resolve('frontend/public/walkthroughs');
await mkdir(destination, { recursive: true });
const stamp = seconds => new Date(Math.round(seconds * 1000)).toISOString().slice(11, 23);
for (const slug of ['live-monitoring', 'approved-recovery', 'cost-intelligence', 'five-layer-integrations']) {
  const meta = JSON.parse(await readFile(path.join(source, `${slug}.json`), 'utf8'));
  const trimStart = meta.captions[0].start;
  const project = { version: 1, videoPath: path.join(source, `${slug}.webm`), editor: {
    aspectRatio: 'native', trimRegions: [{ startMs: 0, endMs: trimStart * 1000 }], padding: 12, borderRadius: 8, shadowIntensity: .15,
    // Keep edge-aligned labels and approval notices inside the frame.
    zoomRegions: [],
  } };
  await saveProject(path.join(source, `${slug}.recordly`), project);
  const rendered = path.join(source, `${slug}-edited.mp4`);
  await renderProjectVideo(project, rendered, { mode: 'accurate', crf: 23, preset: 'fast' });
  execFileSync('ffmpeg', ['-y', '-i', rendered, '-c', 'copy', '-movflags', '+faststart', path.join(destination, `${slug}.mp4`)], { stdio: 'ignore' });
  execFileSync('ffmpeg', ['-y', '-i', path.join(source, `${slug}.png`), '-q:v', '3', path.join(destination, `${slug}.jpg`)], { stdio: 'ignore' });
  await writeFile(path.join(destination, `${slug}.vtt`), 'WEBVTT\n\n' + meta.captions.map((c,i) => `${i+1}\n${stamp(c.start - trimStart)} --> ${stamp(c.end - trimStart)}\n${c.text}\n`).join('\n'));
  await writeFile(path.join(destination, `${slug}.txt`), `${meta.title}\nIllustrative synthetic data. Recorded from the Fluxera React interface.\n\n${meta.captions.map(c => c.text).join('\n\n')}\n`);
  console.log(`Exported ${slug}`);
}
