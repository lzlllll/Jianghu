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

      let path: string;
      let op: "=" | "+" | "-";
      let value: string;

      if (m) {
        path = m[1];
        op = m[2] as "=" | "+" | "-";
        value = m[3].trim();
      } else {
        const firstSpace = rest.indexOf(" ");
        if (firstSpace === -1) {
          i++;
          continue;
        }
        path = rest.slice(0, firstSpace).trim();
        op = "=";
        value = rest.slice(firstSpace + 1).trim();
      }

      let lineCount = 0;

      i++;
      while (i < lines.length && lineCount < MAX_LINES_PER_OP) {
        const nextLine = lines[i];
        const trimmedNext = nextLine.trim();
        if (!trimmedNext || trimmedNext.startsWith("#") || trimmedNext.startsWith("//")) {
          if (value.length < MAX_VALUE_LENGTH) {
            value += "\n" + nextLine;
          }
          i++;
          lineCount++;
          continue;
        }
        if (/^(MODIFY|ADD|DELETE)\b/i.test(trimmedNext)) break;
        if (value.length + nextLine.length > MAX_VALUE_LENGTH) {
          console.warn("[parseOpLines] Value too large, truncating");
          break;
        }
        value += "\n" + nextLine;
        i++;
        lineCount++;
      }

      ops.push({
        kind: "modify",
        path,
        op,
        value: value.trim(),
      });
    } else if (/^ADD\s+/i.test(rawLine)) {
      const rest = rawLine.replace(/^ADD\s+/i, "").trim();
      const collection = rest;
      let payload = "";
      let lineCount = 0;

      i++;
      while (i < lines.length && lineCount < MAX_LINES_PER_OP) {
        const nextLine = lines[i];
        const trimmedNext = nextLine.trim();
        if (!trimmedNext || trimmedNext.startsWith("#") || trimmedNext.startsWith("//")) {
          if (payload.length < MAX_VALUE_LENGTH) {
            payload += "\n" + nextLine;
          }
          i++;
          lineCount++;
          continue;
        }
        if (/^(MODIFY|ADD|DELETE)\b/i.test(trimmedNext)) break;
        if (payload.length + nextLine.length > MAX_VALUE_LENGTH) {
          console.warn("[parseOpLines] Payload too large, truncating");
          break;
        }
        payload += "\n" + nextLine;
        i++;
        lineCount++;
      }

      const trimmedPayload = payload.trim();
      if (trimmedPayload) {
        ops.push({
          kind: "add",
          collection,
          payload: trimmedPayload,
        });
      }
    } else if (/^DELETE\b/i.test(rawLine)) {
      const rest = rawLine.replace(/^DELETE\s+/i, "").trim();
      const firstSpace = rest.indexOf(" ");
      if (firstSpace !== -1) {
        ops.push({
          kind: "delete",
          collection: rest.slice(0, firstSpace).trim(),
          id: rest.slice(firstSpace + 1).trim(),
        });
      }
      i++;
    } else {
      i++;
    }
  }
  return ops;
}

type PathSeg = string;

function parsePath(path: string): PathSeg[] {
  const segs: PathSeg[] = [];
  let cur = "";
  for (const ch of path) {
    if (ch === ".") {
      if (cur) segs.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur) segs.push(cur);
  return segs;
}

function parseValue(raw: string): unknown {
  const trimmed = raw.trim();

  if (!trimmed) {
    return raw;
  }

  if (!isNaN(Number(trimmed))) {
    return Number(trimmed);
  }

  if (trimmed === "true") {
    return true;
  }

  if (trimmed === "false") {
    return false;
  }

  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }

  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1);
  }

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      try {
        return JSON.parse(trimmed.replace(/'/g, '"'));
      } catch {
        return trimmed;
      }
    }
  }

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      try {
        return JSON.parse(trimmed.replace(/'/g, '"'));
      } catch {
        return trimmed;
      }
    }
  }

  return trimmed;
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
    let trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (trimmed.startsWith("-- ")) {
      trimmed = trimmed.slice(3).trim();
    } else if (trimmed.startsWith("--- ")) {
      trimmed = trimmed.slice(4).trim();
    }

    const colonIdx = trimmed.indexOf(":");
    if (colonIdx !== -1) {
      const key = trimmed.slice(0, colonIdx).trim();
      const rawValue = trimmed.slice(colonIdx + 1).trim();
      result[key] = parseValue(rawValue);
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
    if (typeof parent !== "object" || parent === null) {
      console.warn("[applyOne] Parent is not an object for modify:", op.path);
      return;
    }
    applyModify(parent, last, op);
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
    const payload = parseMarkdownBlockToJson(op.payload);
    if (op.collection === "log") {
      const text = typeof payload === "string" ? payload : payload.text || payload.desc || JSON.stringify(payload);
      arr.push(text);
    } else {
      arr.push(payload);
    }
  } else if (op.kind === "delete") {
    const arr = resolveCollection(root, op.collection);
    if (!Array.isArray(arr) || arr.length === 0) return;
    if (typeof arr[0] === "object" && arr[0] !== null) {
      const idx = arr.findIndex(
        (x: any) => String(x?.id) === op.id || String(x?.name) === op.id,
      );
      if (idx !== -1) arr.splice(idx, 1);
    } else {
      const idx = arr.findIndex((x: unknown) => String(x) === op.id);
      if (idx !== -1) arr.splice(idx, 1);
    }
  }
}

function descend(obj: any, seg: PathSeg): any {
  if (typeof seg === "string") {
    return obj?.[seg];
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
  const parsed = parseValue(value);
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) return "[]";
    if (parsed.length <= 3) {
      return parsed.map((item) => {
        if (typeof item === "object" && item !== null) {
          const keys = Object.keys(item);
          if (keys.includes("name")) return item.name;
          if (keys.includes("element")) return `${item.element}${item.grade}`;
          if (keys.includes("id")) return item.id;
          return String(item).slice(0, 20);
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
