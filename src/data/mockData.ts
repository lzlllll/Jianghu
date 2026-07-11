import type {
  Player,
  Technique,
  InventoryItem,
  SpiritStones,
  TalismanRecipe,
  AlchemyRecipe,
  Sect,
  Relation,
  RealmTier,
  HeartScore,
  HeartModifier,
  BuffTargetStat,
} from "./types";

export const REALMS: RealmTier[] = [
  { name: "引气", stage: "初期", cultivationNeeded: 100 },
  { name: "引气", stage: "中期", cultivationNeeded: 300 },
  { name: "引气", stage: "后期", cultivationNeeded: 600 },
  { name: "引气", stage: "圆满", cultivationNeeded: 1000 },
  { name: "炼气", stage: "初期", cultivationNeeded: 3000 },
  { name: "炼气", stage: "中期", cultivationNeeded: 8000 },
  { name: "炼气", stage: "后期", cultivationNeeded: 15000 },
  { name: "炼气", stage: "圆满", cultivationNeeded: 25000 },
  { name: "筑基", stage: "初期", cultivationNeeded: 60000 },
  { name: "筑基", stage: "中期", cultivationNeeded: 150000 },
  { name: "筑基", stage: "后期", cultivationNeeded: 350000 },
  { name: "筑基", stage: "圆满", cultivationNeeded: 600000 },
  { name: "金丹", stage: "初期", cultivationNeeded: 1500000 },
  { name: "金丹", stage: "中期", cultivationNeeded: 4000000 },
  { name: "金丹", stage: "后期", cultivationNeeded: 8000000 },
  { name: "金丹", stage: "圆满", cultivationNeeded: 15000000 },
  { name: "元婴", stage: "初期", cultivationNeeded: 40000000 },
  { name: "元婴", stage: "中期", cultivationNeeded: 100000000 },
  { name: "元婴", stage: "后期", cultivationNeeded: 250000000 },
  { name: "元婴", stage: "圆满", cultivationNeeded: 500000000 },
  { name: "化神", stage: "初期", cultivationNeeded: 1200000000 },
  { name: "化神", stage: "中期", cultivationNeeded: 3000000000 },
  { name: "化神", stage: "后期", cultivationNeeded: 8000000000 },
  { name: "化神", stage: "圆满", cultivationNeeded: 20000000000 },
  { name: "合体", stage: "初期", cultivationNeeded: 50000000000 },
  { name: "合体", stage: "中期", cultivationNeeded: 150000000000 },
  { name: "合体", stage: "后期", cultivationNeeded: 500000000000 },
  { name: "合体", stage: "圆满", cultivationNeeded: 1500000000000 },
  { name: "渡劫", stage: "初期", cultivationNeeded: 5000000000000 },
  { name: "渡劫", stage: "中期", cultivationNeeded: 20000000000000 },
  { name: "渡劫", stage: "后期", cultivationNeeded: 100000000000000 },
  { name: "渡劫", stage: "圆满", cultivationNeeded: 500000000000000 },
  { name: "大乘", stage: "初期", cultivationNeeded: 2000000000000000 },
  { name: "大乘", stage: "中期", cultivationNeeded: 10000000000000000 },
  { name: "大乘", stage: "后期", cultivationNeeded: 50000000000000000 },
  { name: "大乘", stage: "圆满", cultivationNeeded: 200000000000000000 },
  { name: "真仙", stage: "飞升", cultivationNeeded: 0 },
];

export const DAO_PATHS: Record<string, { name: string; description: string }> = {
  sword: { name: "剑道真意", description: "剑修之道，以剑入道，一剑破万法" },
  sharp_weapon: { name: "利器刀锋", description: "刀枪斧钺等利器之术" },
  blunt_weapon: { name: "钝器软兵", description: "锤棍鞭锏等钝器之术" },
  defense: { name: "防御绝技", description: "肉盾/反弹流，以守为攻" },
  archery: { name: "神射星术", description: "弓弩暗器，百步穿杨" },
  hidden_weapon: { name: "万化暗渡", description: "暗器机关，出其不意" },
  unarmed: { name: "赤手空拳", description: "无兵之术，拳掌腿法" },
  elemental: { name: "五行真炁", description: "操纵元素，水火风雷" },
  illusion: { name: "太虚幻象", description: "神魂幻术，迷人心智" },
  curse: { name: "幽冥蛊咒", description: "蛊毒诅咒，诡异莫测" },
  beast_taming: { name: "万灵契法", description: "御兽召唤，万兽为仆" },
  array: { name: "天音阵图", description: "阵法音律，困敌杀敌" },
};

