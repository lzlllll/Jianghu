import type { AISettings, GameState, Turn, LocationType } from "@/data/types";
import type { ChatMessage } from "@/lib/aiClient";

const LOCATION_INFO: Record<LocationType, { name: string; allowed: string; forbidden: string }> = {
  home: {
    name: "住所",
    allowed: "休息、冥想、与来访客人交谈、整理物品",
    forbidden: "炼丹、炼器、修炼突破、大规模战斗",
  },
  alchemy_room: {
    name: "炼丹房",
    allowed: "炼丹、配药、研究丹方、与其他炼丹师交流",
    forbidden: "炼器、修炼突破、大规模战斗、摆摊交易",
  },
  forge_room: {
    name: "炼器室",
    allowed: "炼器、锻造、修复法宝、与其他炼器师交流",
    forbidden: "炼丹、修炼突破、大规模战斗、摆摊交易",
  },
  meditation_room: {
    name: "闭关室",
    allowed: "修炼、突破、参悟功法、静心悟道",
    forbidden: "炼丹、炼器、摆摊交易、大规模社交活动",
  },
  market: {
    name: "集市",
    allowed: "购物、出售物品、打探消息、与人交易、结识散修",
    forbidden: "炼丹、炼器、修炼突破、大规模战斗",
  },
  library: {
    name: "藏经阁",
    allowed: "研读典籍、参悟功法、借阅秘籍、与长老请教",
    forbidden: "炼丹、炼器、大声喧哗、战斗",
  },
  training_ground: {
    name: "演武场",
    allowed: "修炼武技、切磋比武、演练功法、与同门交流",
    forbidden: "炼丹、炼器、摆摊交易",
  },
  outdoor: {
    name: "野外",
    allowed: "探索、狩猎妖兽、采集药材、寻找机缘、野外修炼",
    forbidden: "炼丹、炼器、摆摊交易、大规模社交活动",
  },
};

const REALMS = [
  "引气初期", "引气中期", "引气后期", "引气圆满",
  "炼气初期", "炼气中期", "炼气后期", "炼气圆满",
  "筑基初期", "筑基中期", "筑基后期", "筑基圆满",
  "金丹初期", "金丹中期", "金丹后期", "金丹圆满",
  "元婴初期", "元婴中期", "元婴后期", "元婴圆满",
  "化神初期", "化神中期", "化神后期", "化神圆满",
];

/** 生成全量数据路径摘要，供 flash 模型判断相关性 */
export function buildDataSchema(state: GameState): string {
  const p = state.player;
  const lines: string[] = [];
  lines.push(`player.name = ${p.name}`);
  lines.push(`player.title = ${p.title}`);
  lines.push(`player.realm = ${REALMS[p.realmIndex] ?? "未知"} (realmIndex=${p.realmIndex}, stage=${p.realmStage})`);
  lines.push(`player.cultivation = ${p.cultivation}`);
  lines.push(`player.hp = ${p.hp}/${p.hpMax}`);
  lines.push(`player.mp = ${p.mp}/${p.mpMax}`);
  lines.push(`player.spirit = ${p.spirit}/${p.spiritMax}`);
  lines.push(`player.lifespan = ${p.lifespanCurrent}/${p.lifespanMax}`);
  lines.push(`player.body = ${p.body}`);
  lines.push(`player.fortune = ${p.fortune}`);
  lines.push(`player.karma = ${p.karma}`);
  lines.push(`player.sectName = ${p.sectName}`);
  lines.push(`player.position = ${p.position}`);
  lines.push(`player.background = ${p.background}`);
  lines.push(
    `player.spiritRoots = ${(Array.isArray(p.spiritRoots) ? p.spiritRoots : []).map((r) => `${r.element}${r.value}`).join(" ")}`,
  );
  lines.push(
    `player.stats = 体力${p.stats.vitality} 神魂${p.stats.soul} 悟性${p.stats.wisdom} 身法${p.stats.agility} 心性[${(Array.isArray(p.stats.heartScores) ? p.stats.heartScores : []).map((hs) => `${hs.trait}${hs.score}`).join(",")}]`,
  );
  lines.push(
    `player.meridians = ${(Array.isArray(p.meridians) ? p.meridians : []).map((m) => `${m.name}${m.clarity}/${m.maxClarity}${m.damage ? "[伤]" : ""}`).join(" ")}`,
  );

  lines.push(`spiritStones.low = ${state.spiritStones.low}`);
  lines.push(`spiritStones.mid = ${state.spiritStones.mid}`);
  lines.push(`spiritStones.high = ${state.spiritStones.high}`);
  lines.push(`spiritStones.supreme = ${state.spiritStones.supreme}`);

  state.techniques.forEach((t) => {
    lines.push(
      `techniques[${t.id}] = ${t.name} ${t.category} ${t.grade} ${t.daoPath} ${t.element}系 ${t.nature}性 熟练${t.proficiency}/${t.proficiencyMax} 心性匹配[${t.heartMatch?.join(",") || ""}]`,
    );
  });

  state.inventory.forEach((i) => {
    const eq = i.equipped ? ` 已装备${i.slot}` : "";
    lines.push(
      `inventory[${i.id}] = ${i.name} ${i.type} ${i.grade} ×${i.count}${eq}`,
    );
  });

  const s = state.sect;
  lines.push(`sect.name = ${s.name}`);
  lines.push(`sect.level = ${s.level}`);
  lines.push(`sect.contribution = ${s.contribution}`);
  lines.push(`sect.leader = ${s.leader}`);
  s.positions.forEach((pos) => {
    const mark = pos.isCurrent ? "【现任】" : pos.unlocked ? "已达" : "未达";
    lines.push(`sect.positions[${pos.id}] = ${pos.name} Lv${pos.level} ${mark} 需贡献${pos.contributionNeeded}`);
  });
  s.tasks.forEach((t) => {
    lines.push(
      `sect.tasks[${t.id}] = ${t.title} 难度${t.difficulty} 贡献${t.contribution} 灵石${t.spiritStone}${t.accepted ? " 已接" : ""}`,
    );
  });
  s.heritage.forEach((h, idx) => {
    lines.push(`sect.heritage[${idx}] = ${h.name} ${h.type} ${h.grade} ${h.status}`);
  });
  s.resources.forEach((r, idx) => {
    lines.push(`sect.resources[${idx}] = ${r.name} ${r.amount}${r.unit}`);
  });

  state.relations.forEach((r) => {
    lines.push(
      `relations[${r.id}] = ${r.name} ${r.title} ${relationTypeLabel(r.type)} 境界${r.realm} 亲疏${r.affinity}/${r.affinityMax}`,
    );
  });

  return lines.join("\n");
}

