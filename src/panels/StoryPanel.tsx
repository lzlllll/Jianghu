import { useEffect, useRef, useState } from "react";
import { useAIStore } from "@/store/useAIStore";
import { useGameStore } from "@/store/useGameStore";
import { ScrollCard } from "@/components/ui/ScrollCard";
import { PanelTitle } from "@/components/ui/PanelTitle";
import { SealButton } from "@/components/ui/SealButton";
import { CloudDivider } from "@/components/ui/CloudDivider";
import { summarizeOps } from "@/lib/dataOps";
import { cn } from "@/lib/utils";
import { BattlePanel } from "@/components/battle/BattlePanel";
import {
  Sparkles,
  Square,
  RotateCcw,
  Settings as SettingsIcon,
  Loader2,
  Database,
  Code,
  Copy,
  Check,
} from "lucide-react";

interface StoryPanelProps {
  onOpenSettings: () => void;
}

const QUICK_DECISIONS = [
  "闭关修炼三日，潜心参悟功法",
  "前往坊市，购买炼丹材料",
  "挑战同门师兄，切磋道法",
  "探索后山秘境，寻找机缘",
];

export function StoryPanel({ onOpenSettings }: StoryPanelProps) {
  const conversation = useAIStore((s) => s.conversation);
  const settings = useAIStore((s) => s.settings);
  const runTurn = useAIStore((s) => s.runTurn);
  const regenerate = useAIStore((s) => s.regenerate);
  const cancel = useAIStore((s) => s.cancel);
  const clearConversation = useAIStore((s) => s.clearConversation);
  const battle = useAIStore((s) => s.battle);
  const startBattle = useAIStore((s) => s.startBattle);
  const log = useGameStore((s) => s.log);
  const isDeveloperMode = useAIStore((s) => s.isDeveloperMode);

  const [showRawOutput, setShowRawOutput] = useState(false);
  const [copied, setCopied] = useState(false);

  const [decision, setDecision] = useState("");
  const narrativeRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (conversation.stage === "done") {
      const lastTurn = conversation.turns[conversation.turns.length - 1];
      if (lastTurn?.mode === "battle") {
        const player = useGameStore.getState().player;
        startBattle({
          width: 10,
          height: 10,
          entities: [
            {
              id: "player",
              name: "沈青砚",
              type: "player",
              position: { x: 5, y: 5 },
              hp: player.hp,
              maxHp: player.hpMax,
              mp: player.mp,
              maxMp: player.mpMax,
            },
          ],
        });
      }
    }
  }, [conversation.stage, startBattle]);

  const stage = conversation.stage;
  const isGenerating = stage === "flash" || stage === "pro";
  const turns = conversation.turns;
  const lastTurn = turns[turns.length - 1];
  const hasApiKey = !!settings.apiKey;

  useEffect(() => {
    if (narrativeRef.current) {
      narrativeRef.current.scrollTop = narrativeRef.current.scrollHeight;
    }
  }, [turns.length, lastTurn?.narrative]);

  const handleSubmit = () => {
    const text = decision.trim();
    if (!text || isGenerating) return;
    runTurn(text);
    setDecision("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (battle.isActive) {
    return <BattlePanel />;
  }

  return (
    <div className="paper-texture">
      <PanelTitle
        title="问道"
        poem="道可道，非常道；名可名，非常名。以心问天，以言演命。"
      />

      {!hasApiKey && (
        <div className="mb-4 rounded-lg border border-cinnabar-500/40 bg-cinnabar-500/10 px-4 py-3 flex items-center gap-3">
          <SettingsIcon size={18} className="text-cinnabar-400 shrink-0" />
          <div className="flex-1 font-serif text-sm text-cinnabar-300">
            尚未配置通灵接口。请先点击右上角设置按钮，填写 API Key 与模型信息。
          </div>
          <SealButton variant="ghost" onClick={onOpenSettings} className="shrink-0">
            前往设置
          </SealButton>
        </div>
      )}

      <div className="flex flex-col gap-4 h-[calc(100vh-120px)]">
        {/* 叙事正文 */}
        <ScrollCard
          title="天机"
          subtitle="演万象，定一念"
          ornament={
            <div className="flex items-center gap-2 text-[10px] font-serif text-paper-400/50">
              {turns.length > 0 && (
                <>
                  <span className="flex items-center gap-1">
                    <Database size={11} />
                    {lastTurn?.ops.length ?? 0} 变
                  </span>
                  <span>·</span>
                  <span>第 {turns.length} 回</span>
                </>
              )}
            </div>
          }
          className="flex-[3] min-h-0 flex flex-col"
        >
          <div
            ref={narrativeRef}
            className="flex-1 overflow-y-auto pr-2"
          >
            {turns.length === 0 ? (
              <EmptyState />
            ) : (
              <article className="font-serif text-lg text-paper-100 leading-loose tracking-wide whitespace-pre-wrap">
                <NarrativeText text={lastTurn?.narrative ?? ""} />
              </article>
            )}
          </div>

          {/* 数据变更徽章 */}
          {lastTurn && Array.isArray(lastTurn.ops) && lastTurn.ops.length > 0 && (
            <>
              <CloudDivider className="my-3" />
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Database size={12} className="text-gold-400/70" />
                  <span className="font-serif text-xs text-paper-300 tracking-wider">
                    气运流转
                  </span>
                  <span className="font-number text-[10px] text-paper-400/50">
                    {lastTurn.ops.length} 项
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {summarizeOps(lastTurn.ops).map((s, i) => (
                    <OpBadge key={i} text={s} op={lastTurn.ops[i]} />
                  ))}
                </div>
              </div>
            </>
          )}
        </ScrollCard>

        {/* 决策输入 */}
        <ScrollCard
          title="心念"
          subtitle="一念既起，万法随之"
          className="shrink-0 max-h-[350px]"
        >
          {/* 快捷决断 */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {QUICK_DECISIONS.map((q) => (
              <button
                key={q}
                onClick={() => setDecision(q)}
                disabled={isGenerating}
                className="px-2.5 py-1 rounded text-[11px] font-serif border border-paper-400/15 text-paper-300/80 hover:border-gold-500/40 hover:text-gold-400 hover:bg-gold-400/5 transition disabled:opacity-40"
              >
                {q}
              </button>
            ))}
          </div>

          <textarea
            value={decision}
            onChange={(e) => setDecision(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isGenerating}
            placeholder="此处书写你的决断与行动……&#10;（Ctrl/Cmd + Enter 发送）"
            rows={5}
            className="input-ink resize-none leading-relaxed"
            style={{ fontFamily: '"Noto Serif SC", serif' }}
          />

          {/* 阶段指示器 */}
          <div className="mt-3">
            <StageIndicator stage={stage} />
          </div>

          {/* 操作按钮 */}
          <div className="mt-3 flex gap-2">
            {isGenerating ? (
              <SealButton variant="ghost" onClick={cancel} className="flex-1">
                <span className="flex items-center justify-center gap-1.5">
                  <Square size={12} /> 中止
                </span>
              </SealButton>
            ) : (
              <SealButton
                onClick={handleSubmit}
                disabled={!decision.trim()}
                className="flex-1"
              >
                <span className="flex items-center justify-center gap-1.5">
                  <Sparkles size={13} /> 演化
                </span>
              </SealButton>
            )}
            <SealButton
              variant="ghost"
              onClick={() => regenerate()}
              disabled={isGenerating || !lastTurn}
              title="删除本轮内容，使用相同输入重新生成"
            >
              <span className="flex items-center justify-center gap-1.5">
                <RotateCcw size={13} /> 重演
              </span>
            </SealButton>
            <button
              onClick={() => {
                if (turns.length === 0) return;
                if (confirm("确定要清除所有问道记录？")) {
                  clearConversation();
                }
              }}
              disabled={turns.length === 0 || isGenerating}
              className="font-serif text-[11px] text-paper-400/50 hover:text-cinnabar-400 disabled:opacity-30 px-3 py-2 rounded border border-paper-400/10 hover:border-cinnabar-500/30 transition"
            >
              清除
            </button>
          </div>

          {conversation.errorMsg && (
            <div className="mt-3 rounded px-3 py-2 bg-cinnabar-500/10 border border-cinnabar-500/30 font-serif text-xs text-cinnabar-300 leading-relaxed">
              {conversation.errorMsg}
            </div>
          )}
        </ScrollCard>

        {/* 开发者模式 - AI原始输出 */}
        {isDeveloperMode && (
          <ScrollCard
            title="AI原始输出"
            subtitle="开发者模式"
            ornament={
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(conversation.lastRawOutput);
                    setCopied(true);
                    setTimeout(() => {
                      if (isMountedRef.current) setCopied(false);
                    }, 2000);
                  }}
                  className="p-1 hover:bg-paper-400/10 rounded transition"
                  title="复制"
                >
                  {copied ? <Check size={14} className="text-jade-400" /> : <Copy size={14} className="text-paper-400/60" />}
                </button>
              </div>
            }
            className="shrink-0"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-serif text-xs text-paper-400/60">
                上一轮AI原始响应
              </span>
              <button
                onClick={() => setShowRawOutput(!showRawOutput)}
                className="font-serif text-xs text-gold-400/80 hover:text-gold-400 transition"
              >
                {showRawOutput ? "收起" : "展开"}
              </button>
            </div>
            {showRawOutput && (
              <pre className="font-mono text-xs text-paper-400/80 bg-ink-900/50 p-3 rounded max-h-[300px] overflow-y-auto whitespace-pre-wrap">
                {conversation.lastRawOutput || "暂无原始输出"}
              </pre>
            )}
          </ScrollCard>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="py-16 text-center">
      <div className="inline-flex w-20 h-20 rounded-full bg-gold-400/10 border border-gold-400/30 items-center justify-center mb-6">
        <Sparkles size={36} className="text-gold-400/70" />
      </div>
      <p className="font-brush text-xl text-paper-300 tracking-widest mb-2">
        道心未动
      </p>
      <p className="font-serif text-sm text-paper-400/50 leading-relaxed max-w-md mx-auto">
        书写决断于下，演化万象于上。<br />
        天机自会因你一念而起。
      </p>
    </div>
  );
}

function StageIndicator({ stage }: { stage: string }) {
  const stages: { key: string; label: string; desc: string }[] = [
    { key: "flash", label: "窥机", desc: "数据判断" },
    { key: "pro", label: "演化", desc: "叙事生成" },
    { key: "done", label: "定数", desc: "已应用" },
  ];

  const activeIdx =
    stage === "flash" ? 0 : stage === "pro" ? 1 : stage === "done" ? 2 : -1;

  return (
    <div className="flex items-center gap-1">
      {stages.map((s, i) => {
        const isActive = i === activeIdx;
        const isDone = i < activeIdx;
        const isError = stage === "error" && i === activeIdx;
        return (
          <div key={s.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-brush border transition",
                  isActive && "bg-gold-400/20 border-gold-400/60 text-gold-400 shadow-glow",
                  isDone && "bg-jade-500/15 border-jade-500/40 text-jade-400",
                  isError && "bg-cinnabar-500/20 border-cinnabar-500/50 text-cinnabar-400",
                  !isActive && !isDone && !isError && "bg-ink-900/40 border-paper-400/15 text-paper-400/40",
                )}
              >
                {isActive ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : isDone ? (
                  "✓"
                ) : (
                  i + 1
                )}
              </div>
              <div
                className={cn(
                  "font-brush text-[10px] mt-1 tracking-wider",
                  isActive ? "text-gold-400" : isDone ? "text-jade-400/80" : "text-paper-400/40",
                )}
              >
                {s.label}
              </div>
              <div className="font-serif text-[8px] text-paper-400/40">{s.desc}</div>
            </div>
            {i < stages.length - 1 && (
              <div
                className={cn(
                  "h-px flex-1 -mt-5 transition",
                  i < activeIdx ? "bg-jade-500/40" : "bg-paper-400/15",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function OpBadge({ text, op }: { text: string; op: import("@/data/types").DataOp }) {
  const color =
    op.kind === "add"
      ? "border-jade-500/40 bg-jade-500/10 text-jade-300"
      : op.kind === "delete"
        ? "border-cinnabar-500/40 bg-cinnabar-500/10 text-cinnabar-300"
        : "border-gold-500/40 bg-gold-500/10 text-gold-300";
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-1 rounded text-[10px] font-number border",
        color,
      )}
      title={text}
    >
      {text}
    </span>
  );
}

function NarrativeText({ text }: { text: string }) {
  const paragraphs = text.split(/\n+/).filter((p) => p.trim());
  if (paragraphs.length === 0) {
    return (
      <p className="text-paper-400/40 text-center py-8">
        暂无叙事内容
      </p>
    );
  }
  return (
    <>
      {paragraphs.map((p, i) => (
        <p key={i} className="mb-4 indent-[2em]">
          {p}
        </p>
      ))}
    </>
  );
}
