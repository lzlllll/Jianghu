import { useState } from "react";
import { useGameStore } from "@/store/useGameStore";
import { ScrollCard } from "@/components/ui/ScrollCard";
import { PanelTitle } from "@/components/ui/PanelTitle";
import { CloudDivider } from "@/components/ui/CloudDivider";
import { SealButton } from "@/components/ui/SealButton";
import { GradeTag } from "@/components/ui/GradeTag";
import { cn } from "@/lib/utils";
import type { TalismanRecipe, AlchemyRecipe } from "@/data/types";

export function CraftingPanel() {
  const tab = useGameStore((s) => s.craftingTab);
  const setTab = useGameStore((s) => s.setCraftingTab);

  return (
    <div className="paper-texture">
      <PanelTitle
        title="百艺"
        poem="工欲善其事，必先利其器。符箓丹药，皆为修真之助。"
      />

      <div className="flex gap-2 mb-4">
        <TabButton active={tab === "talisman"} onClick={() => setTab("talisman")}>
          画符台
        </TabButton>
        <TabButton active={tab === "alchemy"} onClick={() => setTab("alchemy")}>
          炼丹炉
        </TabButton>
      </div>

      {tab === "talisman" ? <TalismanWorkshop /> : <AlchemyWorkshop />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-6 py-2 rounded-t-lg font-brush text-base tracking-wider transition-all border-b-2",
        active
          ? "text-gold-400 border-gold-400 bg-ink-900/40"
          : "text-paper-400/60 border-transparent hover:text-paper-200",
      )}
    >
      {children}
    </button>
  );
}

function TalismanWorkshop() {
  const recipes = useGameStore((s) => s.talismanRecipes);
  const draw = useGameStore((s) => s.drawTalisman);
  const inventory = useGameStore((s) => s.inventory);
  const mp = useGameStore((s) => s.player.mp);
  const [selectedId, setSelectedId] = useState<string>(recipes[0]?.id ?? "");
  const selected = recipes.find((r) => r.id === selectedId);

  const paperCount = inventory.find((i) => i.name === "黄表符纸")?.count ?? 0;
  const cinnabarCount = inventory.find((i) => i.name === "朱砂")?.count ?? 0;

  return (
    <div className="grid grid-cols-12 gap-4">
      <ScrollCard className="col-span-5" title="符箓图谱" subtitle="择一而绘">
        <div className="space-y-2 max-h-[480px] overflow-y-auto pr-2">
          {recipes.map((recipe) => (
            <RecipeRow
              key={recipe.id}
              active={selectedId === recipe.id}
              recipe={recipe}
              onSelect={() => setSelectedId(recipe.id)}
            />
          ))}
        </div>
      </ScrollCard>

      <div className="col-span-7">
        <ScrollCard title="画符台" subtitle="凝神静气，笔走龙蛇">
          {selected && (
            <div>
              <div className="flex justify-center mb-4">
                <div className="relative w-32 h-40 bg-gradient-to-b from-paper-200 to-paper-300 rounded shadow-lg flex items-center justify-center transform rotate-1">
                  <div className="absolute inset-2 border border-cinnabar-500/30 rounded" />
                  <span className="font-brush text-5xl text-cinnabar-500">
                    {selected.name.charAt(0)}
                  </span>
                  <div className="absolute -top-2 -right-2 w-6 h-6 red-seal rounded-sm text-[10px]">
                    符
                  </div>
                </div>
              </div>

              <div className="text-center mb-3">
                <h3 className="font-brush text-2xl text-gold-400">{selected.name}</h3>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <GradeTag grade={selected.grade} />
                  <span className="font-serif text-xs text-paper-400/60">
                    成功率 {selected.successRate}%
                  </span>
                </div>
                <p className="font-serif text-xs text-paper-400/70 mt-2 max-w-md mx-auto leading-relaxed">
                  {selected.desc}
                </p>
              </div>

              <CloudDivider label="所需材料" />

              <div className="grid grid-cols-2 gap-3 mb-4">
                <MaterialSlot
                  name="黄表符纸"
                  need={selected.paperCost}
                  have={paperCount}
                  icon="纸"
                />
                <MaterialSlot
                  name="朱砂"
                  need={selected.cinnabarCost}
                  have={cinnabarCount}
                  icon="砂"
                />
              </div>

              <div className="flex items-center justify-between mb-3 px-3 py-2 rounded bg-ink-900/40 border border-paper-400/10">
                <span className="font-serif text-xs text-paper-400/70">消耗灵力</span>
                <span
                  className={cn(
                    "font-number text-sm",
                    mp >= selected.mpCost ? "text-jade-400" : "text-cinnabar-400",
                  )}
                >
                  {selected.mpCost} / {mp}
                </span>
              </div>

              <SealButton
                onClick={() => draw(selected.id)}
                disabled={
                  paperCount < selected.paperCost ||
                  cinnabarCount < selected.cinnabarCost ||
                  mp < selected.mpCost
                }
                className="w-full"
              >
                画符
              </SealButton>
            </div>
          )}
        </ScrollCard>
      </div>
    </div>
  );
}

