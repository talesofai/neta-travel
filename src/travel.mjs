/**
 * Core travel logic:
 * 1. Read character + pictureUuid from SOUL.md
 * 2. Discover a collection (suggest_content → fallback interactiveList)
 * 3. Read collection details (coreInput template)
 * 4. Build prompt (inject character)
 * 5. Parse vtokens
 * 6. Generate image (with pictureUuid as reference)
 * 7. Poll until done
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseVtokens } from './prompts.mjs';
import { buildImagePayload } from './apis.mjs';

// ── SOUL.md reader ────────────────────────────────────────────────────────
export function readSoul(soulPath) {
  const content = readFileSync(resolve(soulPath), 'utf-8');
  const name = content.match(/- \*\*名字\*\*:\s*(.+)$/m)?.[1]
    ?.trim().replace(/(?:（龙虾化）|\(龙虾化\))$/, '').trim();
  if (!name) return null;

  const imgUrl = content.match(/- \*\*(?:龙虾图片|形象图片)\*\*:\s*(https?:\/\/[^\s]+)/m)?.[1];
  const pictureUuid = imgUrl?.match(/\/picture\/([a-f0-9-]+)\./)?.[1];
  return { name, pictureUuid };
}

// ── Collection discovery ──────────────────────────────────────────────────
async function discoverCollection(apis, log) {
  // Primary: suggest_content
  try {
    const res = await apis.suggestContent({
      page_index: 0, page_size: 20, scene: 'agent_intent',
      business_data: { intent: 'recommend', search_keywords: [], tax_paths: [],
        tax_primaries: [], tax_secondaries: [], tax_tertiaries: [],
        exclude_keywords: [], exclude_tax_paths: [] },
    });
    const candidates = (res?.module_list ?? [])
      .map(m => ({ uuid: m?.json_data?.uuid ?? m?.data_id, name: m?.json_data?.name ?? '未知目的地' }))
      .filter(c => c.uuid);
    if (candidates.length) {
      return candidates[Math.floor(Math.random() * candidates.length)];
    }
  } catch (e) { log?.warn('suggestContent failed, fallback:', e.message); }

  // Fallback: interactiveList
  const res = await apis.interactiveList({ page_index: 0, page_size: 10 });
  const items = (res?.module_list ?? []).filter(m => m.template_id === 'NORMAL');
  if (!items.length) throw new Error('没有发现可以旅行的玩法');
  const pick = items[Math.floor(Math.random() * items.length)];
  const uuid = pick?.json_data?.uuid ?? pick?.data_id;
  if (!uuid) throw new Error('发现玩法失败：缺少 collection uuid');
  return { uuid, name: pick?.json_data?.name ?? '未知目的地' };
}

// ── coreInput extractor ───────────────────────────────────────────────────
function extractCoreInput(ctaInfo) {
  return ctaInfo?.launch_prompt?.core_input?.trim()
    ?? ctaInfo?.choices?.[0]?.core_input?.trim()
    ?? '';
}

// ── Polling ───────────────────────────────────────────────────────────────
async function poll(taskStatus, taskUuid, { interval = 2000, timeout = 10 * 60 * 1000, onProgress } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const result = await taskStatus(taskUuid);
    onProgress?.(result.task_status);
    if (result.task_status !== 'PENDING' && result.task_status !== 'MODERATION') return result;
    await new Promise(r => setTimeout(r, interval));
  }
  return { task_uuid: taskUuid, task_status: 'TIMEOUT', artifacts: [] };
}

// ── Main travel function ──────────────────────────────────────────────────
export async function travel(apis, { soulPath = 'SOUL.md', collectionUuid, aspect = '1:1', log } = {}) {
  // 1. Read soul
  const soul = readSoul(soulPath);
  if (!soul) throw new Error('SOUL.md 中没有找到角色信息，请先执行 adopt 命令');
  log?.info(`character: ${soul.name}, pictureUuid: ${soul.pictureUuid}`);

  // 2. Discover collection
  let collection;
  if (collectionUuid) {
    collection = { uuid: collectionUuid, name: '指定目的地' };
  } else {
    collection = await discoverCollection(apis, log);
  }
  log?.info(`destination: ${collection.name} (${collection.uuid})`);

  // 3. Read collection details
  const item = await apis.interactiveItem({ collection_uuid: collection.uuid });
  const data = item?.json_data ?? {};
  const name = data.name ?? collection.name;
  const description = typeof data.description === 'string' ? data.description.slice(0, 100) : '';
  const url = `https://app.nieta.art/collection/interaction?uuid=${collection.uuid}`;
  const coreInput = extractCoreInput(data.cta_info);

  // 4. Build prompt
  const fallback = `@${soul.name}, ${name}, 梦幻风格, 高质量插画`;
  let prompt = coreInput
    ? coreInput
        .replace(/\{@character\}/g, `@${soul.name}`)
        .replace(/\{角色名称\}|\{角色名\}/g, soul.name)
        .replace(/（角色名称）/g, soul.name)
    : fallback;
  if (!prompt.includes(`@${soul.name}`)) prompt = `@${soul.name}, ${prompt}`;
  log?.info(`prompt: ${prompt.slice(0, 80)}...`);

  // 5. Parse vtokens
  let vtokens;
  try {
    vtokens = await parseVtokens(prompt, apis.searchTCPs);
  } catch (e) {
    if (coreInput && e.message?.includes('搜索关键字过多')) {
      vtokens = await parseVtokens(fallback, apis.searchTCPs);
    } else {
      throw e;
    }
  }

  // 6. Submit image generation
  const payload = buildImagePayload(vtokens, {
    aspect,
    collectionUuid: collection.uuid,
    pictureUuid: soul.pictureUuid,
  });
  const taskUuid = await apis.makeImage(payload);
  log?.info(`task submitted: ${taskUuid}`);

  // 7. Poll
  const result = await poll(apis.taskStatus, taskUuid, {
    onProgress: status => process.stdout.write(`\r  generating... [${status}]   `),
  });
  process.stdout.write('\n');

  return {
    character_name: soul.name,
    destination: { uuid: collection.uuid, name, description, url },
    image: {
      task_uuid: result.task_uuid ?? taskUuid,
      task_status: result.task_status,
      artifacts: result.artifacts ?? [],
    },
  };
}
