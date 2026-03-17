---
name: neta-travel
description: |
  Take a Neta character on a random adventure — one stop at a time, collect 5 stops to generate a travel atlas.

  **Auto-trigger (no explicit request needed):**
  - Right after completing adopt
  - User mentions: travel / explore / let's go / take me somewhere / random
  - User says "more" / "continue" in a travel image context

  **Prerequisites:** SOUL.md with character name + portrait image field; neta-skills configured.
  **Stream feedback after each step — don't batch.**
  **Speed:** Push forward immediately. If image poll exceeds 30s, output a waiting message.
  **Language:** Match trigger language (Chinese → Chinese, English → English). Stick to it unless user switches.
  **Interaction:** All next-step choices must be clickable quick-reply buttons. Click sends `@{bot_name} {option}`.
---

# Neta Travel

Auto-travel a Neta character — random scene discovery, personalized image generation, 5 stops unlock an interactive travel atlas.

**Related:** [neta-skills](https://github.com/talesofai/neta-skills)

---

## Opening

Read SOUL.md silently. Output immediately on trigger (don't wait for read):
```
🦞 On it! Waking up the character...
```

Once character name is read:
```
══════════════════════════════════════
🌍 Neta World Map loading...

500+ scenes waiting — battlefields, bathrooms, dreamscapes, deep sea...
Every stop is a random warp. You never know where you'll land next.

One personalized image per stop. Hit 5 stops to unlock your Travel Atlas 📖.

Current character: {character_name}
══════════════════════════════════════
Go with {character_name}, or swap characters?
```

Buttons: `Go with {character_name} 🚀` → `@{bot_name} go` · `Swap character 🔄` → `@{bot_name} swap`

On confirm: `✨ {character_name} is ready! Stop 1, let's go!`
On swap: prompt user to run adopt first.

---

## Pre-flight Checks (silent)

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

### Step 1 · Read character (<1ms)

From SOUL.md:
- `名字` → `character_name` (strip trailing `（龙虾化）`)
- `形象图片` or `龙虾图片` URL → extract UUID segment → `picture_uuid`

> ⚠️ Missing `形象图片` = no reference image = generation FAILURE. Run adopt first.

### Step 2 · Find destination (~80ms)

Maintain `visited_uuids` in memory. Exclude on every call.

```json
suggest_content({ "page_index":0, "page_size":20, "scene":"agent_intent", "business_data":{"intent":"recommend"} })
```

Fallback if empty or all visited: `feeds.interactiveList({ page_index:0, page_size:20 })` filtered to `template_id === "NORMAL"`.

Output:
```
🌀 Portal opening...
📍 Destination locked: {destination_name}
```

### Step 3 · Load scene (~200ms)

`feeds.interactiveItem({ collection_uuid })`

Extract prompt template (in order): `cta_info.launch_prompt.core_input` → `cta_info.choices[0].core_input` → fallback: `@{character_name}, {destination_name}, fantasy style, high quality illustration`

### Step 4 · Build prompt + resolve character vtoken (<100ms)

**Replace placeholders in template:**

| Placeholder | Replace with |
|-------------|-------------|
| `{@character}` | `@{character_name}` |
| `{角色名称}` / `{角色名}` / `（角色名称）` | `{character_name}` |

If result doesn't contain `@{character_name}`, prepend it.

**Resolve character TCP UUID for precise image binding:**
```
GET /v2/travel/parent-search?keywords={character_name}&parent_type=oc&sort_scheme=exact&page_index=0&page_size=1
```

**Build vtokens array:**
- If character found: add `{ type:"oc_vtoken_adaptor", uuid:char.uuid, name:char.name, value:char.uuid, weight:1 }`, then strip `@{character_name}` from prompt text
- Strip any `参考图-*` / `图片捏-*` tokens from text (picture reference goes via `inherit_params` instead)
- Remaining text (if any): add `{ type:"freetext", value:promptText, weight:1 }`
- If character not found: fallback to `prompt.parseVtokens(promptText)`. On "too many keywords" error, retry with fallback prompt.

### Step 5 · Submit image (~480ms)

```json
artifact.makeImage({
  "vtokens": [...],
  "make_image_aspect": "1:1",
  "context_model_series": "8_image_edit",
  "inherit_params": { "collection_uuid": "...", "picture_uuid": "..." }
})
```

Output: `🎨 Painting the scene...`

### Step 6 · Poll result (10–30s server-side)

`artifact.task(task_uuid)` every 500ms. States: `PENDING → MODERATION → SUCCESS / FAILURE`

- >30s: `⏳ Rendering is taking a bit longer, almost there...`
- code 433: wait 5s, retry silently
- FAILURE: `⚠️ Lost the way this stop — try a different destination?`

---

## Station Display

On SUCCESS, output in this order:

**1. Character scene simulation (before image):**
```
🎭 [{destination_name}]

{1–2 sentences: environment and atmosphere as the character arrives}

{character_name}: {first-person reaction matching SOUL.md personality and speech style}
({action/expression, 1 sentence})
```

**2. Station header + image URL (URL on its own line — Discord auto-embeds):**
```
━━━━━━━━━━━━━━━━━━━━━━━━
Stop {round} · {destination_name}
{image_url}
```

**3. Progress bar + message:**

| Stop | Bar | Message |
|------|-----|---------|
| 1 | `▓░░░░  1/5` | 🌟 Stop 1 done! 4 more to unlock your atlas. Keep going? |
| 2 | `▓▓░░░  2/5` | ✨ Two stops in! Atlas is getting closer~ |
| 3 | `▓▓▓░░  3/5` | 🔥 Halfway! Two more and the atlas is yours! |
| 4 | `▓▓▓▓░  4/5` | ⚡ One stop away! The atlas is within reach! |
| 5+ | `▓▓▓▓▓  5/5 🎉` | Atlas unlocked! Type "generate atlas" to seal this adventure, or keep exploring~ |

**4. Buttons:**

< 5 stops: `Continue 🗺️` → `@{bot_name} continue` · `Call it a day 👋` → `@{bot_name} end`

≥ 5 stops: add `Generate Atlas 📖` → `@{bot_name} generate atlas`

---

## Travel Atlas (user-triggered)

Triggers on: "generate atlas" / "atlas" / "gallery" / "html"

Ask for style first:
```
What style for the atlas? (skip = default map)
e.g. retro film / starmap / pixel game / minimal white...
```

**Default — interactive map:** Each stop's image is a landmark on an adventure-style map (parchment / pixel / star chart). Click any landmark to expand image + destination name + scene link + stop number. Match the map vibe to the character.

**Custom style:** Any layout (gallery, card wall, timeline, magazine). Keep click-to-expand interaction.

Save to `~/.openclaw/workspace/pages/travel_{character_name}_{date}.html`

After saving, ask for username once per session:
```
📖 {character_name}'s travel atlas is sealed!
Your pages username? → https://claw-{username}-pages.talesofai.com
```

Output share link on its own line. Reuse username if already given this session. Offer re-customization: `Want a different style? Just describe it ✨`

---

## Errors

| Error | Cause | Fix |
|-------|-------|-----|
| Character not in SOUL.md | adopt not run | Run adopt first |
| `task_status: FAILURE` | Missing picture_uuid | Ensure SOUL.md has `形象图片` |
| code 433 | Concurrent limit | Auto-retry after 5s |
| "Too many keywords" | Prompt too long | Auto-fallback to simple prompt |
| No scenes found | Empty API / expired token | Retry |

## Common Scene UUIDs

| Scene | UUID |
|-------|------|
| Bathroom scene (good first stop) | `9251d699-86d4-4ebd-b648-26c939e55bc6` |
| Character sports report | `0a7a79e0-27a7-4281-8b2c-66064fa75185` |
| Multi-panel comic | `2855a5f4-1878-4d92-b901-0a44cb7f5582` |
| Character transformation | `02946196-14c6-4340-a053-a80785271c39` |
| Too dangerous to go alone | `b98f6742-bb2e-4463-9575-48061dccc769` |
| Black and white | `a6eb5bb7-7017-4d0a-8522-446ef5e98c0c` |
