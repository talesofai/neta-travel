---
name: neta-travel
description: |
  让 Neta 角色自动"旅行" —— 发现平台玩法合集，代入角色生成旅行图片。

  **主动触发时机（无需用户明确要求）：**
  - 刚完成 `adopt` 领养角色后，主动提议："要不要让 TA 去旅行看看？"
  - 对话中出现角色名 + 探索/冒险/出发/去哪/玩什么等语义
  - 用户说"再来一些"、"继续"、"多来几张"且上下文是旅行图片

  **被动触发关键词：**
  旅行 / travel / 去玩 / 出发 / 带我去 / 探索 / 随机玩法 / 生成旅行图

  **前置条件：** 已有角色档案（SOUL.md，含 `形象图片` 字段）+ NETA_TOKEN 环境变量。
---

# Neta Travel Skill

让角色自动发现 Neta 平台上的玩法合集，并代入角色生成一张旅行图片。

## 前置条件

1. 已准备好角色档案 `SOUL.md`（含 `形象图片` 字段）—— 可通过 [clawhouse](https://github.com/huxiuhan/clawhouse) 的 `adopt` 命令生成
2. 已安装本包：`npm install`（仅需 axios + dotenv）
3. 已设置环境变量 `NETA_TOKEN`

## 核心命令

### 自动旅行（随机发现玩法）

```bash
node bin/cli.mjs
```

自动执行三步：`suggest_content` → `read_collection` → 生成图片

### 指定目的地旅行

```bash
node bin/cli.mjs --collection_uuid "<玩法UUID>"
```

### 指定角色档案

```bash
node bin/cli.mjs --soul_path "/path/to/SOUL.md"
```

### 指定图片比例

```bash
node bin/cli.mjs --aspect "9:16"
# 可选：1:1 | 3:4 | 4:3 | 9:16 | 16:9（默认 1:1）
```

### 组合用法

```bash
node bin/cli.mjs \
  --soul_path "./SOUL.md" \
  --collection_uuid "0a7a79e0-27a7-4281-8b2c-66064fa75185" \
  --aspect "9:16"
```

## 旅行工作流

```
SOUL.md（角色档案）
    ↓ 读取角色名 + 形象图片UUID
suggest_content（发现玩法）
    ↓ 随机选取一个合集
read_collection（读取玩法详情）
    ↓ 提取 coreInput 模板
构建 prompt（@角色名 + 玩法模板）
    ↓
generateImage（生成旅行图片）
    ↓
返回：目的地信息 + 图片URL
```

📖 [详细流程说明](./references/travel-workflow.md)

## 输出示例

```json
{
  "travel": {
    "character_name": "关羽",
    "destination": {
      "uuid": "0a7a79e0-...",
      "name": "【捏捏开荒团】角色的运动报告",
      "description": "为选择的角色制作每日活动报告...",
      "url": "https://app.nieta.art/collection/interaction?uuid=..."
    },
    "image": {
      "task_status": "SUCCESS",
      "artifacts": [{ "url": "https://oss.talesofai.cn/picture/..." }]
    }
  }
}
```

## 参考文档

| 场景 | 文档 |
|------|------|
| 🗺️ 旅行完整流程 | [travel-workflow.md](./references/travel-workflow.md) |
| 🔍 玩法发现策略 | [collection-discovery.md](./references/collection-discovery.md) |

## 关键注意事项

- **必须传入角色形象图片 UUID**：travel 使用 `8_image_edit` 模型，需要角色参考图。SOUL.md 中的 `形象图片` 字段会自动提取，缺失会导致生成 FAILURE
- **并发上限**：同时最多 2 个生成任务，超出会报 code 433
- **玩法随机性**：每次旅行目的地不同，可用 `--collection_uuid` 固定目的地
