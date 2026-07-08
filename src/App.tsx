import { useState, useEffect } from "react";
import { useGameStore } from "@/store/useGameStore";
import { useAIStore } from "@/store/useAIStore";
import Home from "@/pages/Home";
import { StartSetup } from "@/components/start/StartSetup";

export default function App() {
  const [gameStarted, setGameStarted] = useState(false);
  const turns = useAIStore((s) => s.conversation.turns);

  useEffect(() => {
    if (turns.length > 0) {
      setGameStarted(true);
    }
  }, [turns]);

  if (!gameStarted) {
    return <StartSetup />;
  }

  return <Home />;
}
