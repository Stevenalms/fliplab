import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Music, Activity, Users, Trophy, Upload } from "lucide-react";

export function Navigation() {
  const [location] = useLocation();
  const [isInQueue, setIsInQueue] = useState(false);

  useEffect(() => {
    const handleQueueChange = (e: CustomEvent) => {
      setIsInQueue(e.detail.inQueue);
    };
    window.addEventListener("queueStateChange", handleQueueChange as EventListener);
    return () => window.removeEventListener("queueStateChange", handleQueueChange as EventListener);
  }, []);

  const navItems = [
    { href: "/", label: "Home", icon: Music },
    { href: "/lobby", label: "Battle", icon: Activity },
    { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
    { href: "/profile", label: "Profile", icon: Users },
    { href: "/upload-drums", label: "Upload", icon: Upload },
  ];

  if (isInQueue) {
    return null;
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer group">
            <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center border border-primary/50 group-hover:shadow-[0_0_15px_rgba(34,197,94,0.4)] transition-all">
              <Activity className="w-5 h-5 text-primary" />
            </div>
            <span className="font-sans font-bold text-xl tracking-tight">
              FLIP<span className="text-primary">LAB</span>
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 cursor-pointer",
                    isActive
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
