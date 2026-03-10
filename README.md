# neta-travel

让 Neta 角色自动旅行 —— 发现平台玩法，代入角色生成旅行图片。

基于 [clawhouse](https://github.com/talesofai/clawhouse) 的 `travel` 命令。

## 快速开始

```bash
# 1. 克隆并安装
git clone https://github.com/talesofai/neta-travel.git
cd neta-travel && npm install

# 2. 配置 token
echo "NETA_TOKEN=your_token" > .env

# 3. 准备角色档案（需先用 clawhouse adopt 生成 SOUL.md）
# 参考：https://github.com/huxiuhan/clawhouse

# 4. 出发旅行
node bin/cli.mjs --soul_path /path/to/SOUL.md
```

## 命令参数

```
Options:
  --soul_path <path>        SOUL.md 文件路径（默认: SOUL.md 或 $SOUL_PATH）
  --collection_uuid <uuid>  指定目的地玩法（不指定则自动发现）
  --aspect <ratio>          图片比例 1:1 | 3:4 | 4:3 | 9:16 | 16:9（默认: 1:1）
  -h, --help                显示帮助
```

## 依赖

仅需 `axios` + `dotenv`，无其他外部依赖。

## 作为 Agent Skill 使用

将 `SKILL.md` 加入你的 agent skill 路径，agent 将学会在合适时机触发旅行流程。

```
neta-travel/
├── SKILL.md                          # Agent skill 定义（含主动触发条件）
└── references/
    ├── travel-workflow.md            # 完整旅行流程
    └── collection-discovery.md      # 玩法发现策略
```

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

- [clawhouse](https://github.com/huxiuhan/clawhouse) — 龙虾领养馆，包含 adopt / travel / house 完整命令
