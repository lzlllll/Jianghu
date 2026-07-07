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
};

const INITIAL_NPC_CHAT: NPCChatState = {
  profiles: [],
  activeNpcId: null,
  isTyping: false,
  errorMsg: "",
};

interface AIStore {
  settings: AISettings;
  conversation: ConversationState;
  npcChat: NPCChatState;
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
}

let abortController: AbortController | null = null;

export const useAIStore = create<AIStore>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      conversation: INITIAL_CONVERSATION,
      npcChat: INITIAL_NPC_CHAT,
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
          set((st) => ({
            conversation: {
              ...st.conversation,
              stage: "error",
              errorMsg: `数据判断失败：${(e as Error).message}`,
            },
          }));
          abortController = null;
          return;
        }

        const relevantData = resolveRelevantData(gameState, flashPaths);
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
            },
          }));
        } catch (e) {
          if (signal.aborted) return;
          set((st) => ({
            conversation: {
              ...st.conversation,
              stage: "error",
              errorMsg: `叙事生成失败：${(e as Error).message}`,
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
          flashRaw,
          proRequest,
          narrative,
          ops,
          opsRaw,
          applied: true,
          snapshot,
          timestamp: Date.now(),
        };

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

          set((st) => {
            const turns = [...st.conversation.turns];
            turns[turns.length - 1] = {
              ...lastTurn,
              narrative: parsed.narrative,
              ops: parsed.ops,
              opsRaw: parsed.opsRaw,
              applied: true,
              timestamp: Date.now(),
            };
            return {
              conversation: {
                ...st.conversation,
                turns,
                stage: "done",
                errorMsg: "",
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
            profiles: st.npcChat.profiles.map((p) =>
              p.npcId === npcId
                ? { ...p, messages: [...p.messages, playerMsg], lastUpdated: Date.now() }
                : p,
            ),
          },
        }));

        try {
          const recentStoryTurns = recentForPrompt(conversation.turns);
          const storyContext = recentStoryTurns
            .map((t) => `玩家：${t.input}\n叙述：${t.narrative.slice(0, 100)}`)
            .join("\n---\n");

          const recentMessages = profile.messages.slice(-8);
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
              profiles: st.npcChat.profiles.map((p) =>
                p.npcId === npcId
                  ? { ...p, messages: [...p.messages, npcMsg], lastUpdated: Date.now() }
                  : p,
              ),
            },
          }));
        } catch (e) {
          if (signal.aborted) return;
          set((st) => ({
            npcChat: {
              ...st.npcChat,
              isTyping: false,
              errorMsg: `发送失败：${(e as Error).message}`,
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
            profiles: st.npcChat.profiles.map((p) =>
              p.npcId === npcId ? { ...p, messages: [], lastUpdated: Date.now() } : p,
            ),
          },
        }));
      },
    }),
    {
      name: "xiuxian-ai",
      partialize: (s) => ({
        settings: s.settings,
        conversation: s.conversation,
        npcChat: s.npcChat,
        isDeveloperMode: s.isDeveloperMode,
      }),
    },
  ),
);

export { RECENT_WINDOW };
