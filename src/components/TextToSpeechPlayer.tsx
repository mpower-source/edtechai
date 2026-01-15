import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Play, Pause, Square, Volume2 } from "lucide-react";

interface TextToSpeechPlayerProps {
  text: string;
  className?: string;
}

interface VoiceInfo {
  voice: SpeechSynthesisVoice;
  label: string;
  isLocal: boolean;
}

export const TextToSpeechPlayer = ({ text, className = "" }: TextToSpeechPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [voices, setVoices] = useState<VoiceInfo[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [rate, setRate] = useState(1);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = speechSynthesis.getVoices();
      
      // Sort voices: local voices first, then by name
      const voiceOptions: VoiceInfo[] = availableVoices
        .map((voice) => ({
          voice,
          label: `${voice.name} (${voice.lang})${voice.localService ? '' : ' ⚡'}`,
          isLocal: voice.localService,
        }))
        .sort((a, b) => {
          // Prioritize local voices (more reliable)
          if (a.isLocal && !b.isLocal) return -1;
          if (!a.isLocal && b.isLocal) return 1;
          return a.voice.name.localeCompare(b.voice.name);
        });
      
      setVoices(voiceOptions);
      
      // Set default voice (prefer local English voice for reliability)
      if (voiceOptions.length > 0 && !selectedVoice) {
        const localEnglishVoice = voiceOptions.find(v => v.isLocal && v.voice.lang.startsWith('en'));
        const anyEnglishVoice = voiceOptions.find(v => v.voice.lang.startsWith('en'));
        setSelectedVoice(localEnglishVoice?.voice.name || anyEnglishVoice?.voice.name || voiceOptions[0].voice.name);
      }
    };

    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      speechSynthesis.cancel();
      speechSynthesis.onvoiceschanged = null;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [selectedVoice]);

  // Cancel speech when voice changes to ensure clean state
  useEffect(() => {
    speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
  }, [selectedVoice]);

  const speakText = useCallback(() => {
    if (!text.trim()) return;

    // Chrome bug workaround: cancel any pending speech first
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const voiceInfo = voices.find(v => v.voice.name === selectedVoice);
    if (voiceInfo) utterance.voice = voiceInfo.voice;
    utterance.rate = rate;

    utterance.onstart = () => {
      setIsPlaying(true);
      setIsPaused(false);
    };

    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };

    utterance.onerror = (event) => {
      console.log('Speech error:', event.error);
      setIsPlaying(false);
      setIsPaused(false);
    };

    utteranceRef.current = utterance;
    
    // Small delay to ensure Chrome processes the voice change
    retryTimeoutRef.current = setTimeout(() => {
      speechSynthesis.speak(utterance);
    }, 50);
  }, [text, voices, selectedVoice, rate]);

  const handlePlay = () => {
    if (isPaused) {
      speechSynthesis.resume();
      setIsPaused(false);
      setIsPlaying(true);
      return;
    }

    speakText();
    setIsPlaying(true);
  };

  const handlePause = () => {
    speechSynthesis.pause();
    setIsPaused(true);
    setIsPlaying(false);
  };

  const handleStop = () => {
    speechSynthesis.cancel();
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
    setIsPlaying(false);
    setIsPaused(false);
  };

  if (!('speechSynthesis' in window)) {
    return (
      <div className={`text-sm text-muted-foreground ${className}`}>
        Text-to-speech is not supported in your browser.
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-3 p-3 bg-muted/50 rounded-lg ${className}`}>
      <div className="flex items-center gap-1">
        <Volume2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Listen</span>
      </div>

      <div className="flex items-center gap-1">
        {!isPlaying ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handlePlay}
            disabled={!text.trim()}
            className="h-8"
          >
            <Play className="h-3 w-3 mr-1" />
            {isPaused ? "Resume" : "Play"}
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

      <Select value={selectedVoice} onValueChange={setSelectedVoice}>
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

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Speed:</span>
        <Slider
          value={[rate]}
          onValueChange={([value]) => setRate(value)}
          min={0.5}
          max={2}
          step={0.1}
          className="w-20"
        />
        <span className="text-xs text-muted-foreground w-8">{rate}x</span>
      </div>
    </div>
  );
};
