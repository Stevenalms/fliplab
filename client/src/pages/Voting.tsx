import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Play, Pause, Heart, Trophy, Share2, Home, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useMatch, useSubmitVote } from "@/lib/api";
import { gameWs } from "@/lib/websocket";

export default function Voting() {
  const [_, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const matchId = searchParams.get("matchId");
  const currentUserId = searchParams.get("userId") || localStorage.getItem("userId");
  
  const { data: matchData, isLoading } = useMatch(matchId);
  const submitVoteMutation = useSubmitVote();
  
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [votedFlip, setVotedFlip] = useState<string | null>(null);
  const [votingComplete, setVotingComplete] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [pointsAwarded, setPointsAwarded] = useState(14);

  const participants = matchData?.participants || [];

  useEffect(() => {
    const handleVoteSubmitted = (data: any) => {
      if (data.winner) {
        setWinner(data.winner);
        setPointsAwarded(data.pointsAwarded || 14);
        setVotingComplete(true);
      }
    };

    gameWs.on("vote_submitted", handleVoteSubmitted);
    return () => {
      gameWs.off("vote_submitted", handleVoteSubmitted);
    };
  }, []);

  const togglePlay = (id: string) => {
    if (playingId === id) {
      setPlayingId(null);
    } else {
      setPlayingId(id);
    }
  };

  const submitVotes = async () => {
    if (!votedFlip || !matchId || !currentUserId) return;
    
    try {
      const result = await submitVoteMutation.mutateAsync({
        matchId,
        voterId: currentUserId,
        flipVoteId: votedFlip,
      });
      
      setWinner(votedFlip);
      setPointsAwarded(result.pointsAwarded || 14);
      setVotingComplete(true);
    } catch (error) {
      console.error("Failed to submit vote:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pt-24 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-24 pb-12 px-4">
      <div className="container max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">THE LISTENING SESSION</h1>
          <p className="text-muted-foreground text-lg">
            {votingComplete 
              ? "Voting complete! See the results below." 
              : "Listen to each beat. Vote for the best flip."}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {participants.map((participant: any, index: number) => {
            const isCurrentUser = participant.userId === currentUserId;
            const isWinner = winner === participant.userId;
            const avatarColors = ["bg-blue-500", "bg-purple-500", "bg-amber-500", "bg-pink-500"];
            
            return (
              <motion.div
                key={participant.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  "bg-card border rounded-xl p-6 relative flex flex-col gap-6",
                  playingId === participant.userId ? "border-primary shadow-[0_0_30px_rgba(34,197,94,0.1)]" : "border-white/5",
                  isWinner && "border-yellow-500 shadow-[0_0_30px_rgba(234,179,8,0.2)]"
                )}
                data-testid={`voting-card-${participant.userId}`}
              >
                {isWinner && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-500 text-black px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                    <Trophy className="w-3 h-3" /> WINNER +{pointsAwarded}
                  </div>
                )}
                
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full ${avatarColors[index % 4]} flex items-center justify-center font-bold text-white shadow-lg`}>
                    {participant.projectName?.[0] || "P"}
                  </div>
                  <div>
                    <div className="font-bold text-lg">
                      {isCurrentUser ? "You" : participant.projectName || `Player ${index + 1}`}
                    </div>
                    {isCurrentUser && (
                      <div className="text-xs text-muted-foreground">Your submission</div>
                    )}
                  </div>
                </div>

                <div className="h-32 bg-black/30 rounded-lg border border-white/5 flex items-center justify-center gap-1 px-4 relative overflow-hidden group">
                   <div className="absolute inset-0 flex items-center justify-center z-10">
                      <Button 
                        size="icon" 
                        className={cn(
                          "w-12 h-12 rounded-full shadow-xl transition-transform hover:scale-110", 
                          playingId === participant.userId ? "bg-white text-black" : "bg-primary text-black"
                        )}
                        onClick={() => togglePlay(participant.userId)}
                        data-testid={`play-button-${participant.userId}`}
                      >
                        {playingId === participant.userId ? <Pause className="fill-current" /> : <Play className="fill-current ml-1" />}
                      </Button>
                   </div>
                   
                   {Array.from({ length: 20 }).map((_, i) => (
                     <div 
                       key={i} 
                       className={cn(
                         "flex-1 rounded-full transition-all duration-300",
                         playingId === participant.userId ? "bg-primary animate-pulse" : "bg-white/10"
                       )}
                       style={{ 
                         height: playingId === participant.userId ? `${30 + Math.random() * 70}%` : '20%',
                         animationDelay: `${i * 0.05}s`
                       }}
                     />
                   ))}
                </div>

                {!votingComplete ? (
                  <div className="flex flex-col gap-3 mt-auto">
                    <Button 
                      variant={votedFlip === participant.userId ? "default" : "outline"} 
                      className={cn(
                        "w-full justify-between", 
                        votedFlip === participant.userId && "bg-secondary text-secondary-foreground hover:bg-secondary/90"
                      )}
                      disabled={isCurrentUser}
                      onClick={() => setVotedFlip(participant.userId)}
                      data-testid={`vote-button-${participant.userId}`}
                    >
                      <span>{isCurrentUser ? "Can't vote for yourself" : "Best Flip"}</span>
                      <Heart className={cn("w-4 h-4", votedFlip === participant.userId && "fill-current")} />
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 mt-auto pt-4 border-t border-white/5">
                     {isWinner && (
                       <div className="text-center text-sm font-bold text-yellow-500 uppercase tracking-widest flex items-center justify-center gap-2">
                         <Trophy className="w-4 h-4" /> Winner
                       </div>
                     )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        <div className="flex justify-center gap-4">
          {!votingComplete ? (
            <Button 
              size="lg" 
              className="px-12 h-14 text-lg font-bold bg-white text-black hover:bg-white/90"
              disabled={!votedFlip || submitVoteMutation.isPending}
              onClick={submitVotes}
              data-testid="submit-vote-button"
            >
              {submitVoteMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</>
              ) : (
                "SUBMIT VOTE"
              )}
            </Button>
          ) : (
            <>
              <Button size="lg" className="px-8 h-14 bg-primary text-primary-foreground">
                <Share2 className="mr-2 w-4 h-4" /> Share Results
              </Button>
              <Link href="/lobby">
                <Button size="lg" variant="outline" className="px-8 h-14">
                  Play Again
                </Button>
              </Link>
              <Link href="/">
                <Button size="lg" variant="ghost" className="px-8 h-14">
                  <Home className="mr-2 w-4 h-4" /> Home
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
