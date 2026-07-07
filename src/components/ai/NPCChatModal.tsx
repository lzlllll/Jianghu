import { useEffect, useRef, useState } from "react";
import { useAIStore } from "@/store/useAIStore";
import { useGameStore } from "@/store/useGameStore";
import { SealButton } from "@/components/ui/SealButton";
import { cn } from "@/lib/utils";
import { X, Loader2, Send, Trash2, RefreshCw } from "lucide-react";

export function NPCChatModal() {
  const npcChat = useAIStore((s) => s.npcChat);
  const sendNPCMessage = useAIStore((s) => s.sendNPCMessage);
  const closeNPCChat = useAIStore((s) => s.closeNPCChat);
  const clearNPCChat = useAIStore((s) => s.clearNPCChat);
  const getOrCreateNPCProfile = useAIStore((s) => s.getOrCreateNPCProfile);
  const relations = useGameStore((s) => s.relations);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeNpcId = npcChat.activeNpcId;
  const profile = npcChat.profiles.find((p) => p.npcId === activeNpcId);
  const relation = relations.find((r) => r.id === activeNpcId);
  const isTyping = npcChat.isTyping;

  useEffect(() => {
    if (activeNpcId && relation && !profile) {
      setLoading(true);
      setError("");
      getOrCreateNPCProfile(activeNpcId, relation.name, relation.title)
        .then(() => setLoading(false))
        .catch((e) => {
          setError(e.message);
          setLoading(false);
        });
    }
  }, [activeNpcId, relation, profile, getOrCreateNPCProfile]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [profile?.messages.length]);

  useEffect(() => {
    if (npcChat.errorMsg) {
      setError(npcChat.errorMsg);
      setTimeout(() => setError(""), 5000);
    }
  }, [npcChat.errorMsg]);

  if (!activeNpcId) return null;

  const handleSend = () => {
    const text = input.trim();
    if (!text || isTyping) return;
    sendNPCMessage(activeNpcId, text);
    setInput("");
    setError("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const typeLabels: Record<string, string> = {
    dao_companion: "道侣",
    master: "师父",
    disciple: "弟子",
    friend: "好友",
    enemy: "仇敌",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-ink-900/80 backdrop-blur-sm animate-inkSpread"
        onClick={closeNPCChat}
      />

      <div
        className="relative scroll-card rounded-lg w-full max-w-3xl h-[70vh] flex flex-col"
        style={{ animation: "inkSpread 0.4s ease-out" }}
      >
        {/* 标题栏 */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-gold-500/20 bg-ink-800/95 backdrop-blur">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 red-seal rounded-sm text-xl font-brush flex items-center justify-center">
              {relation?.name.charAt(0) || "?"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-brush text-xl text-gold-400 tracking-widest">
                  {relation?.name || profile?.name || "未知"}
                </h2>
                <span className="font-serif text-xs text-paper-400/70">
                  「{relation?.title || profile?.title || ""}」
                </span>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="font-serif text-[11px] text-paper-400/60">
                  {typeLabels[relation?.type || "friend"]}
                </span>
                {relation && (
                  <div className="flex items-center gap-1">
                    <div className="w-20 h-1.5 rounded-full bg-ink-900/60 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cinnabar-500 via-gold-400 to-jade-400"
                        style={{ width: `${relation.affinity}%` }}
                      />
                    </div>
                    <span className="font-number text-[10px] text-paper-400/50">
                      {relation.affinity}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (confirm("确定要清空与该 NPC 的对话记录？")) {
                  clearNPCChat(activeNpcId);
                }
              }}
              className="font-serif text-[11px] text-paper-400/50 hover:text-cinnabar-400 px-2 py-1 rounded border border-paper-400/10 hover:border-cinnabar-500/30 transition flex items-center gap-1"
            >
              <Trash2 size={10} /> 清空
            </button>
            <button
              onClick={closeNPCChat}
              className="w-8 h-8 rounded flex items-center justify-center text-paper-400/60 hover:text-paper-100 hover:bg-paper-400/10 transition"
              aria-label="关闭"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 人设信息（初次加载） */}
        {loading && (
          <div className="px-6 py-4 flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin text-gold-400" />
            <span className="font-serif text-xs text-paper-400/60">正在推演 {relation?.name} 的命格……</span>
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="px-6 py-2 bg-cinnabar-500/10 border-b border-cinnabar-500/30">
            <p className="font-serif text-xs text-cinnabar-300">{error}</p>
          </div>
        )}

        {/* 消息列表 */}
        {profile && (
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {profile.messages.length === 0 ? (
              <div className="text-center py-8">
                <p className="font-brush text-sm text-paper-400/60 tracking-widest">
                  开口交谈
                </p>
                <p className="font-serif text-xs text-paper-400/40 mt-2">
                  与 {profile.name} 说些什么吧……
                </p>
              </div>
            ) : (
              profile.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-3",
                    msg.role === "player" ? "flex-row-reverse" : "",
                  )}
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-sm flex items-center justify-center shrink-0 font-brush text-sm",
                      msg.role === "player"
                        ? "bg-cinnabar-500/20 text-cinnabar-400 border border-cinnabar-500/40"
                        : "bg-gold-500/20 text-gold-400 border border-gold-500/40",
                    )}
                  >
                    {msg.role === "player" ? "我" : profile.name.charAt(0)}
                  </div>
                  <div
                    className={cn(
                      "max-w-[70%] rounded-lg px-4 py-3",
                      msg.role === "player"
                        ? "bg-cinnabar-500/15 border border-cinnabar-500/30 rounded-br-none"
                        : "bg-gold-500/10 border border-gold-500/20 rounded-bl-none",
                    )}
                  >
                    <p className="font-serif text-sm text-paper-100 leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </p>
                    <div
                      className={cn(
                        "font-serif text-[9px] text-paper-400/40 mt-1",
                        msg.role === "player" ? "text-right" : "",
                      )}
                    >
                      {new Date(msg.timestamp).toLocaleTimeString("zh-CN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              ))
            )}

            {/* 打字中 */}
            {isTyping && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-sm bg-gold-500/20 text-gold-400 border border-gold-500/40 flex items-center justify-center shrink-0 font-brush text-sm">
                  {profile.name.charAt(0)}
                </div>
                <div className="bg-gold-500/10 border border-gold-500/20 rounded-lg rounded-bl-none px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-gold-400 animate-shimmer" />
                    <span className="w-2 h-2 rounded-full bg-gold-400 animate-shimmer" style={{ animationDelay: "0.1s" }} />
                    <span className="w-2 h-2 rounded-full bg-gold-400 animate-shimmer" style={{ animationDelay: "0.2s" }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}

        {/* 输入区域 */}
        {profile && (
          <div className="sticky bottom-0 px-6 py-4 border-t border-gold-500/20 bg-ink-800/95 backdrop-blur">
            <div className="flex gap-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isTyping}
                placeholder="输入话语……&#10;（Ctrl/Cmd + Enter 发送）"
                rows={3}
                className="flex-1 input-ink resize-none leading-relaxed"
                style={{ fontFamily: '"Noto Serif SC", serif' }}
              />
              <SealButton
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                className="shrink-0"
              >
                {isTyping ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <>
                    <Send size={14} /> 言
                  </>
                )}
              </SealButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
