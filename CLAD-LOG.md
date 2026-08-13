# CLAD Log — Focus Organizer (Week 1 "Organize")

Development log of AI-assisted development with Claude Code (CLAD) in Lens Studio 5.23.1. Newest entries last.

## Before this log — how the baseline was built (early August 2026)

The first version of the lens was built iteratively with AI assistance inside Lens Studio (Claude Code + the Lens Studio MCP server): the 6-card pastel carousel, per-card task lists with priorities and timers, index-finger swipe navigation, the Spectacles keyboard flow, focus reminders, and the AI coach through Remote Service Gateway (OpenAI with Gemini fallback and offline canned messages). Key human+AI design decisions from that phase:

- **Opaque pastel surfaces only** — dark/transparent plates disappear on optical see-through displays. The `BackPlate` tint has to be applied *after* `onInitialized`, because the component's built-in dark style silently overwrites earlier tints.
- **Guilt-free coach language** — short messages, no medical claims, "skip without guilt" as a first-class action.
- **Custom index-finger drag** for carousel navigation (direct plane-touch detection against the panel, with depth thresholds), because pinch-only navigation felt heavy for ADHD users.

## Day 1 of submission sprint — Aug 13, 2026

**Session goal:** turn the prototype into a submittable entry: audit, public repo, persistence.

- Claude audited all 5 scripts (~730 lines) and the delivery requirements against the hackathon rules, and flagged: no git repo (required), no CLAD log (50% of judging), no persistence between sessions, spatial presence limited to a billboard panel, English deliverables pending.
- **Repo:** verified no credentials live in the project (RSG token stays in Lens Studio app preferences; `.mcp.json` with the local MCP bearer token was already gitignored), extended `.gitignore` with Lens Studio local state (`Cache/`, `Workspaces/`, `PluginsUserPreferences/`, `Support/`), `git init`, baseline commit.
- **Persistence (Claude-authored):** `FocusPersist.ts` (JSON wrapper over `persistentStorageSystem`), `serialize()/restore()` on `FocusOrganizerState` with input sanitizing (clamped numbers, whitelisted statuses), save hooks on every mutation plus a 10-second autosave while a task runs. Design decision: a task that was running when the lens closed **restores as paused** — resuming focus is the user's decision, not the system's.
- **Verified end-to-end in preview via MCP:** started a task (countdown 14:54, row highlighted), reset the lens, log shows `estado restaurado de la sesión anterior` and the task came back at 14:49, paused. Debugging note: SIK interactables in preview need a press-hold-release gesture sequence when injected programmatically; real finger taps are unaffected.

**Next:** spatial "focus chip" companion (mini timer that follows the running task into the periphery), English UI strings for the demo, demo video + README + description in English, public repo push.

## Day 1, session 2 — Aug 13, 2026 (fluid carousel + task note paper with AI estimates)

Two UX upgrades requested by Flor, implemented by Claude through the Lens Studio MCP:

- **Continuous carousel drag** — replaced the threshold-fires-once swipe with cards that follow the finger (`onDragProgress` event streaming -1..1 from both the index-finger plane drag and 2D touch), with scale/depth blending toward the incoming card and a 30% snap threshold on release. The snap lands where the cards already are, so there is no visual jump.
- **Task note paper ("papelito")** — tapping a task now opens a cream paper over the card: free-form note (Spectacles keyboard), editable time estimate, and a **✨ estimate button**: OpenAI (via Remote Service Gateway) reads the title + note and returns JSON with a realistic ADHD-aware estimate (with buffer), 2-4 micro-steps (first one under 5 minutes to beat task initiation), and a short encouragement. Estimate lands in the task timer (still editable with −5m/+5m), steps render numbered on the paper, everything persists.
- **Resilience decision:** the RSG call races an 8-second `DelayedCallbackEvent` timeout and falls back to a local heuristic (minutes from note length, steps from note lines) so the flow works with no network and never hangs. JSON from the model is sanitized (clamped minutes, capped steps).
- **Verified in preview:** drag-snap logged `snap por arrastre continuo`; paper opened with placeholder, estimate button visible; end-to-end estimate validated via a temporary debug call — remote OpenAI responded in ~1.4s: `estimación: 10 min, 4 pasos` (debug line removed afterwards). Persistence restore confirmed again after recompile.
- **Tooling note:** injected preview gestures trigger SIK interactables only ~50% of the time (needs press-hold-release); real finger taps are unaffected. Preview persistent storage sometimes clears on script recompile; on-device storage is unaffected.
