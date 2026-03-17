#!/usr/bin/env node
/**
 * travel.js — standalone Neta travel helper, zero external dependencies
 *
 * Commands:
 *   node travel.js soul [soul_path]                    → {name, picture_uuid}
 *   node travel.js adopt <char_name> [soul_path]       → writes SOUL.md, {name, picture_uuid}
 *   node travel.js suggest [exclude_csv]               → {uuid, name}
 *   node travel.js gen <char_name> <pic_uuid> <uuid>   → {scene, status, url, collection_uuid}
 *
 * Token: NETA_TOKEN env → ~/.openclaw/workspace/.env → ~/developer/clawhouse/.env
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, dirname } from 'node:path';

const BASE = 'https://api.talesofai.cn';

function getToken() {
  if (process.env.NETA_TOKEN) return process.env.NETA_TOKEN;
  for (const p of [
    resolve(homedir(), '.openclaw/workspace/.env'),
    resolve(homedir(), 'developer/clawhouse/.env'),
  ]) {
    try {
      const m = readFileSync(p, 'utf8').match(/NETA_TOKEN=(.+)/);
      if (m) return m[1].trim();
    } catch { /* try next */ }
  }
  throw new Error('NETA_TOKEN not found. Add it to ~/.openclaw/workspace/.env');
}

const HEADERS = {
  'x-token': getToken(),
  'x-platform': 'nieta-app/web',
  'content-type': 'application/json',
};

async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method, headers: HEADERS,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

const log = msg => process.stderr.write(msg + '\n');
const out = data => console.log(JSON.stringify(data));
const [,, cmd, ...args] = process.argv;

// ── poll helper ───────────────────────────────────────────────────────────────

async function pollTask(task_uuid, maxMs = 180000) {
  const interval = 500;
  const maxIter = maxMs / interval;
  let warnedSlow = false;
  for (let i = 0; i < maxIter; i++) {
    await new Promise(r => setTimeout(r, interval));
    if (!warnedSlow && i >= 60) { log('⏳ Rendering is taking a bit longer, almost there...'); warnedSlow = true; }
    const result = await api('GET', `/v1/artifact/task/${task_uuid}`);
    if (result.task_status !== 'PENDING' && result.task_status !== 'MODERATION') return result;
  }
  return { task_status: 'TIMEOUT', artifacts: [] };
}

// ── soul ─────────────────────────────────────────────────────────────────────

if (cmd === 'soul') {
  const paths = [
    args[0],
    resolve(homedir(), '.openclaw/workspace/SOUL.md'),
    resolve(homedir(), 'developer/clawhouse/SOUL.md'),
  ].filter(Boolean);

  let content;
  for (const p of paths) {
    try { content = readFileSync(p, 'utf8'); break; } catch { /* try next */ }
  }
  if (!content) throw new Error('SOUL.md not found. Run: travel adopt "<name>"');

  const name = content.match(/名字[^：:\n]*[：:]\s*([^\n*]+)/)?.[1]
    ?.trim().replace(/（龙虾化）$/, '').replace(/\*+/g, '');
  const picUuid = content
    .match(/\/picture\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/)?.[1];

  if (!name) throw new Error('No 名字 field in SOUL.md. Run: travel adopt "<name>"');
  out({ name, picture_uuid: picUuid ?? null });
}

// ── adopt ─────────────────────────────────────────────────────────────────────

else if (cmd === 'adopt') {
  const charName = args[0];
  if (!charName) throw new Error('Usage: travel.js adopt "<character_name>" [soul_path]');
  const soulPath = args[1] ?? resolve(homedir(), 'developer/clawhouse/SOUL.md');

  log(`🔍 Looking up character: ${charName}`);

  // 1. Search TCP for character
  const search = await api('GET',
    `/v2/travel/parent-search?keywords=${encodeURIComponent(charName)}&parent_type=oc&sort_scheme=exact&page_index=0&page_size=1`);
  const char = search.list?.find(r => r.type === 'oc');
  if (!char) throw new Error(`Character "${charName}" not found in Neta TCP. Try a different name.`);

  log(`✅ Found: ${char.name} (${char.uuid})`);

  // 2. Fetch an existing portrait from the character's image feed
  log('🖼️  Fetching existing portrait...');
  const feed = await api('GET',
    `/v1/home/feed/interactive?oc_uuid=${char.uuid}&page_index=0&page_size=10`);

  let imageUrl = null;
  for (const m of (feed.module_list ?? [])) {
    for (const page of (m.json_data?.displayData?.pages ?? [])) {
      for (const img of (page.images ?? [])) {
        if (img.url?.includes('/picture/') && img.url?.endsWith('.webp')) {
          imageUrl = img.url;
          break;
        }
      }
      if (imageUrl) break;
    }
    if (imageUrl) break;
  }

  if (!imageUrl) throw new Error(`No existing portrait found for "${charName}". Check the character name or try again.`);

  const picUuid = imageUrl.match(/\/picture\/([0-9a-f-]{36})/)?.[1];
  log(`✅ Portrait found: ${imageUrl}`);

  // 3. Write SOUL.md
  const today = new Date().toISOString().slice(0, 10);
  const soulContent = `# SOUL.md — ${charName}\n\n## 我的身份\n\n- **名字**: ${charName}\n- **领养日期**: ${today}\n- **形象图片**: ${imageUrl}\n`;

  mkdirSync(dirname(soulPath), { recursive: true });
  writeFileSync(soulPath, soulContent, 'utf8');
  log(`📝 SOUL.md written to: ${soulPath}`);

  out({ name: charName, picture_uuid: picUuid, soul_path: soulPath, image_url: imageUrl });
}

