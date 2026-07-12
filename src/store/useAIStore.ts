import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AISettings,
  ConversationState,
  GenStage,
  Turn,
  NPCChatState,
  NPCProfile,
  NPCMessage,
  BattleState,
  BattleMap,
  BattleEntity,
} from "@/data/types";
import { useGameStore } from "@/store/useGameStore";
import { chatWithModel } from "@/lib/aiClient";
import {
  buildDataSchema,
  buildFlashPrompt,
  buildProPrompt,
  buildCompressionPrompt,
  parseFlashPaths,
  resolveRelevantData,
} from "@/lib/promptBuilder";
import { parseModelOutput } from "@/lib/dataOps";
import {
  RECENT_WINDOW,
  clampSummary,
  needsCompression,
  recentForPrompt,
  splitForCompression,
} from "@/lib/contextCompressor";

const DEFAULT_SETTINGS: AISettings = {
  baseUrl: "https://api.deepseek.com/v1",
  apiKey: "",
  flashModel: "deepseek-chat",
  proModel: "deepseek-chat",
  temperature: 0.85,
};

const INITIAL_CONVERSATION: ConversationState = {
  turns: [],
  summary: "",
  stage: "idle",
  errorMsg: "",
  lastFlashDuration: 0,
  lastProDuration: 0,
  lastRawOutput: "",
  quickDecisions: [],
};

const INITIAL_NPC_CHAT: NPCChatState = {
  profiles: [],
  activeNpcId: null,
  isTyping: false,
  errorMsg: "",
};

const INITIAL_BATTLE: BattleState = {
  isActive: false,
  map: {
    width: 10,
    height: 10,
    entities: [],
  },
  round: 1,
  turn: "player",
  narrative: "",
  isResolving: false,
  errorMsg: "",
  context: [],
};

interface AIStore {
  settings: AISettings;
  conversation: ConversationState;
  npcChat: NPCChatState;
  battle: BattleState;
  isDeveloperMode: boolean;
  isCraftingOpen: boolean;
  updateSettings: (patch: Partial<AISettings>) => void;
  runTurn: (decision: string) => Promise<void>;
  regenerate: () => Promise<void>;
  compressNow: () => Promise<void>;
  clearConversation: () => void;
  cancel: () => void;
  setStage: (stage: GenStage, msg?: string) => void;

  setDeveloperMode: (enabled: boolean) => void;
  openCrafting: () => void;
  closeCrafting: () => void;

  getOrCreateNPCProfile: (npcId: string, name: string, title: string) => Promise<NPCProfile>;
  sendNPCMessage: (npcId: string, content: string) => Promise<void>;
  openNPCChat: (npcId: string) => void;
  closeNPCChat: () => void;
  clearNPCChat: (npcId: string) => void;

  startBattle: (map?: BattleMap) => void;
  endBattle: () => void;
  setBattleNarrative: (narrative: string) => void;
  updateBattleMap: (entities: BattleEntity[]) => void;
  runBattleTurn: (action: string) => Promise<void>;
}

let abortController: AbortController | null = null;

