import { useState } from "react";
import { useGameStore } from "@/store/useGameStore";
import { REALMS, HEART_STAT_DISPLAY, generateHeartModifiers } from "@/data/mockData";
import { ScrollCard } from "@/components/ui/ScrollCard";
import { PanelTitle } from "@/components/ui/PanelTitle";
import { CloudDivider } from "@/components/ui/CloudDivider";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { cn } from "@/lib/utils";

const ELEMENT_COLORS: Record<string, string> = {
  金: "from-paper-300 to-paper-400",
  木: "from-jade-400 to-jade-500",
  水: "from-pine-400 to-pine-500",
  火: "from-cinnabar-400 to-cinnabar-500",
  土: "from-gold-500 to-gold-600",
  风: "from-sky-400 to-sky-500",
  雷: "from-purple-400 to-purple-500",
  冰: "from-cyan-400 to-cyan-500",
  光: "from-yellow-200 to-yellow-300",
  暗: "from-slate-600 to-slate-700",
};

const STAT_LABELS: Record<string, { name: string; desc: string; icon: string }> = {
  vitality: { name: "体力", desc: "物理伤害基数", icon: "体" },
  soul: { name: "神魂", desc: "法术伤害+神识", icon: "神" },
  wisdom: { name: "悟性", desc: "修炼效率+领悟", icon: "悟" },
  agility: { name: "身法", desc: "闪避+出手顺序", icon: "速" },
};

