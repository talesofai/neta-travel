/**
 * Prompt parsing: converts "@角色名, /元素名, 描述词" into vtokens array.
 * Extracted from neta-skills/utils/prompts.js + apis/prompt.js
 */

const SEPARATORS = [',', '，', '。', ';', '；', '!', '！', '?', '？'];

function parseParts(str) {
  const chars = [...str];
  let offset = 0;
  const parts = [];
  let current = '';
  while (offset < chars.length) {
    const ch = chars[offset++];
    if (ch === '\\') { current += chars[offset++] ?? '\\'; }
    else if (SEPARATORS.includes(ch)) { parts.push(current.trim()); current = ''; }
    else { current += ch; }
  }
  parts.push(current.trim());
  return parts.filter(Boolean);
}

function extractWeight(str) {
  const segs = str.split(':');
  if (segs.length > 1) {
    const w = parseFloat(segs[segs.length - 1]);
    if (!Number.isNaN(w)) return [segs.slice(0, -1).join(':'), Math.min(Math.max(0.1, w), 2)];
  }
  return [str, 1];
}

/** Parse a single prompt token into a typed descriptor */
function parsePart(str) {
  if (str.startsWith('@')) {
    const [name, weight] = extractWeight(str.slice(1));
    return { type: 'character', name, weight };
  }
  if (str.startsWith('/')) {
    const [name, weight] = extractWeight(str.slice(1));
    return { type: 'elementum', name, weight };
  }
  return { type: 'text', value: str, weight: 1 };
}

/**
 * Convert prompt string to vtokens, resolving @character and /elementum via API.
 * Falls back to freetext if lookup fails.
 */
export async function parseVtokens(prompt, searchTCPs) {
  const parts = parseParts(prompt);
  const vtokens = [];

  for (const part of parts) {
    const desc = parsePart(part);

    if (desc.type === 'text') {
      vtokens.push({ type: 'freetext', weight: desc.weight, value: desc.value });
      continue;
    }

    if (desc.type === 'character' || desc.type === 'elementum') {
      try {
        const results = await searchTCPs({
          keyword: desc.name,
          types: desc.type === 'character' ? ['character'] : ['elementum'],
          page_index: 0,
          page_size: 1,
        });
        const hit = results?.list?.[0] ?? results?.data?.[0] ?? results?.[0];
        if (hit?.uuid) {
          vtokens.push(desc.type === 'elementum'
            ? { uuid: hit.uuid, name: hit.name ?? desc.name, value: hit.uuid, type: 'elementum', weight: desc.weight }
            : { uuid: hit.uuid, name: hit.name ?? desc.name, value: hit.uuid, type: 'oc_vtoken_adaptor', weight: desc.weight }
          );
          continue;
        }
      } catch { /* fallthrough to freetext */ }
      // fallback
      vtokens.push({ type: 'freetext', weight: 1, value: desc.name });
    }
  }

  return vtokens.length ? vtokens : [{ type: 'freetext', weight: 1, value: prompt }];
}
