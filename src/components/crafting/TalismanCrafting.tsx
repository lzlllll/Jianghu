import { useState } from "react";
import { useGameStore } from "@/store/useGameStore";
import { ScrollCard } from "@/components/ui/ScrollCard";
import { CloudDivider } from "@/components/ui/CloudDivider";
import { SealButton } from "@/components/ui/SealButton";
import { GradeTag } from "@/components/ui/GradeTag";
import { cn } from "@/lib/utils";
import type { TalismanElement, TalismanAction, TalismanModifier, TalismanRecipe } from "@/data/types";

const ELEMENTS: { value: TalismanElement; name: string; desc: string; color: string }[] = [
  { value: "金", name: "庚金", desc: "锋利，破甲", color: "gold" },
  { value: "木", name: "乙木", desc: "生机，缠绕", color: "jade" },
  { value: "水", name: "壬水", desc: "流动，柔克", color: "blue" },
  { value: "火", name: "丙火", desc: "炎烈，灼烧", color: "cinnabar" },
  { value: "土", name: "戊土", desc: "厚重，稳固", color: "amber" },
  { value: "风", name: "巽风", desc: "迅捷，穿透", color: "cyan" },
  { value: "雷", name: "震雷", desc: "迅猛，震慑", color: "yellow" },
  { value: "冰", name: "寒冰", desc: "冻结，迟缓", color: "ice" },
  { value: "暗", name: "玄暗", desc: "隐匿，侵蚀", color: "purple" },
];

const ACTIONS: { value: TalismanAction; name: string; desc: string }[] = [
  { value: "引", name: "引", desc: "引导元素之力" },
  { value: "保", name: "保", desc: "保护自身或他人" },
  { value: "封", name: "封", desc: "封印敌人能力" },
  { value: "助", name: "助", desc: "增强自身属性" },
  { value: "破", name: "破", desc: "破除敌方防御" },
  { value: "灭", name: "灭", desc: "造成直接伤害" },
  { value: "惑", name: "惑", desc: "迷惑敌人心智" },
  { value: "愈", name: "愈", desc: "治愈伤势" },
  { value: "遁", name: "遁", desc: "快速移动或逃跑" },
];

const MODIFIERS: TalismanModifier[] = [
  { id: "range_near", name: "近距", type: "range", effect: "1格内", mpCost: 0, paperCost: 0 },
  { id: "range_far", name: "远距", type: "range", effect: "3格内", mpCost: 20, paperCost: 1 },
  { id: "range_global", name: "全域", type: "range", effect: "全场", mpCost: 50, paperCost: 2 },
  
  { id: "trigger_instant", name: "瞬发", type: "trigger", effect: "立即生效", mpCost: 10, paperCost: 0 },
  { id: "trigger_on_hit", name: "触击", type: "trigger", effect: "攻击时触发", mpCost: 5, paperCost: 0 },
  { id: "trigger_on_damage", name: "受击", type: "trigger", effect: "受击时触发", mpCost: 5, paperCost: 0 },
  
  { id: "duration_short", name: "瞬刻", type: "duration", effect: "1回合", mpCost: 0, paperCost: 0 },
  { id: "duration_long", name: "持久", type: "duration", effect: "3回合", mpCost: 20, paperCost: 1 },
  { id: "duration_permanent", name: "永恒", type: "duration", effect: "持续至战斗结束", mpCost: 40, paperCost: 2 },
  
  { id: "strength_weak", name: "弱化", type: "strength", effect: "效果减半", mpCost: -15, paperCost: -1 },
  { id: "strength_normal", name: "标准", type: "strength", effect: "正常效果", mpCost: 0, paperCost: 0 },
  { id: "strength_strong", name: "强化", type: "strength", effect: "效果翻倍", mpCost: 30, paperCost: 1 },
  
  { id: "target_self", name: "自身", type: "target", effect: "仅作用于自身", mpCost: 0, paperCost: 0 },
  { id: "target_single", name: "单体", type: "target", effect: "作用于单个目标", mpCost: 10, paperCost: 0 },
  { id: "target_aoe", name: "范围", type: "target", effect: "作用于范围内所有目标", mpCost: 30, paperCost: 2 },
  
  { id: "cost_low", name: "低耗", type: "cost", effect: "灵力消耗-30%", mpCost: 5, paperCost: 1 },
  { id: "cost_high", name: "高耗", type: "cost", effect: "灵力消耗+50%", mpCost: -20, paperCost: -1 },
];

