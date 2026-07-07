import type { DataOp, GameState } from "@/data/types";

const START_MARKER = "<<<OPS>>>";
const END_MARKER = "<<<END>>>";

export interface ParsedTurn {
  narrative: string;
  ops: DataOp[];
  opsRaw: string;
  mode: string | null;
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
  return { narrative, ops, opsRaw: opsRaw.trim(), mode };
}

function parseOpLines(block: string): DataOp[] {
  const ops: DataOp[] = [];
  for (const rawLine of block.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) continue;

    if (/^MODIFY\b/i.test(line)) {
      const rest = line.replace(/^MODIFY\s+/i, "").trim();
      const m = rest.match(/^(\S+)\s*([+\-=])\s*(.+)$/);
      if (m) {
        ops.push({
          kind: "modify",
          path: m[1],
          op: m[2] as "=" | "+" | "-",
          value: m[3].trim(),
        });
      }
    } else if (/^ADD\b/i.test(line)) {
      const rest = line.replace(/^ADD\s+/i, "").trim();
      const sp = rest.search(/\s/);
      if (sp !== -1) {
        ops.push({
          kind: "add",
          collection: rest.slice(0, sp).trim(),
          payload: rest.slice(sp + 1).trim(),
        });
      }
    } else if (/^DELETE\b/i.test(line)) {
      const rest = line.replace(/^DELETE\s+/i, "").trim();
      const sp = rest.search(/\s/);
      if (sp !== -1) {
        ops.push({
          kind: "delete",
          collection: rest.slice(0, sp).trim(),
          id: rest.slice(sp + 1).trim(),
        });
      }
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
      // 用 id 定位数组元素整体替换
      const arr = parent;
      if (Array.isArray(arr)) {
        const idx = arr.findIndex((x: any) => String(x?.id) === last.id || String(x?.trait) === last.id);
        if (idx !== -1) arr[idx] = parseValue(op.value);
      }
    }
  } else if (op.kind === "add") {
    const arr = resolveCollection(root, op.collection);
    let payload: unknown;
    try {
      payload = JSON.parse(op.payload);
    } catch {
      payload = op.payload;
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
    return obj.find((x: any) => String(x?.id) === seg.id);
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

/** 生成数据操作的人类可读摘要，用于 UI 展示 */
export function summarizeOps(ops: DataOp[]): string[] {
  return ops.map((op) => {
    if (op.kind === "modify") {
      const sign = op.op === "+" ? "+" : op.op === "-" ? "-" : "=";
      return `${op.path} ${sign} ${op.value}`;
    }
    if (op.kind === "add") {
      return `新增 ${op.collection}`;
    }
    return `移除 ${op.collection} ${op.id}`;
  });
}
