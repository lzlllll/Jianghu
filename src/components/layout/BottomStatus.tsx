import { useGameStore } from "@/store/useGameStore";
import { StatusBar } from "@/components/ui/StatusBar";
import { CloudDivider } from "@/components/ui/CloudDivider";

export function BottomStatus() {
  const player = useGameStore((s) => s.player);
  const log = useGameStore((s) => s.log);

  return (
    <footer className="h-24 shrink-0 border-t border-gold-500/20 ink-bg flex items-stretch relative">
      {/* 状态条 */}
      <div className="flex-1 flex flex-col justify-center gap-2 px-6 py-3 border-r border-gold-500/15">
        <div className="flex items-center justify-between mb-1">
          <span className="font-brush text-sm text-gold-400/80 tracking-widest">三花聚顶</span>
          <span className="font-serif text-[10px] text-paper-400/50">
            精·气·神
          </span>
        </div>
        <StatusBar label="气血" icon="❤" current={player.hp} max={player.hpMax} color="hp" />
        <StatusBar label="灵力" icon="✦" current={player.mp} max={player.mpMax} color="mp" />
        <StatusBar label="神识" icon="◉" current={player.spirit} max={player.spiritMax} color="spirit" />
      </div>

      {/* 修行日志 */}
      <div className="w-[420px] flex flex-col px-5 py-3">
        <div className="flex items-center justify-between mb-1">
          <span className="font-brush text-sm text-gold-400/80 tracking-widest">修行录</span>
          <span className="font-serif text-[10px] text-paper-400/50">最新动态</span>
        </div>
        <CloudDivider className="my-0" />
        <div className="flex-1 overflow-y-auto pr-1 space-y-1 mt-1">
          {log.slice(0, 4).map((entry, idx) => (
            <p
              key={idx}
              className="font-serif text-xs text-paper-300/80 leading-relaxed flex gap-2"
            >
              <span className="text-gold-400/50 shrink-0">·</span>
              <span className={idx === 0 ? "text-paper-100" : ""}>{entry}</span>
            </p>
          ))}
        </div>
      </div>

      {/* 底部金线 */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-500/30 to-transparent" />
    </footer>
  );
}
