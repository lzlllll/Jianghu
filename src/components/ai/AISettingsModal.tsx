import { useEffect, useRef, useState } from "react";
import { useAIStore } from "@/store/useAIStore";
import { chatWithModel } from "@/lib/aiClient";
import type { AISettings } from "@/data/types";
import { SealButton } from "@/components/ui/SealButton";
import { cn } from "@/lib/utils";
import { X, Eye, EyeOff, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

interface AISettingsModalProps {
  open: boolean;
  onClose: () => void;
}

type TestState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "ok"; msg: string; model: "flash" | "pro" }
  | { status: "error"; msg: string; model: "flash" | "pro" };

const PRESETS: { label: string; baseUrl: string; flash: string; pro: string; note: string }[] = [
  {
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    flash: "deepseek-chat",
    pro: "deepseek-reasoner",
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

export function AISettingsModal({ open, onClose }: AISettingsModalProps) {
  const settings = useAIStore((s) => s.settings);
  const updateSettings = useAIStore((s) => s.updateSettings);
  const isDeveloperMode = useAIStore((s) => s.isDeveloperMode);
  const setDeveloperMode = useAIStore((s) => s.setDeveloperMode);
  const openCrafting = useAIStore((s) => s.openCrafting);

  const [draft, setDraft] = useState<AISettings>(settings);
  const [showKey, setShowKey] = useState(false);
  const [test, setTest] = useState<TestState>({ status: "idle" });
  const [saved, setSaved] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  // 每次打开时同步最新设置
  useEffect(() => {
    if (open) {
      setDraft(settings);
      setTest({ status: "idle" });
      setSaved(false);
    }
  }, [open, settings]);

  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const patch = (p: Partial<AISettings>) => setDraft((d) => ({ ...d, ...p }));

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setDraft((d) => ({
      ...d,
      baseUrl: preset.baseUrl,
      flashModel: preset.flash,
      proModel: preset.pro,
    }));
    setTest({ status: "idle" });
  };

  const runTest = async (which: "flash" | "pro") => {
    if (!draft.apiKey.trim()) {
      setTest({
        status: "error",
        msg: "请先填写 API Key",
        model: which,
      });
      return;
    }
    setTest({ status: "testing" });
    try {
      const model = which === "flash" ? draft.flashModel : draft.proModel;
      const start = Date.now();
      await chatWithModel(
        draft,
        model,
        [
          {
            role: "user",
            content: "请回复：通",
          },
        ],
        { timeoutMs: 15000 },
      );
      const elapsed = Date.now() - start;
      setTest({
        status: "ok",
        msg: `${model} 连接成功（${elapsed}ms）`,
        model: which,
      });
    } catch (e) {
      setTest({
        status: "error",
        msg: (e as Error).message,
        model: which,
      });
    }
  };

  const handleSave = () => {
    updateSettings(draft);
    setSaved(true);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-ink-900/80 backdrop-blur-sm animate-inkSpread"
        onClick={onClose}
      />

      {/* 主体 */}
      <div
        ref={dialogRef}
        className="relative scroll-card rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        style={{ animation: "inkSpread 0.4s ease-out" }}
      >
        {/* 标题栏 */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-gold-500/20 bg-ink-800/95 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 red-seal rounded-sm text-base">设</div>
            <div>
              <h2 className="font-brush text-2xl text-gold-400 tracking-widest text-shadow-ink">
                通灵设置
              </h2>
              <p className="font-serif text-[11px] text-paper-400/60 mt-0.5">
                配置天机接口，连通两界叙事
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded flex items-center justify-center text-paper-400/60 hover:text-paper-100 hover:bg-paper-400/10 transition"
            aria-label="关闭"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* 预设 */}
          <section>
            <SectionLabel>接口预设</SectionLabel>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
              {PRESETS.map((p) => {
                const active = draft.baseUrl === p.baseUrl;
                return (
                  <button
                    key={p.label}
                    onClick={() => applyPreset(p)}
                    className={cn(
                      "px-3 py-2 rounded text-left border transition-all",
                      active
                        ? "border-gold-400/60 bg-gold-400/10"
                        : "border-paper-400/15 hover:border-gold-500/40 hover:bg-paper-400/5",
                    )}
                    title={p.note}
                  >
                    <div
                      className={cn(
                        "font-brush text-sm tracking-wider",
                        active ? "text-gold-400" : "text-paper-200",
                      )}
                    >
                      {p.label}
                    </div>
                    <div className="font-serif text-[9px] text-paper-400/60 mt-0.5 leading-tight">
                      {p.note}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Base URL */}
          <section>
            <SectionLabel>Base URL</SectionLabel>
            <input
              type="text"
              value={draft.baseUrl}
              onChange={(e) => patch({ baseUrl: e.target.value })}
              placeholder="https://api.deepseek.com/v1"
              className="input-ink mt-2"
              spellCheck={false}
            />
            <p className="font-serif text-[10px] text-paper-400/50 mt-1.5 leading-relaxed">
              OpenAI 兼容接口根路径，将自动追加 <code className="text-gold-400/80">/chat/completions</code>。
              若遇 CORS 错误，请更换为支持浏览器直连的服务商或自建代理。
            </p>
          </section>

          {/* API Key */}
          <section>
            <SectionLabel>API Key</SectionLabel>
            <div className="relative mt-2">
              <input
                type={showKey ? "text" : "password"}
                value={draft.apiKey}
                onChange={(e) => patch({ apiKey: e.target.value })}
                placeholder="sk-..."
                className="input-ink pr-10"
                spellCheck={false}
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-paper-400/60 hover:text-paper-100 transition"
                aria-label={showKey ? "隐藏" : "显示"}
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="font-serif text-[10px] text-paper-400/50 mt-1.5">
              密钥仅存储于本机 localStorage，不会上传任何第三方服务器。
            </p>
          </section>

          {/* 双模型 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <section>
              <SectionLabel>
                Flash 模型
                <span className="font-serif text-[10px] text-paper-400/50 ml-2">数据判断 / 压缩</span>
              </SectionLabel>
              <input
                type="text"
                value={draft.flashModel}
                onChange={(e) => patch({ flashModel: e.target.value })}
                placeholder="deepseek-chat"
                className="input-ink mt-2"
                spellCheck={false}
              />
              <button
                onClick={() => runTest("flash")}
                disabled={test.status === "testing"}
                className="ghost-btn mt-2 w-full px-3 py-1.5 rounded text-xs flex items-center justify-center gap-1.5"
              >
                {test.status === "testing" ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : null}
                测试 Flash 连接
              </button>
            </section>

            <section>
              <SectionLabel>
                Pro 模型
                <span className="font-serif text-[10px] text-paper-400/50 ml-2">叙事生成</span>
              </SectionLabel>
              <input
                type="text"
                value={draft.proModel}
                onChange={(e) => patch({ proModel: e.target.value })}
                placeholder="deepseek-reasoner"
                className="input-ink mt-2"
                spellCheck={false}
              />
              <button
                onClick={() => runTest("pro")}
                disabled={test.status === "testing"}
                className="ghost-btn mt-2 w-full px-3 py-1.5 rounded text-xs flex items-center justify-center gap-1.5"
              >
                {test.status === "testing" ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : null}
                测试 Pro 连接
              </button>
            </section>
          </div>

          {/* 测试结果 */}
          {test.status !== "idle" && test.status !== "testing" && (
            <div
              className={cn(
                "rounded px-3 py-2 flex items-start gap-2 text-xs font-serif",
                test.status === "ok"
                  ? "bg-jade-500/10 border border-jade-500/30 text-jade-400"
                  : "bg-cinnabar-500/10 border border-cinnabar-500/30 text-cinnabar-400",
              )}
            >
              {test.status === "ok" ? (
                <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed break-all">{test.msg}</span>
            </div>
          )}

          {/* 温度 */}
          <section>
            <div className="flex items-center justify-between">
              <SectionLabel>温度</SectionLabel>
              <span className="font-number text-sm text-gold-400">
                {draft.temperature.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={2}
              step={0.05}
              value={draft.temperature}
              onChange={(e) => patch({ temperature: parseFloat(e.target.value) })}
              className="fire-slider mt-3 w-full"
            />
            <div className="flex justify-between mt-1.5 font-serif text-[10px] text-paper-400/50">
              <span>0 · 严谨</span>
              <span>1 · 平衡</span>
              <span>2 · 奔放</span>
            </div>
          </section>

          {/* 开发者模式 */}
          <section>
            <div className="flex items-center justify-between">
              <SectionLabel>开发者模式</SectionLabel>
              <button
                onClick={() => setDeveloperMode(!isDeveloperMode)}
                className={cn(
                  "relative w-12 h-6 rounded-full transition-colors",
                  isDeveloperMode ? "bg-cinnabar-500/30 border border-cinnabar-400/50" : "bg-ink-700/50 border border-paper-400/20",
                )}
              >
                <div
                  className={cn(
                    "absolute top-1 w-4 h-4 rounded-full transition-transform",
                    isDeveloperMode
                      ? "left-7 bg-cinnabar-400"
                      : "left-1 bg-paper-400/50",
                  )}
                />
              </button>
            </div>
            {isDeveloperMode && (
              <div className="mt-3 space-y-2">
                <div className="bg-cinnabar-500/5 border border-cinnabar-500/20 rounded px-3 py-2">
                  <p className="font-serif text-[11px] text-cinnabar-300/80">
                    已启用开发者模式
                  </p>
                  <button
                    onClick={() => {
                      openCrafting();
                      onClose();
                    }}
                    className="ghost-btn mt-2 w-full px-3 py-1.5 rounded text-xs flex items-center justify-center gap-1.5"
                  >
                    强制打开百艺窗口（测试）
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* 底部操作 */}
        <div className="sticky bottom-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-gold-500/20 bg-ink-800/95 backdrop-blur">
          <SealButton variant="ghost" onClick={onClose}>
            取消
          </SealButton>
          <SealButton onClick={handleSave} className="min-w-[100px]">
            {saved ? "已保存" : "保存"}
          </SealButton>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="font-serif text-xs text-paper-300 tracking-wider flex items-center">
      {children}
    </label>
  );
}
