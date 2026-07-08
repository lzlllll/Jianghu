import { useState } from "react";
import { useAIStore } from "@/store/useAIStore";
import { useGameStore } from "@/store/useGameStore";
import { BattleMap } from "./BattleMap";
import { ScrollCard } from "@/components/ui/ScrollCard";
import { PanelTitle } from "@/components/ui/PanelTitle";
import { SealButton } from "@/components/ui/SealButton";
import { CloudDivider } from "@/components/ui/CloudDivider";
import { cn } from "@/lib/utils";
import { Swords, X, Loader2 } from "lucide-react";

export function BattlePanel() {
  const battle = useAIStore((s) => s.battle);
  const runBattleTurn = useAIStore((s) => s.runBattleTurn);
  const endBattle = useAIStore((s) => s.endBattle);
  const player = useGameStore((s) => s.player);

  const [action, setAction] = useState("");
  const isResolving = battle.isResolving;

  const handleSubmit = () => {
    const text = action.trim();
    if (!text || isResolving) return;
    runBattleTurn(text);
    setAction("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="paper-texture h-full flex flex-col">
      <PanelTitle
        title="战斗"
        poem="黄沙百战穿金甲，不破楼兰终不还。"
      />
      <button
        onClick={endBattle}
        className="flex items-center gap-1 text-[11px] font-serif text-cinnabar-400/70 hover:text-cinnabar-300 transition mb-4"
      >
        <X size={12} /> 结束战斗
      </button>

      <div className="flex-1 flex flex-col gap-4 overflow-hidden">
        <ScrollCard
          title="战场态势"
          subtitle={`第 ${battle.round} 回合 · ${battle.turn === "player" ? "玩家行动" : "敌方行动"}`}
          ornament={
            <div className="flex items-center gap-2">
              <Swords size={14} className="text-cinnabar-400/80" />
              <span className="font-number text-xs text-paper-400/60">
                {battle.map.entities.filter(e => e.type === "enemy" && !e.isDead).length} 敌
              </span>
            </div>
          }
          className="shrink-0"
        >
          <BattleMap map={battle.map} />
        </ScrollCard>

        <ScrollCard
          title="战斗叙事"
          subtitle="实时战况"
          className="flex-1 min-h-0 flex flex-col"
        >
          <div className="flex-1 overflow-y-auto font-serif text-sm text-paper-200 leading-relaxed whitespace-pre-wrap pr-2">
            {battle.narrative || "战斗开始，准备行动..."}
          </div>
        </ScrollCard>

        <ScrollCard
          title="我方状态"
          className="shrink-0"
        >
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="font-brush text-lg text-cinnabar-400">{player.hp}</div>
              <div className="font-serif text-[10px] text-paper-400/50">气血 / {player.hpMax}</div>
              <div className="h-1 bg-ink-900/50 rounded mt-1">
                <div
                  className="h-full bg-cinnabar-500 transition-all"
                  style={{ width: `${(player.hp / player.hpMax) * 100}%` }}
                />
              </div>
            </div>
            <div className="text-center">
              <div className="font-brush text-lg text-blue-400">{player.mp}</div>
              <div className="font-serif text-[10px] text-paper-400/50">灵力 / {player.mpMax}</div>
              <div className="h-1 bg-ink-900/50 rounded mt-1">
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{ width: `${(player.mp / player.mpMax) * 100}%` }}
                />
              </div>
            </div>
            <div className="text-center">
              <div className="font-brush text-lg text-gold-400">{player.stats.vitality}</div>
              <div className="font-serif text-[10px] text-paper-400/50">体魄</div>
            </div>
            <div className="text-center">
              <div className="font-brush text-lg text-jade-400">{player.stats.soul}</div>
              <div className="font-serif text-[10px] text-paper-400/50">神魂</div>
            </div>
          </div>
        </ScrollCard>

        <ScrollCard
          title="行动指令"
          subtitle="输入你的战斗行动（Ctrl/Cmd + Enter 发送）"
          className="shrink-0"
        >
          <textarea
            value={action}
            onChange={(e) => setAction(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isResolving || battle.turn !== "player"}
            placeholder="例如：向前移动两步，然后使用剑法攻击敌人"
            rows={4}
            className={cn(
              "input-ink resize-none leading-relaxed",
              battle.turn !== "player" && "opacity-50"
            )}
            style={{ fontFamily: '"Noto Serif SC", serif' }}
          />

          <div className="mt-3 flex gap-2">
            <SealButton
              onClick={handleSubmit}
              disabled={!action.trim() || isResolving || battle.turn !== "player"}
              className="flex-1"
            >
              <span className="flex items-center justify-center gap-1.5">
                {isResolving ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : null}
                {battle.turn === "player" ? "执行行动" : "等待敌方行动"}
              </span>
            </SealButton>
          </div>

          {battle.errorMsg && (
            <div className="mt-3 rounded px-3 py-2 bg-cinnabar-500/10 border border-cinnabar-500/30 font-serif text-xs text-cinnabar-300 leading-relaxed">
              {battle.errorMsg}
            </div>
          )}
        </ScrollCard>
      </div>
    </div>
  );
}