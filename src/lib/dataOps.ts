import type { DataOp, GameState, BattleEntity } from "@/data/types";

const START_MARKER = "<<<OPS>>>";
const END_MARKER = "<<<END>>>";
const BATTLE_START = "<<<BATTLE>>>";

export interface ParsedTurn {
  narrative: string;
  ops: DataOp[];
  opsRaw: string;
  mode: string | null;
  battleEntities: BattleEntity[] | null;
}

const MODE_START = "<<<MODE>>>";
const MODE_END = "<<<END>>>";

/** 从模型输出中提取叙事正文、模式标记与 <<<OPS>>> 标记块 */
export function parseModelOutput(raw: string): ParsedTurn {
  let text = raw.replace(/```[a-zA-Z]*\n?/g, "");

  let mode: string | null = null;
  const modeStartIdx = text.indexOf(MODE_START);
  if (modeStartIdx !== -1) {
    const afterModeStart = text.slice(modeStartIdx + MODE_START.length);
    const modeEndIdx = afterModeStart.indexOf(MODE_END);
    if (modeEndIdx !== -1) {
      mode = afterModeStart.slice(0, modeEndIdx).trim();
      text = text.slice(0, modeStartIdx) + afterModeStart.slice(modeEndIdx + MODE_END.length);
    }
  }

  let battleEntities: BattleEntity[] | null = null;
  const battleStartIdx = text.indexOf(BATTLE_START);
  if (battleStartIdx !== -1) {
    const afterBattleStart = text.slice(battleStartIdx + BATTLE_START.length);
    const battleEndIdx = afterBattleStart.indexOf(END_MARKER);
    if (battleEndIdx !== -1) {
      const battleContent = afterBattleStart.slice(0, battleEndIdx);
      battleEntities = parseBattleEntities(battleContent);
      text = text.slice(0, battleStartIdx) + afterBattleStart.slice(battleEndIdx + END_MARKER.length);
    }
  }

  const startIdx = text.indexOf(START_MARKER);
  let opsRaw = "";
  let narrative = text;

  if (startIdx !== -1) {
    const afterStart = text.slice(startIdx + START_MARKER.length);
    const endIdx = afterStart.indexOf(END_MARKER);
    if (endIdx !== -1) {
      opsRaw = afterStart.slice(0, endIdx);
      narrative = text.slice(0, startIdx) + afterStart.slice(endIdx + END_MARKER.length);
    } else {
      opsRaw = afterStart;
      narrative = text.slice(0, startIdx);
    }
  }
  narrative = narrative.trim();
  const ops = parseOpLines(opsRaw);
  return { narrative, ops, opsRaw: opsRaw.trim(), mode, battleEntities };
}

function parseBattleEntities(content: string): BattleEntity[] {
  const entities: BattleEntity[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("-- entities: ")) {
      const jsonStr = trimmed.slice(14).trim();
      try {
        const parsed = JSON.parse(jsonStr);
        if (Array.isArray(parsed)) {
          entities.push(...parsed);
        }
      } catch {
        console.warn("Failed to parse battle entities:", jsonStr);
      }
    }
  }

  return entities;
}

/** 检查 JSON 字符串的括号是否完整闭合 */
function isJsonClosed(s: string): boolean {
  const stack: string[] = [];
  let inString = false;
  let escape = false;
  for (const ch of s) {
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "[" || ch === "{") stack.push(ch);
    else if (ch === "]") { if (stack.pop() !== "[") return false; }
    else if (ch === "}") { if (stack.pop() !== "{") return false; }
  }
  return stack.length === 0;
}

function parseOpLines(block: string): DataOp[] {
  const ops: DataOp[] = [];
  const lines = block.split("\n");
  let i = 0;
  const MAX_LINES_PER_OP = 100;
  const MAX_VALUE_LENGTH = 50000;
  const MAX_TOTAL_OPS = 200;

  while (i < lines.length) {
    if (ops.length >= MAX_TOTAL_OPS) {
      console.warn(`[parseOpLines] Too many ops, truncating at ${MAX_TOTAL_OPS}`);
      break;
    }
    const rawLine = lines[i].trim();
    if (!rawLine || rawLine.startsWith("#") || rawLine.startsWith("//")) {
      i++;
      continue;
    }

    if (/^MODIFY\b/i.test(rawLine)) {
      const rest = rawLine.replace(/^MODIFY\s+/i, "").trim();
      const m = rest.match(/^(\S+)\s*([+\-=])\s*(.+)$/);
      if (m) {
        let valuePart = m[3].trim();
        let lineCount = 0;
        const isMultilineValue = valuePart.startsWith("[") || valuePart.startsWith("{");

        i++;
        while (i < lines.length && lineCount < MAX_LINES_PER_OP) {
          const nextLine = lines[i].trim();
          if (!nextLine || nextLine.startsWith("#") || nextLine.startsWith("//")) {
            if (isMultilineValue && !isJsonClosed(valuePart)) {
              valuePart += "\n" + lines[i];
            }
            i++;
            lineCount++;
            continue;
          }
          if (/^(MODIFY|ADD|DELETE)\b/i.test(nextLine)) break;
          if (valuePart.length + nextLine.length > MAX_VALUE_LENGTH) {
            console.warn("[parseOpLines] Value too large, truncating");
            break;
          }
          valuePart += "\n" + lines[i];
          i++;
          lineCount++;
          if (isMultilineValue && isJsonClosed(valuePart)) break;
        }

        ops.push({
          kind: "modify",
          path: m[1],
          op: m[2] as "=" | "+" | "-",
          value: valuePart,
        });
      } else {
        i++;
      }
    } else if (/^ADD\b/i.test(rawLine)) {
      const rest = rawLine.replace(/^ADD\s+/i, "").trim();
      const sp = rest.search(/\s/);

      const collection = sp !== -1 ? rest.slice(0, sp).trim() : rest;
      let payload = sp !== -1 ? rest.slice(sp + 1).trim() : "";
      let lineCount = 0;

      i++;
      while (i < lines.length && lineCount < MAX_LINES_PER_OP) {
        const nextLine = lines[i].trim();
        if (payload.length > MAX_VALUE_LENGTH) {
          console.warn("[parseOpLines] Payload too large, truncating");
          break;
        }
        if (/^(MODIFY|ADD|DELETE)\b/i.test(nextLine)) break;
        payload += "\n" + lines[i];
        i++;
        lineCount++;
      }

      ops.push({
        kind: "add",
        collection,
        payload,
      });
    } else if (/^DELETE\b/i.test(rawLine)) {
      const rest = rawLine.replace(/^DELETE\s+/i, "").trim();
      const sp = rest.search(/\s/);
      if (sp !== -1) {
        ops.push({
          kind: "delete",
          collection: rest.slice(0, sp).trim(),
          id: rest.slice(sp + 1).trim(),
        });
      }
      i++;
    } else {
      i++;
    }
  }
  return ops;
}

type PathSeg = string | { id: string };

function parsePath(path: string): PathSeg[] {
  const segs: PathSeg[] = [];
  let i = 0;
  let cur = "";
  while (i < path.length) {
    const ch = path[i];
    if (ch === ".") {
      if (cur) segs.push(cur);
      cur = "";
      i++;
    } else if (ch === "[") {
      if (cur) {
        segs.push(cur);
        cur = "";
      }
      const end = path.indexOf("]", i);
      if (end === -1) break;
      segs.push({ id: path.slice(i + 1, end) });
      i = end + 1;
      if (path[i] === ".") i++;
    } else {
      cur += ch;
      i++;
    }
  }
  if (cur) segs.push(cur);
  return segs;
}

function parseValue(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function resolveCollection(root: any, collection: string): any[] {
  const segs = collection.split(".");
  let cur: any = root;
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    if (cur == null) return [];
    if (cur[s] === undefined) {
      if (i === segs.length - 1) {
        cur[s] = [];
      } else {
        cur[s] = {};
      }
    } else if (typeof cur[s] !== "object" && i < segs.length - 1) {
      return [];
    }
    cur = cur[s];
  }
  return Array.isArray(cur) ? cur : [];
}

/** 深拷贝并应用所有数据操作，返回新状态 */
export function applyOpsToState(state: GameState, ops: DataOp[]): GameState {
  if (ops.length === 0) return state;
  const MAX_OPS = 200;
  const limitedOps = ops.slice(0, MAX_OPS);
  if (ops.length > MAX_OPS) {
    console.warn(`[dataOps] Too many ops (${ops.length}), truncating to ${MAX_OPS}`);
  }

  const clone = <T>(obj: T): T => {
    if (obj == null) return obj;
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch {
      return obj;
    }
  };

  const next: GameState = {
    ...state,
    player: clone(state.player),
    techniques: Array.isArray(state.techniques) ? state.techniques.map((t) => ({ ...t })) : [],
    inventory: Array.isArray(state.inventory) ? state.inventory.map((i) => ({ ...i })) : [],
    spiritStones: { ...state.spiritStones },
    sect: clone(state.sect),
    relations: Array.isArray(state.relations) ? state.relations.map((r) => ({ ...r })) : [],
    log: Array.isArray(state.log) ? [...state.log] : [],
    pillCache: state.pillCache ? { ...state.pillCache } : {},
    news: state.news ? clone(state.news) : { items: [], lastUpdate: "" },
  };

  for (const op of limitedOps) {
    try {
      applyOne(next, op);
    } catch (e) {
      console.warn("[dataOps] 操作失败，已跳过:", op, e);
    }
  }
  return next;
}

function parseMarkdownBlockToJson(block: string): any {
  const result: Record<string, unknown> = {};
  const lines = block.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (trimmed.startsWith("-- ")) {
      const content = trimmed.slice(3).trim();
      const colonIdx = content.indexOf(":");
      if (colonIdx !== -1) {
        const key = content.slice(0, colonIdx).trim();
        const rawValue = content.slice(colonIdx + 1).trim();
        let value: unknown = rawValue;

        if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
          value = rawValue.slice(1, -1);
        } else if (!isNaN(Number(rawValue))) {
          value = Number(rawValue);
        } else if (rawValue === "true") {
          value = true;
        } else if (rawValue === "false") {
          value = false;
        }

        result[key] = value;
      }
    } else if (trimmed.startsWith("--- ")) {
      const content = trimmed.slice(4).trim();
      const colonIdx = content.indexOf(":");
      if (colonIdx !== -1) {
        const key = content.slice(0, colonIdx).trim();
        const valueStr = content.slice(colonIdx + 1).trim();

        try {
          result[key] = JSON.parse(valueStr);
        } catch {
          result[key] = valueStr;
        }
      }
    } else {
      if (!result.text) {
        result.text = trimmed;
      } else {
        result.text += "\n" + trimmed;
      }
    }
  }

  if (result.text && !result.desc) {
    result.desc = result.text;
    delete result.text;
  }

  return Object.keys(result).length > 0 ? result : block;
}

function applyOne(root: any, op: DataOp): void {
  if (op.kind === "modify") {
    const segs = parsePath(op.path);
    if (segs.length === 0) return;
    let parent: any = root;
    for (let i = 0; i < segs.length - 1; i++) {
      parent = descend(parent, segs[i]);
      if (parent == null) return;
      if (typeof parent !== "object") {
        console.warn("[applyOne] Path segment is not an object:", op.path, "at segment", i, "value:", parent);
        return;
      }
    }
    const last = segs[segs.length - 1];
    if (typeof last === "string") {
      if (typeof parent !== "object" || parent === null) {
        console.warn("[applyOne] Parent is not an object for modify:", op.path);
        return;
      }
      applyModify(parent, last, op);
    } else {
      const arr = parent;
      if (Array.isArray(arr)) {
        if (arr.length > 1000) {
          console.warn("[applyOne] Array too large, skipping modify:", op.path);
          return;
        }
        const idx = arr.findIndex((x: any) => String(x?.id) === last.id || String(x?.trait) === last.id);
        if (idx !== -1) {
          arr[idx] = parseValue(op.value);
        } else {
          const newValue = parseValue(op.value);
          if (typeof newValue === "object" && newValue !== null) {
            const normalizedValue = normalizeMeridianZone({ ...newValue, id: last.id });
            arr.push(normalizedValue);
          } else {
            arr.push(newValue);
          }
        }
      }
    }
  } else if (op.kind === "add") {
    const arr = resolveCollection(root, op.collection);
    if (!Array.isArray(arr)) {
      console.warn("[applyOne] Collection is not an array:", op.collection);
      return;
    }
    if (arr.length > 1000) {
      console.warn("[applyOne] Collection too large, skipping add:", op.collection);
      return;
    }
    let payload: unknown;

    if (op.payload.trim().startsWith("-- ")) {
      payload = parseMarkdownBlockToJson(op.payload);
    } else {
      try {
        payload = JSON.parse(op.payload);
      } catch {
        payload = op.payload;
      }
    }

    arr.push(payload);
  } else if (op.kind === "delete") {
    const arr = resolveCollection(root, op.collection);
    if (!Array.isArray(arr) || arr.length === 0) return;
    if (typeof arr[0] === "object" && arr[0] !== null) {
      const idx = arr.findIndex(
        (x: any) => String(x?.id) === op.id || String(x?.name) === op.id,
      );
      if (idx !== -1) arr.splice(idx, 1);
    } else {
      let target: unknown = op.id;
      try {
        target = JSON.parse(op.id);
      } catch {
        /* keep raw */
      }
      const idx = arr.findIndex((x: unknown) => x === target);
      if (idx !== -1) arr.splice(idx, 1);
    }
  }
}

function descend(obj: any, seg: PathSeg): any {
  if (typeof seg === "string") {
    const result = obj?.[seg];
    return result;
  }
  if (Array.isArray(obj)) {
    return obj.find((x: any) => String(x?.id) === seg.id || String(x?.trait) === seg.id || String(x?.name) === seg.id);
  }
  return undefined;
}

const ZONE_MAP: Record<string, string> = {
  "头部": "head",
  "胸部": "chest",
  "腹部": "abdomen",
  "四肢": "arm_left",
};

function normalizeMeridianZone(meridian: any): any {
  if (meridian.zone && ZONE_MAP[meridian.zone]) {
    return { ...meridian, zone: ZONE_MAP[meridian.zone] };
  }
  return meridian;
}

function applyModify(parent: any, key: string, op: Extract<DataOp, { kind: "modify" }>): void {
  const current = parent[key];
  if (op.op === "=") {
    let value = parseValue(op.value);

    if (key === "spiritRoots" && typeof value === "object" && value !== null && !Array.isArray(value)) {
      value = Object.entries(value).map(([element, val]) => ({
        element,
        value: Number(val),
      }));
    }

    // 归一化 meridians 数组：damage 字段应为 boolean
    if (key === "meridians" && Array.isArray(value)) {
      value = value.map((m: any) => ({
        ...m,
        damage: Boolean(m.damage),
      }));
    }

    parent[key] = value;
  } else if (op.op === "+") {
    if (typeof current === "number") {
      parent[key] = current + Number(parseValue(op.value));
    } else if (typeof current === "string") {
      const v = parseValue(op.value);
      parent[key] = current + String(v);
    } else {
      parent[key] = parseValue(op.value);
    }
  } else if (op.op === "-") {
    if (typeof current === "number") {
      parent[key] = current - Number(parseValue(op.value));
    }
  }
}

function formatValue(value: string): string {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) return "[]";
      if (parsed.length <= 3) {
        return parsed.map((item) => {
          if (typeof item === "object" && item !== null) {
            const keys = Object.keys(item);
            if (keys.includes("name")) return item.name;
            if (keys.includes("element")) return `${item.element}${item.grade}`;
            if (keys.includes("id")) return item.id;
            return JSON.stringify(item).slice(0, 20);
          }
          return String(item);
        }).join(", ");
      }
      return `[${parsed.length}项]`;
    }
    if (typeof parsed === "object" && parsed !== null) {
      const keys = Object.keys(parsed);
      if (keys.length <= 3) {
        return keys.map((k) => `${k}:${parsed[k]}`).join(", ");
      }
      return `{${keys.length}个字段}`;
    }
    return String(parsed);
  } catch {
    return value;
  }
}

export function summarizeOps(ops: DataOp[]): string[] {
  return ops.map((op) => {
    if (op.kind === "modify") {
      const sign = op.op === "+" ? "+" : op.op === "-" ? "-" : "=";
      const formattedValue = formatValue(op.value);
      return `${op.path} ${sign} ${formattedValue}`;
    }
    if (op.kind === "add") {
      return `新增 ${op.collection}`;
    }
    return `移除 ${op.collection} ${op.id}`;
  });
}
