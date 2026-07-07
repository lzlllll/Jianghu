import { useState } from "react";
import { useGameStore } from "@/store/useGameStore";
import { ScrollCard } from "@/components/ui/ScrollCard";
import { PanelTitle } from "@/components/ui/PanelTitle";
import { CloudDivider } from "@/components/ui/CloudDivider";
import { GradeTag } from "@/components/ui/GradeTag";
import { cn } from "@/lib/utils";
import type { InventoryItem, ItemGrade } from "@/data/types";

const STONE_TIERS = [
  { key: "low" as const, name: "下品灵石", color: "text-paper-300", bg: "from-paper-400/20" },
  { key: "mid" as const, name: "中品灵石", color: "text-jade-400", bg: "from-jade-500/20" },
  { key: "high" as const, name: "上品灵石", color: "text-gold-400", bg: "from-gold-400/20" },
  { key: "supreme" as const, name: "极品灵石", color: "text-cinnabar-400", bg: "from-cinnabar-500/20" },
];

const GRADE_BG: Record<ItemGrade, string> = {
  凡品: "border-paper-400/20 hover:border-paper-400/50",
  灵品: "border-jade-500/30 hover:border-jade-500/60",
  玄品: "border-cinnabar-500/30 hover:border-cinnabar-500/60",
  天品: "border-gold-400/40 hover:border-gold-400/70",
  仙品: "border-gold-300/50 hover:border-gold-300/80",
};

const SLOT_LABELS = [
  { slot: "命" as const, name: "本命法宝", desc: "攻伐之器" },
  { slot: "护" as const, name: "护身法宝", desc: "御敌之宝" },
  { slot: "辅" as const, name: "辅助法宝", desc: "行修之资" },
];

export function TreasurePanel() {
  const spiritStones = useGameStore((s) => s.spiritStones);
  const inventory = useGameStore((s) => s.inventory);

  const equipped = inventory.filter((i) => i.equipped);
  const unequipped = inventory.filter((i) => !i.equipped);

  return (
    <div className="paper-texture">
      <PanelTitle
        title="财宝"
        poem="金玉满堂，莫之能守。富贵而骄，自遗其咎。功遂身退，天之道也。"
      />

      <div className="grid grid-cols-12 gap-4">
        {/* 灵石库存 */}
        <ScrollCard className="col-span-12" title="灵石" subtitle="修真通行之资">
          <div className="grid grid-cols-4 gap-3">
            {STONE_TIERS.map((tier) => (
              <div
                key={tier.key}
                className={cn(
                  "relative rounded p-4 border bg-gradient-to-b to-ink-900/40",
                  tier.bg,
                  "border-paper-400/15",
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-brush text-sm text-paper-200">{tier.name}</span>
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-gold-300 to-gold-600 shadow-glow opacity-70" />
                </div>
                <div className={cn("font-number text-2xl", tier.color)}>
                  {spiritStones[tier.key].toLocaleString()}
                </div>
                <div className="font-serif text-[10px] text-paper-400/50 mt-0.5">枚</div>
              </div>
            ))}
          </div>
        </ScrollCard>

        {/* 法宝装备槽 */}
        <ScrollCard className="col-span-12" title="法宝" subtitle="本命护身，辅修行修">
          <div className="grid grid-cols-3 gap-4">
            {SLOT_LABELS.map((slotInfo) => {
              const item = equipped.find((i) => i.slot === slotInfo.slot);
              return (
                <div
                  key={slotInfo.slot}
                  className="relative rounded-lg border-2 border-dashed border-gold-500/20 p-4 text-center hover:border-gold-500/40 transition-colors"
                >
                  <div className="absolute top-2 left-2 w-6 h-6 red-seal rounded text-xs">
                    {slotInfo.slot}
                  </div>
                  <div className="font-brush text-xs text-gold-400/70 mb-2 mt-6">
                    {slotInfo.name}
                  </div>
                  {item ? (
                    <div className="mt-2">
                      <div className="text-3xl mb-1 text-gold-400">{item.icon}</div>
                      <div className="font-brush text-base text-paper-100">{item.name}</div>
                      <div className="mt-1 flex justify-center">
                        <GradeTag grade={item.grade} />
                      </div>
                      <p className="font-serif text-[10px] text-paper-400/60 mt-1.5 leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 font-serif text-xs text-paper-500/40">
                      {slotInfo.desc} · 未装备
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollCard>

        {/* 储物袋 */}
        <div className="col-span-12">
          <InventoryGrid items={unequipped} />
        </div>
      </div>
    </div>
  );
}

function InventoryGrid({ items }: { items: InventoryItem[] }) {
  const [selected, setSelected] = useState<InventoryItem | null>(null);
  const totalSlots = 48;
  const filledSlots = items.length;
  const emptySlots = Math.max(0, totalSlots - filledSlots);

  return (
    <ScrollCard
      title="储物袋"
      subtitle={`已用 ${filledSlots} / ${totalSlots} 格`}
      ornament={
        <span className="font-brush text-xs text-paper-400/60">
          三丈空间，可纳百物
        </span>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        {/* 网格 */}
        <div className="grid grid-cols-8 gap-1.5">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelected(item)}
              className={cn(
                "aspect-square rounded border bg-ink-900/50 flex flex-col items-center justify-center relative group transition-all",
                GRADE_BG[item.grade],
                selected?.id === item.id && "ring-1 ring-gold-400 shadow-glow",
              )}
              title={item.name}
            >
              <span className="text-lg text-gold-400/90 group-hover:scale-110 transition-transform">
                {item.icon}
              </span>
              {item.count > 1 && (
                <span className="absolute bottom-0 right-0.5 font-number text-[9px] text-paper-100 bg-ink-900/80 px-1 rounded-tl">
                  {item.count}
                </span>
              )}
              <span className="absolute top-0.5 left-0.5 w-1.5 h-1.5 rounded-full bg-gold-400/40 opacity-0 group-hover:opacity-100" />
            </button>
          ))}
          {Array.from({ length: emptySlots }).map((_, idx) => (
            <div
              key={`empty-${idx}`}
              className="aspect-square rounded border border-paper-400/5 bg-ink-900/20"
            />
          ))}
        </div>

        {/* 详情 */}
        <div className="rounded border border-gold-500/15 bg-ink-900/40 p-4 min-h-[200px]">
          {selected ? (
            <div>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-brush text-xl text-gold-400">{selected.name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <GradeTag grade={selected.grade} />
                    <span className="font-serif text-xs text-paper-400/60">
                      {selected.type} · ×{selected.count}
                    </span>
                  </div>
                </div>
                <div className="text-4xl text-gold-400/80">{selected.icon}</div>
              </div>
              <CloudDivider />
              <p className="font-serif text-sm text-paper-300/90 leading-relaxed">
                {selected.desc}
              </p>
              <div className="mt-4 flex gap-2">
                <button className="ghost-btn px-3 py-1.5 rounded text-xs">使用</button>
                <button className="ghost-btn px-3 py-1.5 rounded text-xs">丢弃</button>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="text-4xl text-paper-500/20 mb-2"> ◇ </div>
              <p className="font-serif text-sm text-paper-400/50">
                点选左侧物品查看详情
              </p>
              <p className="font-serif text-xs text-paper-500/40 mt-1">
                储物袋内宝物静候有缘
              </p>
            </div>
          )}
        </div>
      </div>
    </ScrollCard>
  );
}
