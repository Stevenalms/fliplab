import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import {
  type DrumPattern,
  type DrumType,
  createEmptyPattern,
  playDrumAtTime,
  getAudioContextTime,
  resumeAudioContext,
  playDrum,
} from "@/lib/soundGenerator";

interface DrumSequencerProps {
  selectedDrums: {
    kicks: number;
    snares: number;
    hats: number;
    openHats: number;
    percs: number;
  };
  externalPattern?: DrumPattern;
  onPatternChange?: (pattern: DrumPattern) => void;
  externalBpm?: number;
  onBpmChange?: (bpm: number) => void;
  isPlayingExternal?: boolean;
  currentStepExternal?: number;
  steps?: number;
  onStepsChange?: (steps: number) => void;
}

const LANES: { type: DrumType; label: string; color: string }[] = [
  { type: "kicks", label: "KICK", color: "bg-red-500" },
  { type: "snares", label: "SNARE", color: "bg-blue-500" },
  { type: "hats", label: "HAT", color: "bg-yellow-500" },
  { type: "openHats", label: "OH", color: "bg-yellow-600" },
  { type: "percs", label: "PERC", color: "bg-purple-500" },
];

const STEP_OPTIONS = [4, 8, 16, 32, 48, 64];

export default function DrumSequencer({ 
  selectedDrums,
  externalPattern,
  onPatternChange,
  externalBpm,
  onBpmChange,
  isPlayingExternal,
  currentStepExternal,
  steps = 16,
  onStepsChange,
}: DrumSequencerProps) {
  const [internalPattern, setInternalPattern] = useState<DrumPattern>(createEmptyPattern(steps));
  const [isPlayingInternal, setIsPlayingInternal] = useState(false);
  const [currentStepInternal, setCurrentStepInternal] = useState(-1);
  const [internalBpm, setInternalBpm] = useState(92);

  const pattern = externalPattern ?? internalPattern;
  const isPlaying = isPlayingExternal ?? isPlayingInternal;
  const currentStep = currentStepExternal ?? currentStepInternal;
  const bpm = externalBpm ?? internalBpm;
  
  const isExternallyControlled = isPlayingExternal !== undefined;

  const schedulerRef = useRef<number | null>(null);
  const nextStepTimeRef = useRef(0);
  const currentStepRef = useRef(0);
  const patternRef = useRef(pattern);
  const selectedDrumsRef = useRef(selectedDrums);
  const bpmRef = useRef(bpm);
  const stepsRef = useRef(steps);

  useEffect(() => {
    patternRef.current = pattern;
  }, [pattern]);

  useEffect(() => {
    selectedDrumsRef.current = selectedDrums;
  }, [selectedDrums]);

  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);
  
  useEffect(() => {
    stepsRef.current = steps;
  }, [steps]);

  const toggleStep = (lane: DrumType, step: number) => {
    const wasActive = pattern[lane][step];
    const newPattern = {
      ...pattern,
      [lane]: pattern[lane].map((v, i) => (i === step ? !v : v)),
    };
    
    if (!wasActive) {
      resumeAudioContext().then(() => {
        playDrum(lane, selectedDrumsRef.current[lane] || 0);
      }).catch(() => {});
    }
    
    if (onPatternChange) {
      onPatternChange(newPattern);
    } else {
      setInternalPattern(newPattern);
    }
  };

  const handleBpmChange = (value: number) => {
    if (onBpmChange) {
      onBpmChange(value);
    } else {
      setInternalBpm(value);
    }
  };

  const scheduleNotes = useCallback(() => {
    const ctx = getAudioContextTime();
    const stepDuration = 60 / bpmRef.current / 4;
    const lookAhead = 0.1;
    const scheduleWindow = 0.05;

    while (nextStepTimeRef.current < ctx + lookAhead) {
      const step = currentStepRef.current % stepsRef.current;
      const currentPattern = patternRef.current;
      const drums = selectedDrumsRef.current;

      LANES.forEach(({ type }) => {
        if (currentPattern[type][step]) {
          playDrumAtTime(type, drums[type], nextStepTimeRef.current);
        }
      });

      setCurrentStepInternal(step);
      nextStepTimeRef.current += stepDuration;
      currentStepRef.current++;
    }

    schedulerRef.current = window.setTimeout(scheduleNotes, scheduleWindow * 1000);
  }, []);

  const startPlayback = async () => {
    await resumeAudioContext();
    nextStepTimeRef.current = getAudioContextTime();
    currentStepRef.current = 0;
    setIsPlayingInternal(true);
    scheduleNotes();
  };

  const stopPlayback = () => {
    if (schedulerRef.current) {
      clearTimeout(schedulerRef.current);
      schedulerRef.current = null;
    }
    setIsPlayingInternal(false);
    setCurrentStepInternal(-1);
  };

  const clearPattern = () => {
    const emptyPattern = createEmptyPattern(steps);
    if (onPatternChange) {
      onPatternChange(emptyPattern);
    } else {
      setInternalPattern(emptyPattern);
    }
  };

  useEffect(() => {
    return () => {
      if (schedulerRef.current) {
        clearTimeout(schedulerRef.current);
      }
    };
  }, []);

  return (
    <div className="bg-black/30 rounded-xl border border-white/10 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold uppercase tracking-wider">Drum Grid</h3>
          {!isExternallyControlled && (
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                data-testid="sequencer-play"
                onClick={isPlaying ? stopPlayback : startPlayback}
                className={cn(
                  "h-8 w-8 p-0",
                  isPlaying && "bg-primary/20 text-primary"
                )}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                data-testid="sequencer-stop"
                onClick={stopPlayback}
                className="h-8 w-8 p-0"
              >
                <Square className="w-4 h-4" />
              </Button>
            </div>
          )}
          <Button
            size="sm"
            variant="ghost"
            data-testid="sequencer-clear"
            onClick={clearPattern}
            className="h-8 px-2 text-xs"
          >
            Clear
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Steps</span>
            <select
              value={steps}
              onChange={(e) => onStepsChange?.(Number(e.target.value))}
              className="bg-black/40 border border-white/10 rounded px-2 py-1 text-xs"
              data-testid="steps-select"
            >
              {STEP_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">BPM</span>
            <Slider
              value={[bpm]}
              onValueChange={([v]) => handleBpmChange(v)}
              min={60}
              max={140}
              step={1}
              className="w-24"
              data-testid="bpm-slider"
            />
            <span className="text-xs font-mono w-8">{bpm}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1 overflow-x-auto">
        <div className="flex gap-1 ml-14 mb-1" style={{ minWidth: steps > 16 ? `${steps * 24}px` : 'auto' }}>
          {Array.from({ length: steps }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "flex-1 h-4 flex items-center justify-center text-[10px] font-mono",
                i % 4 === 0 ? "text-white/60" : "text-white/20"
              )}
            >
              {i + 1}
            </div>
          ))}
        </div>

        {LANES.map(({ type, label, color }) => (
          <div key={type} className="flex gap-1 items-center" style={{ minWidth: steps > 16 ? `${steps * 24 + 56}px` : 'auto' }}>
            <div className="w-12 text-[10px] font-bold text-right pr-2 text-muted-foreground flex-shrink-0">
              {label}
            </div>
            {Array.from({ length: steps }).map((_, stepIndex) => {
              const isActive = pattern[type][stepIndex];
              const isCurrent = stepIndex === currentStep && isPlaying;
              const isBeat = stepIndex % 4 === 0;

              return (
                <button
                  key={stepIndex}
                  data-testid={`step-${type}-${stepIndex}`}
                  onClick={() => toggleStep(type, stepIndex)}
                  className={cn(
                    "flex-1 h-8 rounded-sm border transition-all",
                    isActive
                      ? `${color} border-white/30 shadow-[0_0_10px_rgba(255,255,255,0.2)]`
                      : isBeat
                      ? "bg-white/10 border-white/10 hover:bg-white/20"
                      : "bg-white/5 border-white/5 hover:bg-white/15",
                    isCurrent && "ring-2 ring-white ring-offset-1 ring-offset-black"
                  )}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
