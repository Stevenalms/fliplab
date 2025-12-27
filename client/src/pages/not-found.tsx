import { Link } from "wouter";
import { AlertTriangle, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background text-foreground p-4 relative overflow-hidden">
      {/* Glitch Effect Background */}
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[url('https://media.giphy.com/media/oEI9uBYSzLpBK/giphy.gif')] bg-cover mix-blend-overlay" />
      
      <div className="relative z-10 flex flex-col items-center">
        <div className="w-24 h-24 rounded-full bg-destructive/10 flex items-center justify-center mb-6 animate-pulse border border-destructive/20 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
          <AlertTriangle className="w-12 h-12 text-destructive" />
        </div>
        
        <h1 className="text-8xl font-bold mb-2 font-mono tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-white/50">404</h1>
        <h2 className="text-2xl font-bold mb-6 text-primary tracking-widest uppercase">Signal Lost</h2>
        
        <p className="text-center max-w-md text-muted-foreground mb-8 font-mono text-sm leading-relaxed">
          The frequency you are trying to tune into does not exist. 
          <br/>
          Please return to the main channel.
        </p>

        <Link href="/">
          <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold tracking-wide rounded-none border border-primary/50">
            <Home className="w-4 h-4 mr-2" /> RETURN TO LAB
          </Button>
        </Link>
      </div>
    </div>
  );
}
