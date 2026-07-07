import { useState } from "react";
import { useGameStore } from "@/store/useGameStore";
import { TopBanner } from "@/components/layout/TopBanner";
import { SideNav } from "@/components/layout/SideNav";
import { BottomStatus } from "@/components/layout/BottomStatus";
import { ProfilePanel } from "@/panels/ProfilePanel";
import { TechniquePanel } from "@/panels/TechniquePanel";
import { TreasurePanel } from "@/panels/TreasurePanel";
import { SectPanel } from "@/panels/SectPanel";
import { SocialPanel } from "@/panels/SocialPanel";
import { StoryPanel } from "@/panels/StoryPanel";
import { AISettingsModal } from "@/components/ai/AISettingsModal";
import { NPCChatModal } from "@/components/ai/NPCChatModal";
import { CraftingModal } from "@/components/crafting/CraftingModal";

export default function Home() {
  const currentPanel = useGameStore((s) => s.currentPanel);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="h-screen w-screen flex flex-col ink-bg overflow-hidden">
      <TopBanner onOpenSettings={() => setSettingsOpen(true)} />
      <div className="flex-1 flex overflow-hidden">
        <SideNav />
        <main className="flex-1 overflow-y-auto p-6 relative">
          {/* 远山装饰 */}
          <svg
            className="fixed bottom-24 left-56 right-0 h-32 opacity-[0.06] pointer-events-none"
            viewBox="0 0 1200 100"
            preserveAspectRatio="none"
          >
            <path
              d="M0,100 L0,60 Q150,20 300,40 T600,50 T900,30 T1200,45 L1200,100 Z"
              fill="#c9a961"
            />
          </svg>
          <div key={currentPanel} className="animate-inkSpread max-w-7xl mx-auto">
            {currentPanel === "profile" && <ProfilePanel />}
            {currentPanel === "technique" && <TechniquePanel />}
            {currentPanel === "treasure" && <TreasurePanel />}
            {currentPanel === "sect" && <SectPanel />}
            {currentPanel === "social" && <SocialPanel />}
            {currentPanel === "story" && <StoryPanel onOpenSettings={() => setSettingsOpen(true)} />}
          </div>
        </main>
      </div>
      <BottomStatus />
      <AISettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <NPCChatModal />
      <CraftingModal />
    </div>
  );
}
