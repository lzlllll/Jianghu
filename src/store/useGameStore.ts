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
  TalismanRecipe,
  Player,
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
  setPlayer: (player: Player) => void;
  cultivate: () => void;
  breakthrough: () => void;
  comprehendTechnique: (id: string) => void;
  drawTalisman: (recipe: TalismanRecipe) => void;
  brewAlchemy: (selectedHerbs: { name: string; count: number }[], fire: number, duration: number) => void;
  acceptTask: (id: string) => void;
  promote: (id: string) => void;
  buyShop: (id: string) => void;
  interact: (relationId: string) => void;
  addLog: (msg: string) => void;
  resetGame: () => void;
  applyOps: (ops: DataOp[]) => void;
  getSnapshot: () => GameSnapshot;
  restoreSnapshot: (snap: GameSnapshot) => void;
  updateNews: (newItems: { category: string; title: string; content: string; source: string }[]) => void;
}

const initialState: GameState = {
  player: {
    ...initialPlayer,
    spiritRoots: [],
    stats: {
      vitality: 50,
      soul: 50,
      wisdom: 50,
      agility: 50,
      heartScores: [],
    },
    meridians: [],
    timeline: [],
    buffs: [],
    shields: [],
    activeHeartTechnique: null,
  },
  techniques: [],
  inventory: [],
  spiritStones: { low: 0, mid: 0, high: 0, supreme: 0 },
  talismanRecipes: [],
  alchemyRecipes: [],
  sect: {
    name: "",
    level: 1,
    reputation: 0,
    leader: "",
    elders: 0,
    disciples: 0,
    territory: "",
    contribution: 0,
    positions: [],
    tasks: [],
    shop: [],
    heritage: [],
    resources: [],
    management: {
      industries: [],
      activities: [],
      halls: [],
      treasury: {
        spiritStones: 0,
        materials: [],
      },
      consumption: {
        dailyCost: 0,
        recentConsumption: [],
      },
    },
  },
  relations: [],
  currentPanel: "profile",
  craftingTab: "talisman",
  currentLocation: "home",
  log: [],
  pillCache: {},
  news: {
    items: [],
    lastUpdate: "",
  },
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

      setPlayer: (player) => set({ player }),

      addLog: (msg) =>
        set((s) => ({ log: [msg, ...s.log].slice(0, 30) })),

      updateNews: (newItems) =>
        set((s) => {
          const categoryLimits: Record<string, number> = {
            "官府公告": 3,
            "宗门布告": 3,
            "市井传言": 3,
          };

          let newNews = Array.isArray(s.news.items) ? [...s.news.items] : [];

          newItems.forEach((item) => {
            const newItem = {
              id: `news-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              category: item.category as import("@/data/types").NewsCategory,
              title: item.title,
              content: item.content,
              date: "今日",
              source: item.source,
            };
            newNews = [newItem, ...newNews];
          });

          const grouped = newNews.reduce((acc, item) => {
            if (!acc[item.category]) acc[item.category] = [];
            if (acc[item.category].length < (categoryLimits[item.category] || 3)) {
              acc[item.category].push(item);
            }
            return acc;
          }, {} as Record<string, typeof newNews>);

          return {
            news: {
              items: Object.values(grouped).flat(),
              lastUpdate: "今日",
            },
          };
        }),

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

          const playerRootElements = (Array.isArray(s.player.spiritRoots) ? s.player.spiritRoots : []).map((r) => r.element);
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

        const meridians = Array.isArray(s.player.meridians) ? s.player.meridians : [];
        const avgMeridianClarity =
          meridians.length > 0 ? meridians.reduce((sum, m) => sum + m.clarity, 0) / meridians.length : 0;
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

        const meridians = Array.isArray(s.player.meridians) ? s.player.meridians : [];
        const avgMeridianClarity =
          meridians.length > 0 ? meridians.reduce((sum, m) => sum + m.clarity, 0) / meridians.length : 0;
        baseSuccess += (avgMeridianClarity - 50) * 0.002;

        const damageCount = meridians.filter((m) => m.damage).length;
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
              meridians: (Array.isArray(st.player.meridians) ? st.player.meridians : []).map((m) =>
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

        const playerRootElements = (Array.isArray(s.player.spiritRoots) ? s.player.spiritRoots : []).map((r) => r.element);
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

        const matchingHearts = Array.isArray(tech.heartMatch) ? tech.heartMatch.map((trait) => {
          const score = s.player.stats.heartScores.find((hs) => hs.trait === trait)?.score || 0;
          return score;
        }) : [];
        const avgMatchingScore = matchingHearts.length > 0
          ? matchingHearts.reduce((a, b) => a + b, 0) / matchingHearts.length
          : 0;
        efficiency += (avgMatchingScore / 100) * 0.3;

        efficiency += (s.player.stats.wisdom - 50) * 0.005;

        const baseGain = 50 + Math.random() * 80;
        const finalGain = Math.floor(baseGain * efficiency);

        set((st) => ({
          player: { ...st.player, mp: Math.max(0, st.player.mp - mpCost) },
          techniques: (Array.isArray(st.techniques) ? st.techniques : []).map((t) =>
            t.id === id
              ? { ...t, proficiency: Math.min(t.proficiencyMax, t.proficiency + finalGain) }
              : t,
          ),
          log: [`参悟《${tech.name}》，似有所得，熟练度 +${finalGain}。`, ...st.log].slice(0, 30),
        }));
      },

      drawTalisman: (recipe) => {
        const s = get();
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
          const newInventory = (Array.isArray(st.inventory) ? st.inventory : []).map((i) => {
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

      brewAlchemy: async (selectedHerbs, fire, duration) => {
        const s = get();
        if (selectedHerbs.length === 0) {
          set((st) => ({ log: ["请先选择药材。", ...st.log].slice(0, 30) }));
          return;
        }

        const mpCost = 30 + selectedHerbs.reduce((sum, h) => sum + h.count * 10, 0);
        if (s.player.mp < mpCost) {
          set((st) => ({ log: ["灵力不足，难控丹火。", ...st.log].slice(0, 30) }));
          return;
        }

        for (const herb of selectedHerbs) {
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
        let totalHerbValue = 0;
        for (const herb of selectedHerbs) {
          const item = s.inventory.find((i) => i.name === herb.name);
          if (item?.elements) {
            for (const [elem, val] of Object.entries(item.elements)) {
              herbElements[elem] = (herbElements[elem] || 0) + val * herb.count;
              totalHerbValue += Math.abs(val * herb.count);
            }
          }
        }

        const fireFactor = fire / 100;
        const durFactor = duration / 100;

        const FIRE_BOOST_ELEMS = ["火", "雷"];
        const ICE_BOOST_ELEMS = ["冰", "水"];
        const fireBoost = Math.max(0, (fire - 50) / 50);
        const iceBoost = Math.max(0, (50 - fire) / 50);

        const finalElements: Record<string, number> = {};
        for (const elem of ELEMENTS) {
          const herbVal = herbElements[elem] ?? 0;
          let fireMod = 1;
          if (FIRE_BOOST_ELEMS.includes(elem)) {
            fireMod += fireBoost * 0.5;
          }
          if (ICE_BOOST_ELEMS.includes(elem)) {
            fireMod += iceBoost * 0.5;
            fireMod -= fireBoost * 0.3;
          }
          const rawVal = (herbVal * fireFactor + herbVal * durFactor) * fireMod;
          finalElements[elem] = Math.round(Math.max(-100, Math.min(100, rawVal)));
        }

        let baseSuccessRate = Math.min(95, 40 + totalHerbValue / 5);
        if (fire < 20 || fire > 80) baseSuccessRate *= 0.6;
        if (duration < 10 || duration > 90) baseSuccessRate *= 0.7;
        const success = Math.random() * 100 < baseSuccessRate;

        const sortedHerbs = [...selectedHerbs].sort((a, b) => a.name.localeCompare(b.name));
        const cacheKey = `herbs:${sortedHerbs.map((h) => `${h.name}×${h.count}`).join(",")}|fire:${fire}|dur:${duration}`;
        const cached = s.pillCache[cacheKey];

        let pillName = "无名丹药";
        let pillGrade: import("@/data/types").ItemGrade = "凡品";
        let pillDesc = "一枚不知功效的丹药。";
        let outputCount = 1;
        let shouldCache = false;

        if (success) {
          if (cached) {
            pillName = cached.name;
            pillGrade = cached.grade;
            pillDesc = cached.desc;
            outputCount = cached.outputCount;
          } else {
            shouldCache = true;
            try {
              const { chatWithModel } = await import("@/lib/aiClient");
              const { useAIStore } = await import("@/store/useAIStore");
              const aiSettings = useAIStore.getState().settings;

              if (aiSettings.apiKey) {
                const herbsText = selectedHerbs.map((h) => `${h.name}×${h.count}`).join(",");
                const elementsText = ELEMENTS.map((e) => `${e}:${finalElements[e]}`).join(",");

                let fireType = "中火";
                if (fire <= 30) fireType = "文火";
                else if (fire >= 70) fireType = "武火";

                const prompt = [
                  {
                    role: "system" as const,
                    content: `你是一位修真界的炼丹大师。根据以下炼丹结果，推演丹药的名称和效果。

输入参数：
- 放入药材：${herbsText}
- 火候：${fire}（${fireType}）
- 时长：${duration}息
- 元素属性值（-100~100）：${elementsText}

火候对丹药效果的影响规则：
- 文火（0-30）：温和、缓慢、调理类效果，适合治疗、恢复、持久增益类丹药
- 中火（30-70）：平衡、标准效果，适合通用增益类丹药
- 武火（70-100）：猛烈、爆发、攻伐类效果，适合伤害、爆发、控制类丹药

元素说明：
金：锐利、坚韧、金属性，适合攻击类丹药
木：生机、恢复、木属性，适合治疗类丹药
水：柔和、流动、水属性，适合灵力恢复类丹药
火：灼热、爆发、火属性，适合伤害类丹药
土：稳固、防御、土属性，适合防御类丹药
风：迅捷、灵动、风属性，适合身法速度类丹药
雷：迅猛、破敌、雷属性，适合爆发攻击类丹药
冰：寒冷、迟缓、冰属性，适合控制类丹药
暗：诡异、隐匿、暗属性，适合特殊效果类丹药

请根据火候类型和元素属性生成：
1. 丹药名称（2-4个字，古风韵味，符合元素特性和火候类型）
2. 丹药效果描述（50-100字，描述服用后的效果，与元素属性和火候类型相符）
3. 丹药品级（从凡品/灵品/玄品/天品/仙品中选择，根据药材品质和元素纯度决定）

格式要求：
NAME: [丹药名称]
GRADE: [品级]
EFFECT: [效果描述]`,
                  },
                ];

                const raw = await chatWithModel(aiSettings, aiSettings.proModel, prompt, {
                  timeoutMs: 30000,
                });

                const nameMatch = raw.match(/NAME:\s*(.+)/);
                const gradeMatch = raw.match(/GRADE:\s*(.+)/);
                const effectMatch = raw.match(/EFFECT:\s*(.+)/);

                if (nameMatch) pillName = nameMatch[1].trim();
                if (gradeMatch) pillGrade = gradeMatch[1].trim() as any;
                if (effectMatch) pillDesc = effectMatch[1].trim();

                const maxElement = Math.max(...Object.values(finalElements).map(Math.abs));
                if (maxElement > 60) outputCount = 1;
                else if (maxElement > 30) outputCount = 2;
                else outputCount = Math.min(3, selectedHerbs.length);
              } else {
                const maxElement = Math.max(...Object.values(finalElements).map(Math.abs));
                if (maxElement > 70) {
                  pillName = "极品灵丹";
                  pillGrade = "灵品";
                  pillDesc = "药力精纯，服之可大幅提升修为。";
                } else if (maxElement > 40) {
                  pillName = "上乘丹药";
                  pillGrade = "凡品";
                  pillDesc = "品质尚佳，略有补益之效。";
                }
                outputCount = Math.min(2, selectedHerbs.length);
              }
            } catch (e) {
              console.error("AI生成丹药失败:", e);
              shouldCache = false;
            }
          }
        }

        set((st) => {
          let newInventory = (Array.isArray(st.inventory) ? st.inventory : []).map((i) => {
            const herb = selectedHerbs.find((h) => h.name === i.name);
            if (herb) return { ...i, count: Math.max(0, i.count - herb.count) };
            return i;
          });

          let newPillCache = { ...st.pillCache };
          if (success && shouldCache) {
            newPillCache[cacheKey] = {
              name: pillName,
              grade: pillGrade,
              desc: pillDesc,
              elements: finalElements,
              outputCount,
            };
          }

          if (success) {
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
              player: { ...st.player, mp: Math.max(0, st.player.mp - mpCost) },
              log: [`丹成！得「${pillName}」×${outputCount}，${pillDesc.slice(0, 20)}...`, ...st.log].slice(0, 30),
              pillCache: newPillCache,
            };
          }

          return {
            inventory: newInventory,
            player: { ...st.player, mp: Math.max(0, st.player.mp - mpCost) },
            log: ["丹炉轰鸣，丹药化为飞灰，功亏一篑。", ...st.log].slice(0, 30),
          };
        });
      },

      acceptTask: (id) => {
        const s = get();
        const task = s.sect.tasks.find((t) => t.id === id);
        if (!task || task.accepted) return;
        set((st) => ({
          sect: {
            ...st.sect,
            tasks: (Array.isArray(st.sect?.tasks) ? st.sect.tasks : []).map((t) =>
              t.id === id ? { ...t, accepted: true } : t,
            ),
            contribution: (st.sect?.contribution || 0) + task.contribution,
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
            contribution: (st.sect?.contribution || 0) - pos.contributionNeeded,
            positions: (Array.isArray(st.sect?.positions) ? st.sect.positions : []).map((p) => ({
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
            relations: (Array.isArray(st.relations) ? st.relations : []).map((r) =>
              r.id === relationId
                ? { ...r, affinity: Math.min(r.affinityMax, r.affinity + gain) }
                : r,
            ),
            log: [`与道侣双修，情谊 +${gain}，修为 +${cultGain}。`, ...st.log].slice(0, 30),
          }));
          return;
        }
        set((st) => ({
          relations: (Array.isArray(st.relations) ? st.relations : []).map((r) =>
            r.id === relationId
              ? { ...r, affinity: Math.min(r.affinityMax, r.affinity + gain) }
              : r,
          ),
          log: [`与「${rel.name}」往来，亲疏变化 ${gain}。`, ...st.log].slice(0, 30),
        }));
      },

      addBuff: (buff) => {
        set((st) => {
          const existing = (Array.isArray(st.player.buffs) ? st.player.buffs : []).find((b) => b.id === buff.id);
          if (existing) {
            const newStacks = Math.min(existing.stacks + buff.stacks, existing.maxStacks);
            return {
              player: {
                ...st.player,
                buffs: (Array.isArray(st.player.buffs) ? st.player.buffs : []).map((b) =>
                  b.id === buff.id ? { ...b, stacks: newStacks } : b,
                ),
              },
            };
          }
          return {
            player: {
              ...st.player,
              buffs: [...(Array.isArray(st.player.buffs) ? st.player.buffs : []), { ...buff, stacks: Math.min(buff.stacks, buff.maxStacks) }],
            },
          };
        });
      },

      removeBuff: (buffId) => {
        set((st) => ({
          player: {
            ...st.player,
            buffs: (Array.isArray(st.player.buffs) ? st.player.buffs : []).filter((b) => b.id !== buffId),
          },
        }));
      },

      addShield: (shield) => {
        set((st) => {
          const existing = (Array.isArray(st.player.shields) ? st.player.shields : []).find((s) => s.id === shield.id);
          if (existing) {
            const newValue = Math.min(existing.value + shield.value, existing.maxValue);
            return {
              player: {
                ...st.player,
                shields: (Array.isArray(st.player.shields) ? st.player.shields : []).map((s) =>
                  s.id === shield.id ? { ...s, value: newValue } : s,
                ),
              },
            };
          }
          return {
            player: {
              ...st.player,
              shields: [...(Array.isArray(st.player.shields) ? st.player.shields : []), { ...shield }],
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
            buffs: (Array.isArray(st.player.buffs) ? st.player.buffs : [])
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
            pillCache: st.pillCache,
            news: st.news,
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
            pillCache: next.pillCache,
          };
        });
      },

      getSnapshot: () => {
        const st = get();
        try {
          return JSON.parse(JSON.stringify({
            player: st.player,
            techniques: st.techniques,
            inventory: st.inventory,
            spiritStones: st.spiritStones,
            sect: st.sect,
            relations: st.relations,
            log: st.log,
          }));
        } catch (e) {
          console.warn("[getSnapshot] Failed to snapshot:", e);
          return {
            player: st.player,
            techniques: st.techniques,
            inventory: st.inventory,
            spiritStones: st.spiritStones,
            sect: st.sect,
            relations: st.relations,
            log: st.log,
          };
        }
      },

      restoreSnapshot: (snap) => {
        const clone = (obj: any) => {
          if (obj == null) return obj;
          try {
            return JSON.parse(JSON.stringify(obj));
          } catch {
            return obj;
          }
        };
        set({
          player: clone(snap.player),
          techniques: Array.isArray(snap.techniques) ? clone(snap.techniques) : [],
          inventory: Array.isArray(snap.inventory) ? clone(snap.inventory) : [],
          spiritStones: clone(snap.spiritStones),
          talismanRecipes: [],
          alchemyRecipes: [],
          sect: clone(snap.sect),
          relations: Array.isArray(snap.relations) ? clone(snap.relations) : [],
          currentPanel: "profile",
          craftingTab: "talisman",
          currentLocation: "home",
          log: Array.isArray(snap.log) ? clone(snap.log) : [],
          pillCache: clone(snap.pillCache || {}),
          news: { items: [], lastUpdate: "" },
        });
      },
    }),
    {
      name: "xiuxian-save",
      version: 9,
      migrate: (state: any, version: number) => {
        if (version < 2) {
          if (state.techniques && Array.isArray(state.techniques)) {
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
            state.player.meridians = (Array.isArray(state.player.meridians) ? state.player.meridians : []).map((m: any) => ({
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
          if (state.techniques && Array.isArray(state.techniques)) {
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

        if (version < 7) {
          const defaultElements: Record<string, Record<string, number>> = {
            "百年灵芝": { 木: 80, 土: 20 },
            "寒潭水精": { 水: 90, 冰: 40 },
            "朱砂": { 火: 60, 土: 30 },
            "黄表符纸": { 木: 70, 火: 20 },
            "千年雪莲": { 冰: 85, 水: 50, 木: 20 },
            "妖兽内丹": { 火: 50, 雷: 30 },
            "聚气丹": { 水: 40, 木: 30 },
            "筑基丹": { 火: 40, 土: 30, 金: 20 },
            "回春丹": { 木: 50, 水: 30 },
            "雷火符": { 雷: 60, 火: 40 },
            "冰封符": { 冰: 70, 水: 30 },
            "寒潭玄铁剑": { 金: 80, 水: 30 },
            "云水佩": { 水: 60, 木: 20 },
          };
          if (state.inventory && Array.isArray(state.inventory)) {
            state.inventory = state.inventory.map((item: any) => {
              if (!item.elements && defaultElements[item.name]) {
                return { ...item, elements: defaultElements[item.name] };
              }
              return item;
            });
          }
          if (!state.pillCache) {
            state.pillCache = {};
          }
        }

        if (version < 8) {
          if (!Array.isArray(state.techniques)) state.techniques = [];
          if (!Array.isArray(state.inventory)) state.inventory = [];
          if (!Array.isArray(state.relations)) state.relations = [];
          if (!Array.isArray(state.log)) state.log = [];
          if (state.player) {
            if (!Array.isArray(state.player.spiritRoots)) state.player.spiritRoots = [];
            if (!Array.isArray(state.player.meridians)) state.player.meridians = [];
            if (!Array.isArray(state.player.buffs)) state.player.buffs = [];
            if (!Array.isArray(state.player.shields)) state.player.shields = [];
            if (!Array.isArray(state.player.timeline)) state.player.timeline = [];
            if (state.player.stats) {
              if (!Array.isArray(state.player.stats.heartScores)) state.player.stats.heartScores = [];
              if (!Array.isArray(state.player.stats.heartTraits)) state.player.stats.heartTraits = [];
            }
          }
          if (state.sect) {
            if (!Array.isArray(state.sect.tasks)) state.sect.tasks = [];
            if (!Array.isArray(state.sect.positions)) state.sect.positions = [];
            if (!Array.isArray(state.sect.shop)) state.sect.shop = [];
            if (!Array.isArray(state.sect.heritage)) state.sect.heritage = [];
            if (!Array.isArray(state.sect.resources)) state.sect.resources = [];
            if (state.sect.management) {
              if (!Array.isArray(state.sect.management.industries)) state.sect.management.industries = [];
              if (!Array.isArray(state.sect.management.activities)) state.sect.management.activities = [];
              if (!Array.isArray(state.sect.management.halls)) state.sect.management.halls = [];
              if (state.sect.management.treasury && !Array.isArray(state.sect.management.treasury.materials)) {
                state.sect.management.treasury.materials = [];
              }
              if (state.sect.management.consumption && !Array.isArray(state.sect.management.consumption.recentConsumption)) {
                state.sect.management.consumption.recentConsumption = [];
              }
            }
          }
          if (state.news && !Array.isArray(state.news.items)) {
            state.news.items = [];
          }
        }
        if (version < 9) {
          const MAX_ARRAY = 200;
          if (Array.isArray(state.techniques)) state.techniques = state.techniques.slice(0, MAX_ARRAY);
          if (Array.isArray(state.inventory)) state.inventory = state.inventory.slice(0, MAX_ARRAY);
          if (Array.isArray(state.relations)) state.relations = state.relations.slice(0, MAX_ARRAY);
          if (Array.isArray(state.log)) state.log = state.log.slice(0, 30);
          if (state.player) {
            if (Array.isArray(state.player.meridians)) state.player.meridians = state.player.meridians.slice(0, 30);
            if (Array.isArray(state.player.timeline)) state.player.timeline = state.player.timeline.slice(0, 50);
            if (Array.isArray(state.player.buffs)) state.player.buffs = state.player.buffs.slice(0, 50);
            if (Array.isArray(state.player.shields)) state.player.shields = state.player.shields.slice(0, 50);
            if (state.player.stats && Array.isArray(state.player.stats.heartScores)) {
              state.player.stats.heartScores = state.player.stats.heartScores.slice(0, 20);
            }
          }
          if (state.sect) {
            if (Array.isArray(state.sect.tasks)) state.sect.tasks = state.sect.tasks.slice(0, 50);
            if (Array.isArray(state.sect.positions)) state.sect.positions = state.sect.positions.slice(0, 30);
            if (Array.isArray(state.sect.shop)) state.sect.shop = state.sect.shop.slice(0, 50);
            if (Array.isArray(state.sect.heritage)) state.sect.heritage = state.sect.heritage.slice(0, 50);
            if (Array.isArray(state.sect.resources)) state.sect.resources = state.sect.resources.slice(0, 50);
          }
          if (state.pillCache && typeof state.pillCache === "object") {
            const keys = Object.keys(state.pillCache);
            if (keys.length > 100) {
              const newCache: Record<string, any> = {};
              for (const k of keys.slice(0, 100)) {
                newCache[k] = state.pillCache[k];
              }
              state.pillCache = newCache;
            }
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
        pillCache: s.pillCache,
      }),
    },
  ),
);
