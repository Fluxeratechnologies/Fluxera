# Fluxera design system

## Direction

Fluxera pairs a restrained, proof-forward public site with a compact operational console. The public experience borrows Mireye's measured light composition—without reusing its assets or copy—while the authenticated workspace uses source-owned BoardUI components and semantic tokens.

The interface should communicate three things immediately: what is running, what requires a human decision, and what has been verified. Motion explains those state changes; it is not ambient decoration.

## Public tokens

- **Canvas:** `#ffffff`
- **Soft surface:** `#f0efe9`
- **Structural line:** `#dfded8`
- **Ink:** `#111111`
- **Muted text:** `#666666`
- **Interactive accent:** `#3454d1`
- **Healthy status:** `#3f6b2a`
- **Failure status:** `#b3341a`
- **Typeface:** Geist, with Inter and system sans-serif fallbacks
- **Content width:** 1176px
- **Radii:** 8–14px on public controls and media frames

The public shell stays light and editorial. Use shadows sparingly, maintain thin borders, and avoid generic card grids where a ruled sequence communicates the relationship more clearly.

## Public composition

1. Sticky capsule navigation with Product, How it works, Integrations, FAQ, sign-in, and request-access actions.
2. Two-column hero: concise continuity proposition and one interactive COBE globe.
3. Proof band naming the five execution layers.
4. Observe → Decide → Dispatch → Verify sequence.
5. Five integration-layer examples with real platform marks.
6. Keyboard-operated staged product walkthroughs.
7. Accountability FAQ and request-access form.

The globe uses deterministic synthetic execution markers and must never expose workspace telemetry. It supports pointer dragging, a static SVG fallback, and reduced-motion mode.

## Workspace system

Authenticated surfaces use BoardUI's semantic color, typography, focus, and dark-mode tokens. Prefer the installed components in `frontend/src/components/base`, `application`, and `foundations`; do not recreate them with unrelated raw styles.

The workspace prioritizes operational triage:

- service and worker health;
- queue backlog and scheduler lag;
- pending approvals;
- current execution activity;
- recovery history and verification;
- integrations, costs, audit history, and policy settings.

Machine `fx_` keys never unlock the human console. Dashboard sessions and workspace roles determine access to all workspace actions.

## Motion

- Public section entrances: 420–560ms, opacity plus at most 12px translation.
- Operational feedback: 140–220ms.
- SSE changes highlight only the affected row after confirmed server state arrives.
- Approval feedback begins only after the API succeeds.
- Do not autoplay walkthrough tabs or move existing operational rows.
- Under `prefers-reduced-motion`, remove continuous rotation and spatial transforms while retaining brief opacity and status-color feedback.

## Accessibility

- Maintain visible `:focus-visible` treatment.
- Use semantic tablists, tables, navigation, status regions, and dialog roles.
- Make every SVG or canvas experience understandable through accessible text.
- Keep status meaning in text as well as color.
- Preserve keyboard controls and focus when product tabs or dialogs change.
- Public media remains poster-first until captioned Fluxera recordings are available.

## Guardrails

- Use Fluxera-owned copy, synthetic public data, and licensed/source-owned components.
- Never imply that webhook delivery proves recovery; linked SDK telemetry performs verification.
- Keep observed cost and estimated avoidable cost visibly distinct.
- Do not introduce scroll hijacking, autoplay carousels, parallax, or decorative loops in the console.
