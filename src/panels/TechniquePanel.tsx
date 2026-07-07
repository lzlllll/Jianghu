import { useState, useMemo } from "react";
import { useGameStore } from "@/store/useGameStore";
import { ScrollCard } from "@/components/ui/ScrollCard";
import { PanelTitle } from "@/components/ui/PanelTitle";
import { GradeTag } from "@/components/ui/GradeTag";
import { ProficiencyRing } from "@/components/ui/ProficiencyRing";
import { cn } from "@/lib/utils";
import type { Technique, TechniqueCategory } from "@/data/types";

const CATEGORY_INFO: Record<string, { name: string; subtitle: string; color: string }> = {
  心法: { name: "心法", subtitle: "修炼根基，灵力循环", color: "gold" },
  炼体: { name: "炼体", subtitle: "肉身强化，气血充盈", color: "cinnabar" },
  神通: { name: "神通", subtitle: "主动攻伐，降妖除魔", color: "jade" },
  身法: { name: "身法", subtitle: "灵动飘逸，闪避追击", color: "pine" },
  秘术: { name: "秘术", subtitle: "特殊能力，逆天改命", color: "purple" },
};

const CATEGORY_ORDER: TechniqueCategory[] = ["心法", "炼体", "神通", "身法", "秘术"];

export function TechniquePanel() {
  const techniques = useGameStore((s) => s.techniques);
  const player = useGameStore((s) => s.player);
  const setActiveHeartTechnique = useGameStore((s) => s.setActiveHeartTechnique);

  const [activeTab, setActiveTab] = useState<TechniqueCategory>("心法");
  const [levelFilter, setLevelFilter] = useState<number | null>(null);

  const filteredTechniques = useMemo(() => {
    let result = techniques.filter((t) => t.category === activeTab);
    if (levelFilter !== null) {
      result = result.filter((t) => {
        const currentLevel = t.levels && t.levels.length > 0
          ? Math.max(1, t.levels.findIndex((l) => t.proficiency < l.proficiencyNeeded))
          : 1;
        return currentLevel >= levelFilter;
      });
    }
    return result;
  }, [techniques, activeTab, levelFilter]);

  const currentRealm = player.realmIndex;

  const canPractice = (tech: Technique): boolean => {
    for (const req of tech.prerequisites || []) {
      if (req.type === "realm") {
        const reqIndex = [0, 4, 8, 12, 16, 20, 24, 28, 32, 36].findIndex((idx) => 
          req.value === "引气" || req.value === "炼气" || req.value === "筑基" || 
          req.value === "金丹" || req.value === "元婴" || req.value === "化神" || 
          req.value === "炼虚" || req.value === "合体" || req.value === "大乘" || 
          req.value === "渡劫"
        );
        if (currentRealm < (reqIndex >= 0 ? reqIndex : 0)) return false;
      }
      if (req.type === "technique") {
        const requiredTech = techniques.find((t) => t.id === req.value);
        if (!requiredTech) return false;
        const reqLevel = req.minLevel || 1;
        const currentLevel = requiredTech.levels && requiredTech.levels.length > 0
          ? Math.max(1, requiredTech.levels.findIndex((l) => requiredTech.proficiency < l.proficiencyNeeded))
          : 1;
        if (currentLevel < reqLevel) return false;
      }
      if (req.type === "spiritRoot") {
        const root = player.spiritRoots.find((r) => r.element === req.value);
        if (!root) return false;
        if (req.minLevel && root.value < req.minLevel) return false;
      }
      if (req.type === "heartTrait") {
        const score = player.stats.heartScores.find((hs) => hs.trait === req.value)?.score || 0;
        if (score < 50) return false;
      }
    }
    return true;
  };

  const getMatchScore = (tech: Technique): number => {
    let score = 50;
    const rootElements = player.spiritRoots.map((r) => r.element);
    if (rootElements.includes(tech.element)) {
      score += 25;
    }
    const matchingHearts = tech.heartMatch?.map((trait) => {
      return player.stats.heartScores.find((hs) => hs.trait === trait)?.score || 0;
    }) || [];
    const avgMatchingScore = matchingHearts.length > 0
      ? matchingHearts.reduce((a, b) => a + b, 0) / matchingHearts.length
      : 0;
    score += (avgMatchingScore / 100) * 25;
    return Math.min(100, Math.max(0, score));
  };

  return (
    <div className="paper-texture">
      <PanelTitle
        title="功法"
        poem="道可道，非常道。名可名，非常名。无名天地之始，有名万物之母。"
      />

      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {CATEGORY_ORDER.map((cat) => {
          const info = CATEGORY_INFO[cat];
          const count = techniques.filter((t) => t.category === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setActiveTab(cat)}
              className={cn(
                "font-brush text-sm px-4 py-2 rounded border transition-all whitespace-nowrap",
                activeTab === cat
                  ? "bg-gold-500/10 border-gold-400/50 text-gold-300"
                  : "bg-ink-900/50 border-paper-400/20 text-paper-400/70 hover:text-paper-200",
                info.color === "gold" && activeTab === cat && "border-gold-400/50",
                info.color === "cinnabar" && activeTab === cat && "border-cinnabar-400/50",
                info.color === "jade" && activeTab === cat && "border-jade-400/50",
                info.color === "pine" && activeTab === cat && "border-pine-400/50",
                info.color === "purple" && activeTab === cat && "border-purple-400/50",
              )}
            >
              {info.name} <span className="text-xs opacity-60">({count})</span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-3 mb-4">
        <select
          value={levelFilter ?? ""}
          onChange={(e) => setLevelFilter(e.target.value ? Number(e.target.value) : null)}
          className="font-serif text-sm bg-ink-900/50 border border-paper-400/20 rounded px-3 py-1.5 text-paper-300 focus:outline-none focus:border-gold-400/50"
        >
          <option value="">全部境界</option>
          <option value={1}>第一重及以上</option>
          <option value={3}>第三重及以上</option>
          <option value={6}>第六重及以上</option>
          <option value={10}>第十重</option>
        </select>
        <span className="font-serif text-xs text-paper-400/50 self-center">
          匹配度计算：灵根契合 +25%，心性契合 +0~25%
        </span>
      </div>

      <div className="space-y-4">
        {filteredTechniques.map((tech) => {
          const info = CATEGORY_INFO[tech.category];
          const hasLevels = tech.levels && tech.levels.length > 0;
          const currentLevel = hasLevels
            ? Math.max(1, tech.levels.findIndex((l) => tech.proficiency < l.proficiencyNeeded))
            : 1;
          const nextLevel = hasLevels ? tech.levels[currentLevel] : undefined;
          const matchScore = getMatchScore(tech);
          const isActiveHeart = tech.category === "心法" && player.activeHeartTechnique === tech.id;
          const unlockedSkills = tech.skills && tech.skills.length > 0
            ? tech.skills.filter((s) => currentLevel >= s.levelRequired)
            : [];
          const lockedSkills = tech.skills && tech.skills.length > 0
            ? tech.skills.filter((s) => currentLevel < s.levelRequired)
            : [];

          return (
            <ScrollCard
              key={tech.id}
              title={tech.name}
              subtitle={info.subtitle}
              ornament={
                <div className="flex items-center gap-2">
                  <GradeTag grade={tech.grade} />
                  {tech.category === "心法" && (
                    <button
                      onClick={() => {
                        if (isActiveHeart) {
                          setActiveHeartTechnique(null);
                        } else {
                          setActiveHeartTechnique(tech.id);
                        }
                      }}
                      className={cn(
                        "font-brush text-xs px-2 py-0.5 border rounded transition-all",
                        isActiveHeart
                          ? "bg-gold-500/20 text-gold-300 border-gold-400/50"
                          : "bg-ink-900/50 text-paper-400/70 border-paper-400/30 hover:border-gold-400/50",
                      )}
                    >
                      {isActiveHeart ? "已生效" : "切换"}
                    </button>
                  )}
                </div>
              }
              className={cn(
                info.color === "gold" && "border-gold-500/20",
                info.color === "cinnabar" && "border-cinnabar-500/20",
                info.color === "jade" && "border-jade-500/20",
                info.color === "pine" && "border-pine-500/20",
                info.color === "purple" && "border-purple-500/20",
                !canPractice(tech) && "opacity-60",
              )}
            >
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-1">
                  <div className="flex items-start gap-3">
                    <ProficiencyRing value={tech.proficiency} max={tech.proficiencyMax} size={72} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-brush text-[10px] text-cinnabar-400/80 px-1.5 py-0.5 border border-cinnabar-500/30 rounded">
                          {tech.element}系
                        </span>
                        <span className="font-brush text-[10px] text-paper-400/60 px-1.5 py-0.5 border border-paper-400/20 rounded">
                          {tech.nature}性
                        </span>
                      </div>
                      <p className="font-serif text-xs text-paper-400/60 mt-2 leading-relaxed">
                        {tech.description}
                      </p>
                      <div className="bg-ink-900/50 rounded px-2 py-1.5 border-l-2 border-gold-400/20 mt-3">
                        <p className="font-serif text-xs text-paper-300/80 italic">
                          「{tech.insight}」
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-serif text-xs text-paper-400/60">修炼进度</span>
                      <span className="font-number text-xs text-paper-300">
                        {tech.proficiency} / {tech.proficiencyMax}
                      </span>
                    </div>
                    <div className="h-2 bg-ink-900/80 rounded-sm overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cinnabar-600 to-cinnabar-400 transition-all duration-500"
                        style={{ width: `${(tech.proficiency / tech.proficiencyMax) * 100}%` }}
                      />
                    </div>
                    {nextLevel && (
                      <div className="flex items-center justify-between mt-1">
                        <span className="font-brush text-xs text-gold-400/80">
                          下一重「{nextLevel.name}」
                        </span>
                        <span className="font-number text-xs text-paper-400/50">
                          还需 {nextLevel.proficiencyNeeded - tech.proficiency} 熟练度
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-serif text-xs text-paper-400/60">匹配度</span>
                      <span className="font-number text-xs text-paper-300">{Math.round(matchScore)}%</span>
                    </div>
                    <div className="h-1.5 bg-ink-900/80 rounded-sm overflow-hidden">
                      <div
                        className={cn(
                          "h-full transition-all duration-500",
                          matchScore >= 80 ? "bg-gradient-to-r from-gold-500 to-gold-300" :
                          matchScore >= 50 ? "bg-gradient-to-r from-jade-500 to-jade-300" :
                          "bg-gradient-to-r from-cinnabar-600 to-cinnabar-400",
                        )}
                        style={{ width: `${matchScore}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-1">
                  <h5 className="font-brush text-sm text-paper-200 mb-3">十重境界</h5>
                  <div className="grid grid-cols-5 gap-2">
                    {(tech.levels || []).map((level, idx) => {
                      const isCurrent = idx < currentLevel;
                      const isNext = idx === currentLevel;
                      const isUnlocked = isCurrent || isNext;
                      return (
                        <div
                          key={level.level}
                          className={cn(
                            "relative rounded border p-2 text-center transition-all",
                            isCurrent
                              ? "bg-gold-500/10 border-gold-400/30"
                              : isNext
                                ? "bg-ink-800/50 border-cinnabar-400/30"
                                : "bg-ink-900/50 border-paper-400/10 opacity-50",
                          )}
                        >
                          <span className={cn(
                            "font-number text-xs",
                            isCurrent ? "text-gold-300" : "text-paper-400/70",
                          )}>
                            第{level.level}重
                          </span>
                          {[3, 6, 10].includes(level.level) && (
                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-cinnabar-500 rounded-full border border-gold-400" />
                          )}
                          <div className="font-brush text-[9px] text-paper-400/60 mt-0.5 truncate">
                            {isUnlocked ? level.name : "未解锁"}
                          </div>
                          {isCurrent && level.stats && Object.keys(level.stats).length > 0 && (
                            <div className="mt-1 space-y-0.5">
                              {Object.entries(level.stats || {}).map(([stat, value]) => (
                                <div key={stat} className="font-number text-[9px] text-jade-400/80">
                                  {stat === "mpMax" && "灵力+"}
                                  {stat === "hpMax" && "气血+"}
                                  {stat === "vitality" && "体魄+"}
                                  {stat === "soul" && "神魂+"}
                                  {stat === "wisdom" && "悟性+"}
                                  {stat === "agility" && "身法+"}
                                  {stat === "cultivationSpeed" && "修炼+"}
                                  {stat === "damage" && "伤害+"}
                                  {value}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <h5 className="font-brush text-sm text-paper-200 mt-4 mb-3">属性</h5>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(tech.attributes || {}).map(([attr, value]) => (
                      <span
                        key={attr}
                        className="font-brush text-xs text-paper-400/80 px-2 py-0.5 bg-ink-900/50 border border-paper-400/20 rounded"
                      >
                        {attr}: {value}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-1">
                  <h5 className="font-brush text-sm text-paper-200 mb-3">招式技能</h5>
                  <div className="space-y-2">
                    {(unlockedSkills || []).map((skill) => (
                      <div
                        key={skill.id}
                        className="bg-gold-500/5 border border-gold-400/20 rounded px-3 py-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-brush text-sm text-gold-300">{skill.name}</span>
                          <span className="font-number text-[10px] text-cinnabar-400/80">
                            Lv.{skill.levelRequired}
                          </span>
                        </div>
                        <p className="font-serif text-xs text-paper-400/70 mt-1">{skill.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-number text-[10px] text-paper-400/50">灵力:{skill.mpCost}</span>
                          {skill.damage > 0 && (
                            <span className="font-number text-[10px] text-cinnabar-400/80">伤害:{skill.damage}</span>
                          )}
                          {skill.cooldown > 0 && (
                            <span className="font-number text-[10px] text-paper-400/50">冷却:{skill.cooldown}</span>
                          )}
                        </div>
                      </div>
                    ))}
                    {(lockedSkills || []).map((skill) => (
                      <div
                        key={skill.id}
                        className="bg-ink-900/50 border border-paper-400/10 rounded px-3 py-2 opacity-50"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-brush text-sm text-paper-400/50">{skill.name}</span>
                          <span className="font-number text-[10px] text-paper-400/40">
                            Lv.{skill.levelRequired}解锁
                          </span>
                        </div>
                        <p className="font-serif text-xs text-paper-400/40 mt-1">{skill.description}</p>
                      </div>
                    ))}
                    {(!tech.skills || tech.skills.length === 0) && (
                      <div className="font-serif text-xs text-paper-400/40 text-center py-4">
                        暂无招式
                      </div>
                    )}
                  </div>

                  <h5 className="font-brush text-sm text-paper-200 mt-4 mb-3">修炼条件</h5>
                  <div className="space-y-1.5">
                    {(tech.prerequisites || []).map((req, idx) => {
                      const met = canPractice(tech);
                      return (
                        <div
                          key={idx}
                          className={cn(
                            "flex items-center gap-2 text-xs",
                            met ? "text-jade-400/80" : "text-cinnabar-400/80",
                          )}
                        >
                          <span>{met ? "✓" : "✗"}</span>
                          <span className="font-serif">
                            {req.type === "realm" && `${req.value}期`}
                            {req.type === "technique" && `掌握${techniques.find((t) => t.id === req.value)?.name}`}
                            {req.type === "spiritRoot" && `${req.value}灵根${req.minLevel ? `≥${req.minLevel}` : ""}`}
                            {req.type === "heartTrait" && `心性「${req.value}」`}
                            {req.minLevel && req.type !== "spiritRoot" && `达到第${req.minLevel}重`}
                          </span>
                        </div>
                      );
                    })}
                    {(!tech.prerequisites || tech.prerequisites.length === 0) && (
                      <div className="font-serif text-xs text-paper-400/40">无特殊条件</div>
                    )}
                  </div>
                </div>
              </div>
            </ScrollCard>
          );
        })}

        {filteredTechniques.length === 0 && (
          <div className="text-center py-12 font-serif text-sm text-paper-400/50">
            该分类下尚无功法。
          </div>
        )}
      </div>
    </div>
  );
}