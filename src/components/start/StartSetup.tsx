import { useState } from "react";
import { useGameStore } from "@/store/useGameStore";
import { useAIStore } from "@/store/useAIStore";
import { ScrollCard } from "@/components/ui/ScrollCard";
import { SealButton } from "@/components/ui/SealButton";
import { cn } from "@/lib/utils";
import { Settings, Upload, Download, RotateCcw, Eye, EyeOff } from "lucide-react";
import type { AISettings, GameSnapshot } from "@/data/types";

interface PlayerSetup {
  name: string;
  title: string;
  sectName: string;
  position: string;
  realm: string;
  description: string;
  personality: string;
  background: string;
}

const SECT_POSITIONS = ["掌门", "副掌门", "长老", "内门弟子", "外门弟子", "散修"];
const REALMS = ["引气", "炼气", "筑基", "金丹", "元婴", "化神", "合体", "渡劫", "大乘"];

const API_PRESETS: { label: string; baseUrl: string; flash: string; pro: string; note: string }[] = [
  {
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    flash: "deepseek-v4-flash",
    pro: "deepseek-v4-pro",
    note: "默认支持浏览器直连",
  },
  {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    flash: "gpt-4o-mini",
    pro: "gpt-4o",
    note: "需配合代理，存在 CORS 限制",
  },
  {
    label: "智谱 GLM",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    flash: "glm-4-flash",
    pro: "glm-4-plus",
    note: "OpenAI 兼容接口",
  },
  {
    label: "通义千问",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    flash: "qwen-turbo",
    pro: "qwen-max",
    note: "阿里云 DashScope",
  },
];

