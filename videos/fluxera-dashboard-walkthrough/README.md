# Fluxera dashboard walkthrough

The rendered [MP4](renders/fluxera-dashboard-walkthrough.mp4) is a 2:09 walkthrough of the authenticated Fluxera console. All dashboard data is illustrative and synthetic. The browser capture uses an isolated mock API; it does not contact a customer workspace or recovery webhook.

The final media also includes [captions](walkthrough.vtt), a [transcript](TRANSCRIPT.md), and a [poster](poster.jpg). The composition, source captures, narration clips, and generation scripts are kept here for editing.

To regenerate locally, install Node dependencies with `npm install`, create `.venv` with Python 3.12 and `pip install -r requirements.txt`, then run the frontend Vite server on port 5173. Run `node capture-dashboard.cjs`, `node generate-audio.cjs`, `node make-captions.cjs`, and `node build-composition.cjs` in that order. Validate with `npm run check` before `npm run render`.
