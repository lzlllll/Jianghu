export type PanelId =
  | "profile"
  | "technique"
  | "treasure"
  | "crafting"
  | "sect"
  | "social"
  | "story";

export type CraftingTab = "talisman" | "alchemy";

export type RelationType = "dao_companion" | "master" | "disciple" | "friend" | "enemy";

export type LocationType =
  | "home"
  | "alchemy_room"
  | "forge_room"
  | "meditation_room"
  | "market"
  | "library"
  | "training_ground"
  | "outdoor";

export interface Location {
  id: LocationType;
  name: string;
  description: string;
  icon: string;
  allowedActions: string[];
}

export type ItemGrade = "凡品" | "灵品" | "玄品" | "天品" | "仙品";

export type TechniqueCategory = "心法" | "炼体" | "神通" | "身法" | "秘术";

export type DaoPath =
  | "sword"
  | "sharp_weapon"
  | "blunt_weapon"
  | "defense"
  | "archery"
  | "hidden_weapon"
  | "unarmed"
  | "elemental"
  | "illusion"
  | "curse"
  | "beast_taming"
  | "array";

export type HeartTrait = string;

export interface HeartModifier {
  stat: BuffTargetStat;
  value: number;
  description: string;
}

export interface HeartScore {
  trait: HeartTrait;
  score: number;
  modifiers: HeartModifier[];
}

export interface RealmTier {
  name: string;
  stage: string;
  cultivationNeeded: number;
}

export type BuffCategory =
  | "attribute"
  | "attack"
  | "defense"
  | "action"
  | "cultivation"
  | "resource"
  | "status"
  | "dot"
  | "penetration"
  | "special";

export type BuffDurationType = "round" | "permanent" | "conditional" | "instant";

export type BuffTargetStat =
  | "vitality"
  | "soul"
  | "wisdom"
  | "agility"
  | "hp"
  | "mp"
  | "spirit"
  | "cultivation"
  | "maxHp"
  | "maxMp"
  | "maxSpirit"
  | "action"
  | "karma"
  | "damage"
  | "attack"
  | "defense"
  | "dodge"
  | "speed"
  | "critRate"
  | "critDamage"
  | "breakthrough"
  | "comprehension"
  | "meridianRepair"
  | "trading";

export type BuffValueType = "percentage" | "fixed" | "multiplier";

export interface BuffEffect {
  stat?: BuffTargetStat;
  valueType: BuffValueType;
  value: number;
  condition?: string;
  description?: string;
}

export interface Buff {
  id: string;
  name: string;
  category: BuffCategory;
  icon: string;
  durationType: BuffDurationType;
  duration?: number;
  stacks: number;
  maxStacks: number;
  effects: BuffEffect[];
  isDebuff: boolean;
  source?: string;
  description?: string;
  condition?: string;
}

export interface ShieldData {
  id: string;
  name: string;
  value: number;
  maxValue: number;
  source?: string;
}

export interface DamageResult {
  baseDamage: number;
  finalDamage: number;
  absorbedByShield: number;
  shieldRemaining: number;
  modifiers: {
    attackBonus: number;
    damageBonus: number;
    critMultiplier: number;
    specialBonus: number;
    armorReduction: number;
    directReduction: number;
    penetration: number;
  };
}

export interface HealingResult {
  baseHeal: number;
  finalHeal: number;
  modifiers: {
    healingBonus: number;
  };
}

export interface AttributeModifiers {
  vitality: number;
  soul: number;
  wisdom: number;
  agility: number;
  hp: number;
  mp: number;
  spirit: number;
  cultivation: number;
}

export interface CombatModifiers {
  attackPower: number;
  damageIncrease: number;
  damageReduction: number;
  critRate: number;
  critDamage: number;
  armor: number;
  directDamageReduction: number;
  dodgeRate: number;
  hitRate: number;
  cooldownReduction: number;
}