const PRESET_TEMPLATES: { name: string; element: TalismanElement; action: TalismanAction; modifiers: string[]; grade: string; desc: string }[] = [
  { name: "烈火符", element: "火", action: "灭", modifiers: ["range_near", "trigger_instant", "duration_short", "strength_normal", "target_single"], grade: "凡品", desc: "引动烈火之力，对单个敌人造成火焰伤害" },
  { name: "寒冰封", element: "冰", action: "封", modifiers: ["range_far", "trigger_instant", "duration_long", "strength_normal", "target_single"], grade: "灵品", desc: "释放寒冰之力，封印敌人行动" },
  { name: "庚金破", element: "金", action: "破", modifiers: ["range_near", "trigger_on_hit", "duration_short", "strength_strong", "target_single"], grade: "灵品", desc: "庚金锋利，破除敌方防御" },
  { name: "乙木愈", element: "木", action: "愈", modifiers: ["trigger_instant", "duration_short", "strength_normal", "target_self"], grade: "凡品", desc: "乙木生机，治愈自身伤势" },
  { name: "壬水遁", element: "水", action: "遁", modifiers: ["range_global", "trigger_instant", "duration_short", "target_self"], grade: "玄品", desc: "壬水流动，瞬间移动至任意位置" },
  { name: "震雷惑", element: "雷", action: "惑", modifiers: ["range_far", "trigger_instant", "duration_long", "strength_normal", "target_aoe"], grade: "玄品", desc: "震雷轰鸣，迷惑范围内所有敌人" },
  { name: "巽风助", element: "风", action: "助", modifiers: ["trigger_instant", "duration_long", "strength_normal", "target_self"], grade: "凡品", desc: "巽风迅捷，增强自身速度" },
  { name: "戊土保", element: "土", action: "保", modifiers: ["trigger_instant", "duration_long", "strength_strong", "target_self"], grade: "灵品", desc: "戊土厚重，形成护盾保护自身" },
  { name: "玄暗灭", element: "暗", action: "灭", modifiers: ["range_far", "trigger_on_hit", "duration_short", "strength_strong", "target_single"], grade: "玄品", desc: "玄暗侵蚀，造成持续伤害" },
];

