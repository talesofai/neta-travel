#!/usr/bin/env node
import 'dotenv/config';
import { parseArgs } from 'node:util';
import { createClient } from '../src/client.mjs';
import { createApis } from '../src/apis.mjs';
import { travel } from '../src/travel.mjs';

const { values } = parseArgs({
  options: {
    soul_path:       { type: 'string', default: process.env.SOUL_PATH ?? 'SOUL.md' },
    collection_uuid: { type: 'string' },
    aspect:          { type: 'string', default: '1:1' },
    help:            { type: 'boolean', short: 'h' },
  },
  strict: false,
});

if (values.help) {
  console.log(`
Usage: neta-travel [options]

Options:
  --soul_path <path>        SOUL.md 文件路径 (default: SOUL.md or \$SOUL_PATH)
  --collection_uuid <uuid>  指定目的地玩法 UUID（不指定则自动发现）
  --aspect <ratio>          图片比例 1:1 | 3:4 | 4:3 | 9:16 | 16:9 (default: 1:1)
  -h, --help                显示帮助

Environment:
  NETA_TOKEN                Neta API token (required)
  NETA_API_BASE_URL         API base URL (default: https://api.talesofai.cn)
  SOUL_PATH                 Default SOUL.md path
`);
  process.exit(0);
}

const token = process.env.NETA_TOKEN;
if (!token) {
  console.error('❌ NETA_TOKEN is required. Set it in .env or environment.');
  process.exit(1);
}

const baseUrl = process.env.NETA_API_BASE_URL ?? 'https://api.talesofai.cn';
const client = createClient(baseUrl, token);
const apis = createApis(client);

try {
  const result = await travel(apis, {
    soulPath: values.soul_path,
    collectionUuid: values.collection_uuid,
    aspect: values.aspect,
    log: { info: () => {}, warn: console.warn },
  });
  console.log(JSON.stringify({ travel: result }, null, 2));
} catch (err) {
  console.error(JSON.stringify({ error: { type: err.name, code: err.code, message: err.message } }));
  process.exit(1);
}
