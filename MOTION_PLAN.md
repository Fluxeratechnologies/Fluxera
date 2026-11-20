# Fluxera motion implementation plan

## Direction

Use motion to explain how continuity moves through Fluxera. Public motion may be expressive and paced. Workspace motion confirms live state and human decisions without moving data while it is being read.

## Phase 1 — public narrative

- Reveal each major section once as it enters the viewport using opacity and 12px vertical movement.
- Stagger the four continuity steps and five integration cards.
- Choreograph each product scene internally: the failed execution enters first, followed by its supporting evidence and outcome.
- Keep the globe interactive. Disable its rotation when reduced motion is enabled.
- Switch product scenes only through direct user selection; do not autoplay the tabs.

Status: implemented. Browser verified in standard and reduced motion modes.

## Phase 2 — live workspace feedback

- Animate newly inserted SSE execution rows once, after confirmed server state arrives.
- Transition status color and approval button feedback after the API response.
- Keep existing rows and metrics stationary so operators can continue reading them.

Status: implemented. Bursts of SSE events are coalesced into one source-of-truth refresh, only the affected execution row acknowledges a confirmed update, and approval decisions transition only after the API succeeds.

## Phase 3 — validation and polish

- Test standard and reduced motion, including a live OS preference change.
- Check section reveals, tab controls, focus treatment, and mobile crops at 390px, tablet, and desktop widths.
- Confirm the public globe and product scenes remain complete static illustrations when motion is reduced.
- Review timing in a real browser and remove any motion that delays access to information.

Status: implemented. Production build and lint pass; desktop, 390px mobile, keyboard tabs, static fallback, standard motion, and reduced-motion rendering were verified in a real browser. The shared preference hook listens for live OS changes and all motion CSS retains immediate access to content.

## Motion tokens

- UI feedback: 140–220ms.
- Public explanatory entrances: 420–560ms.
- Enter and exit easing: `cubic-bezier(0.23, 1, 0.32, 1)`.
- On-screen movement: `cubic-bezier(0.77, 0, 0.175, 1)`.
- Reduced motion: remove translation and continuous movement; retain opacity and status-color feedback at 150ms or less.
