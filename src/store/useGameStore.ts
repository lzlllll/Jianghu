import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  GameState,
  PanelId,
  CraftingTab,
  DataOp,
  GameSnapshot,
  Location,
  LocationType,
  ElementType,
} from "@/data/types";
import { applyOpsToState } from "@/lib/dataOps";
import {
  REALMS,
  initialPlayer,
  initialTechniques,
  initialInventory,
  initialSpiritStones,
  initialTalismanRecipes,
  initialAlchemyRecipes,
  initialSect,
  initialRelations,
} from "@/data/mockData";

export const LOCATIONS: Location[] = [
  {
    id: "home",
    name: "住所",
    description: "你的修行居所，宁静雅致，适合休整。",
    icon: "居",
    allowedActions: ["休息", "冥想", "闭关"],
  },
  {
    id: "alchemy_room",
    name: "炼丹房",
    description: "宗门炼丹之所，丹炉齐备，灵气充沛。",
    icon: "丹",
    allowedActions: ["炼丹", "配药", "研究丹方"],
  },
  {
    id: "forge_room",
    name: "炼器室",
    description: "炼器工坊，炉火熊熊，可锻神兵。",
    icon: "器",
    allowedActions: ["炼器", "锻造", "修复法宝"],
  },
  {
    id: "meditation_room",
    name: "闭关室",
    description: "隔绝外界干扰的静室，宜潜心修炼。",
    icon: "静",
    allowedActions: ["修炼", "突破", "参悟"],
  },
  {
    id: "market",
    name: "集市",
    description: "坊市繁华，商贾云集，可买卖交换。",
    icon: "市",
    allowedActions: ["购物", "出售", "打探消息"],
  },
  {
    id: "library",
    name: "藏经阁",
    description: "宗门典籍所在，功法秘籍琳琅满目。",
    icon: "书",
    allowedActions: ["研读", "参悟", "借阅"],
  },
  {
    id: "training_ground",
    name: "演武场",
    description: "切磋比武之地，可磨练武技。",
    icon: "武",
    allowedActions: ["修炼", "切磋", "演练"],
  },
  {
    id: "outdoor",
    name: "野外",
    description: "山野之间，灵气驳杂，机缘与危险并存。",
    icon: "野",
    allowedActions: ["探索", "狩猎", "采集"],
  },
];

interface GameStore extends GameState {
  setPanel: (panel: PanelId) => void;
  setCraftingTab: (tab: CraftingTab) => void;
  setLocation: (location: LocationType) => void;
  setActiveHeartTechnique: (id: string | null) => void;
  cultivate: () => void;
  breakthrough: () => void;
  comprehendTechnique: (id: string) => void;
  drawTalisman: (recipeId: string) => void;
  brewAlchemy: (recipeId: string, fire: number, duration: number) => void;
  acceptTask: (id: string) => void;
  promote: (id: string) => void;
  buyShop: (id: string) => void;
  interact: (relationId: string) => void;
  addLog: (msg: string) => void;
  resetGame: () => void;
  applyOps: (ops: DataOp[]) => void;
  getSnapshot: () => GameSnapshot;
  restoreSnapshot: (snap: GameSnapshot) => void;
}

