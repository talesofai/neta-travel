# 旅行完整流程说明

## 概述

`travel` 命令模拟角色"自动旅行"体验：在 Neta 平台上随机发现一个互动玩法合集，将角色代入玩法的生图模板，生成一张独特的旅行图片。

## 详细步骤

### Step 1：读取角色档案（SOUL.md）

从 `SOUL.md` 提取两个关键信息：

```
- **名字**: 关羽                          → character_name
- **形象图片**: https://oss.../xxx.webp   → picture_uuid（从 URL 提取）
```

picture_uuid 提取规则：
```
https://oss.talesofai.cn/picture/<picture_uuid>.webp
```

> ⚠️ 若 SOUL.md 缺少 `形象图片` 字段，`8_image_edit` 模型将没有参考图，导致生成 FAILURE。请先完整执行 `adopt` 命令。

---

### Step 2：发现玩法（suggest_content）

优先使用 `recsys.suggestContent` 获取推荐玩法列表：

```json
{
  "page_index": 0,
  "page_size": 20,
  "scene": "agent_intent",
  "business_data": {
    "intent": "recommend"
  }
}
```

从返回的 `module_list` 中随机选取一个有效 UUID。

若 suggest_content 失败，fallback 到 `feeds.interactiveList`：

```json
{ "page_index": 0, "page_size": 10 }
```

过滤 `template_id === "NORMAL"` 的条目。

---

### Step 3：读取玩法详情（read_collection）

```bash
feeds.interactiveItem({ collection_uuid: "<uuid>" })
```

提取：
- `json_data.name` → 目的地名称
- `json_data.description` → 目的地描述
- `json_data.cta_info.launch_prompt.core_input` → 生图模板（核心）

**coreInput 提取优先级：**
1. `cta_info.launch_prompt.core_input`
2. `cta_info.choices[0].core_input`
3. fallback：`@角色名, {玩法名}, 梦幻风格, 高质量插画`

---

### Step 4：构建 Prompt

将 coreInput 模板中的角色占位符替换为当前角色：

| 占位符 | 替换为 |
|--------|--------|
| `{@character}` | `@关羽` |
| `{角色名称}` / `{角色名}` | `关羽` |
| `（角色名称）` | `关羽` |

若模板中没有 `@关羽`，在开头追加 `@关羽, `。

**Prompt 示例（运动报告玩法）：**
```
@关羽, 参考角色封面图外貌设定进行生成，使用edit_image工具生成一张图片，
为选择的角色制作"关羽的每日活动"报告，比例为9：16...
```

---

### Step 5：生成图片（generateImage）

```typescript
buildMakeImagePayload(vtokens, {
  make_image_aspect: aspect,           // 默认 "1:1"
  context_model_series: "8_image_edit",
}, {
  collection_uuid: collectionUuid,     // 当前玩法 UUID
  picture_uuid: soulPictureUuid,       // ⭐ 角色形象图片 UUID（关键！）
})
```

通过 `artifact.makeImage()` 提交任务，轮询 `artifact.task(task_uuid)` 等待完成。

**状态流转：** `PENDING` → `MODERATION` → `SUCCESS` / `FAILURE`

轮询间隔：2 秒，超时：10 分钟

---

## 错误处理

| 错误 | 原因 | 解决方案 |
|------|------|---------|
| `SOUL.md中没有找到角色信息` | 未执行 adopt | 先运行 `npm start -- adopt` |
| `task_status: FAILURE` | 缺少形象图片 UUID | 确保 SOUL.md 包含 `形象图片` 字段 |
| `code 433 超过同时生成数量上限` | 并发超限 | 等待上一个任务完成后重试 |
| `搜索关键字过多` | Prompt 过长 | 自动 fallback 到通用 prompt |
| `没有发现可以旅行的玩法` | API 返回空 | 网络问题或 token 过期，重试 |

## 与 adopt 的关系

```
adopt（领养角色）
  ↓ 生成 SOUL.md（含角色名、形象图片URL）
travel（旅行）
  ↓ 读取 SOUL.md → 发现玩法 → 生成旅行图
```

travel 依赖 adopt 产生的 SOUL.md，特别是 `形象图片` 字段。
