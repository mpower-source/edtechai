import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Sparkles,
  Play,
  Pause,
  Download,
  Upload,
  RefreshCw,
  User,
  Volume2,
  Square
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface AIAvatarRecorderProps {
  script?: string;
  lessonId?: string;
  lessonTitle?: string;
  onVideoUploaded?: (videoUrl: string) => void;
}

interface VoiceOption {
  id: string;
  name: string;
  description: string;
}

const VOICE_OPTIONS: VoiceOption[] = [
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", description: "British, warm & professional" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", description: "American, soft & friendly" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", description: "British, authoritative" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", description: "British, warm & youthful" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam", description: "American, articulate" },
  { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica", description: "American, expressive" },
];

export const AIAvatarRecorder = ({
  script,
  lessonId,
  lessonTitle,
  onVideoUploaded,
}: AIAvatarRecorderProps) => {
  const { toast } = useToast();
  
  const [selectedVoice, setSelectedVoice] = useState(VOICE_OPTIONS[0].id);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  
  // Avatar animation state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [mouthOpen, setMouthOpen] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
      }
    };
  }, [audioUrl]);

  // Avatar mouth animation when speaking
  useEffect(() => {
    if (isSpeaking) {
      animationIntervalRef.current = setInterval(() => {
        setMouthOpen(prev => !prev);
      }, 150);
    } else {
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
      }
      setMouthOpen(false);
    }
    return () => {
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
      }
    };
  }, [isSpeaking]);

  const generateAudio = useCallback(async () => {
    if (!script?.trim()) {
      toast({
        title: "No script available",
        description: "Please generate or write a script first.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(10);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.access_token) {
        throw new Error("Please sign in to generate audio");
      }

      setGenerationProgress(30);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-avatar-video`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
          body: JSON.stringify({
            script: script.trim(),
            voiceId: selectedVoice,
          }),
        }
      );

      setGenerationProgress(70);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to generate audio: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.audioContent) {
        throw new Error("No audio content received");
      }

      setGenerationProgress(90);

      // Convert base64 to blob using data URI approach
      const audioDataUrl = `data:audio/mpeg;base64,${data.audioContent}`;
      const audioResponse = await fetch(audioDataUrl);
      const blob = await audioResponse.blob();
      
      const url = URL.createObjectURL(blob);
      
      // Clean up previous audio
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      
      setAudioBlob(blob);
      setAudioUrl(url);
      setGenerationProgress(100);

      toast({
        title: "Audio generated!",
        description: "Your AI narration is ready. Click play to preview.",
      });
    } catch (error: any) {
      console.error("Audio generation error:", error);
      toast({
        title: "Generation failed",
        description: error.message || "Failed to generate audio",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
    }
  }, [script, selectedVoice, audioUrl, toast]);

  const togglePlayback = useCallback(() => {
    if (!audioRef.current || !audioUrl) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      setIsSpeaking(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
      setIsSpeaking(true);
    }
  }, [isPlaying, audioUrl]);

  const stopPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setIsSpeaking(false);
    setCurrentTime(0);
  }, []);

  const handleAudioEnded = useCallback(() => {
    setIsPlaying(false);
    setIsSpeaking(false);
    setCurrentTime(0);
  }, []);

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      setAudioDuration(audioRef.current.duration);
    }
  }, []);

  const downloadAudio = useCallback(() => {
    if (!audioBlob) return;
    
    const link = document.createElement("a");
    link.href = URL.createObjectURL(audioBlob);
    link.download = `${lessonTitle || "lesson"}-ai-narration.mp3`;
    link.click();
  }, [audioBlob, lessonTitle]);

  const uploadToLesson = useCallback(async () => {
    if (!audioBlob || !lessonId) {
      toast({
        title: "Cannot upload",
        description: "No audio or lesson ID available",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.user) {
        throw new Error("Please sign in to upload");
      }

      const userId = sessionData.session.user.id;
      const fileName = `${userId}/${lessonId}/ai-narration-${Date.now()}.mp3`;

      const { error: uploadError } = await supabase.storage
        .from("lesson-videos")
        .upload(fileName, audioBlob, {
          contentType: "audio/mpeg",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("lesson-videos")
        .getPublicUrl(fileName);

      // Update lesson with the audio URL (stored as video_url for now)
      const { error: updateError } = await supabase
        .from("lessons")
        .update({ video_url: urlData.publicUrl })
        .eq("id", lessonId);

      if (updateError) throw updateError;

      toast({
        title: "Audio uploaded!",
        description: "AI narration has been added to the lesson.",
      });

      onVideoUploaded?.(urlData.publicUrl);
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload audio",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  }, [audioBlob, lessonId, toast, onVideoUploaded]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const selectedVoiceData = VOICE_OPTIONS.find(v => v.id === selectedVoice);

  return (
    <div className="space-y-4">
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={audioUrl || undefined}
        onEnded={handleAudioEnded}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
      />

      {/* Avatar Display + Script Preview - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Avatar Display */}
        <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="relative aspect-video bg-gradient-to-br from-primary/20 via-background to-secondary/20 flex items-center justify-center">
            {/* Animated Avatar */}
            <div className="relative">
              {/* Avatar circle with glow effect when speaking */}
              <div 
                className={`
                  w-32 h-32 md:w-48 md:h-48 rounded-full 
                  bg-gradient-to-br from-primary to-primary/60 
                  flex items-center justify-center shadow-xl
                  transition-all duration-300
                  ${isSpeaking ? 'ring-4 ring-primary/50 ring-offset-2 ring-offset-background scale-105' : ''}
                `}
              >
                {/* Face */}
                <div className="relative w-full h-full flex items-center justify-center">
                  {/* Eyes */}
                  <div className="absolute top-[35%] left-1/2 -translate-x-1/2 flex gap-6 md:gap-10">
                    <div className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-background" />
                    <div className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-background" />
                  </div>
                  
                  {/* Mouth - animates when speaking */}
                  <div 
                    className={`
                      absolute top-[60%] left-1/2 -translate-x-1/2
                      bg-background rounded-full transition-all duration-100
                      ${mouthOpen 
                        ? 'w-6 h-4 md:w-8 md:h-6' 
                        : 'w-8 h-2 md:w-12 md:h-3'
                      }
                    `}
                  />
                </div>
              </div>

              {/* Sound waves when speaking */}
              {isSpeaking && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="absolute w-40 h-40 md:w-56 md:h-56 rounded-full border-2 border-primary/30 animate-ping" />
                  <div className="absolute w-48 h-48 md:w-64 md:h-64 rounded-full border border-primary/20 animate-pulse" />
                </div>
              )}
            </div>

            {/* Voice label */}
            <div className="absolute bottom-4 left-4 bg-background/80 backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center gap-2 text-sm">
              <Volume2 className="h-4 w-4" />
              <span className="font-medium">{selectedVoiceData?.name}</span>
            </div>

            {/* Status indicator */}
            {isGenerating && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                <div className="text-center">
                  <p className="font-medium">Generating AI Narration...</p>
                  <p className="text-sm text-muted-foreground">This may take a moment</p>
                </div>
                <div className="w-48">
                  <Progress value={generationProgress} />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

        {/* Script Preview - Same size as avatar */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="relative aspect-video bg-muted/30 flex flex-col">
              <div className="px-4 py-3 border-b bg-background/50">
                <h3 className="text-lg font-semibold">Script Preview</h3>
              </div>
              <div className="flex-1 overflow-hidden">
                {script ? (
                  <ScrollArea className="h-full p-4">
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-muted-foreground">
                      {script}
                    </pre>
                  </ScrollArea>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-muted-foreground text-center">
                      No script available. Generate one first.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5" />
            AI Voice Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Voice Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Voice</label>
            <Select value={selectedVoice} onValueChange={setSelectedVoice}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VOICE_OPTIONS.map((voice) => (
                  <SelectItem key={voice.id} value={voice.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{voice.name}</span>
                      <span className="text-xs text-muted-foreground">{voice.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Generate Button */}
          <Button
            className="w-full"
            onClick={generateAudio}
            disabled={isGenerating || !script?.trim()}
          >
            {isGenerating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate AI Narration
              </>
            )}
          </Button>

          {/* Playback Controls - show when audio is ready */}
          {audioUrl && (
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={isPlaying ? "default" : "outline"}
                  onClick={togglePlayback}
                >
                  {isPlaying ? (
                    <>
                      <Pause className="h-4 w-4 mr-1" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-1" />
                      Play
                    </>
                  )}
                </Button>
                <Button size="sm" variant="outline" onClick={stopPlayback}>
                  <Square className="h-4 w-4 mr-1" />
                  Stop
                </Button>
                <span className="text-sm text-muted-foreground ml-auto">
                  {formatTime(currentTime)} / {formatTime(audioDuration)}
                </span>
              </div>

              {/* Progress bar */}
              <Progress value={(currentTime / audioDuration) * 100 || 0} />

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadAudio}
                  className="flex-1"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                {lessonId && (
                  <Button
                    size="sm"
                    onClick={uploadToLesson}
                    disabled={isUploading}
                    className="flex-1"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {isUploading ? "Uploading..." : "Upload to Lesson"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
