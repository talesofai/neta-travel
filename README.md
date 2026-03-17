---
name: neta-travel
description: |
  After adopting a character (or on heartbeat/manual trigger), take the character on a Neta world
  adventure — find a matching world, explore curated scenes, generate one personalized image per stop,
  collect 5 stops to unlock an interactive travel atlas.

  **Auto-trigger:**
  - After adopt completes and user clicks "Explore this world"
  - User mentions: travel / explore / let's go / wander / random
  - User says "more" / "continue" in a travel image context

  **Prerequisites:** SOUL.md with character name + portrait image. No external dependencies.
  **Stream feedback after each step — don't batch.**
  **Speed:** Push forward immediately. If image poll >30s, output a waiting message.
  **Language:** Match trigger language. Stick to it unless user switches.
  **Interaction:** All next-step choices as clickable quick-reply buttons. Click sends `@{bot_name} {option}`.
  **Output:** Character dialogue and images output directly. Narration/system messages use discord plugin.
---

# Neta Travel

Take a Neta character into a world that matches their soul — explore curated scenes, generate
personalized travel images, collect 5 stops to unlock an interactive atlas.

---

## Setup (silent, first run only)

**travel.js:** Check `~/.openclaw/workspace/skills/neta-travel/travel.js`. If missing:
```bash
mkdir -p ~/.openclaw/workspace/skills && cd ~/.openclaw/workspace/skills
git clone https://github.com/talesofai/neta-travel.git && cd neta-travel
```

**Token:** Check `NETA_TOKEN` env → `~/.openclaw/workspace/.env` → `~/developer/clawhouse/.env`. If missing:
```
⚠️ NETA_TOKEN required. Add it to ~/.openclaw/workspace/.env
```

All commands below run as `node ~/.openclaw/workspace/skills/neta-travel/travel.js <cmd>`.
Shorthand in this doc: `travel <cmd>`.

**Adopt (if no SOUL.md or no portrait image):**
```bash
travel adopt "<character_name>"
```
Looks up the character in the TCP database, generates a portrait image, and writes `~/developer/clawhouse/SOUL.md`.
Custom path: `travel adopt "<name>" /path/to/SOUL.md`

---

## Language

Detect from trigger word: Chinese → Chinese, English → English, other → follow user.
Switch only if user explicitly requests it.

---

## Steps

> Output feedback after each step immediately.

### Step 0 · Adopt (if no SOUL.md, silent)

```
travel adopt "{character_name}"  →  { name, picture_uuid, soul_path, image_url }
```

If SOUL.md is missing or has no `形象图片`, run adopt first. Searches TCP for character, generates a portrait, writes SOUL.md automatically. ~30–60s one-time cost.

### Step 1 · Read character (silent, <1ms)

```
travel soul  →  { name, picture_uuid }
```

Reads SOUL.md. Extracts `名字` → `character_name`, `形象图片` UUID → `picture_uuid`.

> ⚠️ Missing `形象图片` = no reference image = generation FAILURE. Run Step 0 first.

### Step 2 · Generate world context (LLM, no API)

Based on character's personality, background, and tags from SOUL.md, infer:
- `world_name` — a Neta world that fits the character's soul
- `world_description` — 2–4 paragraphs: setting, rules, atmosphere, character fit
- `world_count` — use `500+` (no API needed)

### Step 3 · Opening (segmented output)

**Segment 1:**
```
╔══════════════════════════════════════════════╗
║           N E T A   U N I V E R S E          ║
╚══════════════════════════════════════════════╝

  Worlds mapped: {world_count}
  Every world holds a story waiting to happen.
```

**Segment 2:**
```
  ────────────────────────────────────────────
  Scanning soul frequency for {character_name}...
  ████████████████████████  Match found
  ────────────────────────────────────────────
```

**Segment 3:** Output `world_name` reveal, then `world_description` paragraphs one by one:
```
  ╔══════════════════════════════════════════╗
  ║  World: {world_name}                     ║
  ╚══════════════════════════════════════════╝
  {world_description_paragraph_1}
  {world_description_paragraph_2}  ...
```