export const useAIStore = create<AIStore>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      conversation: INITIAL_CONVERSATION,
      npcChat: INITIAL_NPC_CHAT,
      battle: INITIAL_BATTLE,
      isDeveloperMode: false,
      isCraftingOpen: false,

      updateSettings: (patch) =>
        set((st) => ({ settings: { ...st.settings, ...patch } })),

      setStage: (stage, msg = "") =>
        set((st) => ({
          conversation: { ...st.conversation, stage, errorMsg: msg },
        })),

      cancel: () => {
        if (abortController) {
          abortController.abort();
          abortController = null;
        }
        set((st) => ({
          conversation: {
            ...st.conversation,
            stage: "idle",
            errorMsg: "已取消生成。",
          },
          npcChat: {
            ...st.npcChat,
            isTyping: false,
            errorMsg: "已取消生成。",
          },
        }));
      },

      setDeveloperMode: (enabled) =>
        set({ isDeveloperMode: enabled }),

      openCrafting: () =>
        set({ isCraftingOpen: true }),

      closeCrafting: () =>
        set({ isCraftingOpen: false }),

      runTurn: async (decision) => {
        const trimmed = decision.trim();
        if (!trimmed) return;
        const { settings } = get();
        if (!settings.apiKey) {
          set((st) => ({
            conversation: {
              ...st.conversation,
              stage: "error",
              errorMsg: "尚未配置 API Key，请先点击右上角设置按钮填写。",
            },
          }));
          return;
        }

        abortController = new AbortController();
        const signal = abortController.signal;

        const game = useGameStore.getState();
        const gameState: import("@/data/types").GameState = {
          player: game.player,
          techniques: game.techniques,
          inventory: game.inventory,
          spiritStones: game.spiritStones,
          talismanRecipes: game.talismanRecipes,
          alchemyRecipes: game.alchemyRecipes,
          sect: game.sect,
          relations: game.relations,
          currentPanel: game.currentPanel,
          craftingTab: game.craftingTab,
          currentLocation: game.currentLocation,
          log: game.log,
          news: game.news,
          pillCache: game.pillCache,
        };

        const snapshot = game.getSnapshot();
        const conv = get().conversation;

        // ===== Stage 1: flash 判断相关数据 =====
        set((st) => ({
          conversation: { ...st.conversation, stage: "flash", errorMsg: "" },
        }));
        let flashPaths: string[] = [];
        let flashRaw = "";
        try {
          const schema = buildDataSchema(gameState);
          const flashStart = Date.now();
          flashRaw = await chatWithModel(
            settings,
            settings.flashModel,
            buildFlashPrompt(trimmed, schema),
            { timeoutMs: 30000, signal },
          );
          flashPaths = parseFlashPaths(flashRaw);
          set((st) => ({
            conversation: {
              ...st.conversation,
              lastFlashDuration: Date.now() - flashStart,
            },
          }));
        } catch (e) {
          if (signal.aborted) return;
          const errorMsg = (e as Error).message;
          const isNetworkError = errorMsg.includes("网络") || errorMsg.includes("CORS") ||
            errorMsg.includes("请求超时") || errorMsg.includes("不可达");
          set((st) => ({
            conversation: {
              ...st.conversation,
              stage: "error",
              errorMsg: isNetworkError
                ? `网络连接失败：${errorMsg}\n请检查网络连接或在设置中更换Base URL。`
                : `数据判断失败：${errorMsg}`,
            },
          }));
          abortController = null;
          return;
        }

        const isFirstTurn = conv.turns.length === 0;
        const relevantData = isFirstTurn
          ? buildDataSchema(gameState)
          : resolveRelevantData(gameState, flashPaths);
        const recentTurns = recentForPrompt(conv.turns);
        const proRequest = {
          summary: conv.summary,
          recentTurns,
          decision: trimmed,
          relevantData,
        };

        // ===== Stage 2: pro 生成叙事 + 数据 =====
        set((st) => ({
          conversation: { ...st.conversation, stage: "pro" },
        }));
        let narrative = "";
        let ops: import("@/data/types").DataOp[] = [];
        let opsRaw = "";
        try {
          const proStart = Date.now();
          const proRaw = await chatWithModel(
            settings,
            settings.proModel,
            buildProPrompt({
              state: gameState,
              summary: conv.summary,
              recentTurns,
              decision: trimmed,
              relevantData,
            }),
            { timeoutMs: 120000, signal },
          );
          const parsed = parseModelOutput(proRaw);
          narrative = parsed.narrative;
          ops = parsed.ops;
          opsRaw = parsed.opsRaw;

          if (parsed.mode && (parsed.mode.includes("crafting") || parsed.mode.includes("制作百艺"))) {
            set({ isCraftingOpen: true });
          }

          set((st) => ({
            conversation: {
              ...st.conversation,
              lastProDuration: Date.now() - proStart,
              lastRawOutput: proRaw,
              quickDecisions: parsed.quickDecisions,
            },
          }));
        } catch (e) {
          if (signal.aborted) return;
          const errorMsg = (e as Error).message;
          const isNetworkError = errorMsg.includes("网络") || errorMsg.includes("CORS") ||
            errorMsg.includes("请求超时") || errorMsg.includes("不可达");
          set((st) => ({
            conversation: {
              ...st.conversation,
              stage: "error",
              errorMsg: isNetworkError
                ? `网络连接失败：${errorMsg}\n请检查网络连接或在设置中更换Base URL。`
                : `叙事生成失败：${errorMsg}`,
            },
          }));
          abortController = null;
          return;
        }

        useGameStore.getState().applyOps(ops);

        const turn: Turn = {
          id: `turn-${Date.now()}`,
          playerInput: trimmed,
          flashPaths,
          flashRaw: flashRaw.slice(0, 2000),
          proRequest: {
            summary: proRequest.summary,
            recentTurns: proRequest.recentTurns,
            decision: proRequest.decision,
            relevantData: proRequest.relevantData.slice(0, 3000),
          },
          narrative: narrative.slice(0, 20000),
          ops: ops.slice(0, 100),
          opsRaw: opsRaw.slice(0, 5000),
          applied: true,
          snapshot,
          timestamp: Date.now(),
        };

        await new Promise<void>((resolve) => queueMicrotask(() => resolve()));

        set((st) => ({
          conversation: {
            ...st.conversation,
            turns: [...st.conversation.turns, turn],
            stage: "done",
            errorMsg: "",
          },
        }));
        abortController = null;

        await get().compressNow();
      },

      regenerate: async () => {
        const { conversation, settings } = get();
        if (conversation.stage === "flash" || conversation.stage === "pro") return;
        const lastTurn = conversation.turns[conversation.turns.length - 1];
        if (!lastTurn) return;
        if (!settings.apiKey) {
          set((st) => ({
            conversation: {
              ...st.conversation,
              stage: "error",
              errorMsg: "尚未配置 API Key。",
            },
          }));
          return;
        }
        if (!lastTurn.snapshot) {
          set((st) => ({
            conversation: {
              ...st.conversation,
              stage: "error",
              errorMsg: "缺少回合快照，无法回滚后重新生成。",
            },
          }));
          return;
        }

        abortController = new AbortController();
        const signal = abortController.signal;

        useGameStore.getState().restoreSnapshot(lastTurn.snapshot);

        await new Promise<void>((resolve) => queueMicrotask(() => resolve()));

        set((st) => ({
          conversation: { ...st.conversation, stage: "pro", errorMsg: "" },
        }));

        try {
          const proRaw = await chatWithModel(
            settings,
            settings.proModel,
            buildProPrompt({
              state: useGameStore.getState().getSnapshot() as any,
              summary: lastTurn.proRequest.summary,
              recentTurns: lastTurn.proRequest.recentTurns,
              decision: lastTurn.proRequest.decision,
              relevantData: lastTurn.proRequest.relevantData,
            }),
            { timeoutMs: 120000, signal },
          );
          if (signal.aborted) return;
          const parsed = parseModelOutput(proRaw);
          useGameStore.getState().applyOps(parsed.ops);

          await new Promise<void>((resolve) => queueMicrotask(() => resolve()));

          set((st) => {
            const turns = [...st.conversation.turns];
            turns[turns.length - 1] = {
              ...lastTurn,
              narrative: parsed.narrative.slice(0, 20000),
              ops: parsed.ops.slice(0, 100),
              opsRaw: parsed.opsRaw.slice(0, 5000),
              applied: true,
              timestamp: Date.now(),
            };
            return {
              conversation: {
                ...st.conversation,
                turns,
                quickDecisions: parsed.quickDecisions,
                stage: "done",
                lastRawOutput: proRaw,
              },
            };
          });
        } catch (e) {
          if (signal.aborted) return;
          set((st) => ({
            conversation: {
              ...st.conversation,
              stage: "error",
              errorMsg: `重新生成失败：${(e as Error).message}`,
            },
          }));
        }
        abortController = null;
      },

      compressNow: async () => {
        const { conversation, settings } = get();
        if (!needsCompression(conversation.turns)) return;
        const { oldTurns, recentTurns } = splitForCompression(conversation.turns);
        if (oldTurns.length === 0) return;

        try {
          const oldSummary = conversation.summary;
          const turnsData = oldTurns.map((t) => ({
            input: t.playerInput,
            narrative: t.narrative,
          }));
          const compressed = await chatWithModel(
            settings,
            settings.flashModel,
            buildCompressionPrompt(oldSummary, turnsData),
            { timeoutMs: 30000 },
          );
          set((st) => ({
            conversation: {
              ...st.conversation,
              turns: recentTurns,
              summary: clampSummary(compressed.trim()),
            },
          }));
        } catch (e) {
          console.warn("[compress] 压缩失败，保留原状:", e);
        }
      },

      clearConversation: () => {
        if (abortController) {
          abortController.abort();
          abortController = null;
        }
        set({ conversation: INITIAL_CONVERSATION });
      },

      getOrCreateNPCProfile: async (npcId, name, title) => {
        const { npcChat, settings } = get();
        const existing = npcChat.profiles.find((p) => p.npcId === npcId);
        if (existing) return existing;

        if (!settings.apiKey) {
          throw new Error("尚未配置 API Key。");
        }

        try {
          const player = useGameStore.getState().player;
          const relation = useGameStore.getState().relations.find((r) => r.id === npcId);
          const affinity = relation?.affinity ?? 50;

          const prompt = [
            {
              role: "system" as const,
              content: `你是一位修真界的人物设定专家。请为以下 NPC 生成详细的人设提示词。

NPC 信息：
姓名：${name}
称号：${title}
与玩家关系：${relation?.note || "暂无"}
好感度：${affinity}/100

玩家信息：
姓名：${player.name}
道号：${player.title}
境界：${player.realmIndex === 0 ? "炼气初期" : player.realmIndex === 1 ? "筑基期" : "金丹期"}
宗门：${player.sectName}

请生成：
1. 性格特点（50字以内）
2. 说话风格（30字以内）
3. 背景故事（100字以内）

格式要求：
PERSONA: [性格特点]
STYLE: [说话风格]
BACKGROUND: [背景故事]`,
            },
          ];

          const raw = await chatWithModel(settings, settings.flashModel, prompt, {
            timeoutMs: 30000,
          });

          let persona = "";
          let style = "";
          let background = "";

          const personaMatch = raw.match(/PERSONA:\s*(.+)/);
          const styleMatch = raw.match(/STYLE:\s*(.+)/);
          const backgroundMatch = raw.match(/BACKGROUND:\s*(.+)/);

          if (personaMatch) persona = personaMatch[1].trim();
          if (styleMatch) style = styleMatch[1].trim();
          if (backgroundMatch) background = backgroundMatch[1].trim();

          if (!persona) {
            persona = `${title}，性格沉稳，处事有度。`;
          }
          if (!style) {
            style = "语气平和，言辞简练，偶尔引经据典。";
          }

          const initialPrompt = `你是修真者「${name}」，称号「${title}」。

【性格】${persona}
【说话风格】${style}
${background ? `【背景】${background}\n` : ""}
你正在与「${player.name}」（${player.title}）交谈。请以你的身份回复对方的话语，保持角色一致性。`;

          const profile: NPCProfile = {
            npcId,
            name,
            title,
            persona,
            initialPrompt,
            messages: [],
            lastUpdated: Date.now(),
          };

          set((st) => ({
            npcChat: {
              ...st.npcChat,
              profiles: [...st.npcChat.profiles, profile],
            },
          }));

          return profile;
        } catch (e) {
          throw new Error(`生成人设失败：${(e as Error).message}`);
        }
      },

      sendNPCMessage: async (npcId, content) => {
        const { npcChat, conversation, settings } = get();
        if (!settings.apiKey) {
          set((st) => ({
            npcChat: { ...st.npcChat, errorMsg: "尚未配置 API Key。" },
          }));
          return;
        }

        const profile = npcChat.profiles.find((p) => p.npcId === npcId);
        if (!profile) {
          set((st) => ({
            npcChat: { ...st.npcChat, errorMsg: "未找到该 NPC 的人设信息。" },
          }));
          return;
        }

        abortController = new AbortController();
        const signal = abortController.signal;

        set((st) => ({
          npcChat: { ...st.npcChat, isTyping: true, errorMsg: "" },
        }));

        const playerMsg: NPCMessage = {
          id: `msg-${Date.now()}`,
          role: "player",
          content: content.trim(),
          timestamp: Date.now(),
        };

        set((st) => ({
          npcChat: {
            ...st.npcChat,
            profiles: (Array.isArray(st.npcChat.profiles) ? st.npcChat.profiles : []).map((p) =>
              p.npcId === npcId
                ? { ...p, messages: [...(Array.isArray(p.messages) ? p.messages : []), playerMsg], lastUpdated: Date.now() }
                : p,
            ),
          },
        }));

        try {
          const recentStoryTurns = recentForPrompt(conversation.turns);
          const storyContext = recentStoryTurns
            .map((t) => `玩家：${t.input}\n叙述：${t.narrative.slice(0, 100)}`)
            .join("\n---\n");

          const recentMessages = (Array.isArray(profile.messages) ? profile.messages : []).slice(-8);
          const chatHistory = recentMessages
            .map((m) => `${m.role === "player" ? "玩家" : profile.name}：${m.content}`)
            .join("\n");

          const location = useGameStore.getState().currentLocation;
          const locationNames: Record<string, string> = {
            home: "住所",
            alchemy_room: "炼丹房",
            forge_room: "炼器室",
            meditation_room: "闭关室",
            market: "集市",
            library: "藏经阁",
            training_ground: "演武场",
            outdoor: "野外",
          };

          const prompt = [
            {
              role: "system" as const,
              content: `${profile.initialPrompt}

【当前剧情上下文】：
${conversation.summary || "暂无"}
${storyContext || "暂无"}

【玩家当前所在】：${locationNames[location] || location}

【本次对话记录】：
${chatHistory || "暂无"}`,
            },
            {
              role: "user" as const,
              content: content.trim(),
            },
          ];

          const raw = await chatWithModel(settings, settings.proModel, prompt, {
            timeoutMs: 120000,
            signal,
          });

          if (signal.aborted) return;

          const npcMsg: NPCMessage = {
            id: `msg-${Date.now()}`,
            role: "npc",
            content: raw.trim(),
            timestamp: Date.now(),
          };

          set((st) => ({
            npcChat: {
              ...st.npcChat,
              isTyping: false,
              profiles: (Array.isArray(st.npcChat.profiles) ? st.npcChat.profiles : []).map((p) =>
                p.npcId === npcId
                  ? { ...p, messages: [...(Array.isArray(p.messages) ? p.messages : []), npcMsg], lastUpdated: Date.now() }
                  : p,
              ),
            },
          }));
        } catch (e) {
          if (signal.aborted) return;
          const errorMsg = (e as Error).message;
          const isNetworkError = errorMsg.includes("网络") || errorMsg.includes("CORS") ||
            errorMsg.includes("请求超时") || errorMsg.includes("不可达");
          set((st) => ({
            npcChat: {
              ...st.npcChat,
              isTyping: false,
              errorMsg: isNetworkError
                ? `网络连接失败：${errorMsg}\n请检查网络连接或在设置中更换Base URL。`
                : `发送失败：${errorMsg}`,
            },
          }));
        }
        abortController = null;
      },

      openNPCChat: (npcId) => {
        set((st) => ({
          npcChat: { ...st.npcChat, activeNpcId: npcId },
        }));
      },

      closeNPCChat: () => {
        set((st) => ({
          npcChat: { ...st.npcChat, activeNpcId: null, isTyping: false, errorMsg: "" },
        }));
      },

      clearNPCChat: (npcId) => {
        set((st) => ({
          npcChat: {
            ...st.npcChat,
            profiles: (Array.isArray(st.npcChat.profiles) ? st.npcChat.profiles : []).map((p) =>
              p.npcId === npcId ? { ...p, messages: [], lastUpdated: Date.now() } : p,
            ),
          },
        }));
      },

      startBattle: (map) => {
        set((st) => ({
          battle: {
            ...st.battle,
            isActive: true,
            map: map || {
              width: 10,
              height: 10,
              entities: [],
            },
            round: 1,
            turn: "player",
            narrative: "",
            isResolving: false,
            errorMsg: "",
            context: [],
          },
        }));
      },

      endBattle: () => {
        set((st) => ({
          battle: {
            ...INITIAL_BATTLE,
            isActive: false,
          },
        }));
      },

      setBattleNarrative: (narrative) => {
        set((st) => ({
          battle: {
            ...st.battle,
            narrative,
          },
        }));
      },

      updateBattleMap: (entities) => {
        set((st) => ({
          battle: {
            ...st.battle,
            map: {
              ...st.battle.map,
              entities,
            },
          },
        }));
      },

      runBattleTurn: async (action) => {
        const { battle, settings } = get();
        if (!settings.apiKey) {
          set((st) => ({
            battle: {
              ...st.battle,
              errorMsg: "尚未配置 API Key。",
            },
          }));
          return;
        }

        set((st) => ({
          battle: {
            ...st.battle,
            isResolving: true,
            errorMsg: "",
          },
        }));

        try {
          const player = useGameStore.getState().player;
          const battleState = get().battle;

          const inventory = Array.isArray(useGameStore.getState().inventory) ? useGameStore.getState().inventory : [];
          const techniques = Array.isArray(useGameStore.getState().techniques) ? useGameStore.getState().techniques : [];
          const playerWeapons = inventory.filter((i) => i.type === "法宝");
          const playerTalismans = inventory.filter((i) => i.type === "符箓");
          const playerPills = inventory.filter((i) => i.type === "丹药");

          const prompt: import("@/lib/aiClient").ChatMessage[] = [
            {
              role: "system" as const,
              content: `你是一个仙侠战斗模拟器。当前处于战斗模式，地图为10x10瓦片。

当前战斗状态：
- 回合：${battleState.round}
- 当前行动方：${battleState.turn}
- 玩家状态：气血=${player.hp}/${player.hpMax}，灵力=${player.mp}/${player.mpMax}
- 玩家属性：体魄=${player.stats.vitality}，神魂=${player.stats.soul}，悟性=${player.stats.wisdom}，身法=${player.stats.agility}
- 玩家境界：${player.cultivation}
- 玩家法宝：${playerWeapons.map((w) => `${w.name}(${w.grade})`).join(", ") || "无"}
- 当前功法：${techniques.map((t) => `${t.name}(${t.grade})：${t.description}`).join("；") || "无"}
- 当前心法：${player.activeHeartTechnique ? techniques.find((t) => t.id === player.activeHeartTechnique)?.name || player.activeHeartTechnique : "无"}
- 玩家符箓：${playerTalismans.map((t) => `${t.name}(${t.count}张)`).join(", ") || "无"}
- 玩家丹药：${playerPills.map((p) => `${p.name}(${p.count}颗)`).join(", ") || "无"}
- 地图实体：${JSON.stringify(battleState.map.entities)}

战斗上下文：
${battleState.context.join("\n")}

玩家行动：${action}

请根据玩家的行动、属性、法宝、功法、符箓和丹药，判断行动可行性并返回：
1. 战斗叙事文本
2. 数据操作（增减气血、灵力、buff等）
3. 更新后的实体位置

输出格式：
<<<BATTLE>>>
-- narrative: 战斗叙事文本
-- entities: [{"id":"player","name":"玩家","type":"player","position":{"x":5,"y":5},"hp":100,"maxHp":100},{"id":"enemy1","name":"妖兽","type":"enemy","position":{"x":7,"y":5},"hp":80,"maxHp":100}]
<<<OPS>>>
MODIFY player.hp - 20
MODIFY player.mp - 10
<<<END>>>`,
            },
            {
              role: "user" as const,
              content: action,
            },
          ];

          const raw = await chatWithModel(
            settings,
            settings.proModel,
            prompt,
            { timeoutMs: 60000 },
          );

          const parsed = parseModelOutput(raw);

          if (parsed.ops.length > 0) {
            useGameStore.getState().applyOps(parsed.ops);
          }

          const isPlayerTurn = get().battle.turn === "player";
          const allEnemiesDead = parsed.battleEntities?.every(
            e => e.type === "enemy" && e.isDead
          ) ?? false;
          const playerDead = parsed.battleEntities?.find(
            e => e.type === "player" && e.isDead
          ) ?? false;

          const actionContext = `回合${battleState.round} ${battleState.turn === "player" ? "玩家" : "敌人"}行动：${action}`;
          const resultContext = parsed.narrative ? `结果：${parsed.narrative}` : "";

          set((st) => {
            const nextTurn: "player" | "enemy" = isPlayerTurn ? "enemy" : "player";
            const newContext = [...st.battle.context, actionContext, resultContext].slice(-20);
            return {
              battle: {
                ...st.battle,
                isResolving: false,
                turn: nextTurn,
                round: !isPlayerTurn ? st.battle.round + 1 : st.battle.round,
                narrative: parsed.narrative || st.battle.narrative,
                map: parsed.battleEntities && parsed.battleEntities.length > 0
                  ? { ...st.battle.map, entities: parsed.battleEntities }
                  : st.battle.map,
                isActive: !(allEnemiesDead || playerDead),
                context: newContext,
              },
            };
          });
        } catch (e) {
          const errorMsg = (e as Error).message;
          const isNetworkError = errorMsg.includes("网络") || errorMsg.includes("CORS") ||
            errorMsg.includes("请求超时") || errorMsg.includes("不可达");
          set((st) => ({
            battle: {
              ...st.battle,
              isResolving: false,
              errorMsg: isNetworkError
                ? `网络连接失败：${errorMsg}\n请检查网络连接或在设置中更换Base URL。`
                : errorMsg,
            },
          }));
        }
      },
    }),
    {
      name: "xiuxian-ai",
      version: 2,
      migrate: (state: any, version: number) => {
        if (version < 1) {
          if (state.conversation && !Array.isArray(state.conversation.turns)) {
            state.conversation.turns = [];
          }
          if (state.npcChat && state.npcChat.profiles) {
            if (!Array.isArray(state.npcChat.profiles)) {
              state.npcChat.profiles = [];
            } else {
              state.npcChat.profiles.forEach((p: any) => {
                if (!Array.isArray(p.messages)) {
                  p.messages = [];
                }
              });
            }
          }
          if (state.battle && state.battle.map && !Array.isArray(state.battle.map.entities)) {
            state.battle.map.entities = [];
          }
          if (state.battle && !Array.isArray(state.battle.context)) {
            state.battle.context = [];
          }
        }
        if (version < 2) {
          if (state.conversation && Array.isArray(state.conversation.turns)) {
            state.conversation.turns = state.conversation.turns
              .slice(-4)
              .map((t: any) => ({
                ...t,
                snapshot: null,
                flashRaw: "",
                opsRaw: "",
                proRequest: {
                  summary: t.proRequest?.summary || "",
                  recentTurns: [],
                  decision: t.proRequest?.decision || "",
                  relevantData: "",
                },
              }));
          }
          if (state.npcChat && Array.isArray(state.npcChat.profiles)) {
            state.npcChat.profiles = state.npcChat.profiles
              .slice(-5)
              .map((p: any) => ({
                ...p,
                messages: Array.isArray(p.messages) ? p.messages.slice(-20) : [],
              }));
          }
          if (state.battle) {
            state.battle.context = [];
          }
        }
        return state;
      },
      partialize: (s) => ({
        settings: s.settings,
        conversation: {
          ...s.conversation,
          turns: (Array.isArray(s.conversation.turns) ? s.conversation.turns : [])
            .slice(-4)
            .map((t) => ({
              ...t,
              snapshot: null,
              flashRaw: "",
              opsRaw: "",
              proRequest: {
                summary: t.proRequest?.summary || "",
                recentTurns: [],
                decision: t.proRequest?.decision || "",
                relevantData: "",
              },
            })),
        },
        npcChat: {
          ...s.npcChat,
          profiles: (Array.isArray(s.npcChat.profiles) ? s.npcChat.profiles : [])
            .slice(-5)
            .map((p) => ({
              ...p,
              messages: (Array.isArray(p.messages) ? p.messages : []).slice(-20),
            })),
        },
        battle: { ...s.battle, context: [] },
        isDeveloperMode: s.isDeveloperMode,
      }),
    },
  ),
);

export { RECENT_WINDOW };
