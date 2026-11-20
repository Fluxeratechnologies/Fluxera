const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = __dirname;
const scenes = JSON.parse(fs.readFileSync(path.join(root, 'scenes.json'), 'utf8'));
const bin = path.join(path.dirname(require.resolve('hyperframes/package.json')), 'bin/hyperframes.mjs');
const python = process.env.HYPERFRAMES_PYTHON || path.join(root, '.venv/bin/python');
fs.mkdirSync(path.join(root, 'audio'), { recursive: true });
const manifest = [];
for (const scene of scenes) {
  const output = path.join(root, 'audio', `${scene.id}.wav`);
  if (!fs.existsSync(output)) {
    const result = spawnSync(process.execPath, [bin, 'tts', scene.narration, '-o', output, '--voice', 'af_heart', '--json'], {
      cwd: root,
      env: { ...process.env, HYPERFRAMES_PYTHON: python },
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
    });
    if (result.status !== 0) throw new Error(`${scene.id}: ${result.stderr || result.stdout}`);
  }
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', output], { encoding: 'utf8' });
  const duration = Number(probe.stdout.trim());
  if (!Number.isFinite(duration)) throw new Error(`Could not probe ${output}`);
  manifest.push({ ...scene, audio: `audio/${scene.id}.wav`, audioDuration: duration, duration: Math.max(duration + 0.45, 8) });
  console.log(scene.id, duration.toFixed(2));
  fs.writeFileSync(path.join(root, 'timed-scenes.json'), JSON.stringify(manifest, null, 2));
}
