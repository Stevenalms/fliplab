import { useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Navigation } from "@/components/Navigation";
import Home from "@/pages/Home";
import Lobby from "@/pages/Lobby";
import Studio from "@/pages/Studio";
import Voting from "@/pages/Voting";
import Showcase from "@/pages/Showcase";
import Leaderboard from "@/pages/Leaderboard";
import Profile from "@/pages/Profile";
import DrumPackUploader from "@/pages/DrumPackUploader";
import NotFound from "@/pages/not-found";
import { gameWs } from "@/lib/websocket";

function ensureGuestId(): void {
  let guestId = localStorage.getItem("guestId");
  if (!guestId) {
    guestId = "guest_" + Math.random().toString(36).substring(2, 15);
    localStorage.setItem("guestId", guestId);
  }
  if (!localStorage.getItem("userId")) {
    localStorage.setItem("userId", guestId);
    localStorage.setItem("username", "Guest");
  }
}

// Run immediately before any components render
ensureGuestId();

function Router() {

  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/lobby" component={Lobby} />
      <Route path="/studio" component={Studio} />
      <Route path="/voting" component={Voting} />
      <Route path="/showcase" component={Showcase} />
      <Route path="/leaderboard" component={Leaderboard} />
      <Route path="/profile" component={Profile} />
      <Route path="/upload-drums" component={DrumPackUploader} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    gameWs.connect().catch(console.error);
    return () => gameWs.close();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen bg-background font-sans text-foreground selection:bg-primary/30">
          <Navigation />
          <Router />
          <Toaster />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