export function TalismanCrafting() {
  const draw = useGameStore((s) => s.drawTalisman);
  const inventory = useGameStore((s) => s.inventory);
  const mp = useGameStore((s) => s.player.mp);
  
  const [element, setElement] = useState<TalismanElement | null>(null);
  const [action, setAction] = useState<TalismanAction | null>(null);
  const [modifiers, setModifiers] = useState<string[]>([]);
  const [mode, setMode] = useState<"custom" | "preset">("custom");
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  const paperCount = inventory.find((i) => i.name === "黄表符纸")?.count ?? 0;
  const cinnabarCount = inventory.find((i) => i.name === "朱砂")?.count ?? 0;

  const selectedModifiers = MODIFIERS.filter(m => modifiers.includes(m.id));
  
  const totalMpCost = 20 + selectedModifiers.reduce((sum, m) => sum + m.mpCost, 0);
  const totalPaperCost = 1 + selectedModifiers.reduce((sum, m) => sum + m.paperCost, 0);
  const cinnabarCost = 1;
  
  const successRate = Math.min(100, Math.max(30, 80 - selectedModifiers.filter(m => m.mpCost > 0).length * 5));

  const talismanName = element && action 
    ? `${ELEMENTS.find(e => e.value === element)?.name}${ACTIONS.find(a => a.value === action)?.name}符`
    : "未命名符";

  const talismanDesc = element && action
    ? `${ELEMENTS.find(e => e.value === element)?.desc}，${ACTIONS.find(a => a.value === action)?.desc}。${selectedModifiers.map(m => m.effect).join("，")}`
    : "请选择元素和行为";

  const canCraft = element && action && modifiers.length >= 2 && 
    paperCount >= totalPaperCost && cinnabarCount >= cinnabarCost && mp >= totalMpCost;

  const handleToggleModifier = (modifierId: string) => {
    if (modifiers.includes(modifierId)) {
      setModifiers(modifiers.filter(m => m !== modifierId));
    } else {
      setModifiers([...modifiers, modifierId]);
    }
  };

  const applyPreset = (preset: typeof PRESET_TEMPLATES[0]) => {
    setElement(preset.element);
    setAction(preset.action);
    setModifiers(preset.modifiers);
    setSelectedPreset(preset.name);
  };

  const handleCraft = () => {
    if (!element || !action) return;
    
    const recipe: TalismanRecipe = {
      id: `talisman-${Date.now()}`,
      name: talismanName,
      grade: "凡品",
      paperCost: totalPaperCost,
      cinnabarCost: cinnabarCost,
      successRate: successRate,
      mpCost: totalMpCost,
      desc: talismanDesc,
      element,
      action,
      modifiers,
    };
    
    draw(recipe);
  };

  return (
    <div className="grid grid-cols-12 gap-4">
      <ScrollCard className="col-span-5" title={mode === "custom" ? "自由组合" : "预设模板"} subtitle={mode === "custom" ? "选择元素、行为和修饰词条" : "选择预设符箓模板"}>
        {mode === "custom" ? (
          <div className="space-y-4">
            <div>
              <h4 className="font-brush text-xs text-paper-300 mb-2">元素主体</h4>
              <div className="grid grid-cols-3 gap-2">
                {ELEMENTS.map((elem) => (
                  <button
                    key={elem.value}
                    onClick={() => setElement(elem.value)}
                    className={cn(
                      "px-2 py-1.5 rounded text-xs font-brush border transition-all",
                      element === elem.value
                        ? `bg-${elem.color}-500/20 border-${elem.color}-400/50 text-${elem.color}-300`
                        : "bg-ink-900/50 border-paper-400/20 text-paper-400/70 hover:border-paper-400/40"
                    )}
                  >
                    {elem.value}
                  </button>
                ))}
              </div>
              {element && (
                <p className="font-serif text-[10px] text-paper-400/50 mt-1">
                  {ELEMENTS.find(e => e.value === element)?.desc}
                </p>
              )}
            </div>

            <div>
              <h4 className="font-brush text-xs text-paper-300 mb-2">行为</h4>
              <div className="grid grid-cols-3 gap-2">
                {ACTIONS.map((act) => (
                  <button
                    key={act.value}
                    onClick={() => setAction(act.value)}
                    className={cn(
                      "px-2 py-1.5 rounded text-xs font-brush border transition-all",
                      action === act.value
                        ? "bg-gold-500/20 border-gold-400/50 text-gold-300"
                        : "bg-ink-900/50 border-paper-400/20 text-paper-400/70 hover:border-paper-400/40"
                    )}
                  >
                    {act.name}
                  </button>
                ))}
              </div>
              {action && (
                <p className="font-serif text-[10px] text-paper-400/50 mt-1">
                  {ACTIONS.find(a => a.value === action)?.desc}
                </p>
              )}
            </div>

            <div>
              <h4 className="font-brush text-xs text-paper-300 mb-2">修饰词条（需选2个）</h4>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {MODIFIERS.map((mod) => (
                  <button
                    key={mod.id}
                    onClick={() => handleToggleModifier(mod.id)}
                    className={cn(
                      "w-full px-3 py-1.5 rounded text-[11px] font-serif border transition-all flex items-center justify-between",
                      modifiers.includes(mod.id)
                        ? "bg-jade-500/10 border-jade-400/30 text-jade-300"
                        : "bg-ink-900/30 border-paper-400/10 text-paper-400/60 hover:border-paper-400/30"
                    )}
                  >
                    <span>{mod.name} · {mod.effect}</span>
                    {mod.mpCost !== 0 && (
                      <span className={cn(
                        "text-[9px]",
                        mod.mpCost > 0 ? "text-cinnabar-400" : "text-jade-400"
                      )}>
                        {mod.mpCost > 0 ? `+${mod.mpCost}灵力` : `${mod.mpCost}灵力`}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <p className="font-serif text-[10px] text-paper-400/40 mt-1">
                已选 {modifiers.length}/2 个词条
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2 max-h-[480px] overflow-y-auto">
            {PRESET_TEMPLATES.map((preset) => (
              <button
                key={preset.name}
                onClick={() => applyPreset(preset)}
                className={cn(
                  "w-full px-3 py-2 rounded text-left border transition-all",
                  selectedPreset === preset.name
                    ? "bg-gold-500/10 border-gold-400/30"
                    : "bg-ink-900/30 border-paper-400/10 hover:border-paper-400/30"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-brush text-sm text-paper-200">{preset.name}</span>
                  <span className="font-number text-[10px] text-paper-400/60">{preset.grade}</span>
                </div>
                <p className="font-serif text-[10px] text-paper-400/50 line-clamp-2">{preset.desc}</p>
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-paper-400/10">
          <button
            onClick={() => setMode(mode === "custom" ? "preset" : "custom")}
            className="ghost-btn w-full px-3 py-1.5 rounded text-xs flex items-center justify-center gap-1.5"
          >
            切换至{mode === "custom" ? "预设模板" : "自由组合"}
          </button>
        </div>
      </ScrollCard>

      <div className="col-span-7">
        <ScrollCard title="画符台" subtitle="凝神静气，笔走龙蛇">
          <div className="flex justify-center mb-4">
            <div className="relative w-32 h-40 bg-gradient-to-b from-paper-200 to-paper-300 rounded shadow-lg flex items-center justify-center transform rotate-1">
              <div className="absolute inset-2 border border-cinnabar-500/30 rounded" />
              <span className="font-brush text-5xl text-cinnabar-500">
                {element || "符"}
              </span>
              <div className="absolute -top-2 -right-2 w-6 h-6 red-seal rounded-sm text-[10px]">
                符
              </div>
            </div>
          </div>

          <div className="text-center mb-3">
            <h3 className="font-brush text-2xl text-gold-400">{talismanName}</h3>
            <div className="flex items-center justify-center gap-2 mt-1">
              <GradeTag grade="凡品" />
              <span className="font-serif text-xs text-paper-400/60">
                成功率 {successRate}%
              </span>
            </div>
            <p className="font-serif text-xs text-paper-400/70 mt-2 max-w-md mx-auto leading-relaxed">
              {talismanDesc}
            </p>
          </div>

          <CloudDivider label="所需材料" />

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-ink-900/40 rounded px-3 py-2 border border-paper-400/10">
              <div className="flex items-center justify-between">
                <span className="font-serif text-xs text-paper-400/70">黄表符纸</span>
                <span className={cn(
                  "font-number text-sm",
                  paperCount >= totalPaperCost ? "text-jade-400" : "text-cinnabar-400"
                )}>
                  {totalPaperCost} / {paperCount}
                </span>
              </div>
            </div>
            <div className="bg-ink-900/40 rounded px-3 py-2 border border-paper-400/10">
              <div className="flex items-center justify-between">
                <span className="font-serif text-xs text-paper-400/70">朱砂</span>
                <span className={cn(
                  "font-number text-sm",
                  cinnabarCount >= cinnabarCost ? "text-jade-400" : "text-cinnabar-400"
                )}>
                  {cinnabarCost} / {cinnabarCount}
                </span>
              </div>
            </div>
            <div className="bg-ink-900/40 rounded px-3 py-2 border border-paper-400/10">
              <div className="flex items-center justify-between">
                <span className="font-serif text-xs text-paper-400/70">灵力</span>
                <span className={cn(
                  "font-number text-sm",
                  mp >= totalMpCost ? "text-jade-400" : "text-cinnabar-400"
                )}>
                  {totalMpCost} / {mp}
                </span>
              </div>
            </div>
          </div>

          <CloudDivider label="修饰词条" />
          {selectedModifiers.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {selectedModifiers.map((mod) => (
                <span
                  key={mod.id}
                  className="px-2 py-0.5 rounded text-[10px] font-serif bg-jade-500/10 border border-jade-400/20 text-jade-300"
                >
                  {mod.name} · {mod.effect}
                </span>
              ))}
            </div>
          ) : (
            <p className="font-serif text-xs text-paper-400/40 text-center py-2">请选择修饰词条</p>
          )}

          <SealButton
            onClick={handleCraft}
            disabled={!canCraft}
            className="w-full"
          >
            画符
          </SealButton>
        </ScrollCard>
      </div>
    </div>
  );
}