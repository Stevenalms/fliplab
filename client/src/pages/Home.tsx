import { motion } from "framer-motion";
import { Link } from "wouter";
import { ArrowRight, Disc, Mic2, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Hero Section */}
      <section
        className="relative h-screen flex items-center justify-center overflow-hidden"
        style={{ backgroundColor: "#0b0b0b" }}
      >
        {/* Background Overlay (image removed to fix build) */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-background/80 to-background" />
          <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:40px_40px]" />
        </div>

        <div className="container relative z-10 px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-6 backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                System Online • v2.0.4
              </span>
            </div>

            <h1 className="text-6xl md:text-8xl font-bold tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-white/50">
              FLIP THE <span className="text-primary">SAMPLE</span>
            </h1>

            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-10 font-light">
              Compete with 3 other producers. 10 minutes on the clock.
              One sample. Who has the best flip?
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/lobby">
                <Button
                  size="lg"
                  className="h-14 px-8 text-lg bg-primary text-primary-foreground hover:bg-primary/90 rounded-none border border-primary/50 shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:shadow-[0_0_30px_rgba(34,197,94,0.5)] transition-all"
                >
                  ENTER THE LAB <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>

              <Button
                size="lg"
                variant="outline"
                className="h-14 px-8 text-lg rounded-none bg-black/50 backdrop-blur-md border-white/10 hover:bg-white/10 hover:border-white/20"
              >
                WATCH BATTLES
              </Button>
            </div>

            <p className="mt-12 text-sm text-muted-foreground/60 font-mono">
              Created by Steven Almstead
            </p>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-background border-t border-white/5 relative">
        <div className="container px-4 mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard
              icon={Disc}
              title="Samplette Integration"
              description="Discover rare samples from Soul, Funk, and Jazz archives. Every match starts with a fresh dig."
            />
            <FeatureCard
              icon={Activity}
              title="10-Minute Rush"
              description="Race against the clock. Chop, pitch, and effect your sample before time runs out."
            />
            <FeatureCard
              icon={Mic2}
              title="Community Voting"
              description="Vote on 'Best Flip' and 'Best Drums'. Climb the leaderboard and unlock pro plugins."
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: any;
  title: string;
  description: string;
}) {
  return (
    <div className="p-8 rounded-xl bg-card/30 border border-white/5 hover:border-primary/30 transition-all group hover:bg-card/50">
      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
        <Icon className="w-6 h-6 text-primary" />
      </div>
      <h3 className="text-xl font-bold mb-3 font-sans">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}
