import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Play, Pause, Square, Volume2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface TextToSpeechPlayerProps {
  text: string;
  className?: string;
}

const AI_VOICES = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", gender: "Female" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", gender: "Male" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", gender: "Male" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura", gender: "Female" },
  { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie", gender: "Male" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", gender: "Female" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam", gender: "Male" },
  { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", gender: "Female" },
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian", gender: "Male" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", gender: "Female" },
];

export const TextToSpeechPlayer = ({ text, className = "" }: TextToSpeechPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(AI_VOICES[0].id);
  const [playbackRate, setPlaybackRate] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const generateAndPlay = useCallback(async () => {
    if (!text.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text, voiceId: selectedVoice }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate speech");
      }

      const data = await response.json();
      
      // Create audio from base64
      const audioUrl = `data:audio/mpeg;base64,${data.audioContent}`;
      
      // Stop any existing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const audio = new Audio(audioUrl);
      audio.playbackRate = playbackRate;
      audioRef.current = audio;

      audio.onended = () => {
        setIsPlaying(false);
        setIsPaused(false);
      };

      audio.onerror = () => {
        setIsPlaying(false);
        setIsPaused(false);
        toast.error("Failed to play audio");
      };

      await audio.play();
      setIsPlaying(true);
    } catch (error) {
      console.error("TTS error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to generate speech");
    } finally {
      setIsLoading(false);
    }
  }, [text, selectedVoice, playbackRate]);

  const handlePlay = () => {
    if (isPaused && audioRef.current) {
      audioRef.current.play();
      setIsPaused(false);
      setIsPlaying(true);
      return;
    }
    generateAndPlay();
  };

  const handlePause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPaused(true);
      setIsPlaying(false);
    }
  };

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsPlaying(false);
    setIsPaused(false);
  };

  const handleRateChange = (newRate: number[]) => {
    const rate = newRate[0];
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  return (
    <div className={`flex flex-wrap items-center gap-3 p-3 bg-muted/50 rounded-lg ${className}`}>
      <div className="flex items-center gap-1">
        <Volume2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">AI Listen</span>
      </div>

      <div className="flex items-center gap-1">
        {!isPlaying ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handlePlay}
            disabled={!text.trim() || isLoading}
            className="h-8"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Play className="h-3 w-3 mr-1" />
                {isPaused ? "Resume" : "Play"}
              </>
            )}
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={handlePause}
            className="h-8"
          >
            <Pause className="h-3 w-3 mr-1" />
            Pause
          </Button>
        )}
        
        {(isPlaying || isPaused) && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleStop}
            className="h-8"
          >
            <Square className="h-3 w-3 mr-1" />
            Stop
          </Button>
        )}
      </div>

      <Select value={selectedVoice} onValueChange={setSelectedVoice} disabled={isPlaying || isLoading}>
        <SelectTrigger className="w-[140px] h-8 text-xs">
          <SelectValue placeholder="Select voice" />
        </SelectTrigger>
        <SelectContent>
          {AI_VOICES.map((voice) => (
            <SelectItem key={voice.id} value={voice.id} className="text-xs">
              {voice.name} ({voice.gender})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Speed:</span>
        <Slider
          value={[playbackRate]}
          onValueChange={handleRateChange}
          min={0.5}
          max={2}
          step={0.1}
          className="w-20"
        />
        <span className="text-xs text-muted-foreground w-8">{playbackRate}x</span>
      </div>
    </div>
  );
};