export interface CultivationModifiers {
  speedBonus: number;
  speedPenalty: number;
  qualityBonus: number;
  successRateBonus: number;
}

export interface ResourceModifiers {
  mpCostReduction: number;
  hpCostReduction: number;
  lifespanCostReduction: number;
}

export interface PenetrationModifiers {
  armorPenetration: number;
  resistancePenetration: number;
  absolutePenetration: boolean;
}

export interface RealmTier {
  name: string;
  stage: string;
  cultivationNeeded: number;
}

export interface SpiritRoot {
  element: ElementType;
  value: number;
  isVariant?: boolean;
}

export type MeridianZone = "head" | "chest" | "abdomen" | "arm_left" | "arm_right" | "leg_left" | "leg_right";

export interface Meridian {
  id: string;
  name: string;
  clarity: number;
  maxClarity: number;
  damage: boolean;
  zone: MeridianZone;
}

export interface PlayerStats {
  vitality: number;
  soul: number;
  wisdom: number;
  agility: number;
  heartScores: HeartScore[];
}

export interface TimelineEvent {
  year: string;
  title: string;
  detail: string;
}

export interface Player {
  name: string;
  title: string;
  sectName: string;
  position: string;
  realmIndex: number;
  realmStage: number;
  cultivation: number;
  lifespanCurrent: number;
  lifespanMax: number;
  hp: number;
  hpMax: number;
  mp: number;
  mpMax: number;
  spirit: number;
  spiritMax: number;
  spiritRoots: SpiritRoot[];
  stats: PlayerStats;
  meridians: Meridian[];
  body: string;
  fortune: string;
  karma: number;
  timeline: TimelineEvent[];
  background: string;
  buffs: Buff[];
  shields: ShieldData[];
  activeHeartTechnique: string | null;
}

export type ElementType = "金" | "木" | "水" | "火" | "土" | "风" | "雷" | "冰" | "暗";

export type TechniqueNature = "刚" | "柔" | "奇" | "毒" | "速" | "稳" | "幻" | "霸";

export interface TechniqueLevel {
  level: number;
  name: string;
  proficiencyNeeded: number;
  stats: Record<string, number>;
  skillUnlocked?: string;
}

export interface TechniqueSkill {
  id: string;
  name: string;
  description: string;
  levelRequired: number;
  mpCost: number;
  damage: number;
  cooldown: number;
  effects: BuffEffect[];
}

export interface TechniquePrerequisite {
  type: "realm" | "cultivation" | "technique" | "spiritRoot" | "heartTrait";
  value: string | number;
  minLevel?: number;
}

export interface HeartCompatibility {
  trait: HeartTrait;
  bonus: number;
}

export interface Technique {
  id: string;
  name: string;
  grade: ItemGrade;
  category: TechniqueCategory;
  daoPath: DaoPath;
  element: ElementType;
  nature: TechniqueNature;
  proficiency: number;
  proficiencyMax: number;
  insight: string;
  description: string;
  heartMatch: HeartTrait[];
  heartCompatibility: HeartCompatibility[];
  levels: TechniqueLevel[];
  skills: TechniqueSkill[];
  prerequisites: TechniquePrerequisite[];
  attributes: Record<string, number>;
  basePracticeSpeed: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  type: "材料" | "丹药" | "符箓" | "法宝" | "杂物";
  grade: ItemGrade;
  count: number;
  icon: string;
  desc: string;
  equipped?: boolean;
  slot?: "命" | "护" | "辅";
  elements?: Partial<Record<ElementType, number>>;
}

export interface SpiritStones {
  low: number;
  mid: number;
  high: number;
  supreme: number;
}

export interface TalismanRecipe {
  id: string;
  name: string;
  grade: ItemGrade;
  paperCost: number;
  cinnabarCost: number;
  successRate: number;
  mpCost: number;
  desc: string;
}

