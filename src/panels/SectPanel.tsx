import { useState } from "react";
import { useGameStore } from "@/store/useGameStore";
import { useAIStore } from "@/store/useAIStore";
import { ScrollCard } from "@/components/ui/ScrollCard";
import { PanelTitle } from "@/components/ui/PanelTitle";
import { CloudDivider } from "@/components/ui/CloudDivider";
import { SealButton } from "@/components/ui/SealButton";
import { GradeTag } from "@/components/ui/GradeTag";
import { NewsPanel } from "@/components/news/NewsPanel";
import { SectManagement } from "@/components/sect/SectManagement";
import { cn } from "@/lib/utils";
import type { SectTask, SectShopItem, SectHeritage } from "@/data/types";

type SubTab = "overview" | "position" | "task" | "shop" | "heritage" | "news" | "management";

export function SectPanel() {
  const sect = useGameStore((s) => s.sect);
  const [tab, setTab] = useState<SubTab>("overview");

  const player = useGameStore((s) => s.player);
  const isDeveloperMode = useAIStore((s) => s.isDeveloperMode);
  const isLeader = player.position === "掌门" || player.position === "副掌门" || isDeveloperMode;

  const TABS: { id: SubTab; label: string }[] = [
    { id: "overview", label: "门派概览" },
    { id: "position", label: "职位晋升" },
    { id: "task", label: "门派任务" },
    { id: "shop", label: "贡献商店" },
    { id: "heritage", label: "门派底蕴" },
    { id: "news", label: "江湖快报" },
    ...(isLeader ? [{ id: "management" as SubTab, label: "宗门管理" }] : []),
  ];

  return (
    <div className="paper-texture">
      <PanelTitle
        title="宗门"
        poem="道不同，不相为谋。然宗门者，同道相护，荣辱与共。"
      />

      {/* 门派横幅 */}
      <ScrollCard className="mb-4 !bg-gradient-to-r from-ink-800/80 to-pine-700/40">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 red-seal rounded-lg text-2xl">云</div>
          <div className="flex-1">
            <div className="flex items-baseline gap-3">
              <h2 className="font-brush text-3xl text-gold-400 text-shadow-ink">
                {sect.name}
              </h2>
              <span className="font-serif text-sm text-paper-400/70">
                Lv.{sect.level} 宗门
              </span>
            </div>
            <div className="flex items-center gap-4 mt-1 font-serif text-xs text-paper-300/80">
              <span>掌门：<span className="text-gold-400/90">{sect.leader}</span></span>
              <span className="text-paper-500/40">|</span>
              <span>长老 {sect.elders} 位</span>
              <span className="text-paper-500/40">|</span>
              <span>弟子 {sect.disciples} 人</span>
              <span className="text-paper-500/40">|</span>
              <span>驻地：{sect.territory}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="font-serif text-[10px] text-paper-400/60">声望</div>
            <div className="font-number text-2xl text-gold-400">
              {sect.reputation.toLocaleString()}
            </div>
          </div>
          <div className="w-px h-12 bg-gold-500/20" />
          <div className="text-right">
            <div className="font-serif text-[10px] text-paper-400/60">我的贡献</div>
            <div className="font-number text-2xl text-cinnabar-400">
              {sect.contribution.toLocaleString()}
            </div>
          </div>
        </div>
      </ScrollCard>

      {/* 子页签 */}
      <div className="flex gap-1 mb-4 border-b border-gold-500/20">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-5 py-2 font-brush text-base tracking-wider transition-all border-b-2 -mb-px",
              tab === t.id
                ? "text-gold-400 border-gold-400"
                : "text-paper-400/60 border-transparent hover:text-paper-200",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div>
        {tab === "overview" && <SectOverview />}
        {tab === "position" && <PositionTree />}
        {tab === "task" && <TaskBoard />}
        {tab === "shop" && <ShopBoard />}
        {tab === "heritage" && <HeritageBoard />}
        {tab === "news" && <NewsPanel />}
        {tab === "management" && <SectManagement />}
      </div>
    </div>
  );
}