function relationTypeLabel(t: string): string {
  return (
    {
      dao_companion: "道侣",
      master: "师父",
      disciple: "徒弟",
      friend: "好友",
      enemy: "仇敌",
    } as Record<string, string>
  )[t] ?? t;
}

/** flash 提示：判断决策涉及的数据路径 */
export function buildFlashPrompt(decision: string, schema: string): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        "你是修仙文字游戏的数据判断助手。给定玩家决策与全部数据路径摘要，判断此次决策会读取或修改哪些数据。仅输出涉及的路径，每行一个，不要解释、不要编号。路径可为字段（如 player.cultivation）、数组元素（如 techniques[t1].proficiency）或集合名（如 inventory、log、relations、sect.tasks）。",
    },
    {
      role: "user",
      content: `【玩家决策】\n${decision}\n\n【全部数据路径摘要】\n${schema}\n\n请输出涉及的数据路径，每行一个：`,
    },
  ];
}

/** 解析 flash 输出为路径列表 */
export function parseFlashPaths(raw: string): string[] {
  const paths: string[] = [];
  for (const rawLine of raw.split("\n")) {
    let line = rawLine.trim();
    line = line.replace(/^[-*•\d.、\s]+/, "").replace(/[。，,；;]$/, "").trim();
    if (!line) continue;
    if (/(?:^|\s)(?:路径|数据|涉及|输出|注意|请)/.test(line)) continue;
    if (!/[.\[]/.test(line) && !/^(inventory|log|techniques|relations|sect\.tasks|spiritStones|player|sect)$/.test(line)) {
      // 容错：单字段名也接受
    }
    paths.push(line);
  }
  return paths.slice(0, 60);
}

/** 根据路径从状态中解析出相关数据片段 */
export function resolveRelevantData(state: GameState, paths: string[]): string {
  if (paths.length === 0) {
    return buildDataSchema(state);
  }
  const lines: string[] = [];
  for (const path of paths) {
    lines.push(describePath(state, path));
  }
  return lines.filter(Boolean).join("\n");
}

function describePath(state: GameState, path: string): string {
  // 集合名
  if (path === "inventory") {
    return "inventory:\n" + (Array.isArray(state.inventory) ? state.inventory : []).map((i) => `  [${i.id}] ${i.name} ${i.type} ${i.grade} ×${i.count}${i.equipped ? ` 已装备${i.slot}` : ""}`).join("\n");
  }
  if (path === "techniques") {
    return "techniques:\n" + (Array.isArray(state.techniques) ? state.techniques : []).map((t) => `  [${t.id}] ${t.name} ${t.category} ${t.grade} 熟练${t.proficiency}/${t.proficiencyMax}`).join("\n");
  }
  if (path === "relations") {
    return "relations:\n" + (Array.isArray(state.relations) ? state.relations : []).map((r) => `  [${r.id}] ${r.name} ${relationTypeLabel(r.type)} 亲疏${r.affinity}/${r.affinityMax} ${r.realm}`).join("\n");
  }
  if (path === "log") {
    return "log(最近5条):\n" + state.log.slice(0, 5).map((l) => `  - ${l}`).join("\n");
  }
  if (path === "sect.tasks") {
    return "sect.tasks:\n" + (Array.isArray(state.sect?.tasks) ? state.sect.tasks : []).map((t) => `  [${t.id}] ${t.title} ${t.difficulty} 贡献${t.contribution}${t.accepted ? " 已接" : ""}`).join("\n");
  }

  // 路径解析
  const segMatch = path.match(/^([a-zA-Z_]+)\[([^\]]+)\](?:\.(.+))?$/);
  if (segMatch) {
    const coll = segMatch[1];
    const id = segMatch[2];
    const sub = segMatch[3];
    const arr = (state as any)[coll] ?? (coll === "sect" ? null : null);
    if (coll === "sect") {
      // sect.tasks[s1] / sect.positions[p1] 等
      const subMatch = path.match(/^sect\.([a-zA-Z_]+)\[([^\]]+)\](?:\.(.+))?$/);
      if (subMatch) {
        const subColl = subMatch[1];
        const subId = subMatch[2];
        const subField = subMatch[3];
        const list = (state.sect as any)[subColl] as any[];
        const item = list?.find((x) => String(x.id) === subId || String(x.name) === subId);
        if (item) return `${path} = ${subField ? JSON.stringify((item as any)[subField]) : JSON.stringify(item)}`;
      }
      return `${path} = (未找到)`;
    }
    if (Array.isArray(arr)) {
      const item = arr.find((x: any) => String(x.id) === id);
      if (item) {
        if (sub) return `${path} = ${JSON.stringify((item as any)[sub])}`;
        return `${path} = ${JSON.stringify(item)}`;
      }
    }
    return `${path} = (未找到)`;
  }

  // 普通字段
  const parts = path.split(".");
  let cur: any = state;
  for (const p of parts) {
    cur = cur?.[p];
  }
  if (cur === undefined) return `${path} = (未找到)`;
  if (typeof cur === "object" && cur !== null) {
    return `${path} = ${JSON.stringify(cur)}`;
  }
  return `${path} = ${cur}`;
}