export interface AlchemyRecipe {
  id: string;
  name: string;
  grade: ItemGrade;
  herbs: { name: string; count: number }[];
  fireRange: [number, number];
  durationRange: [number, number];
  successRate: number;
  mpCost: number;
  output: string;
  desc: string;
  furnaceElements?: Partial<Record<ElementType, number>>;
}

export interface SectPosition {
  id: string;
  name: string;
  level: number;
  contributionNeeded: number;
  privilege: string;
  isCurrent?: boolean;
  unlocked?: boolean;
}

export interface SectTask {
  id: string;
  title: string;
  difficulty: "易" | "中" | "难" | "险";
  contribution: number;
  spiritStone: number;
  desc: string;
  accepted?: boolean;
}

export interface SectShopItem {
  id: string;
  name: string;
  cost: number;
  type: string;
  desc: string;
}

export interface SectHeritage {
  name: string;
  type: "功法" | "秘术" | "阵法" | "丹方" | "符箓";
  grade: ItemGrade;
  status: "已习" | "可习" | "未达";
}

export interface SectResource {
  name: string;
  amount: number;
  unit: string;
}

export interface Sect {
  name: string;
  level: number;
  reputation: number;
  leader: string;
  elders: number;
  disciples: number;
  territory: string;
  contribution: number;
  positions: SectPosition[];
  tasks: SectTask[];
  shop: SectShopItem[];
  heritage: SectHeritage[];
  resources: SectResource[];
}

export interface Relation {
  id: string;
  name: string;
  title: string;
  type: RelationType;
  affinity: number;
  affinityMax: number;
  realm: string;
  note: string;
}

export interface PillCacheEntry {
  name: string;
  grade: ItemGrade;
  desc: string;
  elements: Record<string, number>;
  outputCount: number;
}

export interface GameState {
  player: Player;
  techniques: Technique[];
  inventory: InventoryItem[];
  spiritStones: SpiritStones;
  talismanRecipes: TalismanRecipe[];
  alchemyRecipes: AlchemyRecipe[];
  sect: Sect;
  relations: Relation[];
  currentPanel: PanelId;
  craftingTab: CraftingTab;
  currentLocation: LocationType;
  log: string[];
  pillCache: Record<string, PillCacheEntry>;
}

// ===== AI 叙事系统类型 =====

export type DataOp =
  | { kind: "modify"; path: string; op: "=" | "+" | "-"; value: string }
  | { kind: "add"; collection: string; payload: string }
  | { kind: "delete"; collection: string; id: string };

export interface AISettings {
  baseUrl: string;
  apiKey: string;
  flashModel: string;
  proModel: string;
  temperature: number;
}

export type GenStage =
  | "idle"
  | "flash"
  | "pro"
  | "done"
  | "error";

export interface Turn {
  id: string;
  playerInput: string;
  flashPaths: string[];
  flashRaw: string;
  proRequest: {
    summary: string;
    recentTurns: { input: string; narrative: string }[];
    decision: string;
    relevantData: string;
  };
  narrative: string;
  ops: DataOp[];
  opsRaw: string;
  applied: boolean;
  snapshot: GameSnapshot | null;
  timestamp: number;
  error?: string;
}

export interface GameSnapshot {
  player: Player;
  techniques: Technique[];
  inventory: InventoryItem[];
  spiritStones: SpiritStones;
  sect: Sect;
  relations: Relation[];
  log: string[];
}

export interface ConversationState {
  turns: Turn[];
  summary: string;
  stage: GenStage;
  errorMsg: string;
  lastFlashDuration: number;
  lastProDuration: number;
}

export type NPCChatRole = "player" | "npc";

export interface NPCMessage {
  id: string;
  role: NPCChatRole;
  content: string;
  timestamp: number;
}

export interface NPCProfile {
  npcId: string;
  name: string;
  title: string;
  persona: string;
  initialPrompt: string;
  messages: NPCMessage[];
  lastUpdated: number;
}

export interface NPCChatState {
  profiles: NPCProfile[];
  activeNpcId: string | null;
  isTyping: boolean;
  errorMsg: string;
}