function SectOverview() {
  const sect = useGameStore((s) => s.sect);
  return (
    <div className="grid grid-cols-2 gap-4">
      <ScrollCard title="宗门概况" subtitle="云栖山脉，仙家福地">
        <div className="space-y-3">
          <InfoRow label="门派等级" value={`Lv.${sect.level}`} />
          <InfoRow label="门派声望" value={sect.reputation.toLocaleString()} />
          <InfoRow label="掌门" value={sect.leader} />
          <InfoRow label="护法长老" value={`${sect.elders} 位`} />
          <InfoRow label="门下弟子" value={`${sect.disciples} 人`} />
          <InfoRow label="宗门驻地" value={sect.territory} />
        </div>
      </ScrollCard>

      <ScrollCard title="宗门势力" subtitle="方圆千里，云栖称尊">
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="font-serif text-xs text-paper-300">势力影响</span>
              <span className="font-number text-xs text-gold-400">8600 / 10000</span>
            </div>
            <div className="h-2 bg-ink-900/80 rounded-sm overflow-hidden">
              <div className="h-full bg-gradient-to-r from-cinnabar-600 to-gold-400" style={{ width: "86%" }} />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="font-serif text-xs text-paper-300">资源储备</span>
              <span className="font-number text-xs text-jade-400">充裕</span>
            </div>
            <div className="h-2 bg-ink-900/80 rounded-sm overflow-hidden">
              <div className="h-full bg-gradient-to-r from-jade-500 to-pine-400" style={{ width: "72%" }} />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="font-serif text-xs text-paper-300">传承完整</span>
              <span className="font-number text-xs text-cinnabar-400">六成</span>
            </div>
            <div className="h-2 bg-ink-900/80 rounded-sm overflow-hidden">
              <div className="h-full bg-gradient-to-r from-cinnabar-600 to-cinnabar-400" style={{ width: "60%" }} />
            </div>
          </div>
          <CloudDivider />
          <p className="font-serif text-xs text-paper-400/70 leading-relaxed">
            云栖宗立派千二百年，以水系功法见长。鼎盛时为东南第一大派，
            百年前与血煞门一战，元气大伤，至今未复。门下弟子勤勉，
            渐有中兴之象。
          </p>
        </div>
      </ScrollCard>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-paper-400/10">
      <span className="font-serif text-xs text-paper-400/70">{label}</span>
      <span className="font-serif text-sm text-paper-100">{value}</span>
    </div>
  );
}

