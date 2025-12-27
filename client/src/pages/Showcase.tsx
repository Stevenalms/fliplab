import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Users, Music2, ArrowLeft, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMatch } from "@/lib/api";

export default function Showcase() {
  const [_, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const matchId = searchParams.get("matchId");
  const userId = searchParams.get("userId");
  const { data } = useMatch(matchId);

  const participants = data?.participants || [];
  const match = data?.match;

  return (
    <div className="min-h-screen bg-background pt-24 pb-12 px-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/5 rounded-full blur-[100px]" />
      </div>

      <div className="container max-w-4xl mx-auto relative z-10">
        <div className="text-center mb-8">
          <Badge variant="outline" className="mb-4 border-orange-400/30 text-orange-400 px-4 py-1">
            <Swords className="w-4 h-4 mr-2" />
            DUEL COMPLETE
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">SHOWCASE</h1>
          <p className="text-muted-foreground text-lg">Compare your creations</p>
          {match && (
            <div className="flex items-center justify-center gap-2 mt-4 text-sm text-muted-foreground">
              <Music2 className="w-4 h-4" />
              <span>Sample: {match.sample}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {participants.map((participant: any, index: number) => (
            <motion.div
              key={participant.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.2 }}
            >
              <Card className={`p-6 bg-card/50 border-white/10 backdrop-blur-md ${participant.userId === userId ? 'ring-2 ring-orange-400' : ''}`}>
                <div className="flex flex-col items-center gap-4">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-400/20 to-orange-600/20 flex items-center justify-center border border-orange-400/30">
                    <Users className="w-10 h-10 text-orange-400" />
                  </div>
                  
                  <div className="text-center">
                    <h3 className="text-xl font-bold">
                      {participant.userId === userId ? "Your Flip" : "Opponent's Flip"}
                    </h3>
                    <p className="text-sm text-muted-foreground">{participant.projectName || "Untitled"}</p>
                  </div>

                  {participant.userId === userId && (
                    <Badge className="bg-orange-400/20 text-orange-400 border-orange-400/30">
                      YOU
                    </Badge>
                  )}

                  <div className="w-full h-24 bg-black/20 rounded-lg flex items-center justify-center border border-white/5">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Music2 className="w-5 h-5" />
                      <span className="text-sm">Audio Preview</span>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="text-center space-y-4">
          <p className="text-muted-foreground">
            Duels are just for fun - no points awarded. Compare your creativity!
          </p>
          <Button 
            size="lg"
            onClick={() => setLocation("/lobby")}
            data-testid="button-back-to-lobby"
            className="bg-orange-500 hover:bg-orange-600"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Lobby
          </Button>
        </div>
      </div>
    </div>
  );
}
