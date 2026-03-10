# neta-travel

让 Neta 角色自动旅行 —— 发现平台玩法，代入角色生成旅行图片。

基于 [clawhouse](https://github.com/talesofai/clawhouse) 的 `travel` 命令。

## 快速开始

```bash
# 1. 安装 clawhouse
git clone https://github.com/talesofai/clawhouse.git
cd clawhouse && npm install

# 2. 配置 token
echo "NETA_TOKEN=your_token" > .env

# 3. 领养一个角色
npm start -- adopt --name "关羽#36d0" --mode lobster

# 4. 出发旅行
npm start -- travel
```

## 作为 Agent Skill 使用

将 `SKILL.md` 加入你的 agent skill 路径，agent 将学会在合适时机触发旅行流程。

```
neta-travel/
├── SKILL.md                          # Agent skill 定义
└── references/
    ├── travel-workflow.md            # 完整旅行流程
    └── collection-discovery.md      # 玩法发现策略
```

## 生成示例

| 玩法 | 效果 |
|------|------|
| 角色的运动报告 | 国风信息图，含步数/热量/距离统计 |
| 爱你老己明天见 | 多格漫画，描绘角色忙碌的一天 |
| 角色异化 | 5格渐变，角色逐步溶解成能量体 |
| 黑与白 | 战斗卡牌风格，玻璃碎裂动态构图 |
| 出门带上这个 | Q版梗图，手捏角色 |

## 相关项目

- [clawhouse](https://github.com/talesofai/clawhouse) — 龙虾领养馆，包含 adopt / travel / house 完整命令
- [neta-skills](https://github.com/talesofai/neta-skills) — Neta 平台 API 基础 SDK
