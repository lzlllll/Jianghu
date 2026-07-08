import { useMemo } from "react";
import type { BattleMap as BattleMapType, BattleEntity } from "@/data/types";
import { cn } from "@/lib/utils";

interface BattleMapProps {
  map: BattleMapType;
}

export function BattleMap({ map }: BattleMapProps) {
  const grid = useMemo(() => {
    const result: BattleEntity[][] = [];
    for (let y = 0; y < map.height; y++) {
      const row: BattleEntity[] = [];
      for (let x = 0; x < map.width; x++) {
        const entity = map.entities.find(
          (e) => e.position.x === x && e.position.y === y && !e.isDead
        );
        row.push(entity || null as unknown as BattleEntity);
      }
      result.push(row);
    }
    return result;
  }, [map]);

  const getEntityClass = (entity: BattleEntity | null) => {
    if (!entity) return "bg-ink-800/30";
    switch (entity.type) {
      case "player":
        return "bg-gold-500/40 border-gold-400/60";
      case "ally":
        return "bg-jade-500/40 border-jade-400/60";
      case "enemy":
        return "bg-cinnabar-500/40 border-cinnabar-400/60";
      case "obstacle":
        return "bg-purple-500/40 border-purple-400/60";
      default:
        return "bg-ink-800/30";
    }
  };

  const getEntityIcon = (entity: BattleEntity | null) => {
    if (!entity) return null;
    switch (entity.type) {
      case "player":
        return "☯";
      case "ally":
        return "◎";
      case "enemy":
        return "⚔";
      case "obstacle":
        return "◉";
      default:
        return "?";
    }
  };

  const getEntityName = (entity: BattleEntity | null) => {
    if (!entity) return "";
    return entity.name;
  };

  const getHpBar = (entity: BattleEntity | null) => {
    if (!entity || !entity.hp || !entity.maxHp) return null;
    const percent = (entity.hp / entity.maxHp) * 100;
    return (
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-ink-900/50">
        <div
          className={cn(
            "h-full transition-all",
            percent > 50 ? "bg-jade-400" :
              percent > 25 ? "bg-gold-400" : "bg-cinnabar-400"
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    );
  };

  return (
    <div className="relative">
      <div
        className="grid gap-0.5 border border-paper-400/20 rounded-lg p-2 bg-ink-900/60"
        style={{
          gridTemplateColumns: `repeat(${map.width}, 1fr)`,
          aspectRatio: `${map.width} / ${map.height}`,
        }}
      >
        {grid.map((row, y) =>
          row.map((entity, x) => (
            <div
              key={`${x}-${y}`}
              className={cn(
                "relative flex items-center justify-center border border-paper-400/10 rounded-sm transition-all",
                getEntityClass(entity)
              )}
            >
              {getEntityIcon(entity) && (
                <span className="text-lg font-bold">
                  {getEntityIcon(entity)}
                </span>
              )}
              {getEntityName(entity) && (
                <span className="absolute -top-1 -left-1 text-[8px] font-serif text-paper-300/80 bg-ink-900/80 px-0.5 rounded">
                  {getEntityName(entity).slice(0, 2)}
                </span>
              )}
              {getHpBar(entity)}
            </div>
          ))
        )}
      </div>

      <div className="flex items-center gap-4 mt-3 text-[10px] font-serif">
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-gold-500/40 border border-gold-400/60 flex items-center justify-center text-[10px]">☯</span>
          <span className="text-paper-300/80">玩家</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-jade-500/40 border border-jade-400/60 flex items-center justify-center text-[10px]">◎</span>
          <span className="text-paper-300/80">队友</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-cinnabar-500/40 border border-cinnabar-400/60 flex items-center justify-center text-[10px]">⚔</span>
          <span className="text-paper-300/80">敌人</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-purple-500/40 border border-purple-400/60 flex items-center justify-center text-[10px]">◉</span>
          <span className="text-paper-300/80">障碍物</span>
        </div>
      </div>
    </div>
  );
}