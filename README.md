# ☁️ Focus Organizer — an ADHD-friendly spatial planner for SPECS

A spatial experience that **organizes your work and helps you stay focused while doing it** — designed with ADHD minds at the center. Built for the [CLAD Summer Hackathon](https://lenslist.co/clad-summer-hackathon), Week 1: *Organize*.

> Your to-do list becomes a cozy kawaii notebook floating in your space, a cloud companion powered by AI keeps you company, and when you press play the world quiets down so you can do one thing at a time.

## Why ADHD-first

Distraction isn't fought with willpower — it's fought with **environment design**. Every feature maps to a real executive-function need:

| ADHD reality | What the lens does |
|---|---|
| Task initiation is the hardest step | AI breaks any task into micro-steps; the first is always tiny |
| Time blindness | Realistic AI time estimates (with a kind buffer), always editable |
| Visual overload | **Focus Mode**: press play and the whole UI melts away |
| "What was I doing?" | The cloud companion follows in your periphery with task + countdown |
| Drifting off unnoticed | Two-factor distraction detection (head pose + AI vision) nudges you **only** on sustained, verified signals |
| Shame spirals | Guilt-free coach language everywhere; "I drifted" is a button, not a failure |
| Finished ≠ rewarded | Completing celebrates, sinks the task, and auto-promotes the next to DO FIRST |

## Features

- **Kawaii notebook** with three tabs (Home / Work / Me time): washi-tape task strips, DO FIRST / NEXT / LATER badges, hand-drawn font, tap-to-jump side tabs, draggable scroll.
- **Task post-it**: notes, ✨ AI estimate (OpenAI via Remote Service Gateway; offline heuristic fallback), micro-step checklist, edit / time / remind / delete.
- **Focus Mode**: play → clean space, soft 10-second ticks, cloud companion with the timer, pause/done.
- **AI Focus Assistant**: sustained head-pose drift triggers a single camera frame verified by GPT vision; only a clear "unrelated scene" produces a gentle nudge ("Hey! Focus — you're almost done!") with a 3-minute cooldown.
- **Drift check-ins**: "Still on it ✓ / I drifted ↩" — re-offers the smallest step, silently counts drifts.
- **Meditation mini-player**: your own tracks, auto-advancing playlist.
- **Persistence**: tasks, notes, estimates and settings survive sessions on-device.
- **Auto multi-language** (English/Spanish) from the device's system language — including the AI coach's replies.

## Built with CLAD

This project was pair-built by **Flor Raffa** (concept, ADHD-first design direction, full illustrated asset kit) and **Claude (Anthropic)** working inside Lens Studio through the Lens Studio MCP server — writing TypeScript, driving the scene, taking preview screenshots and verifying every feature in-loop. The complete AI-assisted process, including debugging sagas and design iteration rounds, is documented in [CLAD-LOG.md](CLAD-LOG.md).

## Tech

- Lens Studio **5.23.1** — SPECS project
- Spectacles Interaction Kit 2.0 (hands, interactables, manipulation) + UI Kit
- Remote Service Gateway: OpenAI (`gpt-4.1-nano`) with Gemini fallback — estimates, coaching, vision verification
- `persistentStorageSystem` for on-device state; localized strings in `Assets/Scripts/Strings.ts`

## Run it

1. Open `THDA 2.esproj` in Lens Studio 5.22+.
2. Log into Snapchat and configure your Remote Service Gateway token (Lens Studio → RSG plugin). Without it, AI features fall back to offline heuristics — the lens still works.
3. (Optional) Drag your meditation audio files into the `meditationTracks` input on the `FocusOrganizerPanel` object.
4. Press play in the preview, or push to SPECS.

## Credits

- **Design & art**: Flor Raffa — every illustration (notebook pages, washi strips, cloud companion, post-it, buttons) is original art.
- **Font**: Cheese Milky.
- **Code**: TypeScript co-written with Claude via CLAD.

*Designed with ADHD in mind. Not a medical device.*