const initialState: GameState = {
  player: initialPlayer,
  techniques: initialTechniques,
  inventory: initialInventory,
  spiritStones: initialSpiritStones,
  talismanRecipes: initialTalismanRecipes,
  alchemyRecipes: initialAlchemyRecipes,
  sect: initialSect,
  relations: initialRelations,
  currentPanel: "profile",
  craftingTab: "talisman",
  currentLocation: "home",
  log: ["庚子年春，你拜入云栖宗，自此踏上漫漫修真路。"],
};

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setPanel: (panel) => set({ currentPanel: panel }),
      setCraftingTab: (tab) => set({ craftingTab: tab }),
      setLocation: (location) => set({ currentLocation: location }),

      setActiveHeartTechnique: (id) =>
        set((st) => ({
          player: { ...st.player, activeHeartTechnique: id },
          log: [`切换心法为「${st.techniques.find((t) => t.id === id)?.name || "无"}」。`, ...st.log].slice(0, 30),
        })),

      addLog: (msg) =>
        set((s) => ({ log: [msg, ...s.log].slice(0, 30) })),

      cultivate: () => {
        const s = get();
        const mpCost = 15;
        if (s.player.mp < mpCost) {
          set((st) => ({
            log: ["灵力不足，无法入定修炼。", ...st.log].slice(0, 30),
          }));
          return;
        }

        const heartTechnique = s.player.activeHeartTechnique
          ? s.techniques.find((t) => t.id === s.player.activeHeartTechnique)
          : s.techniques.find((t) => t.category === "心法");
        let efficiency = 1;
        let basePracticeSpeed = 100;

        if (heartTechnique) {
          basePracticeSpeed = heartTechnique.basePracticeSpeed || 100;

          const playerRootElements = s.player.spiritRoots.map((r) => r.element);
          const techElement = heartTechnique.element;

          if (playerRootElements.includes(techElement)) {
            efficiency += 0.25;
          }

          const ELEMENT_GENERATE: Record<ElementType, ElementType> = {
            "金": "水", "木": "火", "土": "金", "水": "木", "火": "土",
            "风": "雷", "雷": "火", "冰": "水", "暗": "土",
          };
          if (playerRootElements.includes(ELEMENT_GENERATE[techElement])) {
            efficiency += 0.1;
          }

          const ELEMENT_COUNTER: Record<ElementType, ElementType> = {
            "金": "木", "木": "土", "土": "水", "水": "火", "火": "金",
            "风": "土", "雷": "水", "冰": "火", "暗": "风",
          };
          if (playerRootElements.includes(ELEMENT_COUNTER[techElement])) {
            efficiency -= 0.15;
          }

          let heartBonus = 0;
          const heartCompatibility = heartTechnique.heartCompatibility || [];
          for (const compat of heartCompatibility) {
            const score = s.player.stats.heartScores.find((hs) => hs.trait === compat.trait)?.score || 0;
            heartBonus += (score / 100) * (compat.bonus / 100);
          }
          efficiency += heartBonus;

          const conflictingPairs: [any, any][] = [["刚毅", "仁厚"], ["无情", "仁厚"], ["谨慎", "勇猛"], ["狡黠", "仁厚"]];
          for (const [trait1, trait2] of conflictingPairs) {
            const score1 = s.player.stats.heartScores.find((hs) => hs.trait === trait1)?.score || 0;
            const score2 = s.player.stats.heartScores.find((hs) => hs.trait === trait2)?.score || 0;
            if (score1 > 60 && score2 > 60) {
              efficiency -= 0.05;
            }
          }
        }

        const avgMeridianClarity =
          s.player.meridians.reduce((sum, m) => sum + m.clarity, 0) / s.player.meridians.length;
        if (avgMeridianClarity < 50) {
          efficiency *= 0.5;
        }

        efficiency += (s.player.stats.wisdom - 50) * 0.005;

        efficiency = Math.max(0.2, efficiency);

        const baseGain = (20 + Math.random() * 30) * (basePracticeSpeed / 100);
        const finalGain = Math.floor(baseGain * efficiency);

        set((st) => ({
          player: {
            ...st.player,
            cultivation: st.player.cultivation + finalGain,
            mp: Math.max(0, st.player.mp - mpCost),
          },
          log: [`静坐吐纳，灵力流转，修为增长 ${finalGain} 点。`, ...st.log].slice(0, 30),
        }));
      },

      breakthrough: () => {
        const s = get();
        const nextRealm = REALMS[s.player.realmIndex + 1];
        if (!nextRealm) {
          set((st) => ({ log: ["已臻化境，无可突破。", ...st.log].slice(0, 30) }));
          return;
        }
        if (s.player.cultivation < nextRealm.cultivationNeeded) {
          set((st) => ({
            log: [
              `修为不足，尚需 ${nextRealm.cultivationNeeded - s.player.cultivation} 点方可尝试突破。`,
              ...st.log,
            ].slice(0, 30),
          }));
          return;
        }

        let baseSuccess = 0.5;
        baseSuccess += (s.player.stats.wisdom - 50) * 0.003;

        const avgMeridianClarity =
          s.player.meridians.reduce((sum, m) => sum + m.clarity, 0) / s.player.meridians.length;
        baseSuccess += (avgMeridianClarity - 50) * 0.002;

        const damageCount = s.player.meridians.filter((m) => m.damage).length;
        baseSuccess -= damageCount * 0.1;

        const success = Math.random() < Math.min(0.95, Math.max(0.1, baseSuccess));

        if (success) {
          const realmBonus = 100 + s.player.realmIndex * 50;
          set((st) => ({
            player: {
              ...st.player,
              realmIndex: st.player.realmIndex + 1,
              lifespanMax: st.player.lifespanMax + 80,
              hpMax: st.player.hpMax + 150 + realmBonus,
              mpMax: st.player.mpMax + 100 + realmBonus,
              spiritMax: st.player.spiritMax + 50 + realmBonus,
              hp: st.player.hpMax + 150 + realmBonus,
              mp: st.player.mpMax + 100 + realmBonus,
              spirit: st.player.spiritMax + 50 + realmBonus,
            },
            log: [
              `天降甘霖，灵台清明，破入 ${nextRealm.name}${nextRealm.stage}！`,
              ...st.log,
            ].slice(0, 30),
          }));
        } else {
          const damage = 50 + Math.floor(Math.random() * 100);
          set((st) => ({
            player: {
              ...st.player,
              hp: Math.max(1, st.player.hp - damage),
              mp: 0,
              meridians: st.player.meridians.map((m) =>
                Math.random() < 0.3 ? { ...m, damage: true, clarity: Math.max(20, m.clarity - 20) } : m,
              ),
            },
            log: ["心魔骤起，突破失败，灵力尽失，气血受创。", ...st.log].slice(0, 30),
          }));
        }
      },

      comprehendTechnique: (id) => {
        const s = get();
        const tech = s.techniques.find((t) => t.id === id);
        if (!tech) return;
        const mpCost = 30;
        if (s.player.mp < mpCost) {
          set((st) => ({ log: ["灵力不济，难以参悟。", ...st.log].slice(0, 30) }));
          return;
        }

        let efficiency = 1;

        const playerRootElements = s.player.spiritRoots.map((r) => r.element);
        const techElement = tech.element;

        if (playerRootElements.includes(techElement)) {
          efficiency += 0.2;
        }

        const ELEMENT_GENERATE: Record<ElementType, ElementType> = {
          "金": "水", "木": "火", "土": "金", "水": "木", "火": "土",
          "风": "雷", "雷": "火", "冰": "水", "暗": "土",
        };
        if (playerRootElements.includes(ELEMENT_GENERATE[techElement])) {
          efficiency += 0.1;
        }

        const matchingHearts = tech.heartMatch?.map((trait) => {
          const score = s.player.stats.heartScores.find((hs) => hs.trait === trait)?.score || 0;
          return score;
        }) || [];
        const avgMatchingScore = matchingHearts.length > 0
          ? matchingHearts.reduce((a, b) => a + b, 0) / matchingHearts.length
          : 0;
        efficiency += (avgMatchingScore / 100) * 0.3;

        efficiency += (s.player.stats.wisdom - 50) * 0.005;

        const baseGain = 50 + Math.random() * 80;
        const finalGain = Math.floor(baseGain * efficiency);

        set((st) => ({
          player: { ...st.player, mp: Math.max(0, st.player.mp - mpCost) },
          techniques: st.techniques.map((t) =>
            t.id === id
              ? { ...t, proficiency: Math.min(t.proficiencyMax, t.proficiency + finalGain) }
              : t,
          ),
          log: [`参悟《${tech.name}》，似有所得，熟练度 +${finalGain}。`, ...st.log].slice(0, 30),
        }));
      },

      drawTalisman: (recipeId) => {
        const s = get();
        const recipe = s.talismanRecipes.find((r) => r.id === recipeId);
        if (!recipe) return;
        const paper = s.inventory.find((i) => i.name === "黄表符纸");
        const cinnabar = s.inventory.find((i) => i.name === "朱砂");
        if (!paper || paper.count < recipe.paperCost || !cinnabar || cinnabar.count < recipe.cinnabarCost) {
          set((st) => ({ log: ["符纸或朱砂不足，无法画符。", ...st.log].slice(0, 30) }));
          return;
        }
        if (s.player.mp < recipe.mpCost) {
          set((st) => ({ log: ["灵力不足，难以运笔。", ...st.log].slice(0, 30) }));
          return;
        }
        const success = Math.random() * 100 < recipe.successRate;
        set((st) => {
          const newInventory = st.inventory.map((i) => {
            if (i.name === "黄表符纸") return { ...i, count: i.count - recipe.paperCost };
            if (i.name === "朱砂") return { ...i, count: i.count - recipe.cinnabarCost };
            return i;
          });
          if (success) {
            const existing = newInventory.find((i) => i.name === recipe.name);
            if (existing) {
              return {
                inventory: newInventory.map((i) =>
                  i.name === recipe.name ? { ...i, count: i.count + 1 } : i,
                ),
                player: { ...st.player, mp: Math.max(0, st.player.mp - recipe.mpCost) },
                log: [`笔走龙蛇，灵光乍现，得《${recipe.name}》一道！`, ...st.log].slice(0, 30),
              };
            }
            return {
              inventory: [
                ...newInventory,
                {
                  id: `talisman-${Date.now()}`,
                  name: recipe.name,
                  type: "符箓" as const,
                  grade: recipe.grade,
                  count: 1,
                  icon: "符",
                  desc: recipe.desc,
                },
              ],
              player: { ...st.player, mp: Math.max(0, st.player.mp - recipe.mpCost) },
              log: [`笔走龙蛇，灵光乍现，得《${recipe.name}》一道！`, ...st.log].slice(0, 30),
            };
          }
          return {
            inventory: newInventory,
            player: { ...st.player, mp: Math.max(0, st.player.mp - recipe.mpCost) },
            log: ["画符失败，符纸焦黑，灵力反噬。", ...st.log].slice(0, 30),
          };
        });
      },

      brewAlchemy: async (recipeId, fire, duration) => {
        const s = get();
        const recipe = s.alchemyRecipes.find((r) => r.id === recipeId);
        if (!recipe) return;
        if (s.player.mp < recipe.mpCost) {
          set((st) => ({ log: ["灵力不足，难控丹火。", ...st.log].slice(0, 30) }));
          return;
        }
        for (const herb of recipe.herbs) {
          const item = s.inventory.find((i) => i.name === herb.name);
          if (!item || item.count < herb.count) {
            set((st) => ({
              log: [`药引「${herb.name}」不足，无法开炉。`, ...st.log].slice(0, 30),
            }));
            return;
          }
        }

        const ELEMENTS = ["金", "木", "水", "火", "土", "风", "雷", "冰", "暗"] as const;

        const herbElements: Record<string, number> = {};
        for (const herb of recipe.herbs) {
          const item = s.inventory.find((i) => i.name === herb.name);
          if (item?.elements) {
            for (const [elem, val] of Object.entries(item.elements)) {
              herbElements[elem] = (herbElements[elem] || 0) + val * herb.count;
            }
          }
        }

        const fireFactor = fire / 100;
        const durFactor = duration / 100;
        const finalElements: Record<string, number> = {};
        for (const elem of ELEMENTS) {
          const furnaceVal = recipe.furnaceElements?.[elem] ?? 0;
          const herbVal = herbElements[elem] ?? 0;
          const rawVal = furnaceVal * fireFactor + herbVal * durFactor;
          finalElements[elem] = Math.round(Math.max(-100, Math.min(100, rawVal * 2)));
        }

        const fireInRange = fire >= recipe.fireRange[0] && fire <= recipe.fireRange[1];
        const durInRange = duration >= (recipe.durationRange?.[0] || 10) && duration <= (recipe.durationRange?.[1] || 50);
        let actualSuccessRate = recipe.successRate;
        if (!fireInRange) actualSuccessRate *= 0.7;
        if (!durInRange) actualSuccessRate *= 0.8;
        const success = Math.random() * 100 < actualSuccessRate;

        set((st) => {
          let newInventory = st.inventory.map((i) => {
            const herb = recipe.herbs.find((h) => h.name === i.name);
            if (herb) return { ...i, count: Math.max(0, i.count - herb.count) };
            return i;
          });
          return {
            inventory: newInventory,
            player: { ...st.player, mp: Math.max(0, st.player.mp - recipe.mpCost) },
          };
        });

        if (!success) {
          set((st) => ({
            log: ["丹炉轰鸣，丹药化为飞灰，功亏一篑。", ...st.log].slice(0, 30),
          }));
          return;
        }

        try {
          const { chatWithModel } = await import("@/lib/aiClient");
          const { useAIStore } = await import("@/store/useAIStore");
          const aiSettings = useAIStore.getState().settings;

          if (!aiSettings.apiKey) {
            const outputName = recipe.output.split("×")[0];
            const outputCount = parseInt(recipe.output.split("×")[1] || "1", 10);
            set((st) => {
              let newInventory = st.inventory.map((i) => i);
              const existing = newInventory.find((i) => i.name === outputName);
              if (existing) {
                newInventory = newInventory.map((i) =>
                  i.name === outputName ? { ...i, count: i.count + outputCount } : i,
                );
              } else {
                newInventory = [
                  ...newInventory,
                  {
                    id: `pill-${Date.now()}`,
                    name: outputName,
                    type: "丹药" as const,
                    grade: recipe.grade,
                    count: outputCount,
                    icon: "丹",
                    desc: recipe.desc,
                    elements: finalElements,
                  },
                ];
              }
              return {
                inventory: newInventory,
                log: [`丹成！得 ${recipe.output}，丹香四溢。`, ...st.log].slice(0, 30),
              };
            });
            return;
          }

          const elementsText = ELEMENTS.map((e) => `${e}:${finalElements[e]}`).join(",");
          const prompt = [
            {
              role: "system" as const,
              content: `你是一位修真界的炼丹大师。根据以下炼丹结果，推演丹药的名称和效果。

输入参数：
- 配方名称：${recipe.name}
- 配方品级：${recipe.grade}
- 配方描述：${recipe.desc}
- 火候：${fire}（适宜范围：${recipe.fireRange[0]}-${recipe.fireRange[1]}）
- 时长：${duration}息（适宜范围：${recipe.durationRange?.[0] || 10}-${recipe.durationRange?.[1] || 50}）
- 元素属性值（-100~100）：${elementsText}

元素说明：
金：锐利、坚韧、金属性
木：生机、恢复、木属性
水：柔和、流动、水属性
火：灼热、爆发、火属性
土：稳固、防御、土属性
风：迅捷、灵动、风属性
雷：迅猛、破敌、雷属性
冰：寒冷、迟缓、冰属性
暗：诡异、隐匿、暗属性

请生成：
1. 丹药名称（2-4个字，古风韵味）
2. 丹药效果描述（50-100字，描述服用后的效果）
3. 丹药品级（从凡品/灵品/玄品/天品/仙品中选择，通常不高于配方品级）

格式要求：
NAME: [丹药名称]
GRADE: [品级]
EFFECT: [效果描述]`,
            },
          ];

          const raw = await chatWithModel(aiSettings, aiSettings.proModel, prompt, {
            timeoutMs: 30000,
          });

          let pillName = recipe.output.split("×")[0];
          let pillGrade = recipe.grade;
          let pillDesc = recipe.desc;

          const nameMatch = raw.match(/NAME:\s*(.+)/);
          const gradeMatch = raw.match(/GRADE:\s*(.+)/);
          const effectMatch = raw.match(/EFFECT:\s*(.+)/);

          if (nameMatch) pillName = nameMatch[1].trim();
          if (gradeMatch) pillGrade = gradeMatch[1].trim() as any;
          if (effectMatch) pillDesc = effectMatch[1].trim();

          const outputCount = parseInt(recipe.output.split("×")[1] || "1", 10);

          set((st) => {
            let newInventory = st.inventory.map((i) => i);
            const existing = newInventory.find((i) => i.name === pillName);
            if (existing) {
              newInventory = newInventory.map((i) =>
                i.name === pillName ? { ...i, count: i.count + outputCount } : i,
              );
            } else {
              newInventory = [
                ...newInventory,
                {
                  id: `pill-${Date.now()}`,
                  name: pillName,
                  type: "丹药" as const,
                  grade: pillGrade,
                  count: outputCount,
                  icon: "丹",
                  desc: pillDesc,
                  elements: finalElements,
                },
              ];
            }
            return {
              inventory: newInventory,
              log: [`丹成！得「${pillName}」×${outputCount}，${pillDesc.slice(0, 20)}...`, ...st.log].slice(0, 30),
            };
          });
        } catch (e) {
          console.error("AI生成丹药失败:", e);
          const outputName = recipe.output.split("×")[0];
          const outputCount = parseInt(recipe.output.split("×")[1] || "1", 10);
          set((st) => {
            let newInventory = st.inventory.map((i) => i);
            const existing = newInventory.find((i) => i.name === outputName);
            if (existing) {
              newInventory = newInventory.map((i) =>
                i.name === outputName ? { ...i, count: i.count + outputCount } : i,
              );
            } else {
              newInventory = [
                ...newInventory,
                {
                  id: `pill-${Date.now()}`,
                  name: outputName,
                  type: "丹药" as const,
                  grade: recipe.grade,
                  count: outputCount,
                  icon: "丹",
                  desc: recipe.desc,
                  elements: finalElements,
                },
              ];
            }
            return {
              inventory: newInventory,
              log: [`丹成！得 ${recipe.output}，丹香四溢。`, ...st.log].slice(0, 30),
            };
          });
        }
      },

      acceptTask: (id) => {
        const s = get();
        const task = s.sect.tasks.find((t) => t.id === id);
        if (!task || task.accepted) return;
        set((st) => ({
          sect: {
            ...st.sect,
            tasks: st.sect.tasks.map((t) =>
              t.id === id ? { ...t, accepted: true } : t,
            ),
            contribution: st.sect.contribution + task.contribution,
          },
          spiritStones: {
            ...st.spiritStones,
            low: st.spiritStones.low + task.spiritStone,
          },
          log: [
            `接取门派任务「${task.title}」，得贡献 ${task.contribution}、下品灵石 ${task.spiritStone}。`,
            ...st.log,
          ].slice(0, 30),
        }));
      },

      promote: (id) => {
        const s = get();
        const pos = s.sect.positions.find((p) => p.id === id);
        if (!pos || pos.unlocked) return;
        if (s.sect.contribution < pos.contributionNeeded) {
          set((st) => ({
            log: [
              `贡献不足，尚需 ${pos.contributionNeeded - s.sect.contribution} 点方可晋升「${pos.name}」。`,
              ...st.log,
            ].slice(0, 30),
          }));
          return;
        }
        set((st) => ({
          sect: {
            ...st.sect,
            contribution: st.sect.contribution - pos.contributionNeeded,
            positions: st.sect.positions.map((p) => ({
              ...p,
              unlocked: p.level <= pos.level ? true : p.unlocked,
              isCurrent: p.id === id ? true : p.isCurrent ? false : p.isCurrent,
            })),
          },
          player: { ...st.player, position: pos.name },
          log: [`功德圆满，晋升为「${pos.name}」！`, ...st.log].slice(0, 30),
        }));
      },

      buyShop: (id) => {
        const s = get();
        const item = s.sect.shop.find((i) => i.id === id);
        if (!item) return;
        if (s.sect.contribution < item.cost) {
          set((st) => ({
            log: [`贡献不足，无法兑换「${item.name}」。`, ...st.log].slice(0, 30),
          }));
          return;
        }
        set((st) => ({
          sect: { ...st.sect, contribution: st.sect.contribution - item.cost },
          log: [`以 ${item.cost} 贡献兑换得「${item.name}」。`, ...st.log].slice(0, 30),
        }));
      },

      interact: (relationId) => {
        const s = get();
        const rel = s.relations.find((r) => r.id === relationId);
        if (!rel) return;
        const gain = Math.floor(3 + Math.random() * 8);
        if (rel.type === "dao_companion") {
          const cultGain = Math.floor(40 + Math.random() * 60);
          set((st) => ({
            player: { ...st.player, cultivation: st.player.cultivation + cultGain },
            relations: st.relations.map((r) =>
              r.id === relationId
                ? { ...r, affinity: Math.min(r.affinityMax, r.affinity + gain) }
                : r,
            ),
            log: [`与道侣双修，情谊 +${gain}，修为 +${cultGain}。`, ...st.log].slice(0, 30),
          }));
          return;
        }
        set((st) => ({
          relations: st.relations.map((r) =>
            r.id === relationId
              ? { ...r, affinity: Math.min(r.affinityMax, r.affinity + gain) }
              : r,
          ),
          log: [`与「${rel.name}」往来，亲疏变化 ${gain}。`, ...st.log].slice(0, 30),
        }));
      },

      addBuff: (buff) => {
        set((st) => {
          const existing = st.player.buffs.find((b) => b.id === buff.id);
          if (existing) {
            const newStacks = Math.min(existing.stacks + buff.stacks, existing.maxStacks);
            return {
              player: {
                ...st.player,
                buffs: st.player.buffs.map((b) =>
                  b.id === buff.id ? { ...b, stacks: newStacks } : b,
                ),
              },
            };
          }
          return {
            player: {
              ...st.player,
              buffs: [...st.player.buffs, { ...buff, stacks: Math.min(buff.stacks, buff.maxStacks) }],
            },
          };
        });
      },

      removeBuff: (buffId) => {
        set((st) => ({
          player: {
            ...st.player,
            buffs: st.player.buffs.filter((b) => b.id !== buffId),
          },
        }));
      },

      addShield: (shield) => {
        set((st) => {
          const existing = st.player.shields.find((s) => s.id === shield.id);
          if (existing) {
            const newValue = Math.min(existing.value + shield.value, existing.maxValue);
            return {
              player: {
                ...st.player,
                shields: st.player.shields.map((s) =>
                  s.id === shield.id ? { ...s, value: newValue } : s,
                ),
              },
            };
          }
          return {
            player: {
              ...st.player,
              shields: [...st.player.shields, { ...shield }],
            },
          };
        });
      },

      consumeShield: (amount) => {
        set((st) => {
          let remaining = amount;
          const newShields = [...st.player.shields];

          for (let i = 0; i < newShields.length && remaining > 0; i++) {
            const consumeAmount = Math.min(remaining, newShields[i].value);
            remaining -= consumeAmount;
            newShields[i].value -= consumeAmount;

            if (newShields[i].value <= 0) {
              newShields.splice(i, 1);
              i--;
            }
          }

          return {
            player: { ...st.player, shields: newShields },
          };
        });
      },

      updateBuffDuration: () => {
        set((st) => ({
          player: {
            ...st.player,
            buffs: st.player.buffs
              .filter((buff) => {
                if (buff.durationType !== "round") return true;
                if (buff.duration === undefined) return true;
                return buff.duration > 0;
              })
              .map((buff) => {
                if (buff.durationType !== "round" || buff.duration === undefined) return buff;
                return { ...buff, duration: buff.duration - 1 };
              }),
          },
        }));
      },

      resetGame: () => {
        set({ ...initialState, log: ["重入轮回，再启修真。"] });
      },

      applyOps: (ops) => {
        if (ops.length === 0) return;
        set((st) => {
          const dataView: GameState = {
            player: st.player,
            techniques: st.techniques,
            inventory: st.inventory,
            spiritStones: st.spiritStones,
            talismanRecipes: st.talismanRecipes,
            alchemyRecipes: st.alchemyRecipes,
            sect: st.sect,
            relations: st.relations,
            currentPanel: st.currentPanel,
            craftingTab: st.craftingTab,
            currentLocation: st.currentLocation,
            log: st.log,
          };
          const next = applyOpsToState(dataView, ops);
          return {
            player: next.player,
            techniques: next.techniques,
            inventory: next.inventory,
            spiritStones: next.spiritStones,
            sect: next.sect,
            relations: next.relations,
            log: next.log,
          };
        });
      },

      getSnapshot: () => {
        const st = get();
        return structuredClone({
          player: st.player,
          techniques: st.techniques,
          inventory: st.inventory,
          spiritStones: st.spiritStones,
          sect: st.sect,
          relations: st.relations,
          log: st.log,
        });
      },

      restoreSnapshot: (snap) => {
        set({
          player: structuredClone(snap.player),
          techniques: structuredClone(snap.techniques),
          inventory: structuredClone(snap.inventory),
          spiritStones: structuredClone(snap.spiritStones),
          sect: structuredClone(snap.sect),
          relations: structuredClone(snap.relations),
          log: structuredClone(snap.log),
        });
      },
    }),
    {
      name: "xiuxian-save",
      version: 6,
      migrate: (state: any, version: number) => {
        if (version < 2) {
          if (state.techniques) {
            state.techniques = state.techniques.map((t: any) => {
              if (t.category === "主修") {
                return { ...t, category: "心法" };
              }
              if (t.category === "辅修") {
                if (t.name.includes("身法") || t.name.includes("遁") || t.name.includes("步")) {
                  return { ...t, category: "身法" };
                }
                if (t.name.includes("诀") && !t.name.includes("心") && !t.name.includes("法")) {
                  return { ...t, category: "炼体" };
                }
                if (t.name.includes("指") || t.name.includes("掌") || t.name.includes("剑") || t.name.includes("雷") || t.name.includes("冰") || t.name.includes("火")) {
                  return { ...t, category: "神通" };
                }
                return { ...t, category: "心法" };
              }
              return t;
            });
          }

          const hasSecretTechnique = state.techniques?.some((t: any) => t.category === "秘术");
          if (!hasSecretTechnique) {
            state.techniques = state.techniques || [];
            state.techniques.push({
              id: "t6",
              name: "龟息诀",
              grade: "灵品",
              category: "秘术",
              daoPath: "elemental",
              element: "土",
              nature: "稳",
              proficiency: 1500,
              proficiencyMax: 6000,
              insight: "龟息潜藏，隐于天地，呼吸之间，生机不绝。",
              description: "保命秘术，可假死遁逃，封印自身气息，推演周围环境变化。",
              heartMatch: ["谨慎", "仁厚"],
              heartCompatibility: [
                { trait: "谨慎", bonus: 30 },
                { trait: "仁厚", bonus: 15 },
                { trait: "执着", bonus: 10 },
                { trait: "勇猛", bonus: -20 },
                { trait: "狡黠", bonus: -15 },
              ],
              attributes: { earth: 70, vitality: 20, stealth: 50 },
              prerequisites: [{ type: "realm", value: "炼气" }, { type: "heartTrait", value: "谨慎" }],
              basePracticeSpeed: 75,
              levels: [],
              skills: [],
            });
          }
        }

        if (version < 3) {
          if (state.player?.stats) {
            const oldTraits = state.player.stats.heartTraits || [];
            state.player.stats.heartScores = [
              { trait: "刚毅", score: oldTraits.includes("刚毅") ? 70 : 30 + Math.floor(Math.random() * 30) },
              { trait: "狡黠", score: oldTraits.includes("狡黠") ? 70 : 30 + Math.floor(Math.random() * 30) },
              { trait: "仁厚", score: oldTraits.includes("仁厚") ? 70 : 30 + Math.floor(Math.random() * 30) },
              { trait: "无情", score: oldTraits.includes("无情") ? 70 : 30 + Math.floor(Math.random() * 30) },
              { trait: "谨慎", score: oldTraits.includes("谨慎") ? 70 : 30 + Math.floor(Math.random() * 30) },
              { trait: "勇猛", score: oldTraits.includes("勇猛") ? 70 : 30 + Math.floor(Math.random() * 30) },
              { trait: "聪慧", score: oldTraits.includes("聪慧") ? 70 : 30 + Math.floor(Math.random() * 30) },
              { trait: "执着", score: oldTraits.includes("执着") ? 70 : 30 + Math.floor(Math.random() * 30) },
            ];
            delete state.player.stats.heartTraits;
          }

          if (state.player?.meridians) {
            const ZONE_MAP: Record<string, string> = {
              "神魂脉": "head",
              "督脉": "head",
              "任脉": "chest",
              "丹田气脉": "abdomen",
              "冲脉": "abdomen",
              "带脉": "abdomen",
              "双臂脉": "arm_right",
              "手太阴肺经": "arm_right",
              "手阳明大肠经": "arm_left",
              "阴维脉": "arm_left",
              "阳维脉": "arm_right",
              "双腿脉": "leg_right",
              "足太阴脾经": "leg_right",
              "足阳明胃经": "leg_left",
              "阴跷脉": "leg_left",
              "阳跷脉": "leg_right",
            };
            state.player.meridians = state.player.meridians.map((m: any) => ({
              ...m,
              zone: ZONE_MAP[m.name] || "chest",
            }));
          }
        }

        if (version < 4) {
          if (state.player && !state.player.buffs) {
            state.player.buffs = [];
          }
          if (state.player && !state.player.shields) {
            state.player.shields = [];
          }
        }

        if (version < 5) {
          if (state.player && state.player.activeHeartTechnique === undefined) {
            state.player.activeHeartTechnique = null;
          }
        }

        if (version < 6) {
          if (state.techniques) {
            state.techniques = state.techniques.map((t: any) => {
              if (!t.heartCompatibility) {
                const defaultCompat: Record<string, { trait: string; bonus: number }[]> = {
                  "太上引气篇": [{ trait: "谨慎", bonus: 25 }, { trait: "聪慧", bonus: 20 }, { trait: "执着", bonus: 15 }, { trait: "勇猛", bonus: -10 }, { trait: "无情", bonus: -15 }],
                  "玄水诀": [{ trait: "谨慎", bonus: 20 }, { trait: "仁厚", bonus: 15 }, { trait: "执着", bonus: 10 }, { trait: "勇猛", bonus: -15 }, { trait: "无情", bonus: -10 }],
                  "青木长生功": [{ trait: "仁厚", bonus: 25 }, { trait: "执着", bonus: 20 }, { trait: "谨慎", bonus: 15 }, { trait: "无情", bonus: -15 }, { trait: "狡黠", bonus: -10 }],
                  "流云身法": [{ trait: "勇猛", bonus: 20 }, { trait: "狡黠", bonus: 25 }, { trait: "敏捷", bonus: 15 }, { trait: "谨慎", bonus: -15 }, { trait: "执着", bonus: -10 }],
                  "寒霜指": [{ trait: "刚毅", bonus: 25 }, { trait: "无情", bonus: 20 }, { trait: "勇猛", bonus: 15 }, { trait: "仁厚", bonus: -20 }, { trait: "谨慎", bonus: -10 }],
                  "龟息诀": [{ trait: "谨慎", bonus: 30 }, { trait: "仁厚", bonus: 15 }, { trait: "执着", bonus: 10 }, { trait: "勇猛", bonus: -20 }, { trait: "狡黠", bonus: -15 }],
                };
                return {
                  ...t,
                  heartCompatibility: defaultCompat[t.name] || [],
                  basePracticeSpeed: t.basePracticeSpeed || 100,
                  attributes: t.attributes || {},
                  prerequisites: t.prerequisites || [],
                };
              }
              return t;
            });
          }
        }
        return state;
      },
      partialize: (s) => ({
        player: s.player,
        techniques: s.techniques,
        inventory: s.inventory,
        spiritStones: s.spiritStones,
        sect: s.sect,
        relations: s.relations,
        log: s.log,
      }),
    },
  ),
);
