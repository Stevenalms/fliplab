import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Activity, Play } from "lucide-react";

export default function Login() {
  const [_, setLocation] = useLocation();
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmed = nickname.trim();
    if (trimmed.length < 2) {
      setError("Nickname must be at least 2 characters");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/enter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: trimmed }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to enter");
      }
      
      const result = await res.json();
      if (result.user) {
        localStorage.setItem("userId", result.user.id);
        localStorage.setItem("username", result.user.username);
        window.dispatchEvent(new Event("storage"));
        setLocation("/");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to enter");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded bg-primary/20 flex items-center justify-center border border-primary/50">
              <Activity className="w-7 h-7 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-2">FLIPLAB</h1>
          <p className="text-muted-foreground">
            Enter your nickname to start
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Nickname</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Enter your nickname"
              className="w-full h-10 px-3 rounded-md bg-black/20 border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-primary"
              autoComplete="off"
            />
          </div>

          {error && (
            <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-md flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Play className="w-4 h-4" /> ENTER THE LAB
          </button>
        </form>

        <div className="mt-12 pt-8 border-t border-white/5 text-center">
          <p className="text-xs text-muted-foreground/60">Created by Steven Almstead</p>
        </div>
      </motion.div>
    </div>
  );
}
