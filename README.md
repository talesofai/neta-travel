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

  **Prerequisites:** SOUL.md with character name + portrait image; neta-skills configured.
  **Stream feedback after each step — don't batch.**
  **Speed:** Push forward immediately. If image poll >30s, output a waiting message.
  **Language:** Match trigger language. Stick to it unless user switches.
  **Interaction:** All next-step choices as clickable quick-reply buttons. Click sends `@{bot_name} {option}`.
  **Output:** Character dialogue and images output directly. Narration/system messages use discord plugin.
---

# Neta Travel

Take a Neta character into a world that matches their soul — explore curated scenes, generate personalized travel images, collect 5 stops to unlock an interactive atlas.

**Related:** [neta-skills](https://github.com/talesofai/neta-skills)

---

## Language

Detect from trigger word before first output: Chinese → Chinese, English → English, other → follow user. Switch only if user explicitly requests it.

---

## Pre-flight (silent)

**Neta Skills:** Check `~/.openclaw/workspace/skills/neta/` or `~/.openclaw/workspace/neta-skills/`. If missing, output `⚙️ Integrating Neta Skills...` then:
```bash
mkdir -p ~/.openclaw/workspace/skills && cd ~/.openclaw/workspace/skills
git clone https://github.com/talesofai/neta-skills.git neta && cd neta && npm install 2>/dev/null || true
```

**Token:** Check `NETA_TOKEN` env → `~/.openclaw/workspace/.env` → `~/.openclaw/config.json`. If missing:
```
⚠️ NETA_TOKEN required. Add it to ~/.openclaw/workspace/.env
```

---

## Steps

> Output feedback after each step immediately. Don't wait for all steps to finish.

### Step 1 · Read character (silent, local)

From SOUL.md:
- `名字` → `character_name` (strip trailing `（龙虾化）`)
- `形象图片` or `龙虾图片` URL → extract UUID → `picture_uuid`
- Other fields (personality, background, tags) → used for world matching

> ⚠️ Missing `形象图片` = no reference image = generation FAILURE. Run adopt first.

### Step 2 · Find matching world

Using neta-skills world search, find the world that best fits the character's personality, background, and tags. Extract:
- Total worlds in Neta universe → `world_count`
- Matched world name → `world_name`
- World description → `world_description` (2–4 paragraphs: setting, rules, atmosphere, character fit)

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

**Segment 3:**
```
  ╔══════════════════════════════════════════╗
  ║  World: {world_name}                     ║
  ╚══════════════════════════════════════════╝
```

Output `world_description` paragraphs one by one, each as a separate message.

**Segment 4:**
```
  ════════════════════════════════════════════
  {character_name} and this world share an inexplicable gravity.
  ════════════════════════════════════════════
```

Button: `Explore 🌀` → `@{bot_name} explore`

---

## Exploration (after user clicks Explore)

### Step 4 · Find destination

Maintain `visited_uuids` in memory. Exclude on every call.

`suggest_content({ page_size:20, scene:"agent_intent", intent:"recommend" })` — filter `visited_uuids`, pick randomly from remaining.

Fallback: `feeds.interactiveList({ page_size:20 })` filtered to `template_id === "NORMAL"`.

Output:
```
🌀 Portal opening...
📍 Destination locked: {destination_name}
```

### Step 5 · Load scene (~200ms)

`feeds.interactiveItem({ collection_uuid })`

Extract prompt template: `cta_info.launch_prompt.core_input` → `cta_info.choices[0].core_input` → fallback: `@{character_name}, {world_name}, {destination_name}, high quality illustration`

### Step 6 · Build prompt + resolve character vtoken (<100ms)

**Replace placeholders:**

| Placeholder | Replace with |
|-------------|-------------|
| `{@character}` | `@{character_name}` |
| `{角色名称}` / `{角色名}` / `（角色名称）` | `{character_name}` |

Prepend `@{character_name}` if not present.

**Resolve character TCP UUID for precise image binding:**
```
GET /v2/travel/parent-search?keywords={character_name}&parent_type=oc&sort_scheme=exact&page_index=0&page_size=1
```

Build vtokens:
- If found: `{ type:"oc_vtoken_adaptor", uuid, name, value:uuid, weight:1 }`, strip `@{character_name}` from text
- Strip `参考图-*` / `图片捏-*` tokens (picture ref goes via `inherit_params`)
- Remaining text → `{ type:"freetext", value:text, weight:1 }`
- If not found: fallback to `prompt.parseVtokens(text)`. On "too many keywords" error, retry with simple prompt.

### Step 7 · Submit image (~480ms)

```json
artifact.makeImage({
  "vtokens": [...],
  "make_image_aspect": "1:1",
  "context_model_series": "8_image_edit",
  "inherit_params": { "collection_uuid": "...", "picture_uuid": "..." }
})
```

Output: `🎨 Painting the scene...`

### Step 8 · Poll result (10–30s server-side)

`artifact.task(task_uuid)` every 500ms. States: `PENDING → MODERATION → SUCCESS / FAILURE`

- >30s: `⏳ Rendering is taking a bit longer, almost there...`
- code 433: wait 5s, retry silently
- FAILURE: `⚠️ Lost the way this stop — try a different destination?`

---

## Station Display

On SUCCESS, output in this order:

**1. Character scene (before image):**
```
🎭 [{destination_name}]

{1–2 sentences: environment and atmosphere on arrival}

{character_name}: {first-person reaction matching SOUL.md personality and speech style}
({action/expression, 1 sentence})
```

**2. Header + image (URL on its own line — auto-embeds):**
```
━━━━━━━━━━━━━━━━━━━━━━━━
Stop {round} · {destination_name}
{image_url}
```

**3. Progress:**

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

**Default — interactive map:** Each stop's image is a landmark on an adventure-style map (parchment / pixel / star chart). Click any landmark to expand image + destination name + scene link + stop number. Match map vibe to character.

**Custom:** Any layout (gallery, card wall, timeline, magazine). Keep click-to-expand interaction.

Save to `~/.openclaw/workspace/pages/travel_{character_name}_{date}.html`. Ask for username once per session → output share link on its own line:
```
🔗 https://claw-{username}-pages.talesofai.com/travel_{character_name}_{date}.html
```

Offer re-customization after each generation: `Want a different style? Just describe it ✨`

---

## Errors

| Error | Cause | Fix |
|-------|-------|-----|
| Character not in SOUL.md | adopt not run | Run adopt first |
| `task_status: FAILURE` | Missing picture_uuid | Ensure SOUL.md has `形象图片` |
| code 433 | Concurrent limit | Auto-retry after 5s |
| "Too many keywords" | Prompt too long | Auto-fallback to simple prompt |
| No scenes found | Empty API / expired token | Retry |
| World search no result | Sparse character tags | Use default recommended world |
