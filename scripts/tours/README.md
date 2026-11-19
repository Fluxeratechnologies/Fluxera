# Fluxera product walkthroughs

Four recordings of the real React interface, with isolated browser API fixtures. Every recording displays **Illustrative synthetic data**. These explain the UI; they are not evidence of a production recovery, real customer savings, or uptime.

The browser context intercepts API calls and contains a recording-only session. Nothing is added to production authentication, no customer data is loaded, and no recovery webhook is sent.

## Reproduce

Run the frontend at `http://127.0.0.1:5173`. Use Playwright with Chrome and its video-capture binary installed. `PLAYWRIGHT_MODULE` may point to an installed Playwright ESM entry point; otherwise the script resolves `playwright` normally.

```sh
node scripts/tours/record.mjs
```

Clone https://github.com/DharambirAgrawal/clip-agent to a separate tools directory, checkout `703ec66fa8740537aefcd20ff04e1e8b68c9f35f`, install its `mcp-server` dependencies, and run `npm run build` there. Ensure its ffmpeg/ffprobe binaries are installed. Then:

```sh
CLIP_AGENT_ROOT=/absolute/path/to/clip-agent node scripts/tours/export.mjs
```

ClipAgent's `renderProjectVideo` applies the trim and rounded frame treatment. Full-screen framing keeps edge-aligned approval notices and synthetic-data labels readable. A final ffmpeg remux places MP4 metadata at the front for web playback. ClipAgent stays an offline tool, not a Fluxera runtime dependency. Its source is not vendored into Fluxera. Source project files and footage live under ignored `output/tours/`; exported media, posters, English WebVTT captions and transcripts are under `frontend/public/walkthroughs/`.

All clips are silent with selectable captions. First-load recording frames are trimmed. The site uses native controls, inline mobile playback, poster frames, and `preload="none"`; it does not autoplay. Regenerate fixtures and recordings when the console changes. Record the eventual database-backed pilot separately once the integration plan's acceptance gates pass.

## Browser QA hygiene

The shared preview browser can retain Playwright's fixed viewport after a test, leaving blank space when its window is enlarged. After viewport tests, clear the CDP `Emulation.clearDeviceMetricsOverride` override or close the automated browser and open a normal tab. Never ship fixed document widths to compensate for browser emulation.
