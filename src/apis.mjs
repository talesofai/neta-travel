/**
 * Minimal Neta API functions needed for travel:
 * - recsys.suggestContent   → discover collections
 * - feeds.interactiveList   → fallback collection list
 * - feeds.interactiveItem   → read collection details
 * - tcp.searchTCPs          → character/elementum lookup (for vtokens)
 * - artifact.makeImage      → submit image generation
 * - artifact.task           → poll task status
 */

export function createApis(client) {
  // ── Recsys ──────────────────────────────────────────────────────────────
  const suggestContent = (params) =>
    client.post('/v1/recsys/content', params).then(r => r.data);

  // ── Feeds ────────────────────────────────────────────────────────────────
  const interactiveList = (params) =>
    client.get('/v1/recsys/feed/interactive', { params }).then(r => r.data);

  const interactiveItem = (params) =>
    client.get('/v1/home/feed/interactive', {
      params: { collection_uuid: params.collection_uuid, page_index: 0, page_size: 1 },
    }).then(r => r.data.module_list[0]);

  // ── TCP (character / elementum lookup) ──────────────────────────────────
  const searchTCPs = (query) =>
    client.get('/v2/travel/parent-search', { params: query }).then(r => r.data);

  // ── Artifact ─────────────────────────────────────────────────────────────
  const makeImage = (payload) =>
    client.post('/v3/make_image', payload).then(r => r.data);

  const taskStatus = (taskUuid) =>
    client.get(`/v1/artifact/task/${taskUuid}`).then(r => r.data);

  return { suggestContent, interactiveList, interactiveItem, searchTCPs, makeImage, taskStatus };
}

// ── Image payload builder ─────────────────────────────────────────────────
const ASPECTS = {
  '1:1':  [512, 512],
  '3:4':  [576, 768],
  '4:3':  [768, 576],
  '9:16': [576, 1024],
  '16:9': [1024, 576],
};

export function buildImagePayload(vtokens, { aspect = '1:1', collectionUuid, pictureUuid } = {}) {
  const [width, height] = ASPECTS[aspect] ?? ASPECTS['1:1'];
  return {
    storyId: 'DO_NOT_USE',
    jobType: 'universal',
    rawPrompt: vtokens,
    width,
    height,
    meta: { entrance: 'PICTURE,VERSE' },
    inherit_params: {
      collection_uuid: collectionUuid,
      picture_uuid: pictureUuid,
    },
    context_model_series: '8_image_edit',
  };
}