**Segment 4:**
```
  ════════════════════════════════════════════
  {character_name} and this world share an inexplicable gravity.
  ════════════════════════════════════════════
```

Button: `Explore 🌀` → `@{bot_name} explore`

---

## Exploration (after user clicks Explore)

Maintain `visited_uuids` list in memory throughout the session.

### Step 4 · Find destination (~1s)

```
travel suggest {visited_uuids joined by comma}  →  { uuid, name }
```

Calls recsys recommend API, excludes visited UUIDs. Falls back to interactive feed if empty.

Output:
```
🌀 Portal opening...
📍 Destination locked: {name}
```

### Step 5–8 · Generate image (30–60s)

```
travel gen "{character_name}" "{picture_uuid}" "{uuid}"
→  { scene, status, url, collection_uuid }
```

Internally:
1. Fetches scene prompt template from collection
2. Resolves character TCP UUID → builds `oc_vtoken_adaptor` vtoken for precise character binding
3. Submits to `8_image_edit` model with character reference image
4. Polls until `SUCCESS` / `FAILURE`

Output as each stage completes:
```
🔍 Scene loaded: {scene}
🎨 Painting the scene...
⏳ Rendering is taking a bit longer, almost there...  ← only if >30s
```

On FAILURE: `⚠️ Lost the way this stop — try a different destination?`

---

## Station Display

On SUCCESS, output in this order:

**1. Character scene (before image):**
```
🎭 [{scene}]

{1–2 sentences: environment and atmosphere on arrival}

{character_name}: {first-person reaction matching SOUL.md personality and speech style}
({action/expression, 1 sentence})
```

**2. Header + image (URL on its own line — auto-embeds):**
```
━━━━━━━━━━━━━━━━━━━━━━━━
Stop {round} · {scene}
{url}
```

**3. Progress + add `collection_uuid` to `visited_uuids`:**

| Stop | Bar | Message |
|------|-----|---------|
| 1 | `▓░░░░  1/5` | 🌟 Stop 1! 4 more to unlock your atlas. Keep going? |
| 2 | `▓▓░░░  2/5` | ✨ Two in! Atlas is getting closer~ |
| 3 | `▓▓▓░░  3/5` | 🔥 Halfway! Two more and the atlas is yours! |
| 4 | `▓▓▓▓░  4/5` | ⚡ One stop away! Atlas within reach! |
| 5+ | `▓▓▓▓▓  5/5 🎉` | Atlas unlocked! Type "generate atlas" or keep exploring~ |

**4. Buttons:**

< 5 stops: `Continue 🗺️` → `@{bot_name} continue` · `Call it a day 👋` → `@{bot_name} end`

≥ 5 stops: add `Generate Atlas 📖` → `@{bot_name} generate atlas`

---

## Travel Atlas (user-triggered)

Triggers on: "generate atlas" / "atlas" / "gallery" / "html"

Ask for style preference:
```
What style for the atlas? (skip = default map)
e.g. retro film / starmap / pixel game / minimal white...
```

**Default — interactive map:** Each stop's image as a landmark on an adventure-style map
(parchment / pixel / star chart). Click to expand image + scene name + stop number.
Match map style to character vibe.

**Custom:** Any layout (gallery, card wall, timeline, magazine). Keep click-to-expand.

Save to `~/.openclaw/workspace/pages/travel_{character_name}_{date}.html`.
Ask for username once per session → output share link on its own line:
```
🔗 https://claw-{username}-pages.talesofai.com/travel_{character_name}_{date}.html
```

Offer re-customization: `Want a different style? Just describe it ✨`

---

## Errors

| Error | Cause | Fix |
|-------|-------|-----|
| SOUL.md not found | adopt not run | `travel adopt "<name>"` |
| `task_status: FAILURE` | Missing/invalid picture_uuid | Re-run adopt to get valid portrait |
| Portrait generation failed | TCP lookup failed + bad prompt | Try exact character name |
| code 433 | Concurrent limit | Auto-retry after 5s |
| HTTP 4xx on gen | Expired token | Refresh NETA_TOKEN |
| No destinations found | Empty API response | Check token / network, retry |