function AlchemyWorkshop() {
  const brew = useGameStore((s) => s.brewAlchemy);
  const inventory = useGameStore((s) => s.inventory);
  const mp = useGameStore((s) => s.player.mp);
  const [selectedHerbs, setSelectedHerbs] = useState<{ name: string; count: number }[]>([]);
  const [fire, setFire] = useState(50);
  const [duration, setDuration] = useState(30);

  const ELEMENTS = ["金", "木", "水", "火", "土", "风", "雷", "冰", "暗"] as const;

  const herbs = inventory.filter((i) => i.type === "材料");

  const toggleHerb = (name: string) => {
    const existing = selectedHerbs.find((h) => h.name === name);
    if (existing) {
      if (existing.count > 1) {
        setSelectedHerbs(selectedHerbs.map((h) =>
          h.name === name ? { ...h, count: h.count - 1 } : h,
        ));
      } else {
        setSelectedHerbs(selectedHerbs.filter((h) => h.name !== name));
      }
    } else {
      const item = inventory.find((i) => i.name === name);
      if (item && item.count > 0) {
        setSelectedHerbs([...selectedHerbs, { name, count: 1 }]);
      }
    }
  };

  const addHerb = (name: string) => {
    const existing = selectedHerbs.find((h) => h.name === name);
    const item = inventory.find((i) => i.name === name);
    if (item && (!existing || existing.count < item.count)) {
      if (existing) {
        setSelectedHerbs(selectedHerbs.map((h) =>
          h.name === name ? { ...h, count: h.count + 1 } : h,
        ));
      } else {
        setSelectedHerbs([...selectedHerbs, { name, count: 1 }]);
      }
    }
  };

  const removeHerb = (name: string) => {
    const existing = selectedHerbs.find((h) => h.name === name);
    if (existing) {
      if (existing.count > 1) {
        setSelectedHerbs(selectedHerbs.map((h) =>
          h.name === name ? { ...h, count: h.count - 1 } : h,
        ));
      } else {
        setSelectedHerbs(selectedHerbs.filter((h) => h.name !== name));
      }
    }
  };

  const getSelectedElements = () => {
    const result: Record<string, number> = {};
    for (const herb of selectedHerbs) {
      const item = inventory.find((i) => i.name === herb.name);
      if (item) {
        if (item.elements) {
          for (const [elem, val] of Object.entries(item.elements)) {
            result[elem] = (result[elem] || 0) + val * herb.count;
          }
        }
      }
    }
    return result;
  };

  const selectedElements = getSelectedElements();
  const mpCost = 30 + selectedHerbs.reduce((sum, h) => sum + h.count * 10, 0);

  const canBrew = () => {
    if (selectedHerbs.length === 0) return false;
    if (mp < mpCost) return false;
    for (const herb of selectedHerbs) {
      const have = inventory.find((i) => i.name === herb.name)?.count ?? 0;
      if (have < herb.count) return false;
    }
    return true;
  };

  return (
    <div className="grid grid-cols-12 gap-4">
      <ScrollCard className="col-span-5" title="药材" subtitle="选择放入丹炉的药材">
        <div className="space-y-2 max-h-[480px] overflow-y-auto pr-2">
          {herbs.map((herb) => {
            const selected = selectedHerbs.find((h) => h.name === herb.name);
            const elemStr = herb.elements
              ? `(${Object.entries(herb.elements).map(([e, v]) => `${e}:${v}`).join(',')})`
              : '';
            return (
              <button
                key={herb.id}
                onClick={() => toggleHerb(herb.name)}
                className={cn(
                  "w-full text-left rounded p-3 border transition-all flex items-center gap-3",
                  selected
                    ? "border-gold-400/50 bg-gold-400/10 shadow-glow"
                    : "border-paper-400/10 bg-ink-900/30 hover:border-paper-400/30",
                )}
              >
                <div className="w-10 h-10 rounded bg-ink-900/60 flex items-center justify-center text-gold-400/80 border border-paper-400/10 font-brush">
                  {herb.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-brush text-base text-paper-100">{herb.name}</span>
                    <span className="font-number text-[10px] text-paper-400/50">×{herb.count}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <GradeTag grade={herb.grade} />
                    <span className="font-number text-[10px] text-paper-500">{elemStr}</span>
                  </div>
                </div>
                {selected && (
                  <span className="font-number text-xs text-gold-400">已选×{selected.count}</span>
                )}
              </button>
            );
          })}
        </div>
      </ScrollCard>

      <div className="col-span-7">
        <ScrollCard title="炼丹炉" subtitle="文武相济，火候为先">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="w-36 h-32 bg-gradient-to-b from-pine-600 to-ink-800 rounded-b-3xl rounded-t-lg border-2 border-gold-500/30 shadow-2xl relative overflow-hidden">
                <div
                  className="absolute bottom-0 left-0 right-0 transition-all duration-300"
                  style={{
                    height: `${fire}%`,
                    background: `linear-gradient(0deg, ${fire < 35
                      ? "rgba(90,138,114,0.6)"
                      : fire > 70
                        ? "rgba(168,50,50,0.7)"
                        : "rgba(201,169,97,0.7)"
                      } 0%, transparent 100%)`,
                  }}
                />
                <div className="absolute inset-x-0 top-2 text-center">
                  <span className="font-brush text-2xl text-gold-400/80">丹</span>
                </div>
              </div>
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-20 h-4 bg-pine-700 rounded-full border border-gold-500/30" />
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-2 h-6 bg-paper-200/20 rounded-full blur-sm animate-float" />
            </div>
          </div>

          <CloudDivider label="已选药材" />

          {selectedHerbs.length > 0 ? (
            <div className="space-y-2 mb-4">
              {selectedHerbs.map((herb) => {
                const item = inventory.find((i) => i.name === herb.name);
                const have = item?.count ?? 0;
                const elemStr = item?.elements
                  ? `(${Object.entries(item.elements).map(([e, v]) => `${e}:${v}`).join(',')})`
                  : '';
                return (
                  <div
                    key={herb.name}
                    className="flex items-center gap-2 px-3 py-2 rounded border border-jade-500/30 bg-jade-500/5"
                  >
                    <div className="w-8 h-8 rounded bg-ink-900/60 flex items-center justify-center text-gold-400/80 border border-paper-400/10">
                      药
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-serif text-xs text-paper-200 truncate">{herb.name}</div>
                      <div className="flex items-center gap-1">
                        <span className="font-number text-xs text-jade-400">×{herb.count}</span>
                        <span className="font-number text-[10px] text-paper-500">{elemStr}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => removeHerb(herb.name)}
                        className="w-6 h-6 rounded bg-cinnabar-500/20 flex items-center justify-center text-cinnabar-400 hover:bg-cinnabar-500/30 text-xs"
                      >
                        -
                      </button>
                      <button
                        onClick={() => addHerb(herb.name)}
                        className="w-6 h-6 rounded bg-jade-500/20 flex items-center justify-center text-jade-400 hover:bg-jade-500/30 text-xs"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 mb-4">
              <span className="font-serif text-sm text-paper-400/50">请从左侧选择药材放入丹炉</span>
            </div>
          )}

          <CloudDivider label="火候" />

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-serif text-xs text-paper-400/70">文火</span>
              <span className="font-number text-sm text-jade-400">{fire}°</span>
              <span className="font-serif text-xs text-paper-400/70">武火</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={fire}
              onChange={(e) => setFire(Number(e.target.value))}
              className="fire-slider w-full"
            />
          </div>

          <CloudDivider label="时长" />

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-serif text-xs text-paper-400/70">短时</span>
              <span className="font-number text-sm text-jade-400">{duration}息</span>
              <span className="font-serif text-xs text-paper-400/70">长时</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="fire-slider w-full"
            />
          </div>

          <CloudDivider label="元素属性预览" />

          <div className="grid grid-cols-9 gap-1 mb-4">
            {ELEMENTS.map((elem) => {
              const herbVal = selectedElements[elem] ?? 0;
              const fireFactor = fire / 100;
              const durFactor = duration / 100;
              const rawVal = herbVal * fireFactor + herbVal * durFactor;
              const normalized = Math.round(Math.max(-100, Math.min(100, rawVal)));
              return (
                <div
                  key={elem}
                  className="flex flex-col items-center p-1 rounded border border-paper-400/10 bg-ink-900/30"
                >
                  <span className="font-brush text-xs text-paper-300">{elem}</span>
                  <span className={cn(
                    "font-number text-[10px]",
                    normalized > 0 ? "text-jade-400" :
                      normalized < 0 ? "text-cinnabar-400" : "text-paper-500",
                  )}>
                    {normalized > 0 ? "+" : ""}{normalized}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between mb-3 px-3 py-2 rounded bg-ink-900/40 border border-paper-400/10">
            <span className="font-serif text-xs text-paper-400/70">消耗灵力</span>
            <span
              className={cn(
                "font-number text-sm",
                mp >= mpCost ? "text-jade-400" : "text-cinnabar-400",
              )}
            >
              {mpCost} / {mp}
            </span>
          </div>

          <SealButton
            onClick={() => brew(selectedHerbs, fire, duration)}
            disabled={!canBrew()}
            className="w-full"
          >
            开炉炼丹
          </SealButton>
        </ScrollCard>
      </div>
    </div>
  );
}

function RecipeRow({
  active,
  recipe,
  onSelect,
}: {
  active: boolean;
  recipe: TalismanRecipe | AlchemyRecipe;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left rounded p-3 border transition-all",
        active
          ? "border-gold-400/50 bg-gold-400/10 shadow-glow"
          : "border-paper-400/10 bg-ink-900/30 hover:border-paper-400/30",
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-brush text-base text-paper-100">{recipe.name}</span>
        <GradeTag grade={recipe.grade} />
      </div>
      <p className="font-serif text-xs text-paper-400/60 leading-relaxed line-clamp-2">
        {recipe.desc}
      </p>
      <div className="flex items-center gap-3 mt-1.5">
        <span className="font-number text-[10px] text-gold-400/70">
          成功率 {recipe.successRate}%
        </span>
        <span className="font-number text-[10px] text-paper-400/50">
          耗灵力 {recipe.mpCost}
        </span>
      </div>
    </button>
  );
}

function MaterialSlot({
  name,
  need,
  have,
  icon,
  extra = "",
}: {
  name: string;
  need: number;
  have: number;
  icon: string;
  extra?: string;
}) {
  const enough = have >= need;
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded border",
        enough
          ? "border-jade-500/30 bg-jade-500/5"
          : "border-cinnabar-500/40 bg-cinnabar-500/5",
      )}
    >
      <div className="w-8 h-8 rounded bg-ink-900/60 flex items-center justify-center text-gold-400/80 border border-paper-400/10">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-serif text-xs text-paper-200 truncate">{name}</div>
        <div className="flex items-center gap-1">
          <span
            className={cn(
              "font-number text-xs",
              enough ? "text-jade-400" : "text-cinnabar-400",
            )}
          >
            {have} / {need}
          </span>
          {extra && <span className="font-number text-[10px] text-paper-500">{extra}</span>}
        </div>
      </div>
      {!enough && <span className="text-cinnabar-400 text-xs">缺</span>}
    </div>
  );
}