export function StartSetup() {
  const [setup, setSetup] = useState<PlayerSetup>({
    name: "",
    title: "",
    sectName: "",
    position: "外门弟子",
    realm: "引气",
    description: "",
    personality: "",
    background: "",
  });

  const [showApiSettings, setShowApiSettings] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiDraft, setApiDraft] = useState<AISettings>(useAIStore.getState().settings);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  const resetGame = useGameStore((s) => s.resetGame);
  const runTurn = useAIStore((s) => s.runTurn);
  const updateSettings = useAIStore((s) => s.updateSettings);
  const settings = useAIStore((s) => s.settings);
  const turns = useAIStore((s) => s.conversation.turns);

  const handleInputChange = (field: keyof PlayerSetup, value: string) => {
    setSetup((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  const applyApiPreset = (preset: (typeof API_PRESETS)[number]) => {
    setApiDraft((d) => ({
      ...d,
      baseUrl: preset.baseUrl,
      flashModel: preset.flash,
      proModel: preset.pro,
    }));
  };

  const saveApiSettings = () => {
    updateSettings(apiDraft);
    setShowApiSettings(false);
  };

  const isValid = setup.name.trim() !== "" && setup.description.trim() !== "" && settings.apiKey.trim() !== "";

  const handleStart = async () => {
    if (!isValid) {
      if (!settings.apiKey.trim()) {
        setError("请先配置API密钥");
        setShowApiSettings(true);
      } else {
        setError("请至少填写姓名和人物简介");
      }
      return;
    }

    setIsGenerating(true);
    setError("");

    try {
      resetGame();

      const gameState = useGameStore.getState();
      const newPlayer = {
        ...gameState.player,
        name: setup.name.trim(),
        title: setup.title.trim() || "无名之辈",
        sectName: setup.sectName.trim() || "散修",
        position: setup.position,
        realmIndex: REALMS.indexOf(setup.realm) * 4,
        realmStage: 0,
        cultivation: 100,
        description: setup.description.trim(),
        personality: setup.personality.trim(),
        background: setup.background.trim(),
      };

      useGameStore.getState().setPlayer(newPlayer);

      const firstInput = `我是${setup.name}，${setup.title || "一名修士"}，${setup.description}。${setup.personality ? "性格" + setup.personality + "。" : ""}${setup.background || ""}\n\n请为我生成完整的开局游戏数据，包括：\n1. 我的详细属性（灵根、经脉、体魄、气运、寿元、HP、MP等）\n2. 1-2个初始功法/技能\n3. 几件初始物品（武器、丹药、材料等）\n4. 一些灵石\n5. 宗门信息（如果我属于宗门）\n6. 几位初始关系人物\n7. 今日的江湖新闻（官府公告、宗门布告、市井传言各一条）\n8. 开篇叙事\n请以游戏数据操作的方式返回所有内容。`;

      await runTurn(firstInput);
    } catch (e) {
      setError(`开局失败：${(e as Error).message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const exportSave = () => {
    const snapshot = useGameStore.getState().getSnapshot();
    const saveData = {
      game: snapshot,
      ai: useAIStore.getState(),
      timestamp: Date.now(),
    };
    const blob = new Blob([JSON.stringify(saveData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `save_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importSave = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const saveData = JSON.parse(text);
        
        if (saveData.game) {
          useGameStore.getState().restoreSnapshot(saveData.game as GameSnapshot);
        }
        
        if (saveData.ai?.settings) {
          updateSettings(saveData.ai.settings);
        }
        
        if (saveData.ai?.conversation?.turns) {
          useAIStore.getState().setStage("done");
        }
        
        window.location.reload();
      } catch (e) {
        setError(`导入存档失败：${(e as Error).message}`);
      }
    };
    input.click();
  };

  const startNewGame = () => {
    resetGame();
    useAIStore.getState().clearConversation();
    useGameStore.getState().setPanel("profile");
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8 ink-bg">
      <div className="max-w-4xl w-full">
        <ScrollCard className="p-8">
          <div className="text-center mb-8">
            <h1 className="font-brush text-3xl text-gold-400 text-shadow-ink tracking-widest mb-2">江湖：人情世故模拟器</h1>
            <p className="font-serif text-paper-400/60">开启你的修真之路</p>
          </div>

          <div className="flex justify-center gap-3 mb-8">
            <SealButton
              onClick={() => setShowApiSettings(!showApiSettings)}
              variant="ghost"
              className="px-4 py-2 text-sm flex items-center gap-2"
            >
              <Settings size={16} />
              {showApiSettings ? "收起设置" : "API设置"}
            </SealButton>
            <SealButton
              onClick={exportSave}
              variant="ghost"
              className="px-4 py-2 text-sm flex items-center gap-2"
            >
              <Download size={16} />
              导出存档
            </SealButton>
            <SealButton
              onClick={importSave}
              variant="ghost"
              className="px-4 py-2 text-sm flex items-center gap-2"
            >
              <Upload size={16} />
              导入存档
            </SealButton>
            {turns.length > 0 && (
              <SealButton
                onClick={startNewGame}
                variant="seal"
                className="px-4 py-2 text-sm flex items-center gap-2"
              >
                <RotateCcw size={16} />
                新游戏
              </SealButton>
            )}
          </div>

          {showApiSettings && (
            <div className="mb-8 p-4 bg-ink-900/50 border border-paper-400/15 rounded">
              <h3 className="font-brush text-lg text-gold-400 mb-4">通灵设置</h3>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                {API_PRESETS.map((p) => {
                  const active = apiDraft.baseUrl === p.baseUrl;
                  return (
                    <button
                      key={p.label}
                      onClick={() => applyApiPreset(p)}
                      className={cn(
                        "px-3 py-2 rounded text-left border transition-all",
                        active
                          ? "border-gold-400/60 bg-gold-400/10"
                          : "border-paper-400/15 hover:border-gold-500/40 hover:bg-paper-400/5",
                      )}
                      title={p.note}
                    >
                      <div className={cn("font-brush text-sm tracking-wider", active ? "text-gold-400" : "text-paper-200")}>
                        {p.label}
                      </div>
                      <div className="font-serif text-[9px] text-paper-400/60 mt-0.5 leading-tight">
                        {p.note}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block font-serif text-xs text-paper-300 mb-1">Base URL</label>
                  <input
                    type="text"
                    value={apiDraft.baseUrl}
                    onChange={(e) => setApiDraft((d) => ({ ...d, baseUrl: e.target.value }))}
                    placeholder="https://api.deepseek.com/v1"
                    className="w-full bg-ink-900/50 border border-paper-400/20 rounded px-3 py-2 font-serif text-paper-100 placeholder-paper-400/30 focus:outline-none focus:border-gold-400/40"
                  />
                </div>
                <div>
                  <label className="block font-serif text-xs text-paper-300 mb-1">API Key</label>
                  <div className="relative">
                    <input
                      type={showApiKey ? "text" : "password"}
                      value={apiDraft.apiKey}
                      onChange={(e) => setApiDraft((d) => ({ ...d, apiKey: e.target.value }))}
                      placeholder="sk-..."
                      className="w-full bg-ink-900/50 border border-paper-400/20 rounded px-3 py-2 font-serif text-paper-100 placeholder-paper-400/30 focus:outline-none focus:border-gold-400/40 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-paper-400/60 hover:text-paper-100 transition"
                    >
                      {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block font-serif text-xs text-paper-300 mb-1">Flash 模型</label>
                  <input
                    type="text"
                    value={apiDraft.flashModel}
                    onChange={(e) => setApiDraft((d) => ({ ...d, flashModel: e.target.value }))}
                    placeholder="deepseek-chat"
                    className="w-full bg-ink-900/50 border border-paper-400/20 rounded px-3 py-2 font-serif text-paper-100 placeholder-paper-400/30 focus:outline-none focus:border-gold-400/40"
                  />
                </div>
                <div>
                  <label className="block font-serif text-xs text-paper-300 mb-1">Pro 模型</label>
                  <input
                    type="text"
                    value={apiDraft.proModel}
                    onChange={(e) => setApiDraft((d) => ({ ...d, proModel: e.target.value }))}
                    placeholder="deepseek-reasoner"
                    className="w-full bg-ink-900/50 border border-paper-400/20 rounded px-3 py-2 font-serif text-paper-100 placeholder-paper-400/30 focus:outline-none focus:border-gold-400/40"
                  />
                </div>
              </div>

              <SealButton onClick={saveApiSettings} className="w-full">
                保存设置
              </SealButton>
            </div>
          )}

          {!settings.apiKey.trim() && !showApiSettings && (
            <div className="mb-6 p-4 bg-cinnabar-500/10 border border-cinnabar-500/30 rounded">
              <p className="font-serif text-sm text-cinnabar-400 text-center">
                请先点击「API设置」配置您的AI接口密钥
              </p>
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-serif text-sm text-paper-300 mb-1">姓名 *</label>
                <input
                  type="text"
                  value={setup.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="请输入姓名"
                  className="w-full bg-ink-900/50 border border-paper-400/20 rounded px-3 py-2 font-serif text-paper-100 placeholder-paper-400/30 focus:outline-none focus:border-gold-400/40"
                  maxLength={20}
                />
              </div>
              <div>
                <label className="block font-serif text-sm text-paper-300 mb-1">称号</label>
                <input
                  type="text"
                  value={setup.title}
                  onChange={(e) => handleInputChange("title", e.target.value)}
                  placeholder="请输入称号"
                  className="w-full bg-ink-900/50 border border-paper-400/20 rounded px-3 py-2 font-serif text-paper-100 placeholder-paper-400/30 focus:outline-none focus:border-gold-400/40"
                  maxLength={20}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-serif text-sm text-paper-300 mb-1">宗门</label>
                <input
                  type="text"
                  value={setup.sectName}
                  onChange={(e) => handleInputChange("sectName", e.target.value)}
                  placeholder="请输入宗门"
                  className="w-full bg-ink-900/50 border border-paper-400/20 rounded px-3 py-2 font-serif text-paper-100 placeholder-paper-400/30 focus:outline-none focus:border-gold-400/40"
                  maxLength={20}
                />
              </div>
              <div>
                <label className="block font-serif text-sm text-paper-300 mb-1">职位</label>
                <select
                  value={setup.position}
                  onChange={(e) => handleInputChange("position", e.target.value)}
                  className="w-full bg-ink-900/50 border border-paper-400/20 rounded px-3 py-2 font-serif text-paper-100 focus:outline-none focus:border-gold-400/40"
                >
                  {SECT_POSITIONS.map((pos) => (
                    <option key={pos} value={pos}>{pos}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block font-serif text-sm text-paper-300 mb-1">境界</label>
              <div className="flex flex-wrap gap-2">
                {REALMS.map((r) => (
                  <button
                    key={r}
                    onClick={() => handleInputChange("realm", r)}
                    className={cn(
                      "px-3 py-1.5 rounded font-serif text-xs border transition-colors",
                      setup.realm === r
                        ? "border-gold-400/50 bg-gold-400/10 text-gold-400"
                        : "border-paper-400/20 bg-ink-900/30 text-paper-400/60 hover:border-paper-400/40"
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-serif text-sm text-paper-300 mb-1">人物简介 *</label>
              <textarea
                value={setup.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                placeholder="简述你的人物设定，如：拥有冰火双灵根的散修，性格孤傲..."
                rows={3}
                className="w-full bg-ink-900/50 border border-paper-400/20 rounded px-3 py-2 font-serif text-paper-100 placeholder-paper-400/30 focus:outline-none focus:border-gold-400/40 resize-none"
                maxLength={200}
              />
            </div>

            <div>
              <label className="block font-serif text-sm text-paper-300 mb-1">性格特点</label>
              <textarea
                value={setup.personality}
                onChange={(e) => handleInputChange("personality", e.target.value)}
                placeholder="如：沉稳内敛，心思缜密..."
                rows={2}
                className="w-full bg-ink-900/50 border border-paper-400/20 rounded px-3 py-2 font-serif text-paper-100 placeholder-paper-400/30 focus:outline-none focus:border-gold-400/40 resize-none"
                maxLength={100}
              />
            </div>

            <div>
              <label className="block font-serif text-sm text-paper-300 mb-1">背景故事</label>
              <textarea
                value={setup.background}
                onChange={(e) => handleInputChange("background", e.target.value)}
                placeholder="简述你的出身和经历..."
                rows={4}
                className="w-full bg-ink-900/50 border border-paper-400/20 rounded px-3 py-2 font-serif text-paper-100 placeholder-paper-400/30 focus:outline-none focus:border-gold-400/40 resize-none"
                maxLength={500}
              />
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-cinnabar-500/10 border border-cinnabar-500/30 rounded font-serif text-sm text-cinnabar-400">
              {error}
            </div>
          )}

          <div className="mt-8 text-center">
            <SealButton
              onClick={handleStart}
              disabled={!isValid || isGenerating}
              variant="seal"
              className="px-8 py-3 text-base"
            >
              {isGenerating ? "正在开启修真之路..." : "踏入江湖"}
            </SealButton>
          </div>
        </ScrollCard>
      </div>
    </div>
  );
}