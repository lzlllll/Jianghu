import { useState, useRef, useEffect } from "react";
import { useGameStore, LOCATIONS } from "@/store/useGameStore";
import { cn } from "@/lib/utils";
import { MapPin, ChevronDown, ChevronUp } from "lucide-react";

export function LocationSelector() {
  const currentLocation = useGameStore((s) => s.currentLocation);
  const setLocation = useGameStore((s) => s.setLocation);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const location = LOCATIONS.find((l) => l.id === currentLocation);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-ink-800/60 border border-gold-500/20 hover:border-gold-500/40 transition-all group"
      >
        <MapPin size={12} className="text-gold-400/70" />
        <span className="font-brush text-xs text-gold-400 tracking-wider">
          {location?.name || "未知"}
        </span>
        {isOpen ? (
          <ChevronUp size={12} className="text-paper-400/50" />
        ) : (
          <ChevronDown size={12} className="text-paper-400/50" />
        )}
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 mt-2 w-48 rounded-lg border border-gold-500/20 bg-ink-900/95 backdrop-blur-sm shadow-xl z-50 overflow-hidden"
          style={{ animation: "inkSpread 0.2s ease-out" }}
        >
          <div className="px-3 py-2 border-b border-gold-500/10">
            <span className="font-serif text-[10px] text-paper-400/60">当前所在</span>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {LOCATIONS.map((loc) => {
              const isSelected = loc.id === currentLocation;
              return (
                <button
                  key={loc.id}
                  onClick={() => {
                    setLocation(loc.id);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gold-500/10 transition-colors",
                    isSelected && "bg-gold-500/10",
                  )}
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded flex items-center justify-center font-brush text-sm",
                      isSelected
                        ? "bg-gold-500/20 text-gold-400 border border-gold-500/40"
                        : "bg-ink-700/60 text-paper-400/70",
                    )}
                  >
                    {loc.icon}
                  </div>
                  <div className="flex-1 text-left">
                    <div
                      className={cn(
                        "font-brush text-sm",
                        isSelected ? "text-gold-400" : "text-paper-200",
                      )}
                    >
                      {loc.name}
                    </div>
                    <div className="font-serif text-[10px] text-paper-400/50 leading-relaxed line-clamp-1">
                      {loc.description}
                    </div>
                  </div>
                  {isSelected && (
                    <span className="text-gold-400 text-xs">✓</span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="px-3 py-2 border-t border-gold-500/10">
            <div className="font-serif text-[10px] text-paper-400/50">
              可进行：
              <span className="text-gold-400/70 ml-1">
                {location?.allowedActions.join("、")}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
