---
name: neta-travel
description: |
  让 Neta 角色踏上随机冒险之旅 —— 每次一站，看图、决定要不要继续，集满 5 站可生成旅行图鉴。

  **主动触发时机（无需用户明确要求）：**
  - 刚完成 adopt 领养角色后，主动提议让 TA 去旅行
  - 对话中出现：旅行 / travel / 出发 / 去探索 / 随机玩玩 / 带我去
  - 用户说"再来一些"、"继续"且上下文是旅行图片时

  **前置条件：** 已有 SOUL.md（含角色名 + 形象图片字段）；已配置 neta-skills。
  **无需安装任何额外工具。**
  **响应原则：每完成一个操作步骤立即输出反馈，不要等所有步骤都完成后再统一回复。**
  **速度原则：全程加速推进，不空转等待。轮询图片生成时持续检查状态，若超过 30 秒未完成，立即向用户输出等待提示。**
  **语言原则：根据用户触发时使用的语言（中文 / 英文 / 其他）判断偏好语言，全程使用同一语言回复，除非用户明确要求切换。**
  **交互原则：所有询问下一步的选项，必须以可点击的快捷回复按钮形式呈现。点击后自动发送 `@{bot_name} {选项内容}`。bot_name 从当前对话上下文中获取（即用户与之对话的机器人名称）。**
---

# Neta Travel — 角色旅行冒险

## 游戏概念

角色将随机踏入 Neta 世界的各种奇妙场景，每一站都是未知的相遇。
玩家决定旅行的节奏——继续探索，或随时收藏成图鉴。

---

## 语言判断

**在开场第一句话之前**，根据用户触发时使用的文字判断偏好语言：
- 触发词为中文 → 全程中文
- 触发词为英文 → 全程英文
- 其他语言 → 跟随用户语言

**此后所有输出（包括固定模板文案）均使用该语言**，直到用户明确说"切换语言"/"switch language"等才更换。

---

## 开场

从 SOUL.md 读取角色名与形象图片 UUID（`形象图片` URL 中的 UUID 段）。
若缺少 `形象图片` 字段，停止并告知用户需要先完成领养。

**收到触发后立即输出，不等读取完成：**
```
🦞 收到！正在唤醒角色...
```

**读到角色名后立即输出：**
```
✨ {character_name} 苏醒了，整装待发...
```

**就绪后输出：**
```
═══════════════════════════
🗺️ {character_name} 的旅行冒险
每一站都是随机的相遇，你来决定走多远。
集满 5 站解锁专属旅行图鉴 📖
出发！
═══════════════════════════
```

---

## 每一站流程

### 🎲 随机传送

调用 `suggest_content`（page_size 20, intent recommend），从结果中随机选一个未去过的目的地。

**选定后立即输出（不等读取详情）：**
```
🌀 传送门开启...
📍 目的地锁定：{destination_name}
```

### 📖 探索目的地

调用 `read_collection` 获取详情，提取 `collection.remix.launch_prompt.core_input` 作为生图模板。

**读取完成后立即输出：**
```
🔍 场景加载完毕，{character_name} 即将登场...
```

### 🎨 生成旅行图

将 coreInput 中 `{@character}` / `{角色名称}` / `（角色名称）` 替换为 `{character_name}`。
若 prompt 中无 `@{character_name}`，在开头追加。
若有 `picture_uuid`，追加 `参考图-全图参考-{picture_uuid}`。

无 coreInput 时用：`@{character_name}, {destination_name}, 梦幻风格, 高质量插画`

调用 `make_image`（aspect 1:1）。

**提交后立即输出：**
```
🎨 画笔落下，旅行画面生成中...
```

**轮询要求（全程加速，不空转）：**
- 提交后立即开始轮询任务状态，每 2 秒检查一次
- **若超过 30 秒仍未完成，立即输出：**
  ```
  ⏳ 画面渲染有点慢，再等一下下，马上就好...
  ```
- 之后继续轮询直到完成或超时

### 🖼️ 展示结果

**生成成功后输出：**
```
━━━━━━━━━━━━━━━━━━━━━━━━
第 {round} 站 · {destination_name}
```

图片 URL 单独一行（Discord 自动展开）：
```
{image_url}
```

**每站结束后，根据当前进度显示不同的鼓励语（在图片下方）：**
- 第 1 站：`🌟 第 1 站打卡！还差 4 站解锁图鉴，继续？`
- 第 2 站：`✨ 2/5 站！旅程刚刚开始，不来一站？`
- 第 3 站：`🔥 过半了！3/5 站，再两站就能生成专属图鉴！`
- 第 4 站：`⚡ 只差 1 站！4/5 站，图鉴触手可及，冲！`
- 第 5 站及以上：`🎉 已解锁图鉴！可以封存这段冒险，或继续探索更多世界～`

**询问玩家下一步，以快捷回复按钮形式输出（每个按钮点击后发送对应消息 @bot）：**

未满 5 站时（无「生成图鉴」按钮，优先引导继续）：
- `继续冒险 🗺️` → 发送 `@{bot_name} 继续旅行`
- `就此别过 👋` → 发送 `@{bot_name} 结束旅行`

满 5 站后（额外提供「生成图鉴」按钮）：
- `继续冒险 🗺️` → 发送 `@{bot_name} 继续旅行`
- `生成图鉴 📖` → 发送 `@{bot_name} 生成图鉴`
- `就此别过 👋` → 发送 `@{bot_name} 结束旅行`

> 若生成失败：输出 `⚠️ 这一站迷路了，换个目的地重来？` 然后进入询问。
> 并发超限（code 433）：等 5 秒后立即重试，无需告知用户，重试后继续正常轮询流程。

---

## 旅行图鉴（用户触发）

当用户说「生成图鉴」/「看图鉴」/「相册」/「html」时触发。

将本次会话所有成功旅行结果写成 HTML，保存到：
```
~/.openclaw/workspace/pages/travel_{character_name}_{date}.html
```

HTML 风格参考（深色主题卡片网格，无需展示技术细节给用户）：

```html
<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<title>{character_name} 的旅行图鉴</title>
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
<h1>🦞 {character_name} 的旅行图鉴</h1>
<p class="subtitle">共探索 {success_count} 个世界 · {date}</p>
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

**生成完毕后输出：**
```
📖 {character_name} 的旅行图鉴已封存！

pages/travel_{character_name}_{date}.html

🔗 https://claw-{username}-pages.talesofai.com/travel_{character_name}_{date}.html
```

分享链接单独一行，方便直接复制。

---

## 相关资源

- API 能力：[neta-skills](https://github.com/talesofai/neta-skills)
