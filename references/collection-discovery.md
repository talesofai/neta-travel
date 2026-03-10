# 玩法发现策略

## 概述

travel 的第一步是自动发现 Neta 平台上的互动玩法合集（collection）。支持自动推荐和手动指定两种模式。

## 自动发现

### 主要方式：suggest_content

```typescript
apis.recsys.suggestContent({
  page_index: 0,
  page_size: 20,
  scene: "agent_intent",
  business_data: {
    intent: "recommend",
    search_keywords: [],
    tax_paths: [],
    tax_primaries: [],
    tax_secondaries: [],
    tax_tertiaries: [],
    exclude_keywords: [],
    exclude_tax_paths: [],
  },
})
```

从 `module_list` 中提取有效 UUID：
```typescript
for (const item of result.module_list ?? []) {
  const uuid = item?.json_data?.uuid ?? item?.data_id ?? "";
  const name = item?.json_data?.name ?? "未知目的地";
  if (uuid) candidates.push({ uuid, name });
}
// 随机选取一个
const picked = candidates[Math.floor(Math.random() * candidates.length)];
```

### Fallback：interactiveList

当 suggest_content 返回空时：

```typescript
apis.feeds.interactiveList({ page_index: 0, page_size: 10 })
// 过滤 template_id === "NORMAL"
```

## 手动指定玩法

通过 `--collection_uuid` 跳过发现阶段，直接前往指定目的地：

```bash
npm start -- travel --collection_uuid "0a7a79e0-27a7-4281-8b2c-66064fa75185"
```

**常用玩法 UUID 参考：**

| 玩法名 | UUID |
|--------|------|
| 角色的运动报告 | `0a7a79e0-27a7-4281-8b2c-66064fa75185` |
| 爱你老己明天见（多格漫画） | `2855a5f4-1878-4d92-b901-0a44cb7f5582` |
| 角色异化 | `02946196-14c6-4340-a053-a80785271c39` |
| 出门太危险了带上这个 | `b98f6742-bb2e-4463-9575-48061dccc769` |
| 黑与白 | `a6eb5bb7-7017-4d0a-8522-446ef5e98c0c` |

> 玩法持续更新，建议通过自动发现获取最新玩法。

## 读取玩法详情

```typescript
const item = await apis.feeds.interactiveItem({ collection_uuid: uuid });

// 提取 coreInput（生图模板）
const coreInput =
  item.json_data?.cta_info?.launch_prompt?.core_input
  ?? item.json_data?.cta_info?.choices?.[0]?.core_input
  ?? "";
```

`coreInput` 是玩法作者定义的生图 prompt 模板，包含占位符供角色代入。

## 玩法 URL

每个玩法可在 Neta 网页端查看：
```
https://app.nieta.art/collection/interaction?uuid=<collection_uuid>
```
