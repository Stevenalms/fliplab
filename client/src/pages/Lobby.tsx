import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Disc, Play, RefreshCw, Music2, Users, Clock, LogOut, Swords, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useJoinQueue, useLeaveQueue, useActiveMatches, useQueueCount } from "@/lib/api";
import { gameWs } from "@/lib/websocket";
import { cn } from "@/lib/utils";

const GENRES = [
  { id: "soul", name: "Soul", color: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-400/20" },
  { id: "funk", name: "Funk", color: "text-purple-400", bg: "bg-purple-400/10", border: "border-purple-400/20" },
  { id: "jazz", name: "Jazz", color: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/20" },
];

const GAME_MODES = [
  { id: "practice", name: "Practice", players: 1, icon: Play, description: "Solo session - start immediately", color: "text-cyan-400", bg: "bg-cyan-400/10", border: "border-cyan-400/20" },
  { id: "battle", name: "Battle", players: 4, icon: Trophy, description: "4-player competition with voting", color: "text-primary", bg: "bg-primary/10", border: "border-primary/20" },
  { id: "duel", name: "Duel", players: 2, icon: Swords, description: "1v1 creative showcase", color: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/20" },
];

export default function Lobby() {
  const [_, setLocation] = useLocation();
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<string>("practice");
  const [isSearching, setIsSearching] = useState(false);
  const [matchFound, setMatchFound] = useState(false);
  const [sampleFound, setSampleFound] = useState(false);
  const userId = localStorage.getItem("userId") || "";
  const joinQueueMutation = useJoinQueue();
  const leaveQueueMutation = useLeaveQueue();
  const { data: matchesData } = useActiveMatches();
  const { data: queueData } = useQueueCount(isSearching ? selectedGenre : null, selectedMode);
  const queueCount = queueData?.count || 0;
  const requiredPlayers = selectedMode === "duel" ? 2 : 4;

  useEffect(() => {
    if (!isSearching) return;

    const handleMatchStart = (data: any) => {
      gameWs.clearMatchmakingRegistration();
      setMatchFound(true);
      setTimeout(() => setSampleFound(true), 1000);
      setTimeout(() => {
        const mode = data.gameMode || selectedMode;
        setLocation(`/studio?matchId=${data.matchId}&userId=${userId}&mode=${mode}`);
      }, 2000);
    };

    gameWs.on("match_started", handleMatchStart);
    return () => gameWs.off("match_started", handleMatchStart);
  }, [isSearching, userId, setLocation, selectedMode]);

  // Fallback: Poll for active matches in case WebSocket notification was missed
  useEffect(() => {
    if (!isSearching || matchFound || !userId) return;

    const checkForActiveMatch = async () => {
      try {
        const response = await fetch(`/api/matches/user/${userId}/active`);
        if (response.ok) {
          const data = await response.json();
          if (data.match) {
            console.log("Found active match via polling:", data.match.id);
            gameWs.clearMatchmakingRegistration();
            setMatchFound(true);
            setTimeout(() => setSampleFound(true), 1000);
            setTimeout(() => {
              setLocation(`/studio?matchId=${data.match.id}&userId=${userId}&mode=${data.match.gameMode}`);
            }, 2000);
          }
        }
      } catch (err) {
        console.error("Failed to check for active match:", err);
      }
    };

    const pollInterval = setInterval(checkForActiveMatch, 2000);
    return () => clearInterval(pollInterval);
  }, [isSearching, matchFound, userId, setLocation]);

  const startMatch = async () => {
    console.log("startMatch called with:", { selectedGenre, userId, selectedMode });
    
    if (!selectedGenre || !userId) {
      console.error("Missing genre or userId:", { selectedGenre, userId });
      return;
    }
    
    if (selectedMode === "practice") {
      setLocation(`/studio?userId=${userId}&genre=${selectedGenre}&mode=practice`);
      return;
    }
    
    setIsSearching(true);
    setMatchFound(false);
    setSampleFound(false);
    window.dispatchEvent(new CustomEvent("queueStateChange", { detail: { inQueue: true } }));
    try {
      const result = await joinQueueMutation.mutateAsync({
        userId,
        genre: selectedGenre,
        gameMode: selectedMode,
      });
      console.log("Join queue result:", result);
      gameWs.registerForMatchmaking(userId, selectedGenre, selectedMode);
    } catch (err) {
      console.error("Failed to join queue", err);
      setIsSearching(false);
      window.dispatchEvent(new CustomEvent("queueStateChange", { detail: { inQueue: false } }));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("userId");
    localStorage.removeItem("username");
    setLocation("/");
  };

  const handleExitQueue = async () => {
    gameWs.clearMatchmakingRegistration();
    if (userId) {
      try {
        await leaveQueueMutation.mutateAsync(userId);
      } catch (err) {
        console.error("Failed to leave queue", err);
      }
    }
    setIsSearching(false);
    setSelectedGenre(null);
    setMatchFound(false);
    setSampleFound(false);
    window.dispatchEvent(new CustomEvent("queueStateChange", { detail: { inQueue: false } }));
  };

  return (
    <div className="min-h-screen bg-background pt-24 pb-12 px-4 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-[100px]" />
      </div>

      <div className="container max-w-4xl mx-auto relative z-10">
        {!isSearching && (
          <>
            <div className="flex justify-between items-center mb-12">
              <div className="text-center flex-1">
                <Badge variant="outline" className="mb-4 border-primary/30 text-primary px-4 py-1">
                  <span className="w-2 h-2 rounded-full bg-primary mr-2 animate-pulse" />
                  SYSTEM ONLINE
                </Badge>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleLogout}
                className="text-muted-foreground hover:text-red-400"
              >
                <LogOut className="w-4 h-4 mr-2" /> Sign Out
              </Button>
            </div>

            <div className="text-center mb-8">
              <h1 className="text-4xl md:text-6xl font-bold mb-4">SELECT YOUR MODE</h1>
              <p className="text-muted-foreground text-lg">Choose how you want to compete.</p>
            </div>

            <div className="grid grid-cols-3 gap-4 max-w-3xl mx-auto mb-12">
              {GAME_MODES.map((mode) => {
                const Icon = mode.icon;
                return (
                  <motion.div
                    key={mode.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedMode(mode.id)}
                    data-testid={`mode-${mode.id}`}
                    className={cn(
                      "cursor-pointer relative overflow-hidden rounded-xl border-2 transition-all p-6 flex flex-col items-center justify-center gap-3",
                      selectedMode === mode.id 
                        ? `${mode.border} ${mode.bg} shadow-[0_0_30px_rgba(0,0,0,0.3)]` 
                        : "border-white/5 bg-card/40 hover:border-white/20"
                    )}
                  >
                    <div className={cn("p-3 rounded-full bg-black/20", mode.color)}>
                      <Icon className="w-8 h-8" />
                    </div>
                    <h3 className={cn("text-xl font-bold", mode.color)}>{mode.name}</h3>
                    <p className="text-xs text-muted-foreground text-center">{mode.description}</p>
                    <Badge variant="outline" className={cn("mt-1", mode.color)}>
                      {mode.players} Players
                    </Badge>
                    {selectedMode === mode.id && (
                      <motion.div
                        layoutId="selected-mode-check"
                        className="absolute top-3 right-3"
                      >
                        <div className={cn("w-5 h-5 rounded-full flex items-center justify-center text-black font-bold text-xs", mode.id === "battle" ? "bg-primary" : "bg-orange-400")}>✓</div>
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-bold mb-2">SELECT YOUR CRATE</h2>
              <p className="text-muted-foreground">Choose a genre to dig from.</p>
            </div>
          </>
        )}

        {!isSearching ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 max-w-3xl mx-auto">
            {GENRES.map((genre) => (
              <motion.div
                key={genre.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedGenre(genre.id)}
                className={`cursor-pointer relative overflow-hidden rounded-xl border-2 transition-all p-8 h-64 flex flex-col items-center justify-center gap-4 ${
                  selectedGenre === genre.id 
                    ? `${genre.border} ${genre.bg} shadow-[0_0_30px_rgba(0,0,0,0.3)]` 
                    : "border-white/5 bg-card/40 hover:border-white/20"
                }`}
              >
                <div className={`p-4 rounded-full bg-black/20 ${genre.color}`}>
                  <Disc className="w-12 h-12" />
                </div>
                <h3 className={`text-2xl font-bold ${genre.color}`}>{genre.name}</h3>
                {selectedGenre === genre.id && (
                  <motion.div
                    layoutId="selected-check"
                    className="absolute top-4 right-4 text-primary"
                  >
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-black font-bold">✓</div>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <Card className="p-12 bg-card/50 border-white/10 backdrop-blur-md max-w-lg w-full">
              <div className="flex flex-col items-center gap-8">
                <div className="relative">
                  <div className="w-32 h-32 rounded-full border-4 border-primary/30 flex items-center justify-center">
                    <RefreshCw className="w-12 h-12 text-primary animate-spin" />
                  </div>
                </div>
                
                <div className="text-center space-y-4">
                  <h3 className="text-3xl font-bold">
                    {!matchFound ? "Finding Opponents..." : !sampleFound ? "Digging for Samples..." : "Match Ready!"}
                  </h3>
                  
                  {!matchFound ? (
                    <div className="flex flex-col items-center gap-4">
                      <div className="flex items-center justify-center gap-3 text-2xl font-mono">
                        <Users className="w-8 h-8 text-primary" />
                        <span className="text-primary font-bold">{queueCount}</span>
                        <span className="text-muted-foreground">/ {requiredPlayers}</span>
                      </div>
                      <p className="text-muted-foreground text-sm">
                        {selectedMode === "duel" ? "Waiting for Opponent" : "Players Ready"}
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Music2 className="w-5 h-5" />
                      <span>Loading sample...</span>
                    </div>
                  )}
                </div>

                <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-primary"
                    initial={{ width: "0%" }}
                    animate={{ width: sampleFound ? "100%" : matchFound ? "60%" : `${(queueCount / requiredPlayers) * 30}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>

                {!matchFound && (
                  <Button 
                    variant="outline" 
                    size="lg"
                    onClick={handleExitQueue}
                    data-testid="button-exit-queue"
                    className="mt-4 border-white/20 hover:bg-white/10 hover:border-white/40"
                  >
                    <LogOut className="w-4 h-4 mr-2" /> Exit Queue
                  </Button>
                )}
              </div>
            </Card>
          </div>
        )}

        {!isSearching && (
          <div className="flex justify-center">
            <Button 
              size="lg" 
              disabled={!selectedGenre}
              onClick={startMatch}
              data-testid="button-enter-match"
              className={cn(
                "h-16 px-12 text-xl font-bold rounded-none text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed",
                selectedMode === "duel" ? "bg-orange-500" : "bg-primary"
              )}
            >
              {selectedMode === "duel" ? "START DUEL" : "ENTER BATTLE"} <Play className="ml-3 w-6 h-6 fill-current" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