export function ProfilePanel() {
  const [activeTab, setActiveTab] = useState<"heart" | "body">("heart");
  const player = useGameStore((s) => s.player);

  const currentRealm = REALMS[player.realmIndex];
  const nextRealm = REALMS[player.realmIndex + 1];
  const realmProgress = nextRealm
    ? (player.cultivation / nextRealm.cultivationNeeded) * 100
    : 100;

  const groupedMeridians = (player.meridians || []).reduce((acc, m) => {
    if (!acc[m.zone]) acc[m.zone] = [];
    acc[m.zone].push(m);
    return acc;
  }, {} as Record<string, typeof player.meridians>);

  return (
    <div className="paper-texture">
      <PanelTitle
        title={activeTab === "heart" ? "心性" : "法身"}
        poem={activeTab === "heart" ? "心者，神之舍也。性者，心之理也。" : "法身者，大道之体也，非血肉之躯。"}
      />

      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab("heart")}
          className={cn(
            "px-8 py-4 rounded-lg font-brush text-xl tracking-widest transition-all border",
            activeTab === "heart"
              ? "border-gold-400/50 bg-gold-400/10 text-gold-400 shadow-glow"
              : "border-paper-400/15 bg-ink-900/40 text-paper-400/70 hover:text-paper-200",
          )}
        >
          心性
        </button>
        <button
          onClick={() => setActiveTab("body")}
          className={cn(
            "px-8 py-4 rounded-lg font-brush text-xl tracking-widest transition-all border",
            activeTab === "body"
              ? "border-gold-400/50 bg-gold-400/10 text-gold-400 shadow-glow"
              : "border-paper-400/15 bg-ink-900/40 text-paper-400/70 hover:text-paper-200",
          )}
        >
          法身
        </button>
      </div>

      {activeTab === "heart" && (
        <div className="space-y-6">
          <ScrollCard title="心性" subtitle="八面玲珑，一念之差">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {(player.stats?.heartScores || []).map((hs) => {
                const modifiers = hs.modifiers && hs.modifiers.length > 0
                  ? hs.modifiers
                  : generateHeartModifiers(hs.trait, hs.score);
                return (
                  <div
                    key={hs.trait}
                    className="flex flex-col p-4 rounded-lg bg-ink-800/40 border border-paper-400/10"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-brush text-xl text-paper-100">{hs.trait}</span>
                      <span className="font-number text-lg text-gold-400">{hs.score}</span>
                    </div>
                    <div className="w-full h-3 bg-ink-900/60 rounded-full overflow-hidden mb-4">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          hs.score >= 70 ? "bg-gold-500/80" : hs.score >= 40 ? "bg-paper-400/60" : "bg-cinnabar-500/50",
                        )}
                        style={{ width: `${hs.score}%` }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      {modifiers.map((mod, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            "flex items-center justify-between text-sm px-3 py-1.5 rounded",
                            mod.value > 0
                              ? "bg-jade-500/10 text-jade-300 border border-jade-500/20"
                              : "bg-cinnabar-500/10 text-cinnabar-300 border border-cinnabar-500/20",
                          )}
                        >
                          <span className="font-brush">
                            {HEART_STAT_DISPLAY[mod.stat] || mod.stat}
                          </span>
                          <span className="font-number">{mod.value > 0 ? "+" : ""}{mod.value}%</span>
                        </div>
                      ))}
                      {modifiers.length === 0 && (
                        <div className="text-sm text-paper-400/40 text-center py-1">暂无加成</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollCard>

          <div className="grid grid-cols-2 gap-6">
            <ScrollCard title="修炼历程" subtitle="回首来路，初心不改">
              <div className="relative pl-6 max-h-[300px] overflow-y-auto">
                <div className="absolute left-2 top-2 bottom-2 w-px bg-gradient-to-b from-gold-400/40 via-gold-500/20 to-transparent" />

                {player.timeline.slice().reverse().map((event, idx) => (
                  <div key={idx} className="relative mb-5 last:mb-0">
                    <div
                      className={cn(
                        "absolute -left-[16px] top-1 w-5 h-5 rounded-full border-2",
                        idx === 0
                          ? "bg-gold-400 border-gold-300 shadow-glow"
                          : "bg-ink-800 border-gold-500/40",
                      )}
                    />
                    <div className="font-brush text-lg text-gold-400/90">{event.year}</div>
                    <div className="font-serif text-lg text-paper-100 mt-1">{event.title}</div>
                    <p className="font-serif text-base text-paper-400/70 leading-relaxed mt-1">
                      {event.detail}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollCard>

            <ScrollCard title="身世背景" subtitle="本命由来，因果之源" ornament={
              <span className="font-brush text-sm text-gold-400/40">本命</span>
            }>
              <div className="relative">
                <div className="absolute -left-2 -top-2 font-brush text-7xl text-cinnabar-500/15 select-none pointer-events-none">
                  {(player.background || "").charAt(0) || "沈"}
                </div>
                <p className="font-serif text-lg text-paper-100 leading-loose tracking-wide indent-[2em] relative z-10 whitespace-pre-wrap">
                  {player.background || "暂无记载。"}
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-gold-500/15 flex items-center justify-between">
                <span className="font-serif text-sm text-paper-400/50">
                  共 {(player.background || "").length} 字
                </span>
                <span className="font-brush text-base text-gold-400/40 tracking-wider">
                  · 本命录 ·
                </span>
              </div>
            </ScrollCard>
          </div>
        </div>
      )}

      {activeTab === "body" && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-6">
            <ScrollCard title="境界" subtitle="九层云梯，一步一重天" className="col-span-1">
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                {REALMS.map((realm, idx) => {
                  const isCurrent = idx === player.realmIndex;
                  const isPast = idx < player.realmIndex;
                  const isNext = idx === player.realmIndex + 1;
                  return (
                    <div
                      key={idx}
                      className={cn(
                        "flex items-center gap-3 px-3 py-3 rounded transition-all",
                        isCurrent && "bg-gold-400/15 border border-gold-400/40 shadow-glow",
                        isPast && "opacity-40",
                        isNext && "border border-dashed border-cinnabar-500/30",
                        !isCurrent && !isPast && !isNext && "opacity-25",
                      )}
                      style={{ marginLeft: `${(idx % 5) * 8}px` }}
                    >
                      <div
                        className={cn(
                          "w-9 h-9 rounded flex items-center justify-center font-brush text-lg shrink-0",
                          isCurrent
                            ? "bg-gold-400 text-ink-900"
                            : isPast
                              ? "bg-pine-600/40 text-paper-400"
                              : "bg-ink-700/60 text-paper-500/50",
                        )}
                      >
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <div
                          className={cn(
                            "font-brush text-xl",
                            isCurrent ? "text-gold-400" : "text-paper-300",
                          )}
                        >
                          {realm.name}
                          <span className="font-serif text-base text-paper-400/60 ml-1">
                            · {realm.stage}
                          </span>
                        </div>
                        {!isPast && (
                          <div className="font-number text-sm text-paper-400/50">
                            需修为 {realm.cultivationNeeded.toLocaleString()}
                          </div>
                        )}
                      </div>
                      {isCurrent && (
                        <span className="text-gold-400 text-base font-brush animate-shimmer">★</span>
                      )}
                      {isPast && <span className="text-jade-400/60 text-base">✓</span>}
                    </div>
                  );
                })}
              </div>

              <CloudDivider />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-serif text-base text-paper-300">
                    当前：{currentRealm.name}{currentRealm.stage}
                  </span>
                  {nextRealm && (
                    <span className="font-serif text-base text-paper-400/60">
                      下一境：{nextRealm.name}{nextRealm.stage}
                    </span>
                  )}
                </div>
                <ProgressBar
                  value={player.cultivation}
                  max={nextRealm?.cultivationNeeded ?? player.cultivation}
                  showText
                  height={16}
                />
              </div>
            </ScrollCard>

            <div className="col-span-2 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <ScrollCard title="灵根" subtitle="五行资质，天生注定">
                  <div className="space-y-3">
                    {player.spiritRoots.map((root) => (
                      <div key={root.element} className="flex items-center gap-3">
                        <div
                          className={cn(
                            "w-10 h-10 rounded flex items-center justify-center font-brush text-2xl bg-gradient-to-b shrink-0",
                            ELEMENT_COLORS[root.element],
                          )}
                        >
                          {root.element}
                        </div>
                        <div className="flex-1">
                          <ProgressBar
                            value={root.value}
                            max={100}
                            barClassName={cn("bg-gradient-to-r", ELEMENT_COLORS[root.element])}
                            height={14}
                          />
                        </div>
                        <span className="font-number text-lg text-paper-300 w-12 text-right">
                          {root.value}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-gold-500/15">
                    <p className="font-serif text-base text-paper-400/70 leading-relaxed">
                      <span className="text-gold-400">水木双灵根</span>，资质上佳，
                      <span className="text-jade-400">适于水系功法</span>。
                      虽非天灵根，然勤修可补。
                    </p>
                  </div>
                </ScrollCard>

                <ScrollCard title="潜能" subtitle="四大根基，定修行上限">
                  <div className="space-y-4">
                    {Object.entries(player.stats || {}).map(([key, val]) => {
                      if (key === "heartScores") return null;
                      const stat = STAT_LABELS[key as keyof typeof STAT_LABELS];
                      if (!stat) return null;
                      const value = val as number;
                      return (
                        <div key={key} className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded bg-ink-700/60 flex items-center justify-center font-brush text-lg text-gold-400/80 border border-paper-400/10">
                            {stat.icon}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-serif text-base text-paper-300">{stat.name}</span>
                              <span className="font-number text-lg text-gold-400">{value}</span>
                            </div>
                            <ProgressBar
                              value={value}
                              max={100}
                              height={10}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollCard>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <ScrollCard title="寿元" subtitle="沙漏倾泻，光阴如水">
                  <div className="flex flex-col items-center py-6">
                    <div className="relative w-28 h-36 mb-5">
                      <div className="absolute inset-x-0 top-0 h-16 bg-ink-900/60 border border-gold-500/30 rounded-t-lg overflow-hidden">
                        <div
                          className="absolute bottom-0 left-0 right-0 bg-gold-400/60"
                          style={{ height: `${100 - (player.lifespanCurrent / player.lifespanMax) * 100}%` }}
                        />
                      </div>
                      <div className="absolute inset-x-0 bottom-0 h-16 bg-ink-900/60 border border-gold-500/30 rounded-b-lg overflow-hidden">
                        <div
                          className="absolute bottom-0 left-0 right-0 bg-gold-400/60"
                          style={{ height: `${(player.lifespanCurrent / player.lifespanMax) * 50}%` }}
                        />
                      </div>
                      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-5 bg-gold-400/40" />
                      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 w-0.5 h-12 bg-gold-300/60 animate-sandFall" style={{ animationDuration: "2.5s" }} />
                    </div>
                    <div className="text-center">
                      <div className="font-number text-4xl text-gold-400">
                        {player.lifespanCurrent}
                        <span className="text-paper-400/50 text-xl"> / {player.lifespanMax}</span>
                      </div>
                      <div className="font-serif text-base text-paper-400/60 mt-3">岁</div>
                    </div>
                    <div className="mt-4 px-5 py-2 rounded bg-jade-500/10 border border-jade-500/30">
                      <span className="font-serif text-lg text-jade-400">寿元充盈</span>
                    </div>
                  </div>
                </ScrollCard>

                <ScrollCard title="经脉" subtitle="十二经脉，气血运行">
                  <div className="relative flex justify-center">
                    <div className="relative w-[340px] h-[420px]">
                      <div className="absolute inset-0 flex flex-col items-center justify-between">
                        {/* 头部 */}
                        <div className="flex flex-col items-center">
                          <div className="w-16 h-16 rounded-full border-2 border-paper-400/20 bg-paper-400/5 flex items-center justify-center">
                            <span className="font-brush text-base text-paper-400/40">头</span>
                          </div>
                          <div className="flex flex-col items-center gap-1 mt-2">
                            {groupedMeridians["head"]?.map((m) => (
                              <div
                                key={m.id}
                                className={cn(
                                  "px-3 py-1 rounded text-sm font-brush border whitespace-nowrap",
                                  m.damage
                                    ? "bg-cinnabar-500/20 text-cinnabar-300 border-cinnabar-500/30"
                                    : m.clarity >= 80
                                      ? "bg-gold-500/20 text-gold-300 border-gold-500/30"
                                      : "bg-paper-400/15 text-paper-300 border-paper-400/20",
                                )}
                              >
                                {m.name} {m.clarity}%
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* 胸腹 */}
                        <div className="flex flex-col items-center">
                          <div className="w-28 h-24 border-2 border-paper-400/20 bg-paper-400/5 flex items-center justify-center rounded">
                            <span className="font-brush text-base text-paper-400/40">躯干</span>
                          </div>
                          <div className="flex flex-col items-center gap-1 mt-2">
                            {groupedMeridians["chest"]?.map((m) => (
                              <div
                                key={m.id}
                                className={cn(
                                  "px-3 py-1 rounded text-sm font-brush border whitespace-nowrap",
                                  m.damage
                                    ? "bg-cinnabar-500/20 text-cinnabar-300 border-cinnabar-500/30"
                                    : m.clarity >= 80
                                      ? "bg-gold-500/20 text-gold-300 border-gold-500/30"
                                      : "bg-paper-400/15 text-paper-300 border-paper-400/20",
                                )}
                              >
                                {m.name} {m.clarity}%
                              </div>
                            ))}
                            {groupedMeridians["abdomen"]?.map((m) => (
                              <div
                                key={m.id}
                                className={cn(
                                  "px-3 py-1 rounded text-sm font-brush border whitespace-nowrap",
                                  m.damage
                                    ? "bg-cinnabar-500/20 text-cinnabar-300 border-cinnabar-500/30"
                                    : m.clarity >= 80
                                      ? "bg-gold-500/20 text-gold-300 border-gold-500/30"
                                      : "bg-paper-400/15 text-paper-300 border-paper-400/20",
                                )}
                              >
                                {m.name} {m.clarity}%
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* 手臂 */}
                        <div className="flex w-full justify-between px-4">
                          <div className="flex flex-col items-start">
                            <div className="w-14 h-20 border-2 border-paper-400/20 bg-paper-400/5 flex items-center justify-center rounded">
                              <span className="font-brush text-base text-paper-400/40">左</span>
                            </div>
                            <div className="flex flex-col items-center gap-1 mt-2">
                              {groupedMeridians["arm_left"]?.map((m) => (
                                <div
                                  key={m.id}
                                  className={cn(
                                    "px-3 py-1 rounded text-sm font-brush border whitespace-nowrap",
                                    m.damage
                                      ? "bg-cinnabar-500/20 text-cinnabar-300 border-cinnabar-500/30"
                                      : m.clarity >= 80
                                        ? "bg-gold-500/20 text-gold-300 border-gold-500/30"
                                        : "bg-paper-400/15 text-paper-300 border-paper-400/20",
                                  )}
                                >
                                  {m.name} {m.clarity}%
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="flex flex-col items-end">
                            <div className="w-14 h-20 border-2 border-paper-400/20 bg-paper-400/5 flex items-center justify-center rounded">
                              <span className="font-brush text-base text-paper-400/40">右</span>
                            </div>
                            <div className="flex flex-col items-center gap-1 mt-2">
                              {groupedMeridians["arm_right"]?.map((m) => (
                                <div
                                  key={m.id}
                                  className={cn(
                                    "px-3 py-1 rounded text-sm font-brush border whitespace-nowrap",
                                    m.damage
                                      ? "bg-cinnabar-500/20 text-cinnabar-300 border-cinnabar-500/30"
                                      : m.clarity >= 80
                                        ? "bg-gold-500/20 text-gold-300 border-gold-500/30"
                                        : "bg-paper-400/15 text-paper-300 border-paper-400/20",
                                  )}
                                >
                                  {m.name} {m.clarity}%
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* 腿 */}
                        <div className="flex w-full justify-between px-4">
                          <div className="flex flex-col items-start">
                            <div className="w-14 h-20 border-2 border-paper-400/20 bg-paper-400/5 flex items-center justify-center rounded">
                              <span className="font-brush text-base text-paper-400/40">左足</span>
                            </div>
                            <div className="flex flex-col items-center gap-1 mt-2">
                              {groupedMeridians["leg_left"]?.map((m) => (
                                <div
                                  key={m.id}
                                  className={cn(
                                    "px-3 py-1 rounded text-sm font-brush border whitespace-nowrap",
                                    m.damage
                                      ? "bg-cinnabar-500/20 text-cinnabar-300 border-cinnabar-500/30"
                                      : m.clarity >= 80
                                        ? "bg-gold-500/20 text-gold-300 border-gold-500/30"
                                        : "bg-paper-400/15 text-paper-300 border-paper-400/20",
                                  )}
                                >
                                  {m.name} {m.clarity}%
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="flex flex-col items-end">
                            <div className="w-14 h-20 border-2 border-paper-400/20 bg-paper-400/5 flex items-center justify-center rounded">
                              <span className="font-brush text-base text-paper-400/40">右足</span>
                            </div>
                            <div className="flex flex-col items-center gap-1 mt-2">
                              {groupedMeridians["leg_right"]?.map((m) => (
                                <div
                                  key={m.id}
                                  className={cn(
                                    "px-3 py-1 rounded text-sm font-brush border whitespace-nowrap",
                                    m.damage
                                      ? "bg-cinnabar-500/20 text-cinnabar-300 border-cinnabar-500/30"
                                      : m.clarity >= 80
                                        ? "bg-gold-500/20 text-gold-300 border-gold-500/30"
                                        : "bg-paper-400/15 text-paper-300 border-paper-400/20",
                                  )}
                                >
                                  {m.name} {m.clarity}%
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gold-500/15 flex flex-wrap justify-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-gold-500/80"></span>
                      <span className="font-serif text-sm text-paper-400/60">通畅(&gt;=80%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-paper-400/60"></span>
                      <span className="font-serif text-sm text-paper-400/60">滞塞(40-79%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-cinnabar-500/50"></span>
                      <span className="font-serif text-sm text-paper-400/60">阻滞(&lt;40%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-cinnabar-500/30 border border-cinnabar-500/50"></span>
                      <span className="font-serif text-sm text-paper-400/60">损伤</span>
                    </div>
                  </div>
                </ScrollCard>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