// ── suggest ───────────────────────────────────────────────────────────────────

else if (cmd === 'suggest') {
  const exclude = (args[0] ?? '').split(',').filter(Boolean);

  const data = await api('POST', '/v1/recsys/content', {
    page_index: 0, page_size: 20, scene: 'agent_intent',
    business_data: {
      intent: 'recommend',
      search_keywords: [], tax_paths: [],
      tax_primaries: [], tax_secondaries: [], tax_tertiaries: [],
      exclude_keywords: [], exclude_tax_paths: [],
    },
  });

  let candidates = (data.module_list ?? [])
    .filter(m => m.template_id === 'NORMAL' && !exclude.includes(m.data_id));

  if (!candidates.length) {
    const fb = await api('GET', '/v1/recsys/feed/interactive?page_index=0&page_size=20');
    candidates = (fb.module_list ?? [])
      .filter(m => m.template_id === 'NORMAL' && !exclude.includes(m.data_id));
  }

  if (!candidates.length) throw new Error('No destinations found. Check token or network.');

  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  out({ uuid: pick.data_id, name: pick.json_data?.name ?? pick.data_id });
}

// ── gen ───────────────────────────────────────────────────────────────────────

else if (cmd === 'gen') {
  const [charName, picUuid, collectionUuid] = args;
  if (!charName || !collectionUuid)
    throw new Error('Usage: travel.js gen <char_name> <pic_uuid> <collection_uuid>');

  // 1. Fetch scene + prompt template
  const feedData = await api('GET',
    `/v1/home/feed/interactive?collection_uuid=${collectionUuid}&page_index=0&page_size=1`);
  const item = feedData.module_list?.[0];
  if (!item) throw new Error(`Scene not found: ${collectionUuid}`);

  const sceneName = item.json_data.name;
  const cta = item.json_data?.cta_info ?? {};
  let promptTemplate = cta.launch_prompt?.core_input ?? cta.choices?.[0]?.core_input ?? null;

  if (!promptTemplate && cta.interactive_config?.verse_uuid) {
    const verse = await api('GET', `/v1/verse/preset/${cta.interactive_config.verse_uuid}`)
      .catch(() => null);
    promptTemplate = verse?.launch_prompt?.core_input ?? null;
  }
  if (!promptTemplate) promptTemplate = `@${charName}, ${sceneName}, 高质量插画`;

  log(`🔍 Scene loaded: ${sceneName}`);

  // 2. Replace placeholders
  let promptText = promptTemplate
    .replace(/\{@character\}/g, charName)
    .replace(/\{角色名称\}|\{角色名\}|（角色名称）/g, charName);

  // 3. Resolve character TCP UUID → oc_vtoken_adaptor
  const search = await api('GET',
    `/v2/travel/parent-search?keywords=${encodeURIComponent(charName)}&parent_type=oc&sort_scheme=exact&page_index=0&page_size=1`);
  const char = search.list?.find(r => r.type === 'oc');

  const vtokens = [];
  if (char) {
    vtokens.push({ type: 'oc_vtoken_adaptor', uuid: char.uuid, name: char.name, value: char.uuid, weight: 1 });
    promptText = promptText.replace(new RegExp(`@${charName}[,，\\s]*`, 'g'), '').trim();
  }
  // Strip reference image tokens (handled via inherit_params instead)
  promptText = promptText.replace(/参考图-\S+/g, '').replace(/图片捏-\S+/g, '').trim();
  if (promptText) vtokens.push({ type: 'freetext', value: promptText, weight: 1 });

  // 4. Submit
  log('🎨 Painting the scene...');
  const taskUuid = await api('POST', '/v3/make_image', {
    storyId: 'DO_NOT_USE', jobType: 'universal',
    rawPrompt: vtokens,
    width: 576, height: 768,
    meta: { entrance: 'PICTURE,VERSE' },
    context_model_series: '8_image_edit',
    inherit_params: {
      collection_uuid: collectionUuid,
      ...(picUuid ? { picture_uuid: picUuid } : {}),
    },
  });
  const task_uuid = typeof taskUuid === 'string' ? taskUuid : taskUuid?.task_uuid;
  log(`⏳ task: ${task_uuid}`);

  // 5. Poll every 500ms (max 3 min)
  const result = await pollTask(task_uuid);
  out({ scene: sceneName, task_uuid, status: result.task_status, url: result.artifacts?.[0]?.url ?? null, collection_uuid: collectionUuid });
}

else {
  process.stderr.write('Usage: node travel.js soul | adopt <name> [soul_path] | suggest [exclude_csv] | gen <char_name> <pic_uuid> <collection_uuid>\n');
  process.exit(1);
}