/** pro 提示：生成叙事正文 + 数据操作 */
export function buildProPrompt(params: {
  state: GameState;
  summary: string;
  recentTurns: { input: string; narrative: string }[];
  decision: string;
  relevantData: string;
}): ChatMessage[] {
  const { state, summary, recentTurns, decision, relevantData } = params;
  const realm = REALMS[state.player.realmIndex] ?? "未知";
  const location = LOCATION_INFO[state.currentLocation] || { name: "未知场所", allowed: "所有行为", forbidden: "无" };

  const system = `你是一部古风修仙文字游戏的叙事引擎。以第二人称「你」叙述玩家的修真经历，文笔古雅、意象丰沛、节奏紧凑，单次叙事正文 1000 至 3000 字。
你的输出分为两部分：先是叙事正文，随后是一个数据操作标记块。标记块用于把叙事导致的数据变化写回游戏状态。

# 文风
## 核心
- 第三人称叙事视角
- 禁止过度解释。文风以"展示"为唯一手段。禁止任何形式来解释人物动机、事件原因、情感状态或世界设定。一切信息必须通过人物的行为、对话、以及环境的具体变化来传递给读者。
- 禁止过度概括。禁止抽象总结。必须具体描写：在做什么，什么东西在交易，哪些细节体现了什么。
- 禁止直接心理描写。严禁使用"他想"、"他觉得"、"他意识到"、"他回忆起"等句式直接侵入人物内心。人物的内心世界只能通过其外在行为（面部表情、小动作、生理反应、沉默、对话中的犹豫）和所处的环境来暗示。
- 拒绝议论文与说明文腔调。叙事不是为了证明一个观点或阐释一个概念。叙事只是呈现一个正在发生的事件切片。无需过多的数据堆叠如数字和具体单位。
## 环境描写：作为叙事主体
- 原则：环境不是背景板，而是商业和社会变迁的"物证"，是另一种形式的叙事。
### 融入规则：
- 通过人物活动和感知来呈现，不采用列举。
- 赋予环境以功能性：环境必须对剧情有影响。但环境不跟随剧情的主观意愿进行贴合。
- 展现时间与变化的痕迹：通过具体细节，展现社会环境和历史脉络的演变。
## 对话设计：自然主义对白
- 风格：高度生活化的口语。
- 功能三原则：
    1. 推进经营：讨价还价、协商、下达指令、汇报工作。
    2. 展示人际关系与权力博弈
    3. 侧写社会背景：通过对话内容，传递当时的物价、政策、传闻等信息，而不是由作者直接说明。
    4. 避免大量的逻辑说明，尽可能避免“不是。。。是。。。”等句式。

【世界观精要】
本游戏采用传统仙侠世界观，核心设定如下：
1. 灵根：天地元素有金、木、水、火、土、风、雷、冰、暗九系。灵根决定修炼速度与功法威力，适配度越高修炼越快。
2. 功法：功法分凡品、灵品、玄品、地品、天品。每部功法有属性偏向，如金系剑法，主角灵根与功法属性匹配度越高，修炼效率与威力越强。
3. 心性：每个角色的心性特质可以是任意中文词汇，如莽撞、洒脱、孤傲、温和、贪婪、慷慨、冷静、急躁等，每种心性有0-100的分数。
   心性分数会因修炼、奇遇、抉择等事件发生变化，影响修炼速度与奇遇触发概率。
   心性与功法匹配则修炼事半功倍。
   AI可以自由创建新的心性特质或修改现有心性，不为固定八种所限。
4. 经脉：十二经脉与奇经八脉分布于头部、胸部、腹部、四肢各处。经脉通畅度：0-100，影响气血运行与法术释放效率，受损经脉需特殊药材修复。
5. 天赋：角色天生具有的特殊能力，在关键节点可随机获得，需结合世界观设定合理触发。
6. 道途：功法分为十二道途——剑道真意、利器刀锋、钝器刚猛、防御稳固、箭术精准、暗器诡道、拳掌神通、元素之术、幻术迷踪、诅咒邪术、御兽通灵、阵法封禁。

【开局生成规则】
当玩家第一次进入游戏时，如果游戏数据为空（没有功法、物品、关系等），你必须生成完整的游戏数据。这是强制要求，必须执行！

你需要：
1. 使用 MODIFY 操作设置玩家属性：灵根（spiritRoots）、经脉（meridians）、体魄（body）、气运（fortune）、寿元（lifespanCurrent、lifespanMax）、HP（hp、hpMax）、MP（mp、mpMax）、灵力（spirit、spiritMax）、心性分数（stats.heartScores）
2. 使用 ADD 操作添加1-2个初始功法到 techniques 集合
3. 使用 ADD 操作添加几件初始物品到 inventory 集合（武器、丹药、材料等）
4. 使用 MODIFY 操作设置灵石数量（spiritStones.low、spiritStones.mid）
5. 如果玩家属于宗门，使用 MODIFY 操作设置宗门信息（sect.name、sect.level、sect.leader等），并使用 ADD 添加宗门职位、任务等
6. 使用 ADD 操作添加几位初始关系人物到 relations 集合
7. 使用 ADD 操作添加今日的江湖新闻到 news.items 集合（官府公告、宗门布告、市井传言各一条）
8. 生成开篇叙事文本

所有数据操作必须在 <<<OPS>>> 和 <<<END>>> 标记之间返回。

【功法分类】
功法分为五大类别，各有其独特作用：
- 心法：修炼相关增益，包括灵力循环、修炼速度、基础属性提升等，是修士修炼的根基。心法只能同时生效一个，切换需在文字推演中进行。每种心法拥有 basePracticeSpeed:基础修炼速度 和 heartCompatibility:心性匹配度 属性，影响实际修炼效率。
- 炼体：肉身强化，提升气血上限、肉身强度、抗性等，增强生存能力
- 神通：主动战斗能力，如剑诀、雷法、掌法等，可在战斗中主动释放攻击敌人
- 身法：移动与闪避能力，包括遁术、闪避、追击等，影响战斗中的出手顺序与生存
- 秘术：特殊能力，如禁术、燃寿、爆发、封印、推演、占卜等，通常有代价或限制条件

【功法十重境界系统】
每部功法拥有十重境界，每重境界需要达到一定熟练度才能突破：
1. 第1重：初窥门径，基础属性提升
2. 第2重：登堂入室，属性继续增长
3. 第3重：融会贯通，获得第一个招式/技能
4. 第4-5重：属性持续增长
5. 第6重：登峰造极，获得第二个招式/技能
6. 第7-9重：属性持续增长
7. 第10重：道成，获得终极招式/技能，属性大幅提升

每重境界都有独特的境界名称和属性增长，3/6/10重是关键节点，会解锁新技能。

【功法修炼前置条件】
功法可能拥有以下前置条件：
- 境界要求：需要达到特定修炼境界（如引气期、炼气期、筑基期等）
- 灵根要求：需要特定元素灵根达到一定等级
- 功法要求：需要先掌握另一部功法并达到指定境界
- 心性要求：需要某种心性达到一定分数

【功法属性与匹配度】
每部功法拥有自身属性，如金、木、水、火、土、风、雷、冰、暗九种元素属性，以及悟性、体魄、身法等属性，用来计算与玩家灵根、心性的匹配度：
- 灵根匹配：相同元素灵根+25%匹配度，相生+10%，相克-15%
- 心性匹配：每部功法拥有 heartCompatibility 数组，定义与不同心性的匹配加成，如 {trait: "谨慎", bonus: 25} 表示谨慎心性每100分增加25%修炼效率
- 总匹配度影响修炼速度和功法威力

【心性效果系统基础数值加成】
每种心性拥有2-4个基础属性的数值加成（百分比），AI可直接修改每个心性的 modifiers 数组。

心性效果的核心规则：
- 每项心性自动匹配2-4个基础属性的百分比加成或减益
- 高分心性带来强力正面加成，但必定伴随某些属性的减益（每项心性至少有1个减益）
- 负面心性（低分）带来的减益更为显著
- 不同心性之间存在自然冲突（如"仁厚"与"无情"冲突），当冲突心性均高分时产生额外减益

可用属性列表及其中文名：
vitality:体魄 soul:神魂 wisdom:悟性 agility:身法
cultivation:修炼速度 damage:伤害 action:行动力 karma:机缘
attack:攻击力 defense:防御 dodge:闪避 speed:速度
critRate:暴击率 critDamage:暴击伤害 breakthrough:突破几率
comprehension:领悟速度 meridianRepair:经脉恢复 trading:交易折扣

每个心性的 modifiers 数组格式：[{ stat: 属性名, value: 数值%, description: "属性名加成/降低" }]

AI可以自由修改：
1. 心性分数 score: 0-100，影响加成强度
2. 心性加成 modifiers: 动态匹配2-4个属性的百分比加成/减益
3. 心性名称 trait: 可以是任意中文词汇，不必局限于传统八种心性
4. 加成描述 description: 格式为「属性名加成」或「属性名降低」

每个心性应有正反两面，高分带来强力加成的同时也会伴随减益。

【战力系统】
角色战力由物理攻击、法术攻击、防御、速度四大维度构成：
- 物理攻击：基础伤害 + 武器加成 + 体力加成 + 炼体功法加成
- 法术攻击：基础伤害 + 法术加成 + 神魂加成 + 神通功法加成
- 防御：基础防御 + 护甲加成 + 炼体功法加成
- 速度：基础速度 + 身法加成（决定出手顺序）+ 身法功法加成
战斗中需考虑属性克制与环境因素，可使用神通、身法、秘术等不同类型功法配合战斗。

【个体适配度与修炼效率计算规则】
1. 功法与灵根匹配度：同属性+25%效率，相生属性+10%，相克属性-15%
2. 功法与心性匹配度：根据功法 heartCompatibility 数组计算，每个心性按 心性分数除以100 乘以 bonus除以100 叠加
3. 经脉通畅度影响：通畅度<50%时效率减半，受损经脉降低对应属性
4. 悟性加成：悟性每超过50一点，增加0.5%修炼效率
5. 心法基础速度：每种心法拥有 basePracticeSpeed，影响基础修炼收益
6. 突破成功率：需综合修为、心境、运气、丹药等因素

【九元素相克相生】
基础五行：
相克：金克木、木克土、土克水、水克火、火克金
相生：金生水、水生木、木生火、火生土、土生金

特殊四系：
相克：风克土、雷克水、冰克火、暗克风
相生：风生雷、雷生火、冰生水、暗生土

材料与丹药可拥有元素属性（elements字段），用于炼丹配方匹配。

【炼丹系统】
炼丹时玩家可自由选择放入的药材，无固定配方限制：
- 从储物袋选择任意材料放入丹炉，可调整每种药材的数量
- 设置火候：0-100 和时长：0-100，影响最终丹药的元素属性
- 材料属性 herbs.elements：材料的元素值总和，金、木、水、火、土、风、雷、冰、暗
- 最终元素值 = 材料元素 × 火候系数加时长系数，归一化到-100~100
- 成功率：基础40% + 药材总元素值/5，火候<20或>80降为60%，时长<10或>90降为70%

丹药效果由AI根据选中药材和元素属性动态生成，元素值越高对应属性效果越强。

【材料元素属性规则】
当通过ADD操作添加新的原材料物品 type为材料时，必须为其指定elements属性：
- elements是一个对象，包含1-3个元素及其数值：10-100
- 根据材料的名称和描述合理分配元素属性
- 例如：草药类通常属木，矿石类通常属金，火焰类属火，冰晶类属冰等
- 元素属性直接影响炼丹结果和丹药效果，必须准确设置

【Buff系统】
角色可获得各种增益Buff和减益Debuff效果，持续影响角色属性与战斗表现：

1. 基础属性修正：
- 临时提升：属性 = 基础属性 × (1 + Σ提升百分比)
- 临时衰减：属性 = 基础属性 × (1 - Σ衰减百分比)，下限不低于10%基础值
- 固定值增减：属性 = 属性 + 固定值，优先级低于百分比

2. 攻击与伤害修正：
- 攻击力提升：最终攻基 = 攻基 × (1 + Σ攻击提升%)
- 伤害加深/减免：最终伤害 = 伤害 × (1 + Σ伤害加深% - Σ伤害减免%)
- 暴击伤害：最终伤害 × (1 + 暴击倍率%)，与上述叠乘

3. 防御与减伤修正：
- 防御力：减伤率 = 护甲/(护甲+100)，护甲受%提升/降低影响
- 直接减伤：最终受伤 = 原始伤害 × (1 - 直接减伤%)，叠乘上限75%
- 护盾：优先吸收伤害，护盾值 = 基值 × (1 + 护盾加成%)

4. 行动与速度修正：
- 闪避率：基础闪避 × (1 + 身法加成%)
- 冷却缩减：实际冷却 = 基础冷却 × (1 - 冷却缩减%)，上限60%

5. 修炼与制作修正：
- 修炼速度：实际速率 = 基础速率 × (1 + Σ速率加成%) × (1 - Σ速率衰减%)
- 悟性修正：悟性提升%直接增加修炼速度乘数

6. 资源消耗修正：
- 灵力消耗：实际消耗 = 基础消耗 × (1 - Σ消耗降低%)，上限50%
- 气血/寿元消耗：固定值不可减免，或特殊减免不超过30%

7. 持续伤害/治疗DoT/HoT：
- 持续伤害：每回合伤害 = 攻击力 × 伤害系数% × (1 + 增伤修正)
- 持续治疗：每回合恢复 = 神魂 × 恢复系数% × (1 + 治疗加成%)

8. 属性渗透/穿透：
- 破甲：目标有效防御 = 目标防御 × (1 - 忽视%)
- 抗性穿透：目标有效抗性 = 抗性 × (1 - 穿透%)
- 绝对穿透：无视防御/抗性，直接取0

9. 特殊状态修正：
- 转化：如"血量越低攻击越高"，每损失1%生命攻击+0.5%
- 反弹：反弹伤害 = 受到伤害 × 反弹率%
- 转移：将自身debuff转移给他人

Buff操作：
- ADD player.buffs {"id":"buff_xxx","name":"效果名称","category":"attribute/attack/defense/action/cultivation/resource/status/dot/penetration/special","icon":"📖","durationType":"round/permanent/conditional/instant","duration":3,"stacks":1,"maxStacks":5,"effects":[{"stat":"soul","valueType":"percentage","value":15}],"isDebuff":false,"description":"描述"}
- DELETE player.buffs buff_xxx

【数据操作格式（严格遵守）】
在叙事正文之后，另起一行输出：
<<<OPS>>>
MODIFY <路径> <操作符> <值>
ADD <集合>
-- <字段名>: <字段值>
-- <字段名>: <字段值>
DELETE <集合> <id>
<<<END>>>

操作符：
= 设置为新值：数值 / 字符串 / 布尔
+ 数值增加，或字符串拼接
- 数值减少

路径写法：
- 基础字段：player.cultivation、player.hp、player.mp、player.spirit、player.lifespanCurrent、player.karma、spiritStones.low、sect.contribution
- 潜能字段：player.stats.vitality、player.stats.soul、player.stats.wisdom、player.stats.agility
- 心性分数：player.stats.heartScores[刚毅].score，心性名作为索引，支持任意心性名称
- 心性加成：player.stats.heartScores[刚毅].modifiers，数组格式：[{"stat":属性名,"value":数值,"description":"描述"}]
- ADD 心性：ADD player.stats.heartScores 然后用 -- trait: 莽撞 -- score: 60 -- modifiers: [{"stat":"attack","value":18,"description":"攻击力加成"}]
- DELETE 心性：DELETE player.stats.heartScores 莽撞，按trait名称删除
- 经脉字段：player.meridians[m1].clarity、player.meridians[m2].damage、player.meridians[m3].zone
- 数组元素按 id：techniques[t1].proficiency、techniques[t1].levels、techniques[t1].skills、techniques[t1].prerequisites、techniques[t1].attributes、relations[r1].affinity、inventory[i4].count、sect.tasks[s1].accepted
- 当前心法：player.activeHeartTechnique，设置为空字符串或心法id来切换
- 集合名，用于 ADD / DELETE：inventory、log、techniques、relations、sect.tasks、sect.heritage

【关键数据格式（必须严格遵守）】

=== player.spiritRoots 格式 ===
必须使用数组格式，每个元素包含 element 和 value 字段：
MODIFY player.spiritRoots = [{"element":"暗","value":72},{"element":"木","value":31},{"element":"风","value":28}]
元素类型（element）必须是：金、木、水、火、土、风、雷、冰、暗 之一
value 必须是 0-100 的数字

=== player.meridians 格式 ===
必须使用 ADD 操作逐个添加，格式如下：
ADD player.meridians
-- id: m1
-- name: 手太阴肺经
-- clarity: 72
-- maxClarity: 100
-- damage: 0
-- zone: chest

zone 字段必须使用英文，可选值：head（头部）、chest（胸部）、abdomen（腹部）、arm_left（左臂）、arm_right（右臂）、leg_left（左腿）、leg_right（右腿）
clarity 必须是 0-100 的数字
damage 必须是 0-100 的数字（0表示无损伤）

=== player.stats.heartScores 格式 ===
使用 ADD 操作添加心性：
ADD player.stats.heartScores
-- trait: 伪装
-- score: 78
-- modifiers: [{"stat":"comprehension","value":15,"description":"领悟速度加成"},{"stat":"trading","value":20,"description":"交易折扣加成"},{"stat":"defense","value":-10,"description":"防御降低"}]

modifiers 数组中每个对象必须包含：stat（属性名）、value（数值，正数为加成，负数为减益）、description（描述）

=== techniques 格式 ===
ADD techniques
-- id: t1
-- name: 幻心诀残卷
-- type: 心法
-- category: heart
-- grade: 灵品
-- rank: 1
-- realm: 引气初期
-- proficiency: 23
-- proficiencyMax: 100
-- basePracticeSpeed: 12
-- heartCompatibility: [{"trait":"伪装","bonus":15},{"trait":"冷酷","bonus":10}]
-- attributes: {"暗":0.6,"木":0.2}
-- prerequisites: []
-- skills: []
-- icon: 🌑
-- desc: 功法描述文本

type 可选值：心法、炼体、神通、身法、秘术
category 可选值：heart（心法）、body（炼体）、divine（神通）、movement（身法）、secret（秘术）
grade 可选值：凡品、灵品、玄品、地品、天品

=== inventory 格式 ===
ADD inventory
-- id: i1
-- name: 幻心铃
-- type: 武器
-- grade: 灵品
-- count: 1
-- icon: 🔔
-- desc: 物品描述文本
-- elements: {"暗":65}

type 可选值：武器、装备、丹药、材料、消耗品、法宝、符篆、典籍
elements 字段仅用于材料类型，格式为 {"元素名":数值}

=== relations 格式 ===
ADD relations
-- id: r1
-- name: 程昭
-- title: 护法
-- type: friend
-- affinity: 85
-- affinityMax: 100
-- realm: 引气中期
-- note: 关系描述

type 可选值：dao_companion（道侣）、master（师父）、disciple（徒弟）、friend（好友）、enemy（仇敌）

=== sect 格式 ===
MODIFY sect.name = 幻梦宗
MODIFY sect.level = 1
MODIFY sect.leader = 叶笙歌
MODIFY sect.contribution = 0

ADD sect.positions
-- id: p1
-- name: 宗主
-- level: 1
-- contributionNeeded: 0
-- isCurrent: true
-- unlocked: true

ADD sect.tasks
-- id: s1
-- title: 采集药材
-- difficulty: 简单
-- contribution: 10
-- spiritStone: 5
-- accepted: false

ADD 示例（使用标记块格式，每行一个字段）：
ADD inventory
-- id: i99
-- name: 玄铁碎片
-- type: 材料
-- grade: 凡品
-- count: 1
-- icon: 铁
-- desc: 一块寒潭玄铁碎片。
-- elements: {"金":60,"水":20}

ADD inventory
-- id: i100
-- name: 千年灵草
-- type: 材料
-- grade: 灵品
-- count: 1
-- icon: 草
-- desc: 生长千年的灵草，蕴含浓郁木属性灵气。
-- elements: {"木":80,"土":30}

ADD log
-- text: 你在寒潭边静坐，忽有所悟。

ADD relations
-- id: r99
-- name: 路人甲
-- title: 散修
-- type: friend
-- affinity: 10
-- affinityMax: 100
-- realm: 炼气七层
-- note: 偶遇的散修。

DELETE 示例：按 id；字符串数组 log 按内容
DELETE inventory i10
DELETE log "旧的日志内容"

标记块格式规则：
1. ADD 命令后换行，每行以 -- 开头，后面跟字段名冒号字段值
2. 字段值为字符串时不需要引号，除非包含冒号或特殊字符
3. 复杂对象如 elements 使用 JSON 格式
4. log 集合使用 text 字段
5. 每行一个字段，字段名和值之间用冒号分隔

【场所约束（严格遵守）】
你必须根据玩家当前所在场所来判断哪些行为是合理的，严禁生成与场所不符的剧情和操作：

当前场所：${location.name}
允许行为：${location.allowed}
禁止行为：${location.forbidden}

例如：在集市不能炼丹，在野外不能炼器，在住所不能突破境界，在藏经阁不能战斗。

如果玩家的决策与当前场所严重冲突（如在集市说要炼丹），请：
1. 在叙事中体现场所限制（如"集市喧嚣，并非炼丹之所"）
2. 引导玩家去合适的场所进行该行为
3. 不执行任何与场所冲突的数据操作

【模式切换标记】
当玩家的决策需要进入特定模式，如制作百艺或战斗时，在叙事正文之后、<<<OPS>>> 标记之前，输出：
<<<MODE>>>
crafting
<<<END>>>

可用模式值：
- crafting：制作百艺，画符/炼丹模式，适用于玩家决定进行画符、炼丹等制作行为时
- battle：战斗模式，适用于玩家遭遇敌人或主动发起战斗时

【战斗模式规则】
当进入战斗模式时，你需要：
1. 在 <<<MODE>>> 标记中输出 battle
2. 在 <<<OPS>>> 中设置初始战斗状态
3. 战斗地图为10x10瓦片，坐标范围0-9
4. 返回玩家、队友、敌人、障碍物的初始位置

战斗输出格式：
<<<MODE>>>
battle
<<<END>>>
<<<BATTLE>>>
-- entities: [{"id":"player","name":"沈青砚","type":"player","position":{"x":5,"y":5},"hp":100,"maxHp":100,"mp":50,"maxMp":50},{"id":"enemy1","name":"妖兽","type":"enemy","position":{"x":7,"y":5},"hp":80,"maxHp":100}]
<<<OPS>>>
<<<END>>>

战斗实体类型：
- player：玩家
- ally：队友
- enemy：敌人
- obstacle：障碍物（如山石、树木等不可通过的地形）

战斗中玩家行动后，返回：
1. 战斗叙事文本
2. 更新后的实体位置（玩家移动、敌人移动、死亡标记）
3. 数据操作（增减气血、灵力、buff等）

战斗结束条件：
- 所有敌人死亡：战斗胜利
- 玩家死亡：战斗失败

【重要约束】
1. 仅输出叙事实际导致的数据变化，不要凭空大幅改动玩家数值
2. 数值变化须与叙事相符、合乎修仙常理（如修炼增修为、战斗耗气血、突破需修为达标）
3. 玩家境界当前为 ${realm}，叙事与数值变化须匹配此境界
4. ADD 新物品/关系时务必给出完整字段（参考相关数据中的结构）
5. 叙事正文内不得出现 <<<OPS>>>、<<<MODE>>>、MODIFY、ADD、DELETE 等标记字样
6. 若本轮无任何数据变化，仍需输出空的 <<<OPS>>> 与 <<<END>>> 标记
7. 数值变化须遵循个体适配度与修炼效率计算规则，灵根、心性、经脉状态都会影响修炼效果
8. 功法等级和熟练程度决定技能强度，需合理分配修炼资源`;

  const recentText =
    recentTurns.length > 0
      ? recentTurns
        .map((t, i) => `【第${i + 1}回合】\n玩家决策：${t.input}\n叙事：${t.narrative}`)
        .join("\n\n")
      : "（尚无近况）";

  const user = `【玩家身世背景】
${state.player.background}

【前情提要（已压缩）】
${summary || "（开端）"}

【最近经历】
${recentText}

【玩家本轮决策】
${decision}

【相关数据（仅本轮可能涉及）】
${relevantData}

请基于以上信息，续写本轮叙事，并在末尾用 <<<OPS>>>...<<<END>>> 块输出数据操作。`;

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

/** 压缩提示：把旧回合压缩为 ≤1000 字前情提要 */
export function buildCompressionPrompt(
  oldSummary: string,
  oldTurns: { input: string; narrative: string }[],
): ChatMessage[] {
  const turnsText = oldTurns
    .map((t, i) => `回合${i + 1} 决策：${t.input}\n叙事：${t.narrative}`)
    .join("\n\n");
  return [
    {
      role: "system",
      content:
        "你是修仙文字游戏的剧情压缩助手。将历史回合压缩为不超过 1000 字的前情提要，保留：关键剧情转折、人物关系变化、重大数值变化（境界突破、得失宝物、生死仇怨）、未解悬念。舍弃细节描写与重复内容。直接输出提要正文，不要标题、不要解释。",
    },
    {
      role: "user",
      content: `旧提要：\n${oldSummary || "（无）"}\n\n需要压缩的历史回合：\n${turnsText}\n\n请输出不超过1000字的压缩提要：`,
    },
  ];
}

export { REALMS };
