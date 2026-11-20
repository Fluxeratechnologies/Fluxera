---
workflow: product-launch-video
flow: automation
storyboard: no
message: "Fluxera makes production work visible and recovery accountable: observe, approve, dispatch, verify."
destination: standalone-video
aspect: 1920x1080
language: en
audience: prospective design partners
length: 120s
angle: authenticated-product-walkthrough
voice: af_heart
---

## Intent

Create a roughly two-minute standalone walkthrough of the authenticated Fluxera dashboard. Show the operational product with illustrative synthetic data, not marketing claims or a public-site tour. Use a warm English female voice and synchronized captions. End with a television power-off transition into the Fluxera logo and getfluxera.com.

## Assets

- The local React application in `frontend/` supplies the actual dashboard interface.
- Synthetic isolated mock API data supplies safe execution, approval, recovery, cost, and audit states.

## Notes

- Do not use customer data, real machine keys, or live recovery webhooks.
- No website changes or embedded player are requested. Deliver an MP4, poster, captions, and transcript in this project.
- A successful webhook delivery is not a verified recovery; show linked SDK verification as a separate step.
