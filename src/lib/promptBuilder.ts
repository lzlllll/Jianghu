import type { AISettings, GameState, Turn, LocationType } from "@/data/types";
import type { ChatMessage } from "@/lib/aiClient";

const HOUR_NAMES = ["子时", "丑时", "寅时", "卯时", "辰时", "巳时", "午时", "未时", "申时", "酉时", "戌时", "亥时"];

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
  lines.push(`player.name = ${p.name || ""}`);
  lines.push(`player.title = ${p.title || ""}`);
  lines.push(`player.realm = ${REALMS[p.realmIndex] ?? "未知"} (realmIndex=${p.realmIndex}, stage=${p.realmStage})`);
  lines.push(`player.cultivation = ${p.cultivation}`);
  lines.push(`player.hp = ${p.hp}/${p.hpMax}`);
  lines.push(`player.mp = ${p.mp}/${p.mpMax}`);
  lines.push(`player.spirit = ${p.spirit}/${p.spiritMax}`);
  lines.push(`player.lifespan = ${p.lifespanCurrent}/${p.lifespanMax}`);
  lines.push(`player.body = ${p.body || ""}`);
  lines.push(`player.fortune = ${p.fortune || ""}`);
  lines.push(`player.karma = ${p.karma}`);
  lines.push(`player.sectName = ${p.sectName || ""}`);
  lines.push(`player.position = ${p.position || ""}`);
  lines.push(`player.background = ${p.background || ""}`);
  lines.push(`player.personality = ${p.personality || ""}`);
  lines.push(`player.description = ${p.description || ""}`);

  const t = state.currentTime || { year: 1, month: 1, day: 1, hour: 0 };
  lines.push(`currentTime.year = ${t.year}`);
  lines.push(`currentTime.month = ${t.month}`);
  lines.push(`currentTime.day = ${t.day}`);
  lines.push(`currentTime.hour = ${t.hour}`);

  const spiritRoots = Array.isArray(p.spiritRoots) ? p.spiritRoots : [];
  lines.push(`player.spiritRoots = ${spiritRoots.map((r) => `${r.element}${r.value}`).join(" ") || "(空)"}`);

  const heartScores = Array.isArray(p.stats?.heartScores) ? p.stats.heartScores : [];
  lines.push(
    `player.stats = 体力${p.stats?.vitality ?? 0} 神魂${p.stats?.soul ?? 0} 悟性${p.stats?.wisdom ?? 0} 身法${p.stats?.agility ?? 0} 心性[${heartScores.map((hs) => `${hs.trait}${hs.score}`).join(",") || "空"}]`,
  );

  const meridians = Array.isArray(p.meridians) ? p.meridians : [];
  lines.push(`player.meridians = ${meridians.map((m) => `${m.name}${m.clarity}/${m.maxClarity}${m.damage ? "[伤]" : ""}`).join(" ") || "(空)"}`);

  lines.push(`spiritStones.low = ${state.spiritStones?.low ?? 0}`);
  lines.push(`spiritStones.mid = ${state.spiritStones?.mid ?? 0}`);
  lines.push(`spiritStones.high = ${state.spiritStones?.high ?? 0}`);
  lines.push(`spiritStones.supreme = ${state.spiritStones?.supreme ?? 0}`);

  const techniques = Array.isArray(state.techniques) ? state.techniques : [];
  techniques.forEach((t) => {
    lines.push(
      `techniques[${t.id}] = ${t.name} ${t.category} ${t.grade} ${t.daoPath} ${t.element}系 ${t.nature}性 熟练${t.proficiency}/${t.proficiencyMax} 心性匹配[${t.heartMatch?.join(",") || ""}]`,
    );
  });

  const inventory = Array.isArray(state.inventory) ? state.inventory : [];
  inventory.forEach((i) => {
    const eq = i.equipped ? ` 已装备${i.slot}` : "";
    lines.push(
      `inventory[${i.id}] = ${i.name} ${i.type} ${i.grade} ×${i.count}${eq}`,
    );
  });

  const s = state.sect || { name: "", level: 1, contribution: 0, leader: "", territory: "", appearance: "", reputationDesc: "", surroundings: "", positions: [], tasks: [], heritage: [], resources: [] };
  lines.push(`sect.name = ${s.name || ""}`);
  lines.push(`sect.level = ${s.level}`);
  lines.push(`sect.contribution = ${s.contribution}`);
  lines.push(`sect.leader = ${s.leader || ""}`);
  lines.push(`sect.territory = ${s.territory || ""}`);
  lines.push(`sect.appearance = ${s.appearance || ""}`);
  lines.push(`sect.reputationDesc = ${s.reputationDesc || ""}`);
  lines.push(`sect.surroundings = ${s.surroundings || ""}`);

  const positions = Array.isArray(s.positions) ? s.positions : [];
  positions.forEach((pos) => {
    const mark = pos.isCurrent ? "【现任】" : pos.unlocked ? "已达" : "未达";
    lines.push(`sect.positions[${pos.id}] = ${pos.name} Lv${pos.level} ${mark} 需贡献${pos.contributionNeeded}`);
  });

  const tasks = Array.isArray(s.tasks) ? s.tasks : [];
  tasks.forEach((t) => {
    lines.push(
      `sect.tasks[${t.id}] = ${t.title} 难度${t.difficulty} 贡献${t.contribution} 灵石${t.spiritStone}${t.accepted ? " 已接" : ""}`,
    );
  });

  const heritage = Array.isArray(s.heritage) ? s.heritage : [];
  heritage.forEach((h, idx) => {
    lines.push(`sect.heritage[${idx}] = ${h.name} ${h.type} ${h.grade} ${h.status}`);
  });

  const resources = Array.isArray(s.resources) ? s.resources : [];
  resources.forEach((r, idx) => {
    lines.push(`sect.resources[${idx}] = ${r.name} ${r.amount}${r.unit}`);
  });

  const relations = Array.isArray(state.relations) ? state.relations : [];
  relations.forEach((r) => {
    const statsStr = r.stats
      ? ` HP${r.stats.hp}/${r.stats.hpMax} 攻${r.stats.attack} 防${r.stats.defense} 速${r.stats.speed}`
      : "";
    const techStr = r.techniqueIds?.length ? ` 功法[${r.techniqueIds.join(",")}]` : "";
    lines.push(
      `relations[${r.id}] = ${r.name} ${r.title} ${relationTypeLabel(r.type)} 境界${r.realm} 亲疏${r.affinity}/${r.affinityMax}${statsStr}${techStr}`,
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
  const MAX_LINES = 200;
  const MAX_TOTAL_LENGTH = 150000;
  let totalLength = 0;

  for (const path of paths) {
    if (lines.length >= MAX_LINES) {
      lines.push("... (数据过多，已截断)");
      break;
    }
    const result = describePath(state, path);
    if (result && result.length < 5000) {
      if (totalLength + result.length > MAX_TOTAL_LENGTH) {
        lines.push("... (数据过多，已截断)");
        break;
      }
      lines.push(result);
      totalLength += result.length;
    }
  }

  const finalResult = lines.filter(Boolean).join("\n");
  console.debug(`[promptBuilder] resolveRelevantData: ${paths.length} paths, ${finalResult.length} chars`);
  return finalResult;
}

function describePath(state: GameState, path: string): string {
  if (!path || path.length > 100) {
    return "";
  }

  // 集合名
  if (path === "inventory") {
    const inventory = Array.isArray(state.inventory) ? state.inventory : [];
    if (inventory.length === 0) return "inventory: (空)";
    return "inventory:\n" + inventory.slice(0, 30).map((i) => `  [${i.id}] ${i.name} ${i.type} ${i.grade} ×${i.count}${i.equipped ? ` 已装备${i.slot}` : ""}`).join("\n");
  }
  if (path === "techniques") {
    const techniques = Array.isArray(state.techniques) ? state.techniques : [];
    if (techniques.length === 0) return "techniques: (空)";
    return "techniques:\n" + techniques.slice(0, 30).map((t) => `  [${t.id}] ${t.name} ${t.category} ${t.grade} 熟练${t.proficiency}/${t.proficiencyMax}`).join("\n");
  }
  if (path === "relations") {
    const relations = Array.isArray(state.relations) ? state.relations : [];
    if (relations.length === 0) return "relations: (空)";
    return "relations:\n" + relations.slice(0, 30).map((r) => `  [${r.id}] ${r.name} ${relationTypeLabel(r.type)} 亲疏${r.affinity}/${r.affinityMax} ${r.realm}`).join("\n");
  }
  if (path === "log") {
    const log = Array.isArray(state.log) ? state.log : [];
    return "log(最近5条):\n" + log.slice(0, 5).map((l) => `  - ${l}`).join("\n");
  }
  if (path === "sect.tasks") {
    const tasks = Array.isArray(state.sect?.tasks) ? state.sect.tasks : [];
    if (tasks.length === 0) return "sect.tasks: (空)";
    return "sect.tasks:\n" + tasks.slice(0, 30).map((t) => `  [${t.id}] ${t.title} ${t.difficulty} 贡献${t.contribution}${t.accepted ? " 已接" : ""}`).join("\n");
  }

  // 路径解析
  const segMatch = path.match(/^([a-zA-Z_]+)\[([^\]]+)\](?:\.(.+))?$/);
  if (segMatch) {
    const coll = segMatch[1];
    const id = segMatch[2];
    const sub = segMatch[3];
    if (coll === "sect") {
      const subMatch = path.match(/^sect\.([a-zA-Z_]+)\[([^\]]+)\](?:\.(.+))?$/);
      if (subMatch) {
        const subColl = subMatch[1];
        const subId = subMatch[2];
        const subField = subMatch[3];
        const list = Array.isArray((state.sect as any)?.[subColl]) ? (state.sect as any)[subColl] : [];
        const item = list.find((x: any) => String(x?.id) === subId || String(x?.name) === subId);
        if (item) {
          try {
            const value = subField ? (item as any)[subField] : item;
            const jsonStr = typeof value === "object" ? JSON.stringify(value) : String(value);
            return `${path} = ${jsonStr.slice(0, 500)}`;
          } catch {
            return `${path} = (序列化失败)`;
          }
        }
      }
      return `${path} = (未找到)`;
    }
    const arr = (state as any)[coll];
    if (Array.isArray(arr)) {
      const item = arr.find((x: any) => String(x?.id) === id);
      if (item) {
        try {
          const value = sub ? (item as any)[sub] : item;
          const jsonStr = typeof value === "object" ? JSON.stringify(value) : String(value);
          return `${path} = ${jsonStr.slice(0, 500)}`;
        } catch {
          return `${path} = (序列化失败)`;
        }
      }
    }
    return `${path} = (未找到)`;
  }

  // 普通字段
  const parts = path.split(".");
  let cur: any = state;
  for (const p of parts) {
    if (cur == null) return `${path} = (未找到)`;
    cur = cur[p];
  }
  if (cur === undefined) return `${path} = (未找到)`;
  if (typeof cur === "object" && cur !== null) {
    try {
      const jsonStr = JSON.stringify(cur);
      return `${path} = ${jsonStr.slice(0, 500)}`;
    } catch {
      return `${path} = (序列化失败)`;
    }
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
  chatSummary?: string;
}): ChatMessage[] {
  const { state, summary, recentTurns, decision, relevantData, chatSummary } = params;
  const realm = REALMS[state.player.realmIndex] ?? "未知";
  const location = LOCATION_INFO[state.currentLocation] || { name: "未知场所", allowed: "所有行为", forbidden: "无" };

  const system = `你是一部古风修仙文字游戏的叙事引擎。以第二人称「你」叙述玩家的修真经历，文笔古雅、意象丰沛、节奏紧凑，单次叙事正文不少于 1000 字。

【强制输出格式 — 违反将导致游戏数据错误】
你的回复必须严格分为两部分：
第一部分：叙事正文（纯叙述文字，不少于1000字）
第二部分：数据操作标记块（以 <<<OPS>>> 开头、<<<END>>> 结尾）

重要：即使当前回合无数据修改，也必须输出空的 <<<OPS>>>\n<<<END>>> 标记块。

【文风】第三人称，禁止过度解释和直接心理描写，通过行为和环境暗示内心。对话高度生活化，推动剧情与展现人际关系。环境描写要有功能性，体现时间与变化。

【世界观】灵根九系（金、木、水、火、土、风、雷、冰、暗）决定修炼速度。功法分五品（凡、灵、玄、地、天）五类（心法、炼体、神通、身法、秘术）。心性任意中文词汇，0-100分影响修炼与奇遇。经脉通畅度0-100影响气血运行。

【数据操作格式】
<<<QUICK>>>
建议1
建议2
建议3
<<<END>>>
<<<OPS>>>
MODIFY <路径> <值>
ADD <集合>
<字段名>: <值>
DELETE <集合> <id>
<<<END>>>

【路径示例】player.cultivation、player.stats.vitality、techniques[t1].proficiency、inventory[i1].count、sect.contribution

【ADD集合】inventory、log、techniques、relations、sect.tasks、sect.heritage、news.items、player.stats.heartScores、player.meridians

【DELETE格式】集合名与id用空格分隔，如 DELETE inventory i10

【场所约束】当前场所：${location.name}。允许：${location.allowed}。禁止：${location.forbidden}。冲突时在叙事中体现限制，不执行冲突操作。

【时间推进】每轮必须用MODIFY更新currentTime（year/month/day/hour），尺度不固定。

【新闻生成】仅跨天时生成3条（官府公告/宗门布告/市井传言），同一天不再生成。

【重要约束】1.仅输出实际数据变化；2.数值变化与叙事相符；3.当前境界：${realm}；4.ADD物品/关系需完整字段；5.叙事内不得出现标记字样；6.强制包含<<<OPS>>>块；7.遵循修炼效率规则。`;

  const recentText =
    recentTurns.length > 0
      ? recentTurns
        .map((t, i) => `【第${i + 1}回合】\n玩家决策：${t.input}\n叙事：${t.narrative}`)
        .join("\n\n")
      : "（尚无近况）";

  const user = `【当前时间】第${state.currentTime.year}年${state.currentTime.month}月${state.currentTime.day}日${HOUR_NAMES[state.currentTime.hour]}

【玩家身世背景】
${state.player.background || "（暂无记载）"}

${state.player.personality ? `【玩家心性】\n${state.player.personality}\n\n` : ""}${state.player.description ? `【玩家外貌】\n${state.player.description}\n\n` : ""}【前情提要（已压缩）】
${summary || "（开端）"}

【最近经历】
${recentText}

${chatSummary ? `【近期交谈记录】\n${chatSummary}\n\n` : ""}【玩家本轮决策】
${decision}

【相关数据（仅本轮可能涉及）】
${relevantData}

请基于以上信息，续写本轮叙事，并在末尾用 <<<OPS>>>...<<<END>>> 块输出数据操作。

（提醒：请务必在回复末尾包含 <<<OPS>>> 和 <<<END>>> 标记块，这是游戏功能正常运行所必需的。）`;

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
