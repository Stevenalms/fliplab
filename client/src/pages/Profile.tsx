import { useEffect } from "react";
import { useUser, useUserRank } from "@/lib/api";
import { Loader, Trophy, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Profile() {
  const userId = localStorage.getItem("userId");
  const username = localStorage.getItem("username");
  
  const { data: userData, isLoading } = useUser(userId);
  const { data: rankData } = useUserRank(userId);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pt-24 flex items-center justify-center">
        <Loader className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const user = userData?.user;
  const rank = rankData?.rank;

  return (
    <div className="min-h-screen bg-background pt-24 pb-12 px-4">
      <div className="container max-w-2xl mx-auto">
        <div className="bg-card/50 border border-white/5 rounded-xl p-8 backdrop-blur-md">
          <div className="flex items-start justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-primary/30 to-secondary/30 border-2 border-primary/50 flex items-center justify-center">
                <span className="text-2xl font-bold text-primary">{username?.[0]?.toUpperCase()}</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold">{username}</h1>
                <p className="text-muted-foreground font-mono text-sm">{userId}</p>
              </div>
            </div>
            {rank && (
              <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-lg border border-primary/20">
                <Trophy className="w-5 h-5 text-primary" />
                <span className="font-bold text-primary">Rank #{rank}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="Total Matches" value={user?.totalMatches || 0} icon={Activity} />
            <StatCard label="Wins" value={user?.wins || 0} icon={Trophy} />
            <StatCard label="Rating" value={user?.rating || 1000} icon={Activity} />
            <StatCard label="Win Rate" value={user?.totalMatches ? `${Math.round((user.wins / user.totalMatches) * 100)}%` : "0%"} />
          </div>

          <div className="border-t border-white/10 pt-6">
            <h2 className="text-xl font-bold mb-4">Achievements</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <AchievementBadge title="First Battle" desc="Play your first match" completed={user?.totalMatches || 0 > 0} />
              <AchievementBadge title="Victory" desc="Win a match" completed={user?.wins || 0 > 0} />
              <AchievementBadge title="Warrior" desc="Win 5 matches" completed={user?.wins || 0 >= 5} />
              <AchievementBadge title="Master" desc="Win 10 matches" completed={user?.wins || 0 >= 10} />
              <AchievementBadge title="Legend" desc="Win 25 matches" completed={user?.wins || 0 >= 25} />
              <AchievementBadge title="Champion" desc="Reach top 10" completed={rank ? rank <= 10 : false} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon?: any }) {
  return (
    <div className="bg-black/20 rounded-lg p-4 border border-white/5">
      <div className="flex items-center gap-2 mb-2">
        {Icon && <Icon className="w-4 h-4 text-primary" />}
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">{label}</p>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function AchievementBadge({ title, desc, completed }: { title: string; desc: string; completed: boolean }) {
  return (
    <div className={cn(
      "p-4 rounded-lg border-2 text-center transition-all",
      completed 
        ? "bg-primary/10 border-primary/50" 
        : "bg-black/20 border-white/5 opacity-50 grayscale"
    )}>
      <div className="text-2xl mb-2">
        {completed ? "🏆" : "🔒"}
      </div>
      <p className="font-bold text-sm mb-1">{title}</p>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}
