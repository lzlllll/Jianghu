import { useState } from "react";
import { useGameStore } from "@/store/useGameStore";
import { useAIStore } from "@/store/useAIStore";
import { ScrollCard } from "@/components/ui/ScrollCard";
import { PanelTitle } from "@/components/ui/PanelTitle";
import { CloudDivider } from "@/components/ui/CloudDivider";
import { cn } from "@/lib/utils";
import type { Buff, ShieldData } from "@/data/types";
import { Shield, Sparkles, Clock, AlertTriangle, X, Plus } from "lucide-react";

export function StatusPanel() {
  const buffs = useGameStore((s) => s.player.buffs ?? []);
  const shields = useGameStore((s) => s.player.shields ?? []);
  const removeBuff = useGameStore((s) => s.removeBuff);
  const consumeShield = useGameStore((s) => s.consumeShield);
  const isDeveloperMode = useAIStore((s) => s.isDeveloperMode);
  const addBuff = useGameStore((s) => s.addBuff);
  const addShield = useGameStore((s) => s.addShield);

  const [showAddBuff, setShowAddBuff] = useState(false);
  const [showAddShield, setShowAddShield] = useState(false);

  const activeBuffs = buffs.filter((b) => b.durationType !== "instant");
  const activeShields = shields.filter((s) => s.value > 0);

  const hasAnyEffect = activeBuffs.length > 0 || activeShields.length > 0;

  return (
    <div className="paper-texture">
      <PanelTitle
        title="状态"
        poem="天地造化，五行流转。吉凶祸福，皆在一念之间。"
      />

      {/* Buffs */}
      <ScrollCard title="当前效果" subtitle="所有生效中的增益与减益">
        {activeBuffs.length === 0 ? (
          <div className="text-center py-8">
            <Sparkles size={32} className="mx-auto mb-2 text-paper-400/30" />
            <p className="font-serif text-sm text-paper-400/50">暂无生效效果</p>
            <p className="font-serif text-xs text-paper-400/30 mt-1">
              丹药、法术、事件皆可产生临时效果
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeBuffs.map((buff) => (
              <BuffCard
                key={buff.id}
                buff={buff}
                canRemove={isDeveloperMode}
                onRemove={() => removeBuff(buff.id)}
              />
            ))}
          </div>
        )}

        {isDeveloperMode && (
          <>
            <CloudDivider label="开发者" />

            <div className="flex gap-2">
              <button
                onClick={() => setShowAddBuff(!showAddBuff)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-gold-400/30 bg-gold-400/5 text-gold-400/80 text-xs font-brush hover:bg-gold-400/10 transition"
              >
                <Plus size={14} /> 添加效果
              </button>
              <button
                onClick={() => setShowAddShield(!showAddShield)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-jade-400/30 bg-jade-400/5 text-jade-400/80 text-xs font-brush hover:bg-jade-400/10 transition"
              >
                <Shield size={14} /> 添加护盾
              </button>
            </div>

            {showAddBuff && (
              <AddBuffMini
                onAdd={(b) => { addBuff(b); setShowAddBuff(false); }}
                onCancel={() => setShowAddBuff(false)}
              />
            )}

            {showAddShield && (
              <AddShieldMini
                onAdd={(s) => { addShield(s); setShowAddShield(false); }}
                onCancel={() => setShowAddShield(false)}
              />
            )}
          </>
        )}
      </ScrollCard>

      {/* Shields */}
      <ScrollCard className="mt-4" title="护盾" subtitle="额外防护层">
        {activeShields.length === 0 ? (
          <div className="text-center py-6">
            <Shield size={28} className="mx-auto mb-2 text-paper-400/30" />
            <p className="font-serif text-xs text-paper-400/50">暂无护盾</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeShields.map((shield) => (
              <div
                key={shield.id}
                className="flex items-center justify-between p-3 rounded border border-jade-500/20 bg-jade-500/5"
              >
                <div className="flex items-center gap-2">
                  <Shield size={16} className="text-jade-400/70" />
                  <div>
                    <div className="font-brush text-sm text-paper-200">{shield.name}</div>
                    {shield.source && (
                      <div className="font-number text-[10px] text-paper-400/50">{shield.source}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-ink-900/60 rounded-full overflow-hidden border border-paper-400/10">
                    <div
                      className="h-full bg-jade-400/60 rounded-full transition-all"
                      style={{ width: `${(shield.value / shield.maxValue) * 100}%` }}
                    />
                  </div>
                  <span className="font-number text-xs text-jade-400">
                    {shield.value}/{shield.maxValue}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollCard>

      {/* Placeholder for when nothing is present */}
      {!hasAnyEffect && (
        <div className="mt-8 text-center">
          <div className="cloud-divider mb-4" />
          <p className="font-brush text-sm text-paper-400/30">
            道法自然，万物皆空
          </p>
        </div>
      )}
    </div>
  );
}

function BuffCard({
  buff,
  canRemove,
  onRemove,
}: {
  buff: Buff;
  canRemove: boolean;
  onRemove: () => void;
}) {
  const durationLabel = () => {
    if (buff.durationType === "permanent") return "永久";
    if (buff.durationType === "conditional") return buff.condition ?? "条件触发";
    if (buff.durationType === "round" && buff.duration !== undefined) return `剩余 ${buff.duration} 回合`;
    return "";
  };

  const getStatLabel = (stat?: string) => {
    const labels: Record<string, string> = {
      vitality: "体力", soul: "神识", wisdom: "聪慧", agility: "敏捷",
      hp: "生命", mp: "灵力", spirit: "精神", cultivation: "修为",
      maxHp: "最大生命", maxMp: "最大灵力", maxSpirit: "最大精神",
      attack: "攻击", defense: "防御", damage: "伤害", dodge: "闪避",
      speed: "速度", critRate: "暴击率", critDamage: "暴伤",
      breakthrough: "突破", comprehension: "领悟", meridianRepair: "经脉修复",
      trading: "交易", karma: "因果", action: "行动",
    };
    return stat ? (labels[stat] ?? stat) : "综合";
  };

  return (
    <div
      className={cn(
        "relative p-3 rounded border flex items-start gap-3 transition-all",
        buff.isDebuff
          ? "border-cinnabar-500/30 bg-cinnabar-500/5"
          : "border-jade-500/20 bg-jade-500/5",
      )}
    >
      <div
        className={cn(
          "w-9 h-9 rounded flex items-center justify-center shrink-0 text-base",
          buff.isDebuff
            ? "bg-cinnabar-500/10 text-cinnabar-400 border border-cinnabar-500/30"
            : "bg-jade-500/10 text-jade-400 border border-jade-500/30",
        )}
      >
        {buff.icon}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-brush text-sm text-paper-100">{buff.name}</span>
          {buff.stacks > 1 && (
            <span className="font-number text-[10px] text-gold-400/70">×{buff.stacks}</span>
          )}
          <span className={cn(
            "font-number text-[10px] px-1 py-0.5 rounded",
            buff.isDebuff ? "bg-cinnabar-500/10 text-cinnabar-400" : "bg-jade-500/10 text-jade-400",
          )}>
            {buff.isDebuff ? "减益" : "增益"}
          </span>
        </div>

        {buff.description && (
          <p className="font-serif text-xs text-paper-400/70 mt-0.5 leading-relaxed">
            {buff.description}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 mt-1.5">
          {buff.effects.map((effect, i) => (
            <span key={i} className="font-number text-[10px] text-paper-400/60">
              {getStatLabel(effect.stat)}
              {effect.valueType === "percentage"
                ? ` ${effect.value > 0 ? "+" : ""}${effect.value}%`
                : effect.valueType === "multiplier"
                  ? ` ×${effect.value}`
                  : ` ${effect.value > 0 ? "+" : ""}${effect.value}`}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-3 mt-1">
          <span className="flex items-center gap-1 font-number text-[10px] text-paper-400/50">
            <Clock size={10} /> {durationLabel()}
          </span>
          {buff.source && (
            <span className="font-number text-[10px] text-paper-400/40">
              来自: {buff.source}
            </span>
          )}
        </div>
      </div>

      {canRemove && (
        <button
          onClick={onRemove}
          className="w-6 h-6 rounded flex items-center justify-center text-paper-400/40 hover:text-cinnabar-400 hover:bg-cinnabar-500/10 transition"
          title="移除效果"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

function AddBuffMini({
  onAdd,
  onCancel,
}: {
  onAdd: (b: Buff) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [icon, setIcon] = useState("⚡");
  const [isDebuff, setIsDebuff] = useState(false);
  const [durationType, setDurationType] = useState<Buff["durationType"]>("round");
  const [duration, setDuration] = useState(3);

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd({
      id: `buff-${Date.now()}`,
      name: name.trim(),
      category: "status",
      icon,
      durationType,
      duration: durationType === "round" ? duration : undefined,
      stacks: 1,
      maxStacks: 5,
      effects: [],
      isDebuff,
      description: desc.trim() || undefined,
    });
  };

  return (
    <div className="p-3 rounded border border-gold-400/30 bg-ink-900/40 space-y-2">
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="效果名称（如：疲劳）"
          className="flex-1 px-2 py-1 rounded bg-ink-900/60 border border-paper-400/10 text-paper-100 text-xs font-serif outline-none focus:border-gold-400/40"
        />
        <input
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          placeholder="图标"
          className="w-16 px-2 py-1 rounded bg-ink-900/60 border border-paper-400/10 text-paper-100 text-xs font-serif outline-none focus:border-gold-400/40"
        />
      </div>
      <input
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        placeholder="效果描述（如：战斗后积攒，降低行动力）"
        className="w-full px-2 py-1 rounded bg-ink-900/60 border border-paper-400/10 text-paper-100 text-xs font-serif outline-none focus:border-gold-400/40"
      />
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1 text-xs text-paper-400/70">
          <input
            type="checkbox"
            checked={isDebuff}
            onChange={(e) => setIsDebuff(e.target.checked)}
          /> 减益
        </label>
        <select
          value={durationType}
          onChange={(e) => setDurationType(e.target.value as Buff["durationType"])}
          className="px-2 py-1 rounded bg-ink-900/60 border border-paper-400/10 text-paper-100 text-xs font-serif outline-none"
        >
          <option value="round">回合制</option>
          <option value="permanent">永久</option>
          <option value="conditional">条件式</option>
        </select>
        {durationType === "round" && (
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(Math.max(1, Number(e.target.value)))}
            className="w-16 px-2 py-1 rounded bg-ink-900/60 border border-paper-400/10 text-paper-100 text-xs font-number outline-none"
            min={1}
          />
        )}
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleAdd}
          className="px-3 py-1 rounded bg-gold-400/20 text-gold-400 text-xs font-brush hover:bg-gold-400/30 transition"
        >
          添加
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1 rounded border border-paper-400/10 text-paper-400/60 text-xs hover:text-paper-200 transition"
        >
          取消
        </button>
      </div>
    </div>
  );
}

function AddShieldMini({
  onAdd,
  onCancel,
}: {
  onAdd: (s: ShieldData) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [value, setValue] = useState(50);

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd({
      id: `shield-${Date.now()}`,
      name: name.trim(),
      value: Math.max(1, value),
      maxValue: Math.max(1, value),
    });
  };

  return (
    <div className="p-3 rounded border border-jade-400/30 bg-ink-900/40 space-y-2">
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="护盾名称"
          className="flex-1 px-2 py-1 rounded bg-ink-900/60 border border-paper-400/10 text-paper-100 text-xs font-serif outline-none focus:border-jade-400/40"
        />
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(Math.max(1, Number(e.target.value)))}
          className="w-20 px-2 py-1 rounded bg-ink-900/60 border border-paper-400/10 text-paper-100 text-xs font-number outline-none"
          min={1}
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleAdd}
          className="px-3 py-1 rounded bg-jade-400/20 text-jade-400 text-xs font-brush hover:bg-jade-400/30 transition"
        >
          添加
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1 rounded border border-paper-400/10 text-paper-400/60 text-xs hover:text-paper-200 transition"
        >
          取消
        </button>
      </div>
    </div>
  );
}
