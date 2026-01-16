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
import { Play, Pause, Square, Volume2, Sparkles, Loader2, Languages } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
}

const LANGUAGES: LanguageOption[] = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "es", name: "Spanish", nativeName: "Español" },
  { code: "fr", name: "French", nativeName: "Français" },
  { code: "de", name: "German", nativeName: "Deutsch" },
  { code: "pt", name: "Portuguese", nativeName: "Português" },
  { code: "zh", name: "Chinese", nativeName: "中文" },
  { code: "ja", name: "Japanese", nativeName: "日本語" },
  { code: "th", name: "Thai", nativeName: "ไทย" },
];

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
  const [selectedLanguage, setSelectedLanguage] = useState<string>("en");
  const [isTranslating, setIsTranslating] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const translatedTextRef = useRef<string>("");
  
  // Detect mobile for pause/resume workaround
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // Language code mapping for voice matching
  const langCodeMap: Record<string, string> = {
    en: 'en',
    es: 'es',
    fr: 'fr',
    de: 'de',
    pt: 'pt',
    zh: 'zh',
    ja: 'ja',
    th: 'th',
  };

  // Get voices for a specific language
  const getVoicesForLanguage = (langCode: string) => {
    return voices.filter(v => v.voice.lang.startsWith(langCode));
  };

  // Auto-select voice and reset playback when language changes
  useEffect(() => {
    // Cancel any ongoing speech when language changes
    speechSynthesis.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
    setIsPaused(false);
    
    if (!useAIVoice && voices.length > 0) {
      const targetLangCode = langCodeMap[selectedLanguage] || 'en';
      const langVoices = getVoicesForLanguage(targetLangCode);
      
      if (langVoices.length > 0) {
        // Prefer Google voices, then any available
        const googleVoice = langVoices.find(v => v.voice.name.toLowerCase().includes('google'));
        setSelectedVoice(googleVoice?.voice.name || langVoices[0].voice.name);
      } else if (selectedLanguage !== 'en') {
        // No voice for this language - warn user
        toast.warning(`No ${LANGUAGES.find(l => l.code === selectedLanguage)?.name} voice found on this device. Playback may not work correctly.`);
      }
    }
  }, [selectedLanguage, voices, useAIVoice]);

  const translateText = async (textToTranslate: string): Promise<string> => {
    if (selectedLanguage === "en") {
      return textToTranslate;
    }

    setIsTranslating(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/translate-text`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ text: textToTranslate, targetLanguage: selectedLanguage }),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Translation failed");
      }

      const data = await response.json();
      return data.translatedText;
    } catch (error) {
      console.error("Translation error:", error);
      toast.error("Translation failed. Playing in English.");
      return textToTranslate;
    } finally {
      setIsTranslating(false);
    }
  };

  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = speechSynthesis.getVoices();
      if (availableVoices.length === 0) return; // Wait for voices to load
      
      const voiceOptions: VoiceInfo[] = availableVoices.map((voice) => ({
        voice,
        label: `${voice.name} (${voice.lang})`,
      }));
      setVoices(voiceOptions);
      
      // Set default voice (prefer Google English voices, then any English)
      if (voiceOptions.length > 0 && !selectedVoice) {
        const googleEnglishVoice = voiceOptions.find(v => 
          v.voice.lang.startsWith('en') && v.voice.name.toLowerCase().includes('google')
        );
        const englishVoice = voiceOptions.find(v => v.voice.lang.startsWith('en'));
        setSelectedVoice(
          googleEnglishVoice?.voice.name || 
          englishVoice?.voice.name || 
          voiceOptions[0].voice.name
        );
      }
    };

    // Load voices immediately
    loadVoices();
    
    // Also listen for async voice loading (required for Chrome on desktop)
    speechSynthesis.onvoiceschanged = loadVoices;
    
    // Some browsers need a small delay
    const timeoutId = setTimeout(loadVoices, 100);

    return () => {
      clearTimeout(timeoutId);
      speechSynthesis.onvoiceschanged = null;
      speechSynthesis.cancel();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [selectedVoice]);

  // Helper to speak text (used for both initial play and resume on mobile)
  const speakText = (textToSpeak: string) => {
    const targetLangCode = langCodeMap[selectedLanguage] || 'en';
    
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    
    // Use the currently selected voice (already synced to language)
    const voiceToUse = voices.find(v => v.voice.name === selectedVoice)?.voice;
    
    if (voiceToUse) {
      utterance.voice = voiceToUse;
    }
    utterance.rate = rate;
    
    // Set the language on the utterance for better pronunciation
    utterance.lang = targetLangCode;

    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };

    utterance.onerror = (event) => {
      console.error("Speech synthesis error:", event);
      setIsPlaying(false);
      setIsPaused(false);
      // Only show error if it's not a cancelled speech
      if (event.error !== 'canceled' && event.error !== 'interrupted') {
        toast.error("Failed to play audio. Try a different voice or language.");
      }
    };

    utteranceRef.current = utterance;
    speechSynthesis.speak(utterance);
    setIsPlaying(true);
  };

  const handlePlayBrowser = async () => {
    // Handle resume - on mobile, restart from beginning; on desktop, use resume
    if (isPaused) {
      if (isMobile) {
        // Mobile: restart from beginning (pause/resume unreliable)
        speechSynthesis.cancel();
        if (translatedTextRef.current) {
          speakText(translatedTextRef.current);
        }
      } else {
        speechSynthesis.resume();
      }
      setIsPaused(false);
      setIsPlaying(true);
      return;
    }

    if (!text.trim()) return;

    // Always cancel any pending speech first
    speechSynthesis.cancel();

    // Check if we have a voice for the target language before translating
    const targetLangCode = langCodeMap[selectedLanguage] || 'en';
    const langVoices = getVoicesForLanguage(targetLangCode);
    
    if (selectedLanguage !== 'en' && langVoices.length === 0) {
      toast.error(`No ${LANGUAGES.find(l => l.code === selectedLanguage)?.name} voice available on this device. Please try a different language or switch to AI Voice.`);
      return;
    }

    // Translate text if needed
    const textToSpeak = await translateText(text);
    
    // Store for potential mobile resume
    translatedTextRef.current = textToSpeak;
    
    speakText(textToSpeak);
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

      // Translate text if needed
      const textToSpeak = await translateText(text);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ text: textToSpeak, voiceId: selectedAIVoice }),
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
      // On mobile, cancel instead of pause (pause is unreliable)
      if (isMobile) {
        speechSynthesis.cancel();
      } else {
        speechSynthesis.pause();
      }
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

  const isLoading = isLoadingAI || isTranslating;
  const loadingText = isTranslating ? "Translating..." : "Loading...";

  return (
    <div className={`flex flex-col gap-3 p-3 rounded-lg transition-colors ${isPlaying ? 'bg-primary/10' : 'bg-muted/50'} ${className}`}>
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
            disabled={isPlaying || isLoading}
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
              disabled={!text.trim() || isLoading}
              className="h-8"
            >
              {isLoading ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Play className="h-3 w-3 mr-1" />
              )}
              {isLoading ? loadingText : isPaused ? "Resume" : "Play"}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handlePause}
              className="h-8 bg-primary/10 border-primary/30"
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

        {/* Language selector */}
        <Select 
          value={selectedLanguage} 
          onValueChange={setSelectedLanguage}
          disabled={isPlaying || isLoading}
        >
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <Languages className="h-3 w-3 mr-1" />
            <SelectValue placeholder="Language" />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((lang) => (
              <SelectItem key={lang.code} value={lang.code} className="text-xs">
                {lang.nativeName} ({lang.name})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Voice selector - different for AI vs Browser */}
        {useAIVoice ? (
          <Select 
            value={selectedAIVoice} 
            onValueChange={setSelectedAIVoice}
            disabled={isPlaying || isLoading}
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
            <SelectTrigger className="w-[220px] h-8 text-xs">
              <SelectValue placeholder="Select voice" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {/* Show voices for current language first */}
              {getVoicesForLanguage(langCodeMap[selectedLanguage] || 'en').length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                    {LANGUAGES.find(l => l.code === selectedLanguage)?.name} Voices
                  </div>
                  {getVoicesForLanguage(langCodeMap[selectedLanguage] || 'en').map((v) => (
                    <SelectItem key={v.voice.name} value={v.voice.name} className="text-xs">
                      {v.voice.name}
                    </SelectItem>
                  ))}
                </>
              )}
              {/* Show all other voices */}
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 mt-1">
                All Voices
              </div>
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
            disabled={isLoading}
          />
          <span className="text-xs text-muted-foreground w-8">{rate}x</span>
        </div>
      </div>

      {/* Info messages */}
      {selectedLanguage !== "en" && (
        <p className="text-xs text-muted-foreground">
          <Languages className="h-3 w-3 inline mr-1" />
          Text will be translated to {LANGUAGES.find(l => l.code === selectedLanguage)?.name} before playing.
        </p>
      )}
      {useAIVoice && (
        <p className="text-xs text-muted-foreground">
          <Sparkles className="h-3 w-3 inline mr-1" />
          Premium AI voice (limited usage). Max 3000 characters.
        </p>
      )}
    </div>
  );
};
