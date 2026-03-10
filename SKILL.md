---
name: neta-travel
description: |
  让 Neta 角色随机旅行 —— 每次一站，展示图片后询问是否继续，积累 5 张后可生成 HTML 相册。

  **主动触发时机（无需用户明确要求）：**
  - 刚完成 adopt 领养角色后，主动提议让 TA 去旅行
  - 对话中出现：旅行 / travel / 出发 / 去探索 / 随机玩玩 / 带我去
  - 用户说"再来一些"、"继续"且上下文是旅行图片时

  **前置条件：** 已有 SOUL.md（含角色名 + 形象图片字段）；已配置 neta-skills。
  **无需安装任何额外工具。**
---

# Neta Travel — 自动旅行总规划

## 概览

每次执行**一站旅行**，完成后展示图片并询问用户是否继续。
积累满 5 张成功图片后，提醒用户可生成 HTML 相册。

```
首次启动
 ├─ 读取 SOUL.md → 获取角色名 + 形象图片UUID
 └─ 输出开场 → 开始第 1 站

每站流程
 ├─ suggest_content → 随机选一个玩法
 ├─ 输出：📍 目的地已发现
 ├─ read_collection → 读取玩法详情 + coreInput
 ├─ 输出：🎨 正在生成...
 ├─ make_image → 生成旅行图片
 ├─ 输出结果：站名 + 链接 + 图片（Discord 单行）
 ├─ 记录到本次会话的旅行列表
 └─ 询问用户：继续旅行？/ 生成相册？/ 结束？

满 5 张时
 └─ 额外提醒：已可生成旅行相册 HTML
```

---

## Step 0 — 首次启动准备

从 SOUL.md 提取：

| 字段 | 说明 |
|------|------|
| `- **名字**: 关羽` | → `character_name` |
| `- **形象图片**: https://oss.talesofai.cn/picture/<uuid>.webp` | → `picture_uuid`（取 URL 中的 UUID） |

若 SOUL.md 缺少 `形象图片` 字段，**停止并提示**用户先完成 adopt。

**立即输出开场：**
```
🦞 旅行开始！
角色：{character_name}
正在随机发现第一个目的地...
```

---

## Step 1 — 发现玩法

**调用前输出：**
```
━━━━━━━━━━━━━━━━━━━━━━━━
🗺️ 第 {round} 站出发中
正在随机发现目的地...
```

```bash
pnpm start suggest_content \
  --page_index 0 --page_size 20 \
  --scene agent_intent --intent recommend
```

从返回的 `module_list` 中随机选取一个有效 `uuid`（跳过本次会话已访问过的）。

**选定后立即输出：**
```
📍 目的地：{destination_name}
```

---

## Step 2 — 读取玩法详情

```bash
pnpm start read_collection --uuid "<collection_uuid>"
```

提取：
- `name` → 目的地名称
- `collection.remix.launch_prompt.core_input` → 生图模板（coreInput）

若 coreInput 为空，fallback：
```
@{character_name}, {destination_name}, 梦幻风格, 高质量插画
```

---

## Step 3 — 构建 Prompt

1. 将 coreInput 中的占位符替换为角色：
   - `{@character}` → `@{character_name}`
   - `{角色名称}` / `{角色名}` / `（角色名称）` → `{character_name}`

2. 若 prompt 中没有 `@{character_name}`，在开头追加。

3. 若有 `picture_uuid`，确保 prompt 包含 `参考图-全图参考-{picture_uuid}`。

**示例：**
```
@关羽, 参考图-全图参考-13dab6ed-bd69-4835-83f4-9fef9dd97998, 生成一幅7格漫画...
```

---

## Step 4 — 生成图片

**提交前输出：**
```
🎨 正在生成旅行图片，请稍候...
```

```bash
pnpm start make_image \
  --prompt "<构建好的prompt>" \
  --aspect "1:1"
```

等待完成（PENDING → SUCCESS/FAILURE）。

---

## Step 5 — 展示结果 + 询问

**成功时输出：**
```
✅ 第 {round} 站 · {destination_name}
🔗 {collection_url}
```

图片单独一行（Discord 自动展开）：
```
{image_url}
```

**若已累积满 5 张成功图片，额外输出提醒：**
```
📸 已完成 5 次旅行！可以输入「生成相册」查看完整旅行日记 HTML。
```

**询问用户下一步：**
```
继续旅行 🗺️ / 生成相册 📸 / 结束 👋
```

记录结果：
```json
{ "round": 1, "destination_name": "...", "collection_uuid": "...", "image_url": "...", "status": "SUCCESS" }
```

> ⚠️ 若 FAILURE：输出失败提示，直接进入询问环节（不计入成功次数）。
> ⚠️ 并发上限为 2，每次生成一张，等完成再发。
> ⚠️ code 433：等待 5 秒后重试。

---

## Step 6 — 生成 HTML 相册（用户触发）

当用户说「生成相册」/「看相册」/「html」时，用当前会话的所有成功结果生成：

```html
<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<title>{character_name} 的旅行日记</title>
<style>
  body { background: #0d1117; color: #e6edf3; font-family: sans-serif; margin: 0; padding: 24px; }
  h1 { text-align: center; font-size: 2em; margin-bottom: 8px; }
  .subtitle { text-align: center; color: #8b949e; margin-bottom: 32px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
  .card { background: #161b22; border-radius: 12px; overflow: hidden; border: 1px solid #30363d; }
  .card img { width: 100%; display: block; aspect-ratio: 1; object-fit: cover; }
  .card-body { padding: 12px 16px; }
  .round { font-size: 0.75em; color: #8b949e; margin-bottom: 4px; }
  .dest { font-size: 0.95em; font-weight: bold; }
  .dest a { color: #58a6ff; text-decoration: none; }
  .dest a:hover { text-decoration: underline; }
</style>
</head>
<body>
<h1>🦞 {character_name} 的旅行日记</h1>
<p class="subtitle">共完成 {success_count} 次旅行 · {date}</p>
<div class="grid">
  <div class="card">
    <img src="{image_url}" alt="{destination_name}" loading="lazy">
    <div class="card-body">
      <div class="round">第 {round} 站</div>
      <div class="dest"><a href="{collection_url}" target="_blank">{destination_name}</a></div>
    </div>
  </div>
</div>
</body>
</html>
```

写入 `travel_report.html` 后输出：
```
📖 旅行日记已生成：travel_report.html
```

---

## 注意事项

| 情况 | 处理方式 |
|------|---------|
| SOUL.md 缺少 `形象图片` | 停止，提示先执行 adopt |
| 生成 FAILURE | 输出提示，进入询问，不计入成功次数 |
| 并发超限（code 433） | 等待 5 秒后重试 |
| coreInput 为空 | 用 fallback 通用 prompt |
| 用户说"结束" | 若有结果则询问是否先生成 HTML |

---

## 相关资源

- API 能力：[neta-skills](https://github.com/talesofai/neta-skills)
