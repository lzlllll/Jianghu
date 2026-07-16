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
  CraftingResult,
  CraftingContext,
} from "@/data/types";
import { useGameStore } from "@/store/useGameStore";
import { chatWithModel, type ChatMessage } from "@/lib/aiClient";
import {
  buildDataSchema,
  buildFlashPrompt,
  buildProPrompt,
  buildCompressionPrompt,
  parseFlashPaths,
  parseFlashCrafting,
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
  flashModel: "deepseek-v4-flash",
  proModel: "deepseek-v4-pro",
  temperature: 0.85,
  customPrompt: "",
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
  pendingChatSummary: "",
  pendingCrafting: null,
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
  restoreConversation: (conv: ConversationState) => void;
  cancel: () => void;
  setStage: (stage: GenStage, msg?: string) => void;

  setDeveloperMode: (enabled: boolean) => void;
  openCrafting: () => void;
  closeCrafting: () => void;
  resumeTurnAfterCrafting: (result: CraftingResult) => Promise<void>;

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
            pendingCrafting: null,
          },
          isCraftingOpen: false,
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

      closeCrafting: () => {
        const { pendingCrafting } = get().conversation;
        if (pendingCrafting) {
          set((st) => ({
            isCraftingOpen: false,
            conversation: {
              ...st.conversation,
              stage: "idle",
              pendingCrafting: null,
              errorMsg: "",
            },
          }));
        } else {
          set({ isCraftingOpen: false });
        }
      },

      resumeTurnAfterCrafting: async (result) => {
        const { settings, conversation } = get();
        const ctx = conversation.pendingCrafting;
        if (!ctx) return;
        if (!settings.apiKey) {
          set((st) => ({
            conversation: { ...st.conversation, stage: "error", errorMsg: "尚未配置 API Key。" },
          }));
          return;
        }

        abortController = new AbortController();
        const signal = abortController.signal;

        const gameState = useGameStore.getState().getSnapshot() as any;
        const summary = conversation.summary;

        set((st) => ({
          conversation: { ...st.conversation, stage: "pro", errorMsg: "" },
          isCraftingOpen: false,
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
              summary,
              recentTurns: ctx.recentTurns,
              decision: ctx.decision,
              relevantData: ctx.relevantData,
              chatSummary: ctx.chatSummary,
              craftingResult: result,
              customPrompt: settings.customPrompt,
            }),
            { timeoutMs: 300000, signal, retries: 2 },
          );
          if (signal.aborted) return;
          const parsed = parseModelOutput(proRaw);
          narrative = parsed.narrative;
          ops = parsed.ops;
          opsRaw = parsed.opsRaw;

          if (ops.length === 0 && narrative.trim().length > 0 && !signal.aborted) {
            console.warn("[resumeCrafting] Pro模型未输出OPS块，尝试从叙事中提取...");
            try {
              const dataSchema = buildDataSchema(gameState);
              const extractPrompt: ChatMessage[] = [
                {
                  role: "system",
                  content: `你是一个数据提取助手。请分析叙事中发生的数据变化，以游戏数据操作格式输出。

输出格式：
<<<OPS>>>
MODIFY player.hp - 10
MODIFY currentTime.hour = 6
<<<END>>>

重要：丹药/符箓已通过制作系统入库，不要输出ADD该物品的操作。仅输出其他数据变化（灵力消耗、时间推进、修为变化等）。

参考当前游戏状态：
${dataSchema}`,
                },
                {
                  role: "user",
                  content: `请从以下叙事中提取数据操作（排除丹药/符箓的ADD）：\n\n${narrative.slice(0, 8000)}`,
                },
              ];
              const extractRaw = await chatWithModel(
                settings,
                settings.flashModel,
                extractPrompt,
                { timeoutMs: 30000, signal, retries: 1 },
              );
              const extractParsed = parseModelOutput(extractRaw);
              if (extractParsed.ops.length > 0) {
                ops = extractParsed.ops;
                opsRaw = extractParsed.opsRaw;
              }
            } catch (extractErr) {
              console.warn("[resumeCrafting] OPS回退提取失败:", extractErr);
            }
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
            errorMsg.includes("请求超时") || errorMsg.includes("不可达") || errorMsg.includes("重试");

          if (isNetworkError && settings.proModel !== settings.flashModel) {
            console.warn("[resumeCrafting] Pro模型失败，降级Flash...");
            try {
              const proStart = Date.now();
              const proRaw = await chatWithModel(
                settings,
                settings.flashModel,
                buildProPrompt({
                  state: gameState,
                  summary,
                  recentTurns: ctx.recentTurns,
                  decision: ctx.decision,
                  relevantData: ctx.relevantData,
                  chatSummary: ctx.chatSummary,
                  craftingResult: result,
                  customPrompt: settings.customPrompt,
                }),
                { timeoutMs: 300000, signal, retries: 2 },
              );
              const parsed = parseModelOutput(proRaw);
              narrative = parsed.narrative;
              ops = parsed.ops;
              opsRaw = parsed.opsRaw;
              set((st) => ({
                conversation: {
                  ...st.conversation,
                  lastProDuration: Date.now() - proStart,
                  lastRawOutput: proRaw,
                  quickDecisions: parsed.quickDecisions,
                },
              }));
            } catch (fallbackErr) {
              set((st) => ({
                conversation: {
                  ...st.conversation,
                  stage: "error",
                  pendingCrafting: null,
                  errorMsg: `叙事生成失败：${(fallbackErr as Error).message}`,
                },
              }));
              abortController = null;
              return;
            }
          } else {
            set((st) => ({
              conversation: {
                ...st.conversation,
                stage: "error",
                pendingCrafting: null,
                errorMsg: `叙事生成失败：${errorMsg}`,
              },
            }));
            abortController = null;
            return;
          }
        }

        useGameStore.getState().applyOps(ops);

        const turn: Turn = {
          id: `turn-${Date.now()}`,
          playerInput: ctx.decision,
          flashPaths: ctx.flashPaths,
          flashRaw: ctx.flashRaw,
          proRequest: {
            summary,
            recentTurns: ctx.recentTurns,
            decision: ctx.decision,
            relevantData: ctx.relevantData.slice(0, 3000),
          },
          narrative: narrative.slice(0, 20000),
          ops: ops.slice(0, 100),
          opsRaw: opsRaw.slice(0, 5000),
          applied: true,
          snapshot: gameState,
          timestamp: Date.now(),
        };

        await new Promise<void>((resolve) => queueMicrotask(() => resolve()));

        set((st) => ({
          conversation: {
            ...st.conversation,
            turns: [...st.conversation.turns, turn],
            stage: "done",
            errorMsg: "",
            pendingChatSummary: "",
            pendingCrafting: null,
          },
        }));
        abortController = null;

        await get().compressNow();
      },

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
          currentTime: game.currentTime,
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
            { timeoutMs: 30000, signal, retries: 1 },
          );
          flashPaths = parseFlashPaths(flashRaw);
          const craftingType = parseFlashCrafting(flashRaw);
          set((st) => ({
            conversation: {
              ...st.conversation,
              lastFlashDuration: Date.now() - flashStart,
            },
          }));

          // 检测到炼丹/画符制作意图，暂停推演等待玩家操作
          if (craftingType) {
            const isFirstTurnForCrafting = conv.turns.length === 0;
            const relevantDataForCrafting = isFirstTurnForCrafting
              ? buildDataSchema(gameState)
              : resolveRelevantData(gameState, flashPaths);
            const recentTurnsForCrafting = recentForPrompt(conv.turns);
            const chatSummaryForCrafting = conv.pendingChatSummary || undefined;

            const craftingContext: CraftingContext = {
              decision: trimmed,
              flashPaths,
              flashRaw: flashRaw.slice(0, 2000),
              relevantData: relevantDataForCrafting,
              recentTurns: recentTurnsForCrafting,
              chatSummary: chatSummaryForCrafting,
              craftingType,
            };

            set((st) => ({
              conversation: {
                ...st.conversation,
                stage: "crafting_wait",
                pendingCrafting: craftingContext,
              },
              isCraftingOpen: true,
            }));
            useGameStore.getState().setCraftingTab(craftingType);
            return;
          }
        } catch (e) {
          if (signal.aborted) return;
          const errorMsg = (e as Error).message;
          const isNetworkError = errorMsg.includes("网络") || errorMsg.includes("CORS") ||
            errorMsg.includes("请求超时") || errorMsg.includes("不可达") || errorMsg.includes("重试");
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
        const chatSummary = conv.pendingChatSummary || undefined;
        const proRequest = {
          summary: conv.summary,
          recentTurns,
          decision: trimmed,
          relevantData,
          chatSummary,
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
              chatSummary,
              customPrompt: settings.customPrompt,
            }),
            { timeoutMs: 120000, signal, retries: 2 },
          );
          const parsed = parseModelOutput(proRaw);
          narrative = parsed.narrative;
          ops = parsed.ops;
          opsRaw = parsed.opsRaw;

          // 回退机制：Pro 模型未输出 OPS 块时，用 Flash 从叙事中提取数据变更
          if (ops.length === 0 && narrative.trim().length > 0 && !signal.aborted) {
            console.warn("[runTurn] Pro模型未输出OPS块，尝试从叙事中提取数据变更...");
            try {
              const dataSchema = buildDataSchema(gameState);
              const extractPrompt: ChatMessage[] = [
                {
                  role: "system",
                  content: `你是一个数据提取助手。以下是一段修仙游戏的叙事文本。请仔细分析叙事中发生了哪些数据变化（修为增减、气血波动、物品得失、时间推移等），以游戏数据操作格式输出。

输出格式：
<<<OPS>>>
MODIFY player.hp - 10
MODIFY player.cultivation + 50
MODIFY currentTime.hour = 6
<<<END>>>

叙事中明确发生的变化才需要输出，没有发生的不要编造。

参考当前游戏状态：
${dataSchema}`,
                },
                {
                  role: "user",
                  content: `请从以下叙事中提取数据操作：\n\n${narrative.slice(0, 8000)}`,
                },
              ];
              const extractRaw = await chatWithModel(
                settings,
                settings.flashModel,
                extractPrompt,
                { timeoutMs: 30000, signal, retries: 1 },
              );
              const extractParsed = parseModelOutput(extractRaw);
              if (extractParsed.ops.length > 0) {
                ops = extractParsed.ops;
                opsRaw = extractParsed.opsRaw;
                console.debug("[runTurn] OPS回退提取成功，共", ops.length, "条操作");
              }
            } catch (extractErr) {
              console.warn("[runTurn] OPS回退提取失败:", extractErr);
            }
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
            errorMsg.includes("请求超时") || errorMsg.includes("不可达") || errorMsg.includes("重试");

          if (isNetworkError && settings.proModel !== settings.flashModel) {
            console.warn("[runTurn] Pro模型网络请求失败，尝试降级到Flash模型...");
            try {
              const proStart = Date.now();
              const proRaw = await chatWithModel(
                settings,
                settings.flashModel,
                buildProPrompt({
                  state: gameState,
                  summary: conv.summary,
                  recentTurns,
                  decision: trimmed,
                  relevantData,
                  chatSummary,
                  customPrompt: settings.customPrompt,
                }),
                { timeoutMs: 120000, signal, retries: 2 },
              );
              const parsed = parseModelOutput(proRaw);
              narrative = parsed.narrative;
              ops = parsed.ops;
              opsRaw = parsed.opsRaw;

              set((st) => ({
                conversation: {
                  ...st.conversation,
                  lastProDuration: Date.now() - proStart,
                  lastRawOutput: proRaw,
                  quickDecisions: parsed.quickDecisions,
                },
              }));
            } catch (fallbackErr) {
              console.error("[runTurn] Flash模型降级也失败:", fallbackErr);
              set((st) => ({
                conversation: {
                  ...st.conversation,
                  stage: "error",
                  errorMsg: `Pro模型网络请求失败，Flash模型降级也失败：${(fallbackErr as Error).message}\n请检查网络连接或在设置中更换Base URL。`,
                },
              }));
              abortController = null;
              return;
            }
          } else {
            set((st) => ({
              conversation: {
                ...st.conversation,
                stage: "error",
                errorMsg: isNetworkError
                  ? `网络连接失败：${errorMsg}\n请检查网络连接或在设置中更换Base URL。\n如果问题持续，可尝试切换为其他模型或降低温度设置。`
                  : `叙事生成失败：${errorMsg}`,
              },
            }));
            abortController = null;
            return;
          }
        }

        useGameStore.getState().applyOps(ops);

        const afterState = useGameStore.getState();
        const hasNewsOp = ops.some((o) => o.kind === "add" && o.collection === "news.items");
        const hasNews = Array.isArray(afterState.news?.items) && afterState.news.items.length > 0;
        const hasNewsUpdate = afterState.news?.lastUpdate;

        const now = afterState.currentTime || { year: 1, month: 1, day: 1 };
        const todayKey = `${now.year}-${now.month}-${now.day}`;

        if (!hasNewsOp && (!hasNewsUpdate || hasNewsUpdate !== todayKey)) {
          const defaultNews = generateDefaultNews(now);
          useGameStore.getState().updateNews(defaultNews);
          console.debug("[runTurn] AI未生成新闻，已自动生成默认新闻");
        }

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
            pendingChatSummary: "",
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
              customPrompt: settings.customPrompt,
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
            { timeoutMs: 30000, retries: 1 },
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

      restoreConversation: (conv: ConversationState) => {
        if (abortController) {
          abortController.abort();
          abortController = null;
        }
        const turns = Array.isArray(conv.turns)
          ? conv.turns.slice(-4).map((t) => ({
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
          }))
          : [];
        set({
          conversation: {
            turns,
            summary: conv.summary || "",
            stage: turns.length > 0 ? "done" : "idle",
            errorMsg: "",
            lastFlashDuration: 0,
            lastProDuration: 0,
            lastRawOutput: "",
            quickDecisions: [],
            pendingChatSummary: "",
            pendingCrafting: null,
          },
        });
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

          const statsStr = relation?.stats
            ? `[战斗属性] HP:${relation.stats.hp}/${relation.stats.hpMax} MP:${relation.stats.mp}/${relation.stats.mpMax} 攻击:${relation.stats.attack} 防御:${relation.stats.defense} 速度:${relation.stats.speed}`
            : "";
          const techStr = relation?.techniqueIds?.length
            ? `[掌握功法] ${relation.techniqueIds.join(", ")}`
            : "";

          const prompt = [
            {
              role: "system" as const,
              content: `你是一位修真界的人物设定专家。请为以下 NPC 生成详细的人设提示词。

NPC 信息：
姓名：${name}
称号：${title}
与玩家关系：${relation?.note || "暂无"}
好感度：${affinity}/100
${statsStr ? `${statsStr}\n` : ""}${techStr ? `${techStr}\n` : ""}

玩家信息：
姓名：${player.name}
道号：${player.title}
境界：${player.realmIndex === 0 ? "炼气初期" : player.realmIndex === 1 ? "筑基期" : "金丹期"}
宗门：${player.sectName}

请生成：
1. 性格特点（50字以内）——描述NPC的性格、处事方式
2. 说话风格（30字以内）——描述NPC的语气、用词习惯
3. 背景故事（100字以内）——描述NPC的来历、修为境界、宗门归属、与玩家的过往交集
4. 立场态度（30字以内）——描述NPC对玩家的态度、立场、可能的帮助或阻碍

格式要求：
PERSONA: [性格特点]
STYLE: [说话风格]
BACKGROUND: [背景故事]
ATTITUDE: [立场态度]`,
            },
          ];

          const raw = await chatWithModel(settings, settings.flashModel, prompt, {
            timeoutMs: 30000,
          });

          let persona = "";
          let style = "";
          let background = "";
          let attitude = "";

          const personaMatch = raw.match(/PERSONA:\s*(.+)/);
          const styleMatch = raw.match(/STYLE:\s*(.+)/);
          const backgroundMatch = raw.match(/BACKGROUND:\s*(.+)/);
          const attitudeMatch = raw.match(/ATTITUDE:\s*(.+)/);

          if (personaMatch) persona = personaMatch[1].trim();
          if (styleMatch) style = styleMatch[1].trim();
          if (backgroundMatch) background = backgroundMatch[1].trim();
          if (attitudeMatch) attitude = attitudeMatch[1].trim();

          if (!persona) {
            persona = `${title}，性格沉稳，处事有度。`;
          }
          if (!style) {
            style = "语气平和，言辞简练，偶尔引经据典。";
          }
          if (!attitude) {
            attitude = affinity >= 70 ? "对玩家友善，愿意提供帮助" :
              affinity >= 40 ? "与玩家保持中立，态度礼貌" :
                "对玩家冷淡或敌对";
          }

          const initialPrompt = `你是修真者「${name}」，称号「${title}」。
${statsStr ? `${statsStr}\n` : ""}${techStr ? `${techStr}\n` : ""}
【性格】${persona}
【说话风格】${style}
${background ? `【背景】${background}\n` : ""}
【对玩家态度】${attitude}
你正在与「${player.name}」（${player.title}）交谈。请以你的身份回复对方的话语，保持角色一致性。
重要：你的回复必须符合修真世界观，使用古风语言风格，避免现代用语。`;

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

        const recentStoryTurns = recentForPrompt(conversation.turns);
        const storyContext = recentStoryTurns
          .map((t) => `玩家：${t.input}\n叙述：${t.narrative.slice(0, 300)}`)
          .join("\n---\n");

        const recentMessages = (Array.isArray(profile.messages) ? profile.messages : []).slice(-10);
        const chatHistory = recentMessages
          .map((m) => `${m.role === "player" ? "玩家" : profile.name}：${m.content}`)
          .join("\n");

        const gameState = useGameStore.getState();
        const location = gameState.currentLocation;
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

        const time = gameState.currentTime;
        const timeStr = `第${time.year}年${time.month}月${time.day}日`;

        const relation = gameState.relations.find((r) => r.id === npcId);
        const relationType = relation?.type || "friend";
        const relationLabels: Record<string, string> = {
          dao_companion: "道侣",
          master: "师父",
          disciple: "弟子",
          friend: "好友",
          enemy: "仇敌",
        };

        const prompt: import("@/lib/aiClient").ChatMessage[] = [
          {
            role: "system" as const,
            content: `${profile.initialPrompt}

【游戏背景】
这是一个古风修真世界，存在宗门、功法、丹药、符箓等元素。境界分为炼气、筑基、金丹、元婴等。

【当前时间】：${timeStr}
【玩家当前所在】：${locationNames[location] || location}
【与玩家关系】：${relationLabels[relationType]}（好感度：${relation?.affinity || 50}/100）

【当前剧情上下文】：
${conversation.summary || "暂无"}
${storyContext || "暂无"}

【本次对话记录】：
${chatHistory || "暂无"}

【回复要求】：
1. 以「${name}」的身份和口吻回复，保持角色一致性
2. 语言风格符合古风修真设定，使用文言或半文言
3. 回复要符合你的性格、背景和对玩家的态度
4. 根据剧情上下文和对话历史，做出合理的回应
5. 回复长度适中，不要太长也不要太短（50-200字）
6. 不要输出任何数据操作标记或系统提示，只输出对话内容`,
          },
          {
            role: "user" as const,
            content: content.trim(),
          },
        ];

        try {
          const raw = await chatWithModel(settings, settings.proModel, prompt, {
            timeoutMs: 120000,
            signal,
            retries: 2,
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
            errorMsg.includes("请求超时") || errorMsg.includes("不可达") || errorMsg.includes("重试");

          if (isNetworkError && settings.proModel !== settings.flashModel) {
            console.warn("[sendNPCMessage] Pro模型网络请求失败，尝试降级到Flash模型...");
            try {
              const raw = await chatWithModel(settings, settings.flashModel, prompt, {
                timeoutMs: 120000,
                signal,
                retries: 2,
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
            } catch (fallbackErr) {
              console.error("[sendNPCMessage] Flash模型降级也失败:", fallbackErr);
              set((st) => ({
                npcChat: {
                  ...st.npcChat,
                  isTyping: false,
                  errorMsg: `Pro模型网络请求失败，Flash模型降级也失败：${(fallbackErr as Error).message}\n请检查网络连接或在设置中更换Base URL。`,
                },
              }));
            }
          } else {
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
        }
        abortController = null;
      },

      openNPCChat: (npcId) => {
        set((st) => ({
          npcChat: { ...st.npcChat, activeNpcId: npcId },
        }));
      },

      closeNPCChat: () => {
        set((st) => {
          // 生成对话摘要
          const activeProfile = st.npcChat.profiles.find((p) => p.npcId === st.npcChat.activeNpcId);
          let chatSummary = "";
          if (activeProfile && activeProfile.messages.length >= 2) {
            const recentMsgs = activeProfile.messages.slice(-8);
            const lines: string[] = [];
            lines.push(`与「${activeProfile.name}」(${activeProfile.title})近期的交谈：`);
            for (const msg of recentMsgs) {
              const speaker = msg.role === "player" ? "你" : activeProfile.name;
              lines.push(`[${speaker}]: ${msg.content.slice(0, 120)}`);
            }
            chatSummary = lines.join("\n");
          }
          return {
            npcChat: { ...st.npcChat, activeNpcId: null, isTyping: false, errorMsg: "" },
            conversation: {
              ...st.conversation,
              pendingChatSummary: chatSummary || st.conversation.pendingChatSummary,
            },
          };
        });
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

        try {
          const raw = await chatWithModel(
            settings,
            settings.proModel,
            prompt,
            { timeoutMs: 60000, retries: 2 },
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
            errorMsg.includes("请求超时") || errorMsg.includes("不可达") || errorMsg.includes("重试");

          if (isNetworkError && settings.proModel !== settings.flashModel) {
            console.warn("[runBattleTurn] Pro模型网络请求失败，尝试降级到Flash模型...");
            try {
              const raw = await chatWithModel(
                settings,
                settings.flashModel,
                prompt,
                { timeoutMs: 60000, retries: 2 },
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
            } catch (fallbackErr) {
              console.error("[runBattleTurn] Flash模型降级也失败:", fallbackErr);
              set((st) => ({
                battle: {
                  ...st.battle,
                  isResolving: false,
                  errorMsg: `Pro模型网络请求失败，Flash模型降级也失败：${(fallbackErr as Error).message}\n请检查网络连接或在设置中更换Base URL。`,
                },
              }));
            }
          } else {
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
        }
      },
    }),
    {
      name: "xiuxian-ai",
      version: 3,
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
        if (version < 3) {
          if (state.settings && !state.settings.customPrompt) {
            state.settings.customPrompt = "";
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

function generateDefaultNews(time: { year: number; month: number; day: number }): any[] {
  const season = time.month >= 3 && time.month <= 5 ? "春" :
    time.month >= 6 && time.month <= 8 ? "夏" :
      time.month >= 9 && time.month <= 11 ? "秋" : "冬";

  const newsTemplates = [
    {
      category: "官府公告",
      titles: [
        `${season}季赋税减免告示`,
        "京城举行修仙大会",
        "边境妖兽异动警示",
        "科举放榜通知",
        "皇家赐婚消息",
        "禁宵令解除",
        "赈灾物资发放",
        "新科状元册封",
      ],
      contents: [
        `朝廷体恤民情，${season}季赋税减半，各州县务必遵照执行，不得苛捐杂税。`,
        `京城将在三日后举行盛大修仙大会，各方修士可前往观摩交流，切磋技艺。`,
        `边境传来急报，妖兽活动频繁，各宗门需加强警戒，保护周边百姓安全。`,
        `今科科举放榜，共录取进士三百名，榜首为江南才子李慕白。`,
        `皇家传来消息，太子殿下将与清河郡主赐婚，婚期定在下月初八。`,
        `京城禁宵令已解除，百姓可自由出入，但需注意夜间安全。`,
        `近日各地灾情得到控制，朝廷已调拨赈灾物资，灾民安置有序。`,
        `新科状元张鸿渐已受册封，将赴翰林院任职。`,
      ],
      sources: ["京城快报", "官府文告", "御书房传讯"],
    },
    {
      category: "宗门布告",
      titles: [
        "宗门大比即将举行",
        "新弟子入门考核",
        "长老闭关出关",
        "资源分配调整",
        "秘境开放通知",
        "宗门巡视安排",
        "功法借阅新规",
        "外门晋升公告",
      ],
      contents: [
        `宗门大比将于下月初一举行，各峰弟子需积极备战，展现宗门风采。`,
        `新弟子入门考核即将开始，凡年满十六岁、灵根合格者均可报名参加。`,
        `闭关三年的玄清长老今日出关，修为更上一层，可喜可贺。`,
        `经宗门商议，下月起资源分配将向有功弟子倾斜，望各位努力修炼。`,
        `宗门秘境将于三日后开放，每位弟子可进入一次，机遇与危险并存。`,
        `本月宗门巡视由执法堂负责，各峰需配合检查，遵守宗门规矩。`,
        `藏经阁功法借阅新规出台，弟子需达到相应修为方可借阅高阶功法。`,
        `外门弟子晋升考核结果已出，共有十二人晋升内门，望继续努力。`,
      ],
      sources: ["宗门传讯", "布告栏", "执事堂通知"],
    },
    {
      category: "市井传言",
      titles: [
        "神秘修士现身茶馆",
        "天价丹药交易",
        "灵异事件频发",
        "失踪人口传闻",
        "宝藏传说兴起",
        "黑市交易猖獗",
        "奇人异事",
        "酒馆趣闻",
      ],
      contents: [
        `城南茶馆来了一位神秘修士，气质非凡，出手阔绰，无人知其来历。`,
        `据说有人在黑市以天价购得一枚九转金丹，不知是真是假。`,
        `近日城郊频发灵异事件，夜晚常有鬼火出现，百姓人心惶惶。`,
        `城中已有三人离奇失踪，坊间传言与邪修有关。`,
        `江湖上兴起一则宝藏传说，据说藏宝图已落入神秘人手中。`,
        `黑市交易愈发猖獗，各种违禁物品琳琅满目，官府束手无策。`,
        `有人亲眼目睹一位白发老者在空中飞行，疑似隐世高人。`,
        `酒馆中有人吹嘘曾在秘境中获得上古传承，引来众人哄笑。`,
      ],
      sources: ["茶馆闲谈", "街头巷议", "酒肆传闻"],
    },
  ];

  return newsTemplates.map((template) => {
    const titleIdx = (time.day + time.month * 10) % template.titles.length;
    const contentIdx = (time.day + time.year * 5) % template.contents.length;
    const sourceIdx = (time.day) % template.sources.length;
    return {
      category: template.category,
      title: template.titles[titleIdx],
      content: template.contents[contentIdx],
      source: template.sources[sourceIdx],
    };
  });
}

export { RECENT_WINDOW };
