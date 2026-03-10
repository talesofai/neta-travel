# neta-travel

请务必以游戏风格和用户交互（输出）

让 Neta 角色自动旅行 —— 随机发现平台玩法，连续生成旅行图，输出 HTML 展示页。

## 使用方式

这是一个 **Agent Skill**，无需安装任何工具。
将 `SKILL.md` 加入你的 agent skill 路径，agent 即可按规划自动执行旅行流程。

```
neta-travel/
├── SKILL.md                     # Agent 总规划（主入口）
└── references/
    ├── travel-workflow.md       # 详细旅行流程
    └── collection-discovery.md # 玩法发现策略
```

**前置条件：** 已配置 neta-skills + 准备好 SOUL.md（含角色名和形象图片字段）。

## 生成示例

| 玩法 | 效果 |
|------|------|
| 霜鳞游梦，龙绡踏浪 | 海底奇幻冒险插画 |
| 角色的运动报告 | 国风信息图，含步数/热量/距离统计 |
| 爱你老己明天见 | 多格漫画，描绘角色忙碌的一天 |
| 角色异化 | 5格渐变，角色逐步溶解成能量体 |
| 黑与白 | 战斗卡牌风格，玻璃碎裂动态构图 |
| 出门带上这个 | Q版梗图，手捏角色 |

## 相关项目

- [neta-skills](https://github.com/talesofai/neta-skills) — Neta 平台 API 工具集