function PositionTree() {
  const positions = useGameStore((s) => Array.isArray(s.sect?.positions) ? s.sect.positions : []);
  const contribution = useGameStore((s) => s.sect?.contribution || 0);
  const promote = useGameStore((s) => s.promote);

  return (
    <ScrollCard title="职位晋升" subtitle="积功累德，步步登高">
      <div className="relative">
        {/* 树状连线 */}
        <div className="absolute left-6 top-4 bottom-4 w-px bg-gradient-to-b from-gold-400/40 to-gold-500/10" />
        <div className="space-y-2">
          {positions.map((pos) => {
            const canPromote = !pos.unlocked && contribution >= pos.contributionNeeded;
            return (
              <div
                key={pos.id}
                className={cn(
                  "relative flex items-center gap-4 pl-12 py-3 rounded border transition-all",
                  pos.isCurrent
                    ? "border-gold-400/50 bg-gold-400/10 shadow-glow"
                    : pos.unlocked
                      ? "border-jade-500/30 bg-jade-500/5"
                      : canPromote
                        ? "border-cinnabar-500/40 bg-cinnabar-500/5"
                        : "border-paper-400/10 bg-ink-900/30 opacity-60",
                )}
              >
                {/* 节点 */}
                <div
                  className={cn(
                    "absolute left-3 w-7 h-7 rounded-full flex items-center justify-center font-brush text-xs border-2",
                    pos.isCurrent
                      ? "bg-gold-400 text-ink-900 border-gold-300"
                      : pos.unlocked
                        ? "bg-jade-500/20 text-jade-400 border-jade-500/40"
                        : "bg-ink-900 text-paper-500/50 border-paper-400/20",
                  )}
                >
                  {pos.level}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-brush text-base text-paper-100">{pos.name}</span>
                    {pos.isCurrent && (
                      <span className="font-brush text-xs text-gold-400 px-1.5 py-0.5 border border-gold-400/40 rounded">
                        现任
                      </span>
                    )}
                    {pos.unlocked && !pos.isCurrent && (
                      <span className="font-serif text-[10px] text-jade-400">已达</span>
                    )}
                  </div>
                  <p className="font-serif text-xs text-paper-400/60 mt-0.5">{pos.privilege}</p>
                  <div className="font-number text-[10px] text-paper-400/50 mt-0.5">
                    需贡献 {pos.contributionNeeded.toLocaleString()}
                  </div>
                </div>

                {!pos.unlocked && (
                  <SealButton
                    onClick={() => promote(pos.id)}
                    disabled={!canPromote}
                    variant="ghost"
                    className="px-3 py-1 text-xs"
                  >
                    {canPromote ? "晋升" : "未达"}
                  </SealButton>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </ScrollCard>
  );
}

function TaskBoard() {
  const tasks = useGameStore((s) => Array.isArray(s.sect?.tasks) ? s.sect.tasks : []);

  const DIFFICULTY: Record<SectTask["difficulty"], { color: string; bg: string }> = {
    易: { color: "text-jade-400", bg: "border-jade-500/30 bg-jade-500/10" },
    中: { color: "text-gold-400", bg: "border-gold-400/30 bg-gold-400/10" },
    难: { color: "text-cinnabar-400", bg: "border-cinnabar-500/30 bg-cinnabar-500/10" },
    险: { color: "text-cinnabar-400", bg: "border-cinnabar-600/40 bg-cinnabar-600/15" },
  };

  return (
    <ScrollCard title="门派任务" subtitle="为宗出力，积攒贡献">
      <p className="font-serif text-xs text-paper-400/50 mb-3">
        请在宗门叙事中提及接取任务，系统将自动记录。
      </p>
      <div className="space-y-2">
        {tasks.map((task) => {
          const d = DIFFICULTY[task.difficulty];
          return (
            <div
              key={task.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded border",
                task.accepted
                  ? "border-jade-500/30 bg-jade-500/5 opacity-70"
                  : "border-paper-400/10 bg-ink-900/30",
              )}
            >
              <div
                className={cn(
                  "w-10 h-10 rounded flex items-center justify-center font-brush text-base border",
                  d.bg,
                  d.color,
                )}
              >
                {task.difficulty}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-brush text-base text-paper-100">{task.title}</span>
                  {task.accepted && (
                    <span className="font-serif text-[10px] text-jade-400 px-1.5 py-0.5 border border-jade-500/30 rounded">
                      已接取
                    </span>
                  )}
                </div>
                <p className="font-serif text-xs text-paper-400/60 mt-0.5 leading-relaxed">
                  {task.desc}
                </p>
                <div className="flex items-center gap-4 mt-1">
                  <span className="font-number text-[10px] text-cinnabar-400">
                    贡献 +{task.contribution}
                  </span>
                  <span className="font-number text-[10px] text-gold-400/80">
                    灵石 +{task.spiritStone}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollCard>
  );
}

function ShopBoard() {
  const shop = useGameStore((s) => Array.isArray(s.sect?.shop) ? s.sect.shop : []);
  const contribution = useGameStore((s) => s.sect?.contribution || 0);

  return (
    <ScrollCard
      title="贡献商店"
      subtitle={`现有贡献 ${contribution.toLocaleString()}`}
    >
      <p className="font-serif text-xs text-paper-400/50 mb-3">
        请在宗门叙事中提及兑换物品，系统将自动扣除贡献并发放物品。
      </p>
      <div className="grid grid-cols-2 gap-3">
        {shop.map((item: SectShopItem) => {
          const canBuy = contribution >= item.cost;
          return (
            <div
              key={item.id}
              className={cn(
                "p-3 rounded border",
                canBuy
                  ? "border-paper-400/15 bg-ink-900/30"
                  : "border-paper-400/10 bg-ink-900/20 opacity-60",
              )}
            >
              <div className="flex items-start justify-between mb-1">
                <div>
                  <h4 className="font-brush text-base text-paper-100">{item.name}</h4>
                  <span className="font-serif text-[10px] text-paper-400/50">{item.type}</span>
                </div>
                <span className="font-number text-sm text-cinnabar-400">
                  {item.cost.toLocaleString()}
                </span>
              </div>
              <p className="font-serif text-xs text-paper-400/60 leading-relaxed">
                {item.desc}
              </p>
              <div className={cn(
                "mt-2 font-serif text-xs text-center py-1 rounded",
                canBuy ? "text-jade-400/80" : "text-paper-400/30"
              )}>
                {canBuy ? "可兑换" : "贡献不足"}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollCard>
  );
}

function HeritageBoard() {
  const heritage = useGameStore((s) => Array.isArray(s.sect?.heritage) ? s.sect.heritage : []);
  const resources = useGameStore((s) => Array.isArray(s.sect?.resources) ? s.sect.resources : []);

  const STATUS_STYLE: Record<SectHeritage["status"], string> = {
    已习: "text-jade-400 border-jade-500/40 bg-jade-500/10",
    可习: "text-gold-400 border-gold-400/40 bg-gold-400/10",
    未达: "text-paper-500/50 border-paper-400/15 bg-ink-900/40",
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* 藏经阁 */}
      <ScrollCard title="藏经阁" subtitle="宗门传承所在">
        <div className="space-y-2 max-h-[440px] overflow-y-auto pr-2">
          {heritage.map((h) => (
            <div
              key={h.name}
              className="flex items-center gap-3 p-2.5 rounded border border-paper-400/10 bg-ink-900/30"
            >
              <div className="w-9 h-9 rounded bg-ink-900/60 flex items-center justify-center border border-paper-400/15">
                <span className="font-brush text-sm text-gold-400/80">
                  {h.type.charAt(0)}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-brush text-sm text-paper-100">{h.name}</span>
                  <GradeTag grade={h.grade} />
                </div>
                <span className="font-serif text-[10px] text-paper-400/50">{h.type}</span>
              </div>
              <span
                className={cn(
                  "font-serif text-xs px-2 py-0.5 rounded border",
                  STATUS_STYLE[h.status],
                )}
              >
                {h.status}
              </span>
            </div>
          ))}
        </div>
      </ScrollCard>

      {/* 仓库库存 */}
      <ScrollCard title="宗门仓库" subtitle="公用物资储备">
        <div className="space-y-2 max-h-[440px] overflow-y-auto pr-2">
          {resources.map((r) => (
            <div
              key={r.name}
              className="flex items-center justify-between p-2.5 rounded border border-paper-400/10 bg-ink-900/30"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-gradient-to-b from-gold-400/20 to-ink-900/40 flex items-center justify-center border border-gold-500/20">
                  <span className="text-xs text-gold-400/80">材</span>
                </div>
                <span className="font-serif text-sm text-paper-200">{r.name}</span>
              </div>
              <div className="text-right">
                <span className="font-number text-sm text-gold-400">
                  {r.amount.toLocaleString()}
                </span>
                <span className="font-serif text-[10px] text-paper-400/50 ml-1">
                  {r.unit}
                </span>
              </div>
            </div>
          ))}
        </div>
      </ScrollCard>
    </div>
  );
}
