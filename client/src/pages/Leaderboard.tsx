import { Trophy, Medal, ArrowUp, ArrowDown, Minus, Loader } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLeaderboard } from "@/lib/api";

export default function Leaderboard() {
  const { data, isLoading } = useLeaderboard(100);
  const leaderboard = data?.leaderboard || [];

  return (
    <div className="min-h-screen bg-background pt-24 pb-12 px-4">
      <div className="container max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 flex items-center justify-center gap-3">
            <Trophy className="w-10 h-10 text-yellow-500" />
            GLOBAL RANKINGS
          </h1>
          <p className="text-muted-foreground text-lg">Top producers of the season.</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : (
          <div className="bg-card/50 border border-white/5 rounded-xl overflow-hidden backdrop-blur-md">
            <div className="grid grid-cols-12 gap-4 p-4 border-b border-white/10 text-xs font-mono uppercase tracking-wider text-muted-foreground font-bold">
              <div className="col-span-2 text-center">Rank</div>
              <div className="col-span-6">Producer</div>
              <div className="col-span-2 text-right">Rating</div>
              <div className="col-span-2 text-center">Wins</div>
            </div>
            
            <div className="divide-y divide-white/5">
              {leaderboard.map((user, index) => (
                <div 
                  key={user.userId} 
                  className={cn(
                    "grid grid-cols-12 gap-4 p-4 items-center hover:bg-white/5 transition-colors",
                    index < 3 ? "bg-primary/5" : ""
                  )}
                >
                  <div className="col-span-2 flex justify-center">
                    {index === 0 ? (
                      <div className="w-8 h-8 rounded-full bg-yellow-500/20 text-yellow-500 flex items-center justify-center border border-yellow-500/50">
                        <Medal className="w-4 h-4" />
                      </div>
                    ) : index === 1 ? (
                      <div className="w-8 h-8 rounded-full bg-gray-400/20 text-gray-400 flex items-center justify-center border border-gray-400/50">
                        <Medal className="w-4 h-4" />
                      </div>
                    ) : index === 2 ? (
                      <div className="w-8 h-8 rounded-full bg-amber-700/20 text-amber-700 flex items-center justify-center border border-amber-700/50">
                        <Medal className="w-4 h-4" />
                      </div>
                    ) : (
                      <span className="font-mono text-muted-foreground">#{index + 1}</span>
                    )}
                  </div>
                  
                  <div className="col-span-6 font-bold text-lg flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-tr from-primary/20 to-secondary/20 border border-white/10`} />
                    {user.username}
                  </div>
                  
                  <div className="col-span-2 text-right font-mono text-primary">
                    {user.rating || 1000}
                  </div>
                  
                  <div className="col-span-2 text-center font-mono text-muted-foreground">
                    {user.wins || 0}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
