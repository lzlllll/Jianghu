import { useGameStore } from "@/store/useGameStore";
import { ScrollCard } from "@/components/ui/ScrollCard";
import { CloudDivider } from "@/components/ui/CloudDivider";
import { cn } from "@/lib/utils";
import type { NewsItem, NewsCategory } from "@/data/types";
import { Scroll, Bell, Users, ScrollText } from "lucide-react";

const CATEGORY_CONFIG: Record<NewsCategory, { icon: React.ReactNode; color: string; bg: string }> = {
  "官府公告": {
    icon: <ScrollText size={14} />,
    color: "text-cinnabar-400",
    bg: "border-cinnabar-500/30 bg-cinnabar-500/10",
  },
  "宗门布告": {
    icon: <Bell size={14} />,
    color: "text-gold-400",
    bg: "border-gold-400/30 bg-gold-400/10",
  },
  "市井传言": {
    icon: <Users size={14} />,
    color: "text-jade-400",
    bg: "border-jade-500/30 bg-jade-500/10",
  },
};

export function NewsPanel() {
  const news = useGameStore((s) => s.news);

  const groupedNews = news.items.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<NewsCategory, NewsItem[]>);

  return (
    <ScrollCard title="江湖快报" subtitle="天下事，尽皆知">
      <div className="space-y-6">
        {(Object.keys(groupedNews) as NewsCategory[]).map((category) => (
          <div key={category}>
            <div className={cn("flex items-center gap-2 mb-3", CATEGORY_CONFIG[category].color)}>
              {CATEGORY_CONFIG[category].icon}
              <span className="font-brush text-sm">{category}</span>
            </div>
            <div className="space-y-2">
              {groupedNews[category].map((item) => (
                <div
                  key={item.id}
                  className={cn("p-3 rounded border", CATEGORY_CONFIG[category].bg)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-brush text-base text-paper-100">{item.title}</span>
                    <span className="font-serif text-[10px] text-paper-400/50">{item.date}</span>
                  </div>
                  <p className="font-serif text-xs text-paper-400/70 leading-relaxed">
                    {item.content}
                  </p>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="font-serif text-[10px] text-paper-400/40">来源：{item.source}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {news.items.length === 0 && (
          <div className="text-center py-8">
            <Scroll size={32} className="mx-auto text-paper-500/30 mb-2" />
            <p className="font-serif text-sm text-paper-400/50">暂无新闻</p>
          </div>
        )}
      </div>
    </ScrollCard>
  );
}