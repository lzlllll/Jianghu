import { useGameStore } from "@/store/useGameStore";
import { useAIStore } from "@/store/useAIStore";
import { REALMS } from "@/data/mockData";
import { Settings, Download, Upload, RotateCcw, Clock } from "lucide-react";
import { LocationSelector } from "./LocationSelector";
import type { GameSnapshot } from "@/data/types";

const HOUR_NAMES = ["子时", "丑时", "寅时", "卯时", "辰时", "巳时", "午时", "未时", "申时", "酉时", "戌时", "亥时"];

interface TopBannerProps {
  onOpenSettings: () => void;
}

export function TopBanner({ onOpenSettings }: TopBannerProps) {
  const player = useGameStore((s) => s.player);
  const currentTime = useGameStore((s) => s.currentTime);
  const realm = REALMS[player.realmIndex];
  const hasApiKey = useAIStore((s) => !!s.settings.apiKey);
  const stage = useAIStore((s) => s.conversation.stage);

  return (
    <header className="relative h-20 shrink-0 border-b border-gold-500/20 ink-bg flex items-center px-6 overflow-hidden">
      {/* 远山剪影 */}
      <svg
        className="absolute bottom-0 left-0 w-full h-full opacity-20 pointer-events-none"
        viewBox="0 0 1200 80"
        preserveAspectRatio="none"
      >
        <path
          d="M0,80 L0,55 Q100,30 200,45 T400,40 T600,48 T800,35 T1000,42 T1200,38 L1200,80 Z"
          fill="#3a4a4a"
        />
        <path
          d="M0,80 L0,65 Q150,45 300,58 T600,62 T900,55 T1200,60 L1200,80 Z"
          fill="#241f1a"
        />
      </svg>

      {/* 道号与境界 */}
      <div className="relative flex items-center gap-6 z-10">
        {/* 印章式头像 */}
        <div className="relative">
          <div className="w-14 h-14 red-seal rounded-sm text-2xl font-brush">
            {player.name?.charAt(0) || "道"}
          </div>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-ink-900 border border-gold-400 flex items-center justify-center">
            <span className="text-[8px] text-gold-400">道</span>
          </div>
        </div>

        <div>
          <div className="flex items-baseline gap-3">
            <h1 className="font-brush text-2xl text-paper-50 text-shadow-ink tracking-widest">
              {player.name}
            </h1>
            <span className="font-serif text-xs text-gold-400/80">「{player.title}」</span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="font-serif text-xs text-paper-300">
              <span className="text-cinnabar-400">{realm.name}</span>
              <span className="text-paper-400/60 mx-1">·</span>
              <span className="text-gold-400">{realm.stage}</span>
            </span>
            <span className="text-paper-500/40">|</span>
            <span className="font-serif text-xs text-paper-400/80">
              {player.sectName} · {player.position}
            </span>
          </div>
        </div>
      </div>

      {/* 右侧修为进度 */}
      <div className="relative ml-auto z-10 flex items-center gap-6">
        <div className="text-right">
          <div className="font-serif text-[10px] text-paper-400/60 tracking-wider">修为</div>
          <div className="font-number text-lg text-gold-400">
            {player.cultivation.toLocaleString()}
          </div>
        </div>
        <div className="w-px h-10 bg-gold-500/20" />
        <div className="text-right">
          <div className="font-serif text-[10px] text-paper-400/60 tracking-wider">寿元</div>
          <div className="font-number text-lg text-jade-400">
            {player.lifespanCurrent}
            <span className="text-paper-400/50 text-xs"> / {player.lifespanMax}</span>
          </div>
        </div>
        <div className="w-px h-10 bg-gold-500/20" />
        <div className="text-right">
          <div className="font-serif text-[10px] text-paper-400/60 tracking-wider">体魄</div>
          <div className="font-serif text-sm text-paper-200">{player.body}</div>
        </div>
        <div className="text-right">
          <div className="font-serif text-[10px] text-paper-400/60 tracking-wider">气运</div>
          <div className="font-serif text-sm text-paper-200">{player.fortune}</div>
        </div>
        <div className="w-px h-10 bg-gold-500/20" />
        <div className="flex items-center gap-3 text-right">
          <Clock size={16} className="text-gold-400/60" strokeWidth={1.5} />
          <div>
            <div className="font-serif text-[10px] text-paper-400/60 tracking-wider">修真历</div>
            <div className="font-number text-sm text-paper-200 whitespace-nowrap">
              第{currentTime.year}年 {currentTime.month}月{currentTime.day}日 {HOUR_NAMES[currentTime.hour] ?? "子时"}
            </div>
          </div>
        </div>
        <div className="w-px h-10 bg-gold-500/20" />
        <LocationSelector />

        {/* 存档管理 */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              const snapshot = useGameStore.getState().getSnapshot();
              const saveData = {
                game: snapshot,
                ai: useAIStore.getState(),
                timestamp: Date.now(),
              };
              const blob = new Blob([JSON.stringify(saveData, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `save_${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="w-10 h-10 rounded flex items-center justify-center border border-gold-500/25 hover:border-gold-400/60 hover:bg-gold-400/10 transition group"
            title="导出存档"
          >
            <Download size={18} className="text-paper-300 group-hover:text-gold-400 transition" strokeWidth={1.5} />
          </button>
          <button
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".json";
              input.onchange = async (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (!file) return;
                try {
                  const text = await file.text();
                  const saveData = JSON.parse(text);
                  if (saveData.game) {
                    useGameStore.getState().restoreSnapshot(saveData.game as GameSnapshot);
                  }
                  if (saveData.ai?.settings) {
                    useAIStore.getState().updateSettings(saveData.ai.settings);
                  }
                  window.location.reload();
                } catch (err) {
                  alert(`导入存档失败：${(err as Error).message}`);
                }
              };
              input.click();
            }}
            className="w-10 h-10 rounded flex items-center justify-center border border-gold-500/25 hover:border-gold-400/60 hover:bg-gold-400/10 transition group"
            title="导入存档"
          >
            <Upload size={18} className="text-paper-300 group-hover:text-gold-400 transition" strokeWidth={1.5} />
          </button>
          <button
            onClick={() => {
              if (confirm("确定要开启新游戏吗？当前进度将丢失。")) {
                useGameStore.getState().resetGame();
                useAIStore.getState().clearConversation();
                window.location.reload();
              }
            }}
            className="w-10 h-10 rounded flex items-center justify-center border border-gold-500/25 hover:border-gold-400/60 hover:bg-gold-400/10 transition group"
            title="新游戏"
          >
            <RotateCcw size={18} className="text-paper-300 group-hover:text-gold-400 transition" strokeWidth={1.5} />
          </button>
        </div>

        {/* 通灵设置 */}
        <button
          onClick={onOpenSettings}
          className="relative ml-2 w-10 h-10 rounded flex items-center justify-center border border-gold-500/25 hover:border-gold-400/60 hover:bg-gold-400/10 transition group"
          title="通灵设置"
        >
          <Settings
            size={18}
            className={`text-paper-300 group-hover:text-gold-400 transition ${stage === "flash" || stage === "pro" ? "animate-spin" : ""
              }`}
            strokeWidth={1.5}
          />
          <span
            className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-ink-900 ${hasApiKey ? "bg-jade-400" : "bg-cinnabar-500"
              }`}
            title={hasApiKey ? "已配置" : "未配置"}
          />
        </button>
      </div>

      {/* 顶部云纹装饰 */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-gold-500/40 to-transparent" />
    </header>
  );
}