export const HEART_TRAITS: string[] = ["刚毅", "狡黠", "仁厚", "无情", "谨慎", "勇猛", "聪慧", "执着"];

export const ELEMENT_COUNTER: Record<string, string> = {
  "金": "木",
  "木": "土",
  "土": "水",
  "水": "火",
  "火": "金",
};

export const ELEMENT_GENERATE: Record<string, string> = {
  "金": "水",
  "木": "火",
  "土": "金",
  "水": "木",
  "火": "土",
};

export const initialPlayer: Player = {
  name: "",
  title: "",
  gender: "male",
  sectName: "",
  position: "",
  realmIndex: 0,
  realmStage: 0,
  cultivation: 0,
  lifespanCurrent: 0,
  lifespanMax: 0,
  hp: 0,
  hpMax: 0,
  mp: 0,
  mpMax: 0,
  spirit: 0,
  spiritMax: 0,
  spiritRoots: [],
  stats: {
    vitality: 0,
    soul: 0,
    wisdom: 0,
    agility: 0,
    heartScores: [],
  },
  meridians: [],
  body: "",
  fortune: "",
  karma: 0,
  background: "",
  description: "",
  personality: "",
  timeline: [],
  buffs: [],
  shields: [],
  activeHeartTechnique: null,
};

export const HEART_STAT_DISPLAY: Record<string, string> = {
  vitality: "体魄", soul: "神魂", wisdom: "悟性", agility: "身法",
  cultivation: "修炼速度", damage: "伤害", action: "行动力", karma: "机缘",
  attack: "攻击力", defense: "防御", dodge: "闪避", speed: "速度",
  critRate: "暴击率", critDamage: "暴击伤害", breakthrough: "突破几率",
  comprehension: "领悟速度", meridianRepair: "经脉恢复", trading: "交易折扣",
};

export function generateHeartModifiers(trait: string, score: number): HeartModifier[] {
  const seed = trait.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const allStats: BuffTargetStat[] = [
    "vitality", "soul", "wisdom", "agility", "cultivation",
    "damage", "action", "karma", "attack", "defense",
    "dodge", "speed", "critRate", "critDamage", "breakthrough",
    "comprehension", "meridianRepair", "trading",
  ];

  const rng = (n: number): number => ((seed * 1103515245 + 12345) >>> 0) % n;
  const signedRng = (n: number): number => {
    const v = rng(n * 2);
    return v < n ? v - n : v - n;
  };

  const count = 2 + rng(3);
  const modifiers: HeartModifier[] = [];
  const used = new Set<string>();

  for (let i = 0; i < count; i++) {
    let statIndex = rng(allStats.length);
    let attempts = 0;
    while (used.has(allStats[statIndex]) && attempts < 20) {
      statIndex = rng(allStats.length);
      attempts++;
    }
    const stat = allStats[statIndex];
    used.add(stat);

    const value = Math.round((score / 100) * ((rng(26) - 5)));
    const displayName = HEART_STAT_DISPLAY[stat] || stat;
    modifiers.push({
      stat,
      value: value === 0 ? 3 : value,
      description: value >= 0 ? `${displayName}加成` : `${displayName}降低`,
    });
  }

  return modifiers;
}

export const initialTechniques: Technique[] = [];

export const initialInventory: InventoryItem[] = [];

export const initialSpiritStones: SpiritStones = {
  low: 0,
  mid: 0,
  high: 0,
  supreme: 0,
};

export const initialTalismanRecipes: TalismanRecipe[] = [];

export const initialAlchemyRecipes: AlchemyRecipe[] = [];

export const initialSect: Sect = {
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
};

export const initialRelations: Relation[] = [];
