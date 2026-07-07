import { useGameStore } from "@/store/useGameStore";
import { useAIStore } from "@/store/useAIStore";
import type { PanelId } from "@/data/types";
import { cn } from "@/lib/utils";
import {
  User,
  BookOpen,
  Gem,
  FlaskConical,
  Landmark,
  Users,
  Sparkles,
} from "lucide-react";

interface NavItem {
  id: PanelId;
  label: string;
  subtitle: string;
  icon: typeof User;
  accent?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: "profile", label: "本命", subtitle: "个人信息", icon: User },
  { id: "technique", label: "功法", subtitle: "修炼之法", icon: BookOpen },
  { id: "treasure", label: "财宝", subtitle: "财产宝物", icon: Gem },
  { id: "sect", label: "宗门", subtitle: "门派经营", icon: Landmark },
  { id: "social", label: "尘缘", subtitle: "社交往来", icon: Users },
  { id: "story", label: "问道", subtitle: "天机演化", icon: Sparkles, accent: true },
];

export function SideNav() {
  const currentPanel = useGameStore((s) => s.currentPanel);
  const setPanel = useGameStore((s) => s.setPanel);
  const aiStage = useAIStore((s) => s.conversation.stage);
  const hasApiKey = useAIStore((s) => !!s.settings.apiKey);
  const turnCount = useAIStore((s) => s.conversation.turns.length);

  const aiBusy = aiStage === "flash" || aiStage === "pro";

  return (
    <nav className="w-56 shrink-0 border-r border-gold-500/20 ink-bg flex flex-col py-6 relative">
      {/* 竖排题字 */}
      <div className="absolute top-4 right-2 vertical-text font-brush text-gold-400/30 text-sm">
        云栖修真录
      </div>

      <div className="px-4 mb-6">
        <div className="font-brush text-paper-400/60 text-xs tracking-widest">六道轮回</div>
      </div>

      <div className="flex-1 flex flex-col gap-1 px-2">
        {NAV_ITEMS.map((item, idx) => {
          const Icon = item.icon;
          const active = currentPanel === item.id;
          const isStory = item.id === "story";
          return (
            <button
              key={item.id}
              onClick={() => setPanel(item.id)}
              className={cn(
                "group relative flex items-center gap-3 px-3 py-3 rounded-r transition-all duration-200 text-left",
                active
                  ? "nav-active"
                  : "hover:bg-paper-400/5 border-l-3 border-l-transparent",
                isStory && "mt-2",
              )}
            >
              {isStory && (
                <div className="absolute -top-2 left-2 right-2 h-px cloud-divider opacity-50" />
              )}
              <div
                className={cn(
                  "w-9 h-9 rounded flex items-center justify-center shrink-0 transition-colors",
                  active
                    ? "bg-cinnabar-500/20 text-gold-400 border border-gold-400/40"
                    : isStory
                      ? "bg-cinnabar-500/10 text-cinnabar-400/80 border border-cinnabar-500/30 group-hover:text-cinnabar-300 group-hover:border-cinnabar-400/50"
                      : "bg-ink-700/50 text-paper-400/60 border border-paper-400/10 group-hover:text-paper-200",
                  isStory && aiBusy && "animate-shimmer",
                )}
              >
                <Icon
                  size={18}
                  strokeWidth={1.5}
                  className={isStory && aiBusy ? "animate-spin" : ""}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className={cn(
                    "font-brush text-base tracking-wider flex items-center gap-1.5",
                    active
                      ? "text-gold-400"
                      : isStory
                        ? "text-cinnabar-300/90 group-hover:text-cinnabar-300"
                        : "text-paper-300 group-hover:text-paper-100",
                  )}
                >
                  {item.label}
                  {isStory && turnCount > 0 && (
                    <span className="font-number text-[9px] text-gold-400/70 bg-gold-400/10 px-1 rounded">
                      {turnCount}
                    </span>
                  )}
                </div>
                <div className="font-serif text-[10px] text-paper-400/50 truncate">
                  {item.subtitle}
                </div>
              </div>
              {isStory ? (
                <span
                  className={cn(
                    "w-2 h-2 rounded-full",
                    aiBusy
                      ? "bg-gold-400 animate-shimmer"
                      : hasApiKey
                        ? "bg-jade-400/70"
                        : "bg-cinnabar-500",
                  )}
                  title={
                    aiBusy ? "演化中" : hasApiKey ? "已配置" : "未配置"
                  }
                />
              ) : (
                <span
                  className={cn(
                    "font-number text-xs",
                    active ? "text-gold-400/60" : "text-paper-500/30",
                  )}
                >
                  {String(idx + 1).padStart(2, "0")}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 底部印章 */}
      <div className="px-4 pt-6 mt-auto">
        <div className="cloud-divider mb-4" />
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 red-seal rounded-sm text-xs">修</div>
          <div>
            <div className="font-brush text-paper-400/70 text-xs">道法自然</div>
            <div className="font-serif text-[9px] text-paper-500/40">v1.0 · 修真版</div>
          </div>
        </div>
      </div>
    </nav>
  );
}
