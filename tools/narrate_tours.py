"""Regenerate the four synthetic walkthrough voiceovers with Kokoro TTS.

Run with: uv run --with kokoro --with soundfile python tools/narrate_tours.py
Requires ffmpeg on PATH. The original silent videos remain the visual source.
"""
from pathlib import Path
import subprocess
import tempfile

import soundfile as sf
from kokoro import KPipeline

ROOT = Path(__file__).resolve().parents[1] / "frontend/public/walkthroughs"
SCRIPTS = {
    "live-monitoring": "Start with service health and queue pressure. Open a failed execution to inspect its steps and checkpoint. Fluxera keeps the operating context together, so the team can decide what happens next.",
    "approved-recovery": "This resume request waits for an authorized person. Review the checkpoint and destination, then approve or reject. Approval queues delivery; only a linked execution event can verify recovery.",
    "cost-intelligence": "Observed spend is recorded separately from retry waste and estimated avoidable cost. Open an execution to see the attributed cost. These figures are illustrative, and Fluxera does not suppress customer work.",
    "five-layer-integrations": "Agents, APIs, workflows, tools, and memory share one execution trail. Inspect the receiver's idempotency support, then follow a failed workflow through its steps. All activity shown here is synthetic.",
}

pipeline = KPipeline(lang_code="a")
for slug, script in SCRIPTS.items():
    chunks = [audio for _, _, audio in pipeline(script, voice="af_heart", speed=1.08)]
    if not chunks:
        raise RuntimeError(f"No audio generated for {slug}")
    import numpy as np
    audio = np.concatenate(chunks)
    source = ROOT / f"{slug}.mp4"
    output = ROOT / f"{slug}.narrated.mp4"
    with tempfile.TemporaryDirectory() as directory:
        wave = Path(directory) / "voice.wav"
        sf.write(wave, audio, 24000)
        voice_duration = len(audio) / 24000
        source_duration = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(source)], text=True).strip())
        padding = max(0, voice_duration + 1 - source_duration)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(source), "-i", str(wave), "-filter_complex", f"[0:v]tpad=stop_mode=clone:stop_duration={padding:.3f}[v]", "-map", "[v]", "-map", "1:a", "-c:v", "libx264", "-crf", "22", "-preset", "fast", "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart", str(output)], check=True)
    output.replace(source)
    (ROOT / f"{slug}.txt").write_text(script + "\n\nIllustrative synthetic data.\n")
    print(f"{slug}: {voice_duration:.1f}s narration")
