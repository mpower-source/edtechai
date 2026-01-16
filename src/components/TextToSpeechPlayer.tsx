import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Play, Pause, Square, Volume2, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface TextToSpeechPlayerProps {
  text: string;
  className?: string;
}

interface VoiceInfo {
  voice: SpeechSynthesisVoice;
  label: string;
}

interface AIVoice {
  id: string;
  name: string;
}

const AI_VOICES: AIVoice[] = [
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George (Male)" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah (Female)" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel (Male)" },
  { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda (Female)" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily (Female)" },
];

export const TextToSpeechPlayer = ({ text, className = "" }: TextToSpeechPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [voices, setVoices] = useState<VoiceInfo[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [rate, setRate] = useState(1);
  const [useAIVoice, setUseAIVoice] = useState(false);
  const [selectedAIVoice, setSelectedAIVoice] = useState<string>(AI_VOICES[0].id);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = speechSynthesis.getVoices();
      const voiceOptions: VoiceInfo[] = availableVoices.map((voice) => ({
        voice,
        label: `${voice.name} (${voice.lang})`,
      }));
      setVoices(voiceOptions);
      
      // Set default voice (prefer English)
      if (voiceOptions.length > 0 && !selectedVoice) {
        const englishVoice = voiceOptions.find(v => v.voice.lang.startsWith('en'));
        setSelectedVoice(englishVoice?.voice.name || voiceOptions[0].voice.name);
      }
    };

    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      speechSynthesis.cancel();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handlePlayBrowser = () => {
    if (isPaused) {
      speechSynthesis.resume();
      setIsPaused(false);
      setIsPlaying(true);
      return;
    }

    if (!text.trim()) return;

    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const voice = voices.find(v => v.voice.name === selectedVoice)?.voice;
    if (voice) utterance.voice = voice;
    utterance.rate = rate;

    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };

    utterance.onerror = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };

    utteranceRef.current = utterance;
    speechSynthesis.speak(utterance);
    setIsPlaying(true);
  };

  const handlePlayAI = async () => {
    if (!text.trim()) return;

    // Check text length limit
    if (text.length > 3000) {
      toast.error("Text too long for AI voice. Maximum 3000 characters. Try browser voice instead.");
      return;
    }

    setIsLoadingAI(true);

    try {
      // Get user session token for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Please sign in to use AI voice.");
        setIsLoadingAI(false);
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ text, voiceId: selectedAIVoice }),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (response.status === 429) {
          toast.error("AI voice limit reached. Switching to browser voice.");
          setUseAIVoice(false);
          setIsLoadingAI(false);
          return;
        }
        throw new Error(data.error || "Failed to generate AI voice");
      }

      const data = await response.json();
      
      // Play the audio using data URI
      const audioUrl = `data:audio/mpeg;base64,${data.audioContent}`;
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.playbackRate = rate;
      
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
    } catch (error: any) {
      console.error("AI TTS error:", error);
      toast.error(error.message || "Failed to generate AI voice");
    } finally {
      setIsLoadingAI(false);
    }
  };

  const handlePlay = () => {
    if (useAIVoice) {
      // For AI voice, resume if paused
      if (isPaused && audioRef.current) {
        audioRef.current.play();
        setIsPaused(false);
        setIsPlaying(true);
        return;
      }
      handlePlayAI();
    } else {
      handlePlayBrowser();
    }
  };

  const handlePause = () => {
    if (useAIVoice && audioRef.current) {
      audioRef.current.pause();
    } else {
      speechSynthesis.pause();
    }
    setIsPaused(true);
    setIsPlaying(false);
  };

  const handleStop = () => {
    if (useAIVoice && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    } else {
      speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setIsPaused(false);
  };

  const handleVoiceToggle = (checked: boolean) => {
    // Stop any current playback when switching
    handleStop();
    setUseAIVoice(checked);
  };

  const handleRateChange = (value: number[]) => {
    const newRate = value[0];
    setRate(newRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = newRate;
    }
  };

  if (!('speechSynthesis' in window)) {
    return (
      <div className={`text-sm text-muted-foreground ${className}`}>
        Text-to-speech is not supported in your browser.
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-3 p-3 bg-muted/50 rounded-lg ${className}`}>
      {/* Header with AI toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Listen</span>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="ai-voice" className="text-xs text-muted-foreground">
            {useAIVoice ? "AI Voice" : "Browser Voice"}
          </Label>
          <Switch
            id="ai-voice"
            checked={useAIVoice}
            onCheckedChange={handleVoiceToggle}
            disabled={isPlaying || isLoadingAI}
          />
          {useAIVoice && <Sparkles className="h-3 w-3 text-primary" />}
        </div>
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          {!isPlaying ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handlePlay}
              disabled={!text.trim() || isLoadingAI}
              className="h-8"
            >
              {isLoadingAI ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Play className="h-3 w-3 mr-1" />
              )}
              {isLoadingAI ? "Loading..." : isPaused ? "Resume" : "Play"}
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

        {/* Voice selector - different for AI vs Browser */}
        {useAIVoice ? (
          <Select 
            value={selectedAIVoice} 
            onValueChange={setSelectedAIVoice}
            disabled={isPlaying || isLoadingAI}
          >
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue placeholder="Select AI voice" />
            </SelectTrigger>
            <SelectContent>
              {AI_VOICES.map((v) => (
                <SelectItem key={v.id} value={v.id} className="text-xs">
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Select 
            value={selectedVoice} 
            onValueChange={setSelectedVoice}
            disabled={isPlaying}
          >
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <SelectValue placeholder="Select voice" />
            </SelectTrigger>
            <SelectContent>
              {voices.map((v) => (
                <SelectItem key={v.voice.name} value={v.voice.name} className="text-xs">
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Speed:</span>
          <Slider
            value={[rate]}
            onValueChange={handleRateChange}
            min={0.5}
            max={2}
            step={0.1}
            className="w-20"
            disabled={isLoadingAI}
          />
          <span className="text-xs text-muted-foreground w-8">{rate}x</span>
        </div>
      </div>

      {/* AI voice info */}
      {useAIVoice && (
        <p className="text-xs text-muted-foreground">
          <Sparkles className="h-3 w-3 inline mr-1" />
          Premium AI voice (limited usage). Max 3000 characters.
        </p>
      )}
    </div>
  );
};
