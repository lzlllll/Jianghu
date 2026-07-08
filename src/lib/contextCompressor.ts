import type { Turn } from "@/data/types";

export const RECENT_WINDOW = 4;
export const SUMMARY_MAX_CHARS = 1000;

/** 切分：保留最近 RECENT_WINDOW 轮，其余进入待压缩区 */
export function splitForCompression(turns: Turn[] | unknown): {
  oldTurns: Turn[];
  recentTurns: Turn[];
} {
  const safeTurns = Array.isArray(turns) ? turns : [];
  if (safeTurns.length <= RECENT_WINDOW) {
    return { oldTurns: [], recentTurns: safeTurns };
  }
  const cut = safeTurns.length - RECENT_WINDOW;
  return {
    oldTurns: safeTurns.slice(0, cut),
    recentTurns: safeTurns.slice(cut),
  };
}

/** 是否需要压缩 */
export function needsCompression(turns: Turn[] | unknown): boolean {
  return Array.isArray(turns) && turns.length > RECENT_WINDOW;
}

/** 取最近 N 轮的精简形式用于 pro 提示 */
export function recentForPrompt(turns: Turn[] | unknown): { input: string; narrative: string }[] {
  const safeTurns = Array.isArray(turns) ? turns : [];
  return safeTurns.slice(-RECENT_WINDOW).map((t) => ({
    input: t.playerInput,
    narrative: t.narrative,
  }));
}

/** 将摘要裁切到上限（兜底，模型可能略超） */
export function clampSummary(summary: string): string {
  if (summary.length <= SUMMARY_MAX_CHARS) return summary;
  return summary.slice(0, SUMMARY_MAX_CHARS - 3) + "…";
}
