import { useState } from "react";
import { useGameStore } from "@/store/useGameStore";
import { useAIStore } from "@/store/useAIStore";
import { ScrollCard } from "@/components/ui/ScrollCard";
import { PanelTitle } from "@/components/ui/PanelTitle";
import { SealButton } from "@/components/ui/SealButton";
import { cn } from "@/lib/utils";
import type { Relation, RelationType } from "@/data/types";
import { MessageCircle } from "lucide-react";

type GroupTab = "all" | RelationType;

const GROUPS: { id: GroupTab; label: string; icon: string }[] = [
  { id: "all", label: "全部", icon: "群" },
  { id: "dao_companion", label: "道侣", icon: "侣" },
  { id: "master", label: "师父", icon: "师" },
  { id: "disciple", label: "徒弟", icon: "徒" },
  { id: "friend", label: "好友", icon: "友" },
  { id: "enemy", label: "仇敌", icon: "仇" },
];

const TYPE_LABEL: Record<RelationType, string> = {
  dao_companion: "道侣",
  master: "师父",
  disciple: "徒弟",
  friend: "好友",
  enemy: "仇敌",
};

const TYPE_COLOR: Record<RelationType, { text: string; border: string; bg: string; seal: string }> = {
  dao_companion: {
    text: "text-cinnabar-400",
    border: "border-cinnabar-500/40",
    bg: "bg-cinnabar-500/10",
    seal: "bg-cinnabar-500",
  },
  master: {
    text: "text-gold-400",
    border: "border-gold-400/40",
    bg: "bg-gold-400/10",
    seal: "bg-gold-500",
  },
  disciple: {
    text: "text-jade-400",
    border: "border-jade-500/40",
    bg: "bg-jade-500/10",
    seal: "bg-jade-500",
  },
  friend: {
    text: "text-pine-400",
    border: "border-pine-500/40",
    bg: "bg-pine-500/10",
    seal: "bg-pine-500",
  },
  enemy: {
    text: "text-cinnabar-400",
    border: "border-cinnabar-700/50",
    bg: "bg-cinnabar-700/15",
    seal: "bg-cinnabar-700",
  },
};

export function SocialPanel() {
  const relations = useGameStore((s) => s.relations);
  const [tab, setTab] = useState<GroupTab>("all");

  const filtered = tab === "all" ? relations : relations.filter((r) => r.type === tab);

  return (
    <div className="paper-texture">
      <PanelTitle
        title="尘缘"
        poem="道法自然，缘起缘灭。红尘种种，皆是修行。"
      />

      {/* 分组按钮 */}
      <div className="flex flex-wrap gap-2 mb-4">
        {GROUPS.map((g) => {
          const count =
            g.id === "all"
              ? relations.length
              : relations.filter((r) => r.type === g.id).length;
          return (
            <button
              key={g.id}
              onClick={() => setTab(g.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded font-brush text-sm tracking-wider transition-all border",
                tab === g.id
                  ? "border-gold-400/50 bg-gold-400/10 text-gold-400"
                  : "border-paper-400/15 bg-ink-900/40 text-paper-400/70 hover:text-paper-200",
              )}
            >
              <span className="text-base">{g.icon}</span>
              {g.label}
              <span className="font-number text-[10px] text-paper-400/50">({count})</span>
            </button>
          );
        })}
      </div>

      {/* 关系卡片网格 */}
      <div className="grid grid-cols-2 gap-4">
        {filtered.map((rel) => (
          <RelationCard key={rel.id} relation={rel} />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-2 text-center py-16 font-serif text-paper-400/50">
            此间空空，缘分未至
          </div>
        )}
      </div>
    </div>
  );
}

const DEFAULT_RELATION_COLOR = {
  text: "text-paper-400",
  border: "border-paper-500/40",
  bg: "bg-paper-500/10",
  seal: "bg-paper-500",
};

function RelationCard({ relation }: { relation: Relation }) {
  const openNPCChat = useAIStore((s) => s.openNPCChat);
  const c = TYPE_COLOR[relation.type] || DEFAULT_RELATION_COLOR;
  const isEnemy = relation.type === "enemy";
  const isCompanion = relation.type === "dao_companion";

  return (
    <ScrollCard className={cn("!p-4", c.bg)}>
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <div
            className={cn(
              "w-14 h-14 rounded red-seal text-xl",
              c.seal,
            )}
          >
            {relation.name.charAt(0)}
          </div>
          <div
            className={cn(
              "absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-sm font-brush text-[10px] border",
              c.border,
              c.bg,
              c.text,
            )}
          >
            {TYPE_LABEL[relation.type]}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <h3 className="font-brush text-lg text-paper-50 truncate">{relation.name}</h3>
            <span className="font-serif text-xs text-paper-400/60 truncate">
              {relation.title}
            </span>
          </div>
          <div className="font-serif text-[11px] text-gold-400/70 mt-0.5">
            {relation.realm}
          </div>

          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="font-serif text-[10px] text-paper-400/60">
                {isEnemy ? "恩怨" : "情谊"}
              </span>
              <span className="font-number text-[10px] text-paper-300">
                {relation.affinity} / {relation.affinityMax}
              </span>
            </div>
            <div className="h-2 bg-ink-900/80 rounded-sm overflow-hidden border border-paper-400/10">
              <div
                className={cn(
                  "h-full transition-all duration-500",
                  isEnemy
                    ? "bg-gradient-to-r from-cinnabar-700 to-cinnabar-400"
                    : isCompanion
                      ? "bg-gradient-to-r from-cinnabar-600 to-gold-400"
                      : "bg-gradient-to-r from-pine-500 to-jade-400",
                )}
                style={{ width: `${(relation.affinity / relation.affinityMax) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <p className="font-serif text-xs text-paper-300/80 leading-relaxed mt-3 px-1">
        {relation.note}
      </p>

      <div className="mt-3">
        <SealButton
          onClick={() => openNPCChat(relation.id)}
          variant="ghost"
          className="w-full py-1.5 text-xs"
        >
          <MessageCircle size={12} className="mr-1" />
          交谈
        </SealButton>
      </div>
    </ScrollCard>
  );
}
