---
name: neta-travel
description: |
  让 Neta 角色自动旅行 —— 随机发现平台玩法，连续生成多张旅行图，最终输出 HTML 展示页。

  **主动触发时机（无需用户明确要求）：**
  - 刚完成 adopt 领养角色后，主动提议让 TA 去旅行
  - 对话中出现：旅行 / travel / 出发 / 去探索 / 随机玩玩 / 带我去
  - 用户说"再来一些"、"继续"且上下文是旅行图片时

  **前置条件：** 已有 SOUL.md（含角色名 + 形象图片字段）；已配置 neta-skills。
  **无需安装任何额外工具。**
---

# Neta Travel — 自动旅行总规划

## 概览

Agent 作为"旅行规划师"，读取角色档案，连续完成 N 次随机旅行，最后生成一个 HTML 展示页。
全程只调用 **neta-skills** 工具，无需安装任何额外依赖。

```
开始
 ├─ 读取 SOUL.md → 获取角色名 + 形象图片UUID
 ├─ 询问旅行次数（默认 5，最多 10）
 └─ 循环 N 次：
     ├─ suggest_content → 随机选一个玩法
     ├─ read_collection → 读取玩法详情 + coreInput
     ├─ 构建 prompt（注入角色 + 参考图）
     ├─ make_image → 生成旅行图片
     └─ 记录结果（玩法名 + 图片URL）
 └─ 生成 HTML 展示页（写入本地文件）
```

---

## Step 0 — 准备

从 SOUL.md 提取：

| 字段 | 说明 |
|------|------|
| `- **名字**: 关羽` | → `character_name` |
| `- **形象图片**: https://oss.talesofai.cn/picture/<uuid>.webp` | → `picture_uuid`（取 URL 中的 UUID 部分） |

若 SOUL.md 缺少 `形象图片` 字段，**停止并提示**用户先完成 adopt。

询问用户旅行次数：
> "要旅行几次？（默认 5 次，最多 10 次）"

---

## Step 1 — 发现玩法（每次循环）

```bash
pnpm start suggest_content \
  --page_index 0 --page_size 20 \
  --scene agent_intent --intent recommend
```

从返回的 `module_list` 中**随机选取**一个有效 `uuid`（跳过已访问过的）。

---

## Step 2 — 读取玩法详情（每次循环）

```bash
pnpm start read_collection --uuid "<collection_uuid>"
```

提取：
- `name` → 目的地名称
- `cta_info.launch_prompt.core_input` → 生图模板（coreInput）

若 coreInput 为空，fallback 模板：
```
@{character_name}, {destination_name}, 梦幻风格, 高质量插画
```

---

## Step 3 — 构建 Prompt（每次循环）

1. 将 coreInput 中的占位符替换为角色：
   - `{@character}` → `@{character_name}`
   - `{角色名称}` / `{角色名}` → `{character_name}`
   - `（角色名称）` → `{character_name}`

2. 若 prompt 中没有 `@{character_name}`，在开头追加：
   ```
   @{character_name}, 参考图-全图参考-{picture_uuid}, {coreInput内容}
   ```

3. 若有 `picture_uuid`，确保 prompt 包含：
   ```
   参考图-全图参考-{picture_uuid}
   ```

**示例 prompt：**
```
@关羽, 参考图-全图参考-13dab6ed-bd69-4835-83f4-9fef9dd97998, 生成一幅7格漫画，描绘角色忙碌的一天...
```

---

## Step 4 — 生成旅行图片（每次循环）

```bash
pnpm start make_image \
  --prompt "<构建好的prompt>" \
  --aspect "1:1"
```

等待任务完成（状态从 PENDING → SUCCESS/FAILURE）。

记录结果：
```json
{
  "round": 1,
  "destination_name": "【捏捏开荒团】爱你老己明天见",
  "collection_uuid": "2855a5f4-...",
  "image_url": "https://oss.talesofai.cn/picture/xxx.webp",
  "status": "SUCCESS"
}
```

> ⚠️ 若返回 FAILURE：记录失败，继续下一轮，不中断整体流程。
> ⚠️ 并发上限为 2，每次生成一张，等完成再发下一个。

---

## Step 5 — 生成 HTML 展示页（全部完成后）

收集所有成功的旅行结果，写入 `travel_report.html`：

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
  <!-- 每张旅行图一个 card，按以下模板重复 -->
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

---

## 注意事项

| 情况 | 处理方式 |
|------|---------|
| SOUL.md 缺少 `形象图片` | 停止，提示先执行 adopt |
| 某次生成 FAILURE | 跳过，继续下一轮，HTML 中不展示失败项 |
| 并发超限（code 433） | 等待 5 秒后重试当前轮 |
| coreInput 为空 | 用 fallback 通用 prompt |
| 用户中途打断 | 用已收集的结果生成 HTML |

---

## 相关资源

- 角色领养：[clawhouse](https://github.com/huxiuhan/clawhouse)
- API 能力：[neta-skills](https://github.com/talesofai/neta-skills)
