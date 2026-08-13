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

## Day 1, session 3 — Aug 13, 2026 (the anti-distraction trio)

Three features designed around the ADHD reality that distraction is fought with environment design, not willpower:

- **Focus chip** — while a task runs, a small yellow chip follows the camera in the lower-right periphery: task name, countdown, and the first AI micro-step as the always-visible re-entry point. Answers "what was I doing?" without opening the panel. Implementation: child of the panel (inherits the working render context), world-position overridden every frame with a lazy-follow lerp toward camera-relative offsets.
- **Tunnel mode** — when a task is running on the card you're looking at, neighbor cards, non-running rows and the whole control strip disappear; only the running task, its controls and the coach remain. One thing looking at you instead of six.
- **Drift check-in** — the periodic reminder now asks "¿Seguís con [tarea]?" with two buttons: "Sigo ✓" (encouragement) and "Me distraje ↩" (no guilt: re-offers the smallest micro-step, silently counts drifts per task — data for future insights).
- **Debugging saga worth recording:** the chip was invisible through five hypotheses (occlusion by distance, camera parenting, canvas layering, back-face culling). The real culprit, found by logging camera pose vs chip position: **Lens Studio's `transform.forward` points to local +Z — the BACK of the view**. The chip had been placed 24 cm behind the user's head the whole time. One sign flip fixed it. Verified visually at multiple camera distances afterwards.

## Day 1, session 4 — Aug 13, 2026 (automatic multi-language)

- All user-facing strings extracted into `Strings.ts` with full English and Spanish tables: UI labels, coach messages, demo tasks, category names, and **the AI coach prompts** (system + user prompts per language, so the LLM answers in the user's language too).
- **Language auto-detection**: the lens reads the device's system language (`deviceInfoSystem.getSystemLanguage()`, guarded with a fallback) and picks the table — Spanish speakers get Spanish, everyone else gets English. A `FORCE_LANG` override exists for demo recordings. Adding a language = adding one table.
- Verified in preview: full UI rendering in English (cards, rows, controls, coach, check-in, post-it).

## Day 1, session 5 — Aug 13, 2026 (Focus Mode + AI Focus Assistant)

The evolution from "spatial task organizer" to "a spatial system that organizes your work AND helps you stay focused while doing it":

- **Capability analysis first** (per the design brief): three detection options were evaluated — head-pose heuristics (free, private, offline, already tracked for the chip), single-frame camera vision through the existing Remote Service Gateway OpenAI integration, and microphone (rejected as invasive). Chosen: **two-factor detection** — sustained pose deviation as the trigger, one AI vision frame as the verifier. Two independent signals before ever interrupting.
- **Focus Mode**: pressing ▶ now melts the entire UI away — cards, menus and controls disappear; what remains floating in the world is the task title, a large "12:43 remaining" countdown, and two minimal buttons (pause / done). The periphery chip stays as the look-away companion. Pause, done, skip or timer-end all restore the full organizer.
- **FocusSentinel** (new script): anchors the "work zone" (position + gaze direction at Play). Accumulates *sustained* away-time (>2 m or >75° for ~45 s; recovery credits at 2× speed when you return), 60 s startup grace, 3-minute cooldown between interventions — deliberately quiet, per the "never interrupt constantly" requirement.
- **AI vision verification**: on a sentinel candidate, one camera frame (Base64 JPEG) goes to GPT via RSG asking if the scene looks related to the task. "related" cancels the nudge and re-credits the user; "unrelated"/offline lets the nudge through (the sustained heuristic alone is already strong evidence). 8 s timeout race, everything wrapped so failures never break the flow.
- **The nudge**: one short rotating message ("Hey! Focus — you're almost done!") + soft chime, auto-clears after 7 s. Localized EN/ES like everything else.
- Verified in preview: Focus Mode strips the UI to task + clock + nudge + chip; restore works; compile and boot clean.

## Day 1, session 6 — Aug 13, 2026 (design direction: kawaii notebook + cloud companion)

Flor delivered the visual direction: a hand-drawn spiral notebook agenda (pastel washi-tape task strips, DO FIRST/NEXT/LATER badges, side tabs HOME/WORK/ME TIME) with a **cloud mascot as the physical embodiment of the AI coach** — it comments in the agenda and becomes the floating companion (with timer + task) in Focus Mode. Feasibility mapped 1:1 onto the existing architecture; asset production split agreed (Flor produces transparent PNGs, Claude integrates).

Structural work done ahead of the assets:
- **6 categories → 3 tabs** (Home / Work / Me time) per the design, including automatic migration of previously saved 6-card states (Trabajo→Work, Casa+Comida→Home, Relax+Amigos+Hiperfoco→Me time). Verified: an old saved state restored with merged cards.
- **Priority badges**: rows now show 🔥 (do first) / ⭐ (next) / 🍃 (later) instead of P1/P2/Pn.

## Day 2 — Aug 14, 2026 (the kawaii notebook skin)

Flor produced the full asset kit (notebook pages with baked tabs/spiral per category, washi task strips with baked checkboxes, DO FIRST/NEXT/LATER badges, colored play buttons, round icon bar, the cloud mascot with speech bubble). Claude integrated it as a complete visual layer swap with zero logic changes:

- Runtime `Component.Image` quads for every visual (pages, strips, badges, plays, icons, cloud) — runtime-created Images ship without a material, so each clones the UIKit `Image.mat`; textures assigned per element.
- Baked-in elements became **invisible hotspots**: the strip checkbox completes the task, the side tabs (HOME/WORK/ME TIME) jump between pages, the whole strip opens the task post-it.
- The bottom bar follows the design exactly (add / priority± / time / remind / more); secondary actions (−5m, skip, list scroll) moved into a "more" popover.
- **The AI coach now speaks from the cloud's bubble** — its real RSG-generated messages render inside the mascot's speech balloon, and the Focus-Mode companion chip is now the cloud itself with the timer in its bubble.
- Localized date on the page header; priority badges render as the design's stamped labels; done tasks show ✓ and drop their badge.
- Debug note: preview camera exploration required querying the runtime scene for the panel's world position (0,0,−110) after camera moves lost it.
