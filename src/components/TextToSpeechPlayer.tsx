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
import { Play, Pause, Square, Volume2 } from "lucide-react";

interface TextToSpeechPlayerProps {
  text: string;
  className?: string;
}

interface VoiceInfo {
  voice: SpeechSynthesisVoice;
  label: string;
}

export const TextToSpeechPlayer = ({ text, className = "" }: TextToSpeechPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [voices, setVoices] = useState<VoiceInfo[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [rate, setRate] = useState(1);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

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
      speechSynthesis.onvoiceschanged = null;
    };
  }, [selectedVoice]);

  // Cancel speech when voice changes to ensure clean state
  useEffect(() => {
    speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
  }, [selectedVoice]);

  const handlePlay = () => {
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

  const handlePause = () => {
    speechSynthesis.pause();
    setIsPaused(true);
    setIsPlaying(false);
  };

  const handleStop = () => {
    speechSynthesis.cancel();
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
