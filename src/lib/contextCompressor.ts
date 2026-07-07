import type { Turn } from "@/data/types";

export const RECENT_WINDOW = 4;
export const SUMMARY_MAX_CHARS = 1000;

/** 切分：保留最近 RECENT_WINDOW 轮，其余进入待压缩区 */
export function splitForCompression(turns: Turn[]): {
  oldTurns: Turn[];
  recentTurns: Turn[];
} {
  if (turns.length <= RECENT_WINDOW) {
    return { oldTurns: [], recentTurns: turns };
  }
  const cut = turns.length - RECENT_WINDOW;
  return {
    oldTurns: turns.slice(0, cut),
    recentTurns: turns.slice(cut),
  };
}

/** 是否需要压缩 */
export function needsCompression(turns: Turn[]): boolean {
  return turns.length > RECENT_WINDOW;
}

/** 取最近 N 轮的精简形式用于 pro 提示 */
export function recentForPrompt(turns: Turn[]): { input: string; narrative: string }[] {
  return turns.slice(-RECENT_WINDOW).map((t) => ({
    input: t.playerInput,
    narrative: t.narrative,
  }));
}

/** 将摘要裁切到上限（兜底，模型可能略超） */
export function clampSummary(summary: string): string {
  if (summary.length <= SUMMARY_MAX_CHARS) return summary;
  return summary.slice(0, SUMMARY_MAX_CHARS - 3) + "…";
}
