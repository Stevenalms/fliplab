import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { 
  Play, Pause, Square, SkipBack, 
  Scissors, Zap, Sliders, Layers, 
  Clock, Save, ArrowRight, ChevronLeft, ChevronRight, Music, FolderOpen,
  ZoomIn, ZoomOut
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { drumKits, playDrum, preloadDrums, type DrumType, getEffectsState, updateEffects, type EffectsState, type DrumPattern, createEmptyPattern, playDrumAtTime, getAudioContextTime, getAudioContext } from "@/lib/soundGenerator";
import { gameWs } from "@/lib/websocket";
import { useMatch, useCreateDraft, useDrafts } from "@/lib/api";
import DrumSequencer from "@/components/DrumSequencer";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import WaveSurfer from "wavesurfer.js";
import { musicSamples, type MusicSample } from "@shared/samples";

export default function Studio() {
  const [_, setLocation] = useLocation();
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [timerInitialized, setTimerInitialized] = useState(false);
  const [activeTab, setActiveTab] = useState("");
  const [selectedDrums, setSelectedDrums] = useState({
    kicks: 0,
    snares: 0,
    hats: 0,
    openHats: 0,
    percs: 0,
    perc2: 3,
  });
  const [effects, setEffects] = useState<EffectsState>(getEffectsState());
  const [sampleProgress, setSampleProgress] = useState(0);
  const [sampleDuration, setSampleDuration] = useState(0);
  const [sampleLoaded, setSampleLoaded] = useState(false);
  const [gridSteps, setGridSteps] = useState(16);
  const [drumPattern, setDrumPattern] = useState<DrumPattern>(createEmptyPattern(16));
  const [currentStep, setCurrentStep] = useState(-1);
  const [bpm, setBpm] = useState(90);
  const [draftName, setDraftName] = useState("");
  const [showDraftDialog, setShowDraftDialog] = useState(false);
  const [showDraftsPanel, setShowDraftsPanel] = useState(false);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [loopStart, setLoopStart] = useState(0);
  const [loopEnd, setLoopEnd] = useState(1);
  const [draggingHandle, setDraggingHandle] = useState<'start' | 'end' | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const schedulerRef = useRef<number | null>(null);
  const nextStepTimeRef = useRef(0);
  const currentStepRef = useRef(0);
  const loopEnabledRef = useRef(loopEnabled);
  const loopStartRef = useRef(loopStart);
  const loopEndRef = useRef(loopEnd);
  const loopAnimationRef = useRef<number | null>(null);
  const bpmRef = useRef(bpm);
  const gridStepsRef = useRef(gridSteps);
  
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { gridStepsRef.current = gridSteps; }, [gridSteps]);
  
  useEffect(() => { loopEnabledRef.current = loopEnabled; }, [loopEnabled]);
  useEffect(() => { loopStartRef.current = loopStart; }, [loopStart]);
  useEffect(() => { loopEndRef.current = loopEnd; }, [loopEnd]);
  
  useEffect(() => {
    if (!draggingHandle) return;
    
    const handleMove = (clientX: number) => {
      if (!waveformRef.current) return;
      const rect = waveformRef.current.getBoundingClientRect();
      const x = (clientX - rect.left) / rect.width;
      const clampedX = Math.max(0, Math.min(1, x));
      
      if (draggingHandle === 'start') {
        setLoopStart(Math.min(clampedX, loopEndRef.current - 0.02));
      } else {
        setLoopEnd(Math.max(clampedX, loopStartRef.current + 0.02));
      }
    };
    
    const handleMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        e.preventDefault();
        handleMove(e.touches[0].clientX);
      }
    };
    
    const handleEnd = () => {
      setDraggingHandle(null);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleEnd);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [draggingHandle]);
  
  const handleEffectChange = (update: Partial<EffectsState>) => {
    updateEffects(update);
    setEffects(getEffectsState());
  };
  
  const searchParams = new URLSearchParams(window.location.search);
  const matchId = searchParams.get("matchId");
  const userId = searchParams.get("userId") || localStorage.getItem("userId");
  const modeParam = searchParams.get("mode");
  const genreParam = searchParams.get("genre") as "soul" | "funk" | "jazz" | null;
  
  const { data: matchData } = useMatch(matchId);
  
  const [practiceSample, setPracticeSample] = useState<MusicSample | null>(null);
  
  useEffect(() => {
    if (modeParam === "practice" && genreParam && !practiceSample) {
      const genreSamples = musicSamples.filter(s => s.genre === genreParam);
      if (genreSamples.length > 0) {
        const randomSample = genreSamples[Math.floor(Math.random() * genreSamples.length)];
        setPracticeSample(randomSample);
        if (randomSample.bpm) {
          setBpm(randomSample.bpm);
        }
      }
    }
  }, [modeParam, genreParam]);
  
  const gameMode = matchData?.match?.gameMode || modeParam || "battle";
  const sampleName = matchData?.match?.sample || practiceSample?.name || "Loading...";
  const sampleUrl = matchData?.match?.sampleUrl || practiceSample?.url;
  const genre = matchData?.match?.genre || genreParam || "soul";
  const sampleId = matchData?.match?.sampleId || practiceSample?.id || sampleName;
  
  const createDraftMutation = useCreateDraft();
  const { data: draftsData, refetch: refetchDrafts } = useDrafts(userId);

  useEffect(() => {
    preloadDrums();
  }, []);

  useEffect(() => {
    if (!sampleUrl || !waveformRef.current) return;
    
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
    }
    
    setSampleLoaded(false);
    setSampleProgress(0);
    setIsPlaying(false);

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: 'rgba(34, 197, 94, 0.4)',
      progressColor: '#22c55e',
      cursorColor: '#ffffff',
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 120,
      normalize: true,
      backend: 'WebAudio',
    });

    ws.load(sampleUrl);

    ws.on('ready', () => {
      setSampleDuration(ws.getDuration());
      setSampleLoaded(true);
      if (matchData?.match?.bpm) {
        setBpm(matchData.match.bpm);
      }
    });

    ws.on('play', () => {
      setIsPlaying(true);
    });

    ws.on('pause', () => {
      setIsPlaying(false);
    });

    ws.on('finish', () => {
      if (loopEnabledRef.current) {
        const duration = ws.getDuration();
        ws.setTime(loopStartRef.current * duration);
        ws.play();
      } else {
        setIsPlaying(false);
        setSampleProgress(0);
        stopDrumScheduler();
      }
    });

    wavesurferRef.current = ws;

    return () => {
      if (loopAnimationRef.current) {
        cancelAnimationFrame(loopAnimationRef.current);
        loopAnimationRef.current = null;
      }
      ws.destroy();
      wavesurferRef.current = null;
    };
  }, [sampleUrl]);

  useEffect(() => {
    if (wavesurferRef.current && sampleLoaded) {
      const minPxPerSec = zoomLevel * 50;
      wavesurferRef.current.zoom(minPxPerSec);
    }
  }, [zoomLevel, sampleLoaded]);

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev * 1.5, 20));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev / 1.5, 1));

  const drumPatternRef = useRef(drumPattern);
  const selectedDrumsRef = useRef(selectedDrums);
  
  useEffect(() => { drumPatternRef.current = drumPattern; }, [drumPattern]);
  useEffect(() => { selectedDrumsRef.current = selectedDrums; }, [selectedDrums]);
  
  const scheduleNotes = useCallback(() => {
    const ctx = getAudioContextTime();
    const stepDuration = 60 / bpmRef.current / 4;
    const lookAhead = 0.1;
    const scheduleWindow = 0.05;

    while (nextStepTimeRef.current < ctx + lookAhead) {
      const step = currentStepRef.current % gridStepsRef.current;

      Object.entries(drumPatternRef.current).forEach(([type, steps]) => {
        if (steps[step]) {
          playDrumAtTime(type as DrumType, selectedDrumsRef.current[type as keyof typeof selectedDrumsRef.current] || 0, nextStepTimeRef.current);
        }
      });

      setCurrentStep(step);
      nextStepTimeRef.current += stepDuration;
      currentStepRef.current++;
    }

    schedulerRef.current = window.setTimeout(scheduleNotes, scheduleWindow * 1000);
  }, []);

  const startDrumScheduler = useCallback(async () => {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    nextStepTimeRef.current = ctx.currentTime;
    currentStepRef.current = 0;
    scheduleNotes();
  }, [scheduleNotes]);

  const stopDrumScheduler = useCallback(() => {
    if (schedulerRef.current) {
      clearTimeout(schedulerRef.current);
      schedulerRef.current = null;
    }
    setCurrentStep(-1);
  }, []);

  const startLoopChecker = useCallback(() => {
    const checkLoop = () => {
      const ws = wavesurferRef.current;
      if (!ws) return;
      
      const currentTime = ws.getCurrentTime();
      const duration = ws.getDuration();
      
      if (duration > 0) {
        setSampleProgress((currentTime / duration) * 100);
        
        if (loopEnabledRef.current) {
          const loopEndTime = loopEndRef.current * duration;
          if (currentTime >= loopEndTime - 0.05) {
            ws.setTime(loopStartRef.current * duration);
          }
        }
      }
      
      if (ws.isPlaying()) {
        loopAnimationRef.current = requestAnimationFrame(checkLoop);
      }
    };
    
    if (loopAnimationRef.current) {
      cancelAnimationFrame(loopAnimationRef.current);
    }
    loopAnimationRef.current = requestAnimationFrame(checkLoop);
  }, []);

  const stopLoopChecker = useCallback(() => {
    if (loopAnimationRef.current) {
      cancelAnimationFrame(loopAnimationRef.current);
      loopAnimationRef.current = null;
    }
  }, []);

  const toggleSamplePlayback = async () => {
    if (!wavesurferRef.current || !sampleLoaded) return;
    
    if (isPlaying) {
      wavesurferRef.current.pause();
      stopDrumScheduler();
      stopLoopChecker();
    } else {
      if (loopEnabled) {
        const duration = wavesurferRef.current.getDuration();
        wavesurferRef.current.setTime(loopStart * duration);
      }
      wavesurferRef.current.play();
      await startDrumScheduler();
      startLoopChecker();
    }
  };

  const stopSample = () => {
    if (!wavesurferRef.current) return;
    wavesurferRef.current.stop();
    stopDrumScheduler();
    stopLoopChecker();
    setSampleProgress(0);
  };

  const stopAllAudio = useCallback(() => {
    stopDrumScheduler();
    stopLoopChecker();
    if (wavesurferRef.current) {
      wavesurferRef.current.pause();
      wavesurferRef.current.stop();
    }
    setIsPlaying(false);
    setCurrentStep(-1);
  }, [stopDrumScheduler, stopLoopChecker]);

  const skipToStart = () => {
    if (!wavesurferRef.current) return;
    wavesurferRef.current.seekTo(0);
    setSampleProgress(0);
  };

  const togglePlaybackRef = useRef(toggleSamplePlayback);
  useEffect(() => { togglePlaybackRef.current = toggleSamplePlayback; });
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && 
          !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        togglePlaybackRef.current();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (matchId && userId) {
      gameWs.send("join_studio", { matchId, userId });
    }
  }, [matchId, userId]);

  useEffect(() => {
    if (matchData?.remainingSeconds !== undefined && !timerInitialized) {
      setTimeLeft(matchData.remainingSeconds);
      setTimerInitialized(true);
    }
  }, [matchData, timerInitialized]);

  useEffect(() => {
    const handleTimeSync = (data: any) => {
      if (data.remainingSeconds !== undefined) {
        setTimeLeft(data.remainingSeconds);
      }
    };

    const handleMatchEnded = (data: any) => {
      stopAllAudio();
      const destination = data.destination || (gameMode === "duel" ? "showcase" : "voting");
      if (destination === "showcase") {
        setLocation(`/showcase?matchId=${matchId}&userId=${userId}`);
      } else {
        setLocation(`/voting?matchId=${matchId}&userId=${userId}`);
      }
    };

    gameWs.on("time_sync", handleTimeSync);
    gameWs.on("match_ended", handleMatchEnded);

    return () => {
      gameWs.off("time_sync", handleTimeSync);
      gameWs.off("match_ended", handleMatchEnded);
    };
  }, [matchId, userId, gameMode, setLocation, stopAllAudio]);

  // Cleanup all audio when component unmounts
  useEffect(() => {
    return () => {
      stopAllAudio();
    };
  }, [stopAllAudio]);

  useEffect(() => {
    if (timeLeft === null) return;
    
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 0) return prev;
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [timeLeft !== null]);

  const handleSubmitEarly = () => {
    stopAllAudio();
    gameWs.send("match_end", { matchId, userId });
  };

  const handleSaveDraft = async () => {
    if (!userId || !draftName.trim()) return;
    
    await createDraftMutation.mutateAsync({
      userId,
      name: draftName.trim(),
      sampleId: sampleId,
      genre: genre,
      bpm: bpm,
      drumPattern: drumPattern,
      effectSettings: effects,
    });
    
    setDraftName("");
    setShowDraftDialog(false);
    refetchDrafts();
  };

  const formatTime = (seconds: number | null) => {
    if (seconds === null) return "--:--";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatSampleTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };
  
  const displayTime = timeLeft ?? 600;

  const beatCount = sampleDuration > 0 ? Math.ceil((sampleDuration / 60) * bpm) : 0;
  const barCount = Math.ceil(beatCount / 4);

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <header className="h-16 border-b border-white/10 bg-card/50 flex items-center justify-between px-6 z-20">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground font-mono">PROJECT</span>
            <span className="font-bold text-sm">FUNK_FLIP_04</span>
          </div>
          <div className="h-8 w-px bg-white/10 mx-2" />
          <div className="flex items-center gap-2">
            <Music className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground font-mono uppercase">{genre}</span>
            <span className="text-sm font-medium text-primary">{sampleName}</span>
            {sampleLoaded && (
              <>
                <span className="px-2 py-0.5 rounded bg-primary/20 text-primary font-mono text-sm font-bold">
                  {bpm} BPM
                </span>
                <span className="text-xs text-muted-foreground">
                  {Math.floor(sampleDuration / 60)}:{Math.floor(sampleDuration % 60).toString().padStart(2, '0')}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/40 px-6 py-2 rounded-lg border border-white/5">
          <Clock className={cn("w-5 h-5", displayTime < 60 ? "text-red-500 animate-pulse" : "text-primary")} />
          <span className={cn("font-mono text-2xl font-bold", displayTime < 60 ? "text-red-500" : "text-foreground")}>
            {formatTime(timeLeft)}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Dialog open={showDraftDialog} onOpenChange={setShowDraftDialog}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-white" data-testid="button-save-draft">
                <Save className="w-4 h-4 mr-2" /> Save Draft
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-white/10">
              <DialogHeader>
                <DialogTitle>Save Draft</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <Input
                  placeholder="Draft name..."
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  className="bg-black/20 border-white/10"
                  data-testid="input-draft-name"
                />
                <Button 
                  onClick={handleSaveDraft} 
                  disabled={!draftName.trim() || createDraftMutation.isPending}
                  className="w-full"
                  data-testid="button-confirm-save-draft"
                >
                  {createDraftMutation.isPending ? "Saving..." : "Save Draft"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-muted-foreground hover:text-white"
            onClick={() => setShowDraftsPanel(!showDraftsPanel)}
            data-testid="button-open-drafts"
          >
            <FolderOpen className="w-4 h-4 mr-2" /> Drafts
          </Button>
          
          <Button 
            size="sm" 
            className={cn("text-primary-foreground hover:opacity-90", gameMode === "duel" ? "bg-orange-500" : "bg-primary")}
            onClick={handleSubmitEarly}
            data-testid="button-submit"
          >
            SUBMIT <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-16 border-r border-white/10 bg-card/30 flex flex-col items-center py-4 gap-4">
          <ToolButton icon={Scissors} label="Chop" active={activeTab === "chop"} onClick={() => setActiveTab("chop")} />
          <ToolButton icon={Zap} label="FX" active={activeTab === "fx"} onClick={() => setActiveTab("fx")} />
          <ToolButton icon={Sliders} label="Mix" active={activeTab === "mix"} onClick={() => setActiveTab("mix")} />
          <ToolButton icon={Layers} label="Drums" active={activeTab === "drums"} onClick={() => setActiveTab("drums")} />
        </div>

        <div className="flex-1 flex flex-col bg-background relative">
          {activeTab !== "chop" && activeTab !== "fx" && activeTab !== "mix" && activeTab !== "drums" ? null : (
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="absolute inset-0 z-30 bg-background/95 backdrop-blur-sm p-6 overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold uppercase">{activeTab}</h2>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setActiveTab("")}
                  className="border-white/20"
                >
                  Close
                </Button>
              </div>
              
              {activeTab === "chop" && (
                <div className="space-y-6">
                  <p className="text-muted-foreground">Select a portion of the sample to loop while you add drums.</p>
                  
                  <div className="p-6 bg-black/40 rounded-xl border border-primary/30">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-primary">Loop Region</h3>
                      <Switch 
                        checked={loopEnabled}
                        onCheckedChange={setLoopEnabled}
                        data-testid="switch-loop-enabled"
                      />
                    </div>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span>Start</span>
                          <span className="text-primary">{sampleDuration > 0 ? formatSampleTime(loopStart * sampleDuration) : '0:00'}</span>
                        </div>
                        <Slider 
                          value={[loopStart * 100]} 
                          onValueChange={([v]) => setLoopStart(Math.min(v / 100, loopEnd - 0.05))}
                          min={0} max={100} step={1}
                          disabled={!loopEnabled}
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span>End</span>
                          <span className="text-primary">{sampleDuration > 0 ? formatSampleTime(loopEnd * sampleDuration) : '0:00'}</span>
                        </div>
                        <Slider 
                          value={[loopEnd * 100]} 
                          onValueChange={([v]) => setLoopEnd(Math.max(v / 100, loopStart + 0.05))}
                          min={0} max={100} step={1}
                          disabled={!loopEnabled}
                        />
                      </div>
                      <div className="text-center pt-2 border-t border-white/10">
                        <span className="text-sm text-muted-foreground">Loop Length: </span>
                        <span className="text-primary font-bold">{sampleDuration > 0 ? formatSampleTime((loopEnd - loopStart) * sampleDuration) : '0:00'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-3">
                    <Button 
                      variant="outline" 
                      className="border-white/20"
                      onClick={() => { setLoopStart(0); setLoopEnd(0.25); setLoopEnabled(true); }}
                    >
                      4 Bars
                    </Button>
                    <Button 
                      variant="outline" 
                      className="border-white/20"
                      onClick={() => { setLoopStart(0); setLoopEnd(0.5); setLoopEnabled(true); }}
                    >
                      8 Bars
                    </Button>
                    <Button 
                      variant="outline" 
                      className="border-white/20"
                      onClick={() => { setLoopStart(0); setLoopEnd(0.125); setLoopEnabled(true); }}
                    >
                      2 Bars
                    </Button>
                    <Button 
                      variant="outline" 
                      className="border-white/20"
                      onClick={() => { setLoopEnabled(false); setLoopStart(0); setLoopEnd(1); }}
                    >
                      Full Track
                    </Button>
                  </div>
                  
                  <h4 className="font-bold text-sm mt-4">Quick Jump Pads</h4>
                  <div className="grid grid-cols-4 gap-3">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div 
                        key={i}
                        className="aspect-square bg-black/40 rounded-xl border border-white/10 hover:border-primary/50 cursor-pointer flex items-center justify-center transition-all hover:scale-105"
                        onClick={() => {
                          if (wavesurferRef.current && sampleDuration > 0) {
                            const position = (i / 8);
                            wavesurferRef.current.seekTo(position);
                            if (loopEnabled) {
                              setLoopStart(position);
                              setLoopEnd(Math.min(position + 0.125, 1));
                            }
                          }
                        }}
                      >
                        <div className="text-center">
                          <div className="text-xl font-bold text-primary">{i + 1}</div>
                          <div className="text-[10px] text-muted-foreground">Section</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {activeTab === "fx" && (
                <div className="space-y-6">
                  <p className="text-muted-foreground">Audio effects to shape your sound.</p>
                  <div className="grid grid-cols-3 gap-6">
                    <div className="p-6 bg-black/40 rounded-xl border border-blue-500/30">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-blue-400">Compressor</h3>
                        <Switch 
                          checked={effects.compressor.enabled}
                          onCheckedChange={(enabled) => handleEffectChange({ compressor: { ...effects.compressor, enabled } })}
                        />
                      </div>
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span>Threshold</span>
                            <span className="text-blue-400">{effects.compressor.threshold}dB</span>
                          </div>
                          <Slider 
                            value={[effects.compressor.threshold]} 
                            onValueChange={([v]) => handleEffectChange({ compressor: { ...effects.compressor, threshold: v } })}
                            min={-60} max={0} step={1}
                          />
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span>Ratio</span>
                            <span className="text-blue-400">{effects.compressor.ratio}:1</span>
                          </div>
                          <Slider 
                            value={[effects.compressor.ratio]} 
                            onValueChange={([v]) => handleEffectChange({ compressor: { ...effects.compressor, ratio: v } })}
                            min={1} max={20} step={0.5}
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-6 bg-black/40 rounded-xl border border-purple-500/30">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-purple-400">Reverb</h3>
                        <Switch 
                          checked={effects.reverb.enabled}
                          onCheckedChange={(enabled) => handleEffectChange({ reverb: { ...effects.reverb, enabled } })}
                        />
                      </div>
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span>Mix</span>
                            <span className="text-purple-400">{Math.round(effects.reverb.mix * 100)}%</span>
                          </div>
                          <Slider 
                            value={[effects.reverb.mix * 100]} 
                            onValueChange={([v]) => handleEffectChange({ reverb: { ...effects.reverb, mix: v / 100 } })}
                            min={0} max={100} step={1}
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-6 bg-black/40 rounded-xl border border-green-500/30">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-green-400">Delay</h3>
                        <Switch 
                          checked={effects.delay.enabled}
                          onCheckedChange={(enabled) => handleEffectChange({ delay: { ...effects.delay, enabled } })}
                        />
                      </div>
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span>Time</span>
                            <span className="text-green-400">{Math.round(effects.delay.time * 1000)}ms</span>
                          </div>
                          <Slider 
                            value={[effects.delay.time * 1000]} 
                            onValueChange={([v]) => handleEffectChange({ delay: { ...effects.delay, time: v / 1000 } })}
                            min={50} max={1000} step={10}
                          />
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span>Feedback</span>
                            <span className="text-green-400">{Math.round(effects.delay.feedback * 100)}%</span>
                          </div>
                          <Slider 
                            value={[effects.delay.feedback * 100]} 
                            onValueChange={([v]) => handleEffectChange({ delay: { ...effects.delay, feedback: v / 100 } })}
                            min={0} max={90} step={1}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {activeTab === "mix" && (
                <div className="space-y-6">
                  <p className="text-muted-foreground">Mix and master your beat.</p>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="p-6 bg-black/40 rounded-xl border border-white/10">
                      <h3 className="font-bold mb-4">Master Volume</h3>
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <Slider 
                            value={[effects.masterVolume * 100]} 
                            onValueChange={([v]) => handleEffectChange({ masterVolume: v / 100 })}
                            max={100} step={1}
                          />
                        </div>
                        <span className="text-2xl font-bold text-primary w-20 text-right">{Math.round(effects.masterVolume * 100)}%</span>
                      </div>
                    </div>
                    <div className="p-6 bg-black/40 rounded-xl border border-white/10">
                      <h3 className="font-bold mb-4">BPM</h3>
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <Slider 
                            value={[bpm]} 
                            onValueChange={([v]) => setBpm(v)}
                            min={60} max={180} step={1}
                          />
                        </div>
                        <span className="text-2xl font-bold text-primary w-20 text-right">{bpm}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {activeTab === "drums" && (
                <div className="space-y-6">
                  <p className="text-muted-foreground">Full drum machine view with expanded controls.</p>
                  <div className="grid grid-cols-5 gap-4 h-48">
                    <DrumPadWithSelect 
                      label="KICK" 
                      color="bg-red-500" 
                      shortcut="Q" 
                      drumType="kicks"
                      selectedIndex={selectedDrums.kicks}
                      onIndexChange={(i) => setSelectedDrums(prev => ({ ...prev, kicks: i }))}
                    />
                    <DrumPadWithSelect 
                      label="SNARE" 
                      color="bg-blue-500" 
                      shortcut="W"
                      drumType="snares"
                      selectedIndex={selectedDrums.snares}
                      onIndexChange={(i) => setSelectedDrums(prev => ({ ...prev, snares: i }))}
                    />
                    <DrumPadWithSelect 
                      label="HIHAT" 
                      color="bg-yellow-500" 
                      shortcut="E"
                      drumType="hats"
                      selectedIndex={selectedDrums.hats}
                      onIndexChange={(i) => setSelectedDrums(prev => ({ ...prev, hats: i }))}
                    />
                    <DrumPadWithSelect 
                      label="OPEN HAT" 
                      color="bg-yellow-600" 
                      shortcut="R"
                      drumType="openHats"
                      selectedIndex={selectedDrums.openHats}
                      onIndexChange={(i) => setSelectedDrums(prev => ({ ...prev, openHats: i }))}
                    />
                    <DrumPadWithSelect 
                      label="PERC" 
                      color="bg-purple-500" 
                      shortcut="T"
                      drumType="percs"
                      selectedIndex={selectedDrums.percs}
                      onIndexChange={(i) => setSelectedDrums(prev => ({ ...prev, percs: i }))}
                    />
                  </div>
                  <div className="p-4 bg-black/30 rounded-lg border border-white/10">
                    <h3 className="font-bold mb-2">Drum Controls</h3>
                    <p className="text-sm text-muted-foreground">Click pads to play drums. Use arrow buttons to cycle through different drum sounds. The drum sequencer below is always visible - use the grid to program your beat pattern.</p>
                  </div>
                </div>
              )}
            </motion.div>
          )}
          
          <div className="h-1/2 p-6 flex flex-col gap-4 border-b border-white/5 relative">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-3">
                <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Sample Player</h3>
                {!sampleLoaded && sampleUrl && (
                  <span className="text-xs text-yellow-400 animate-pulse">Loading audio...</span>
                )}
                <Button
                  size="sm"
                  variant={loopEnabled ? "default" : "outline"}
                  className={cn("h-6 text-xs", loopEnabled && "bg-primary text-black")}
                  onClick={() => {
                    setLoopEnabled(!loopEnabled);
                    if (!loopEnabled) {
                      setLoopStart(0);
                      setLoopEnd(0.25);
                    }
                  }}
                  data-testid="button-loop-toggle"
                >
                  {loopEnabled ? "LOOP ON" : "LOOP OFF"}
                </Button>
              </div>
              <div className="flex gap-2">
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-8 w-8 rounded-full bg-white/5 hover:bg-white/10"
                  onClick={skipToStart}
                  data-testid="button-skip-start"
                >
                  <SkipBack className="w-4 h-4" />
                </Button>
                <Button 
                  size="icon" 
                  className={cn("h-10 w-10 rounded-full", isPlaying ? "bg-accent text-white" : "bg-primary text-black", !sampleLoaded && "opacity-50 cursor-not-allowed")}
                  onClick={toggleSamplePlayback}
                  disabled={!sampleLoaded}
                  data-testid="button-play-sample"
                >
                  {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
                </Button>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-8 w-8 rounded-full bg-white/5 hover:bg-white/10"
                  onClick={stopSample}
                  data-testid="button-stop-sample"
                >
                  <Square className="w-4 h-4 fill-current" />
                </Button>
              </div>
            </div>
            
            <div className="flex-1 bg-black/40 rounded-lg border border-white/5 relative overflow-hidden group">
              {barCount > 0 && (
                <div className="absolute inset-0 flex pointer-events-none z-10">
                  {Array.from({ length: barCount }).map((_, i) => (
                    <div 
                      key={i}
                      className="flex-1 border-l border-white/20 first:border-l-0"
                      style={{ borderLeftStyle: i % 4 === 0 ? 'solid' : 'dashed' }}
                    >
                      <span className="text-[10px] text-white/30 ml-1">{i + 1}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {loopEnabled && (activeTab === "" || activeTab === "chop") && (
                <>
                  <div 
                    className="absolute top-0 bottom-0 bg-primary/20 z-20 pointer-events-none"
                    style={{ 
                      left: `${loopStart * 100}%`, 
                      width: `${(loopEnd - loopStart) * 100}%` 
                    }}
                  >
                    <div className="absolute -top-0 left-1/2 -translate-x-1/2 bg-primary text-black text-[10px] px-1 font-bold">LOOP</div>
                  </div>
                  
                  <div 
                    className="absolute top-0 bottom-0 w-3 bg-primary cursor-ew-resize z-30 hover:bg-primary/80 flex items-center justify-center touch-none"
                    style={{ left: `calc(${loopStart * 100}% - 6px)` }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setDraggingHandle('start');
                    }}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      setDraggingHandle('start');
                    }}
                    data-testid="loop-handle-start"
                  >
                    <div className="w-0.5 h-8 bg-black/30 rounded" />
                  </div>
                  
                  <div 
                    className="absolute top-0 bottom-0 w-3 bg-primary cursor-ew-resize z-30 hover:bg-primary/80 flex items-center justify-center touch-none"
                    style={{ left: `calc(${loopEnd * 100}% - 6px)` }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setDraggingHandle('end');
                    }}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      setDraggingHandle('end');
                    }}
                    data-testid="loop-handle-end"
                  >
                    <div className="w-0.5 h-8 bg-black/30 rounded" />
                  </div>
                </>
              )}
              
              <div ref={waveformRef} className="absolute inset-0" />
            </div>
            
            {sampleLoaded && wavesurferRef.current && (
              <div className="flex justify-between items-center text-xs text-muted-foreground font-mono">
                <span>{formatSampleTime(wavesurferRef.current.getCurrentTime())}</span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleZoomOut}
                    disabled={zoomLevel <= 1}
                    className="h-6 w-6 p-0"
                    data-testid="button-zoom-out"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </Button>
                  <span className="text-xs w-12 text-center">{Math.round(zoomLevel * 100)}%</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleZoomIn}
                    disabled={zoomLevel >= 20}
                    className="h-6 w-6 p-0"
                    data-testid="button-zoom-in"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                </div>
                <span>{formatSampleTime(sampleDuration)}</span>
              </div>
            )}
          </div>

          <div className="h-1/2 bg-card/20 p-6 flex flex-col gap-4 overflow-y-auto">
             <DrumSequencer 
               selectedDrums={selectedDrums} 
               externalPattern={drumPattern}
               onPatternChange={setDrumPattern}
               externalBpm={bpm}
               onBpmChange={setBpm}
               isPlayingExternal={isPlaying}
               currentStepExternal={currentStep}
               steps={gridSteps}
               onStepsChange={(newSteps) => {
                 setGridSteps(newSteps);
                 setDrumPattern(prev => {
                   const expanded: DrumPattern = {} as DrumPattern;
                   Object.keys(prev).forEach(key => {
                     const lane = prev[key as keyof DrumPattern];
                     if (newSteps > lane.length) {
                       expanded[key as keyof DrumPattern] = [...lane, ...Array(newSteps - lane.length).fill(false)];
                     } else {
                       expanded[key as keyof DrumPattern] = lane.slice(0, newSteps);
                     }
                   });
                   return expanded;
                 });
               }}
             />
             
             <div className="flex items-center justify-between mb-2">
               <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Boom Bap II Drum Kit - Pads</h3>
             </div>

             <div className="grid grid-cols-4 gap-4 flex-1 min-h-[180px]">
                <DrumPadWithSelect 
                  label="KICK" 
                  color="bg-red-500" 
                  shortcut="Q" 
                  drumType="kicks"
                  selectedIndex={selectedDrums.kicks}
                  onIndexChange={(i) => setSelectedDrums(prev => ({ ...prev, kicks: i }))}
                />
                <DrumPadWithSelect 
                  label="SNARE" 
                  color="bg-blue-500" 
                  shortcut="W"
                  drumType="snares"
                  selectedIndex={selectedDrums.snares}
                  onIndexChange={(i) => setSelectedDrums(prev => ({ ...prev, snares: i }))}
                />
                <DrumPadWithSelect 
                  label="HIHAT" 
                  color="bg-yellow-500" 
                  shortcut="E"
                  drumType="hats"
                  selectedIndex={selectedDrums.hats}
                  onIndexChange={(i) => setSelectedDrums(prev => ({ ...prev, hats: i }))}
                />
                <DrumPadWithSelect 
                  label="OPEN HAT" 
                  color="bg-yellow-600" 
                  shortcut="R"
                  drumType="openHats"
                  selectedIndex={selectedDrums.openHats}
                  onIndexChange={(i) => setSelectedDrums(prev => ({ ...prev, openHats: i }))}
                />
                
                <DrumPadWithSelect 
                  label="PERC 1" 
                  color="bg-purple-500" 
                  shortcut="A"
                  drumType="percs"
                  selectedIndex={selectedDrums.percs}
                  onIndexChange={(i) => setSelectedDrums(prev => ({ ...prev, percs: i }))}
                />
                <DrumPadWithSelect 
                  label="PERC 2" 
                  color="bg-purple-600" 
                  shortcut="S"
                  drumType="percs"
                  selectedIndex={selectedDrums.perc2}
                  onIndexChange={(i) => setSelectedDrums(prev => ({ ...prev, perc2: i }))}
                />
                <DrumPadWithSelect 
                  label="PERC 3" 
                  color="bg-pink-500" 
                  shortcut="D"
                  drumType="percs"
                  selectedIndex={5}
                  onIndexChange={() => {}}
                />
                <DrumPadWithSelect 
                  label="PERC 4" 
                  color="bg-green-500" 
                  shortcut="F"
                  drumType="percs"
                  selectedIndex={7}
                  onIndexChange={() => {}}
                />
             </div>
          </div>
        </div>

        <div className="w-64 border-l border-white/10 bg-card/30 p-4 flex flex-col gap-3">
          {showDraftsPanel ? (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Saved Drafts</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowDraftsPanel(false)}>
                  Back
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2">
                {draftsData?.drafts?.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No saved drafts yet</p>
                )}
                {draftsData?.drafts?.map((draft: any) => (
                  <div key={draft.id} className="p-3 bg-black/30 rounded-lg border border-white/5">
                    <div className="font-medium text-sm">{draft.name}</div>
                    <div className="text-xs text-muted-foreground">{draft.genre} | {draft.bpm} BPM</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Effects</h3>
              
              <div className="space-y-3">
                <EffectControl
                  name="Compressor"
                  color="blue"
                  enabled={effects.compressor.enabled}
                  onToggle={(enabled) => handleEffectChange({ compressor: { ...effects.compressor, enabled } })}
                  params={[
                    { label: "Thresh", value: effects.compressor.threshold, min: -60, max: 0, onChange: (v) => handleEffectChange({ compressor: { ...effects.compressor, threshold: v } }) },
                    { label: "Ratio", value: effects.compressor.ratio, min: 1, max: 20, onChange: (v) => handleEffectChange({ compressor: { ...effects.compressor, ratio: v } }) },
                  ]}
                />
                
                <EffectControl
                  name="Reverb"
                  color="purple"
                  enabled={effects.reverb.enabled}
                  onToggle={(enabled) => handleEffectChange({ reverb: { ...effects.reverb, enabled } })}
                  params={[
                    { label: "Mix", value: Math.round(effects.reverb.mix * 100), min: 0, max: 100, onChange: (v) => handleEffectChange({ reverb: { ...effects.reverb, mix: v / 100 } }) },
                  ]}
                />
                
                <EffectControl
                  name="Delay"
                  color="green"
                  enabled={effects.delay.enabled}
                  onToggle={(enabled) => handleEffectChange({ delay: { ...effects.delay, enabled } })}
                  params={[
                    { label: "Time", value: Math.round(effects.delay.time * 1000), min: 50, max: 1000, onChange: (v) => handleEffectChange({ delay: { ...effects.delay, time: v / 1000 } }) },
                    { label: "FB", value: Math.round(effects.delay.feedback * 100), min: 0, max: 90, onChange: (v) => handleEffectChange({ delay: { ...effects.delay, feedback: v / 100 } }) },
                  ]}
                />
              </div>
              
              <div className="mt-auto border-t border-white/5 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold">MASTER</span>
                  <span className="text-xs font-mono text-primary">{Math.round(effects.masterVolume * 100)}%</span>
                </div>
                <Slider 
                  value={[effects.masterVolume * 100]} 
                  onValueChange={([v]) => handleEffectChange({ masterVolume: v / 100 })}
                  max={100} 
                  step={1} 
                  className="w-full"
                  data-testid="master-volume"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ToolButton({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-12 h-12 rounded-xl flex flex-col items-center justify-center gap-1 transition-all",
        active 
          ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(34,197,94,0.4)]" 
          : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
      )}
    >
      <Icon className="w-5 h-5" />
      <span className="text-[10px] font-bold">{label}</span>
    </button>
  );
}

function DrumPadWithSelect({ 
  label, 
  color, 
  shortcut, 
  drumType, 
  selectedIndex, 
  onIndexChange 
}: { 
  label: string;
  color: string;
  shortcut: string;
  drumType: DrumType;
  selectedIndex: number;
  onIndexChange: (index: number) => void;
}) {
  const kit = drumKits[drumType];
  const maxIndex = kit.length - 1;

  const handlePlay = () => {
    playDrum(drumType, selectedIndex);
  };

  const handlePrev = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    const newIndex = selectedIndex > 0 ? selectedIndex - 1 : maxIndex;
    onIndexChange(newIndex);
    playDrum(drumType, newIndex);
  };

  const handleNext = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    const newIndex = selectedIndex < maxIndex ? selectedIndex + 1 : 0;
    onIndexChange(newIndex);
    playDrum(drumType, newIndex);
  };

  return (
    <div
      onClick={handlePlay}
      data-testid={`drum-pad-${drumType}-${selectedIndex}`}
      className="bg-black/40 rounded-xl border border-white/5 relative group hover:border-white/20 transition-all active:scale-95 cursor-pointer w-full h-full flex flex-col"
    >
      <div className={cn("absolute inset-2 rounded-lg opacity-20 group-hover:opacity-40 transition-opacity", color)} />
      <span className="absolute top-2 left-3 text-xs font-bold text-white/50">{label}</span>
      <span className="absolute bottom-2 right-3 text-xs font-mono text-white/20 border border-white/10 px-1.5 rounded">{shortcut}</span>
      
      <div className="mt-auto mb-8 flex items-center justify-center gap-2 relative z-10">
        <div
          role="button"
          onClick={handlePrev}
          data-testid={`drum-prev-${drumType}`}
          className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </div>
        <span className="text-xs font-mono text-primary min-w-[24px] text-center">{selectedIndex + 1}</span>
        <div
          role="button"
          onClick={handleNext}
          data-testid={`drum-next-${drumType}`}
          className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}

interface EffectParam {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

function EffectControl({ 
  name, 
  color, 
  enabled, 
  onToggle, 
  params 
}: { 
  name: string; 
  color: "blue" | "purple" | "green" | "orange"; 
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  params: EffectParam[];
}) {
  const colorClasses = {
    blue: "border-blue-500/50",
    purple: "border-purple-500/50",
    green: "border-green-500/50",
    orange: "border-orange-500/50",
  };

  return (
    <div 
      className={cn(
        "bg-black/30 rounded-lg p-3 border-l-2 transition-all",
        colorClasses[color],
        !enabled && "opacity-50"
      )}
    >
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-bold uppercase">{name}</span>
        <Switch
          checked={enabled}
          onCheckedChange={onToggle}
          data-testid={`effect-${name.toLowerCase()}-toggle`}
          className="scale-75"
        />
      </div>
      <div className="space-y-2">
        {params.map((param) => (
          <div key={param.label} className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-10">{param.label}</span>
            <Slider
              value={[param.value]}
              onValueChange={([v]) => param.onChange(v)}
              min={param.min}
              max={param.max}
              step={1}
              className="flex-1"
              data-testid={`slider-${name.toLowerCase()}-${param.label.toLowerCase()}`}
            />
            <span className="text-[10px] font-mono w-8 text-right">{Math.round(param.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
