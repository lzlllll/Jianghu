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

function parseOpLines(block: string): DataOp[] {
  const ops: DataOp[] = [];
  const lines = block.split("\n");
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i].trim();
    if (!rawLine || rawLine.startsWith("#") || rawLine.startsWith("//")) {
      i++;
      continue;
    }

    if (/^MODIFY\b/i.test(rawLine)) {
      const rest = rawLine.replace(/^MODIFY\s+/i, "").trim();
      const m = rest.match(/^(\S+)\s*([+\-=])\s*(.+)$/);
      if (m) {
        ops.push({
          kind: "modify",
          path: m[1],
          op: m[2] as "=" | "+" | "-",
          value: m[3].trim(),
        });
      }
      i++;
    } else if (/^ADD\b/i.test(rawLine)) {
      const rest = rawLine.replace(/^ADD\s+/i, "").trim();
      const sp = rest.search(/\s/);

      if (sp !== -1) {
        const collection = rest.slice(0, sp).trim();
        let payload = rest.slice(sp + 1).trim();

        i++;
        while (i < lines.length) {
          const nextLine = lines[i].trim();
          if (nextLine.startsWith("-- ") || nextLine.startsWith("--- ")) {
            payload += "\n" + lines[i];
            i++;
          } else if (nextLine && !/^(MODIFY|ADD|DELETE)\b/i.test(nextLine)) {
            payload += "\n" + lines[i];
            i++;
          } else {
            break;
          }
        }

        ops.push({
          kind: "add",
          collection,
          payload,
        });
      } else {
        i++;
      }
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
  for (const s of segs) {
    if (cur == null) return [];
    cur = cur[s];
  }
  return Array.isArray(cur) ? cur : [];
}

/** 深拷贝并应用所有数据操作，返回新状态 */
export function applyOpsToState(state: GameState, ops: DataOp[]): GameState {
  const next: GameState = structuredClone(state);
  for (const op of ops) {
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
    } else if (!result.id && !result.name) {
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
    }
    const last = segs[segs.length - 1];
    if (typeof last === "string") {
      applyModify(parent, last, op);
    } else {
      const arr = parent;
      if (Array.isArray(arr)) {
        const idx = arr.findIndex((x: any) => String(x?.id) === last.id || String(x?.trait) === last.id);
        if (idx !== -1) arr[idx] = parseValue(op.value);
      }
    }
  } else if (op.kind === "add") {
    const arr = resolveCollection(root, op.collection);
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
    if (arr.length === 0) return;
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
  if (typeof seg === "string") return obj?.[seg];
  if (Array.isArray(obj)) {
    return obj.find((x: any) => String(x?.id) === seg.id || String(x?.trait) === seg.id || String(x?.name) === seg.id);
  }
  return undefined;
}

function applyModify(parent: any, key: string, op: Extract<DataOp, { kind: "modify" }>): void {
  const current = parent[key];
  if (op.op === "=") {
    parent[key] = parseValue(op.value);
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
