import { useState } from "react";
import { useGameStore } from "@/store/useGameStore";
import { useAIStore } from "@/store/useAIStore";
import { ScrollCard } from "@/components/ui/ScrollCard";
import { CloudDivider } from "@/components/ui/CloudDivider";
import { SealButton } from "@/components/ui/SealButton";
import { cn } from "@/lib/utils";
import type { SectIndustry, SectActivity, SectHall } from "@/data/types";
import { Building2, Target, Users, Coins, TrendingDown } from "lucide-react";

type ManagementTab = "industries" | "activities" | "halls" | "treasury";

export function SectManagement() {
  const sect = useGameStore((s) => s.sect);
  const isDeveloperMode = useAIStore((s) => s.isDeveloperMode);
  const player = useGameStore((s) => s.player);

  const isLeader = player.position === "掌门" || player.position === "副掌门" || isDeveloperMode;

  const [tab, setTab] = useState<ManagementTab>("industries");

  const TABS: { id: ManagementTab; label: string; icon: React.ReactNode }[] = [
    { id: "industries", label: "宗门产业", icon: <Building2 size={14} /> },
    { id: "activities", label: "宗门活动", icon: <Target size={14} /> },
    { id: "halls", label: "各堂信息", icon: <Users size={14} /> },
    { id: "treasury", label: "物资管理", icon: <Coins size={14} /> },
  ];

  if (!isLeader) {
    return (
      <ScrollCard title="宗门管理" subtitle="权限不足">
        <div className="text-center py-12">
          <p className="font-serif text-sm text-paper-400/60">
            只有宗门高层方可查看宗门管理详情。
          </p>
          <p className="font-serif text-xs text-paper-400/40 mt-2">
            当前职位：{player.position || "普通弟子"}
          </p>
        </div>
      </ScrollCard>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-gold-500/20">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-5 py-2 font-brush text-base tracking-wider transition-all border-b-2 -mb-px flex items-center gap-2",
              tab === t.id
                ? "text-gold-400 border-gold-400"
                : "text-paper-400/60 border-transparent hover:text-paper-200",
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div>
        {tab === "industries" && <IndustryPanel industries={Array.isArray(sect?.management?.industries) ? sect.management.industries : []} />}
        {tab === "activities" && <ActivityPanel activities={Array.isArray(sect?.management?.activities) ? sect.management.activities : []} />}
        {tab === "halls" && <HallsPanel halls={Array.isArray(sect?.management?.halls) ? sect.management.halls : []} />}
        {tab === "treasury" && <TreasuryPanel treasury={sect?.management?.treasury || { spiritStones: 0, materials: [] }} consumption={sect?.management?.consumption || { dailyCost: 0, recentConsumption: [] }} />}
      </div>
    </div>
  );
}

function IndustryPanel({ industries }: { industries: SectIndustry[] }) {
  return (
    <ScrollCard title="宗门产业" subtitle="财源广进，基业长青">
      <div className="space-y-3">
        {industries.map((ind) => (
          <div key={ind.id} className="p-4 rounded border border-paper-400/10 bg-ink-900/30">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-brush text-lg text-paper-100">{ind.name}</span>
                <span className="font-number text-xs text-gold-400">Lv.{ind.level}</span>
              </div>
              <span className="font-number text-sm text-cinnabar-400">投入 {(ind.investment ?? 0).toLocaleString()} 灵石</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <span className="font-serif text-[10px] text-paper-400/50">产出</span>
                <div className="font-serif text-xs text-jade-400">{ind.production}</div>
              </div>
            </div>
            <p className="font-serif text-xs text-paper-400/60 leading-relaxed">
              {ind.description}
            </p>
          </div>
        ))}
      </div>
    </ScrollCard>
  );
}

function ActivityPanel({ activities }: { activities: SectActivity[] }) {
  const STATUS_STYLE: Record<string, string> = {
    "筹备中": "text-gold-400 border-gold-400/30 bg-gold-400/10",
    "进行中": "text-jade-400 border-jade-500/30 bg-jade-500/10",
    "已结束": "text-paper-500/50 border-paper-400/15 bg-ink-900/40",
  };

  const TYPE_STYLE: Record<string, string> = {
    "大比": "text-cinnabar-400",
    "试炼": "text-blue-400",
    "庆典": "text-gold-400",
    "祭祀": "text-purple-400",
    "远征": "text-red-400",
  };

  const DEFAULT_STATUS_STYLE = "text-paper-500/50 border-paper-400/15 bg-ink-900/40";
  const DEFAULT_TYPE_STYLE = "text-paper-400";

  return (
    <ScrollCard title="宗门活动" subtitle="凝心聚力，共襄盛举">
      <div className="space-y-3">
        {activities.map((act) => (
          <div key={act.id} className="p-4 rounded border border-paper-400/10 bg-ink-900/30">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className="font-brush text-lg text-paper-100">{act.name}</span>
                <span className={cn("font-serif text-xs px-2 py-0.5 rounded border", TYPE_STYLE[act.type] || DEFAULT_TYPE_STYLE)}>
                  {act.type}
                </span>
              </div>
              <span className={cn("font-serif text-xs px-2 py-0.5 rounded border", STATUS_STYLE[act.status] || DEFAULT_STATUS_STYLE)}>
                {act.status}
              </span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <Target size={12} className="text-paper-400/50" />
              <span className="font-serif text-xs text-paper-300">目标：{act.target}</span>
            </div>
            <p className="font-serif text-xs text-paper-400/60 leading-relaxed">
              {act.description}
            </p>
          </div>
        ))}
      </div>
    </ScrollCard>
  );
}

function HallsPanel({ halls }: { halls: SectHall[] }) {
  return (
    <ScrollCard title="各堂信息" subtitle="各司其职，共护宗门">
      <div className="grid grid-cols-2 gap-3">
        {halls.map((hall) => (
          <div key={hall.id} className="p-3 rounded border border-paper-400/10 bg-ink-900/30">
            <div className="flex items-center justify-between mb-2">
              <span className="font-brush text-base text-paper-100">{hall.name}</span>
              <span className="font-number text-[10px] text-gold-400/80">
                {hall.memberCount}/{hall.maxMembers}
              </span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-serif text-[10px] text-paper-400/50">堂主</span>
                <span className="font-serif text-xs text-paper-200">
                  {hall.master} <span className="text-paper-400/60">({hall.masterRealm})</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-serif text-[10px] text-paper-400/50">当前任务</span>
                <span className="font-serif text-xs text-jade-400">{hall.currentTask}</span>
              </div>
            </div>
            <p className="font-serif text-[10px] text-paper-400/50 mt-2 leading-relaxed">
              {hall.description}
            </p>
          </div>
        ))}
      </div>
    </ScrollCard>
  );
}

function TreasuryPanel({ treasury, consumption }: { treasury: { spiritStones: number; materials: { name: string; amount: number }[] }; consumption: { dailyCost: number; recentConsumption: { date: string; cost: number }[] } }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <ScrollCard title="宗门宝库" subtitle="灵石储备">
        <div className="text-center py-6">
          <div className="font-number text-4xl text-gold-400 mb-2">
            {(treasury.spiritStones ?? 0).toLocaleString()}
          </div>
          <div className="font-serif text-xs text-paper-400/60">下品灵石</div>
          <div className="mt-4 pt-4 border-t border-paper-400/10">
            <div className="flex items-center justify-between mb-1">
              <span className="font-serif text-xs text-paper-400/50">日消耗</span>
              <span className="font-number text-xs text-cinnabar-400">{(consumption.dailyCost ?? 0).toLocaleString()}</span>
            </div>
            <div className="h-1.5 bg-ink-900/80 rounded-sm overflow-hidden">
              <div className="h-full bg-cinnabar-500" style={{ width: `${Math.min(100, (consumption.dailyCost / 5000) * 100)}%` }} />
            </div>
          </div>
        </div>
      </ScrollCard>

      <ScrollCard title="物资库存" subtitle="各类材料储备">
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {(Array.isArray(treasury.materials) ? treasury.materials : []).map((mat) => (
            <div key={mat.name} className="flex items-center justify-between p-2 rounded bg-ink-900/20">
              <span className="font-serif text-xs text-paper-300">{mat.name}</span>
              <span className="font-number text-xs text-jade-400">{(mat.amount ?? 0).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </ScrollCard>

      <ScrollCard title="消耗记录" subtitle="近期开支" className="col-span-2">
        <div className="flex items-end gap-2 h-32">
          {(Array.isArray(consumption.recentConsumption) ? consumption.recentConsumption : []).map((item) => (
            <div key={item.date} className="flex-1 flex flex-col items-center">
              <span className="font-number text-xs text-paper-400/70 mb-1">{item.cost}</span>
              <div
                className="w-full bg-cinnabar-500/30 rounded-t"
                style={{ height: `${(item.cost / 3000) * 100}%` }}
              />
              <span className="font-serif text-[9px] text-paper-400/40 mt-1">{item.date}</span>
            </div>
          ))}
        </div>
      </ScrollCard>
    </div>
  );
}