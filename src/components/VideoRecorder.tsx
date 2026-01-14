import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Video, 
  Square, 
  Circle, 
  Download, 
  Upload, 
  X,
  Camera,
  CameraOff,
  Mic,
  MicOff
} from "lucide-react";

interface VideoRecorderProps {
  script?: string;
  lessonId?: string;
  lessonTitle?: string;
  onVideoUploaded?: (videoUrl: string) => void;
  onClose?: () => void;
}

export const VideoRecorder = ({ 
  script, 
  lessonId, 
  lessonTitle,
  onVideoUploaded,
  onClose 
}: VideoRecorderProps) => {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const playbackVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  
  const [isRecording, setIsRecording] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [uploading, setUploading] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: cameraEnabled,
        audio: micEnabled,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setIsPreviewing(true);
    } catch (error) {
      toast({
        title: "Camera access denied",
        description: "Please allow camera and microphone access to record video.",
        variant: "destructive",
      });
    }
  }, [cameraEnabled, micEnabled, toast]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsPreviewing(false);
  }, [stream]);

  const startRecording = useCallback(() => {
    if (!stream) return;
    
    chunksRef.current = [];
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9',
    });
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };
    
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setRecordedBlob(blob);
      setRecordedUrl(URL.createObjectURL(blob));
    };
    
    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();
    setIsRecording(true);
    setRecordingTime(0);
    
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
  }, [stream]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      stopCamera();
    }
  }, [isRecording, stopCamera]);

  const handleDownload = useCallback(() => {
    if (!recordedBlob) return;
    
    const url = URL.createObjectURL(recordedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${lessonTitle || 'lesson'}-video.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Video downloaded",
      description: "Your recording has been saved to your device.",
    });
  }, [recordedBlob, lessonTitle, toast]);

  const handleUpload = useCallback(async () => {
    if (!recordedBlob || !lessonId) {
      toast({
        title: "Cannot upload",
        description: "No video recorded or lesson not selected.",
        variant: "destructive",
      });
      return;
    }
    
    setUploading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      
      const fileName = `${user.id}/${lessonId}/${Date.now()}.webm`;
      
      const { error: uploadError } = await supabase.storage
        .from('lesson-videos')
        .upload(fileName, recordedBlob, {
          contentType: 'video/webm',
          upsert: true,
        });
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('lesson-videos')
        .getPublicUrl(fileName);
      
      // Update the lesson with the video URL
      const { error: updateError } = await supabase
        .from('lessons')
        .update({ video_url: publicUrl })
        .eq('id', lessonId);
      
      if (updateError) throw updateError;
      
      toast({
        title: "Video uploaded",
        description: "Your recording has been attached to the lesson.",
      });
      
      onVideoUploaded?.(publicUrl);
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  }, [recordedBlob, lessonId, toast, onVideoUploaded]);

  const resetRecording = useCallback(() => {
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
    }
    setRecordedBlob(null);
    setRecordedUrl(null);
    setRecordingTime(0);
  }, [recordedUrl]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (recordedUrl) {
        URL.revokeObjectURL(recordedUrl);
      }
    };
  }, [stream, recordedUrl]);

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Video Preview/Recording */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Video Recorder
          </CardTitle>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Video Preview */}
          <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
            {recordedUrl ? (
              <video
                ref={playbackVideoRef}
                src={recordedUrl}
                controls
                autoPlay={false}
                playsInline
                className="w-full h-full object-cover"
                onLoadedData={() => {
                  // Ensure video is ready for playback
                  if (playbackVideoRef.current) {
                    playbackVideoRef.current.currentTime = 0;
                  }
                }}
              />
            ) : (
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
            )}
            
            {isRecording && (
              <div className="absolute top-4 left-4 flex items-center gap-2 bg-destructive text-destructive-foreground px-3 py-1 rounded-full text-sm font-medium animate-pulse">
                <Circle className="h-3 w-3 fill-current" />
                REC {formatTime(recordingTime)}
              </div>
            )}
            
            {!isPreviewing && !recordedUrl && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-muted-foreground">Click "Start Camera" to begin</p>
              </div>
            )}
          </div>
          
          {/* Camera/Mic Controls */}
          {!recordedUrl && (
            <div className="flex items-center justify-center gap-4">
              <Button
                variant={cameraEnabled ? "outline" : "secondary"}
                size="icon"
                onClick={() => setCameraEnabled(!cameraEnabled)}
                disabled={isPreviewing}
              >
                {cameraEnabled ? <Camera className="h-4 w-4" /> : <CameraOff className="h-4 w-4" />}
              </Button>
              <Button
                variant={micEnabled ? "outline" : "secondary"}
                size="icon"
                onClick={() => setMicEnabled(!micEnabled)}
                disabled={isPreviewing}
              >
                {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              </Button>
            </div>
          )}
          
          {/* Recording Controls */}
          <div className="flex flex-wrap gap-2 justify-center">
            {!isPreviewing && !recordedUrl && (
              <Button onClick={startCamera}>
                <Camera className="h-4 w-4 mr-2" />
                Start Camera
              </Button>
            )}
            
            {isPreviewing && !isRecording && (
              <>
                <Button onClick={startRecording} variant="destructive">
                  <Circle className="h-4 w-4 mr-2 fill-current" />
                  Start Recording
                </Button>
                <Button onClick={stopCamera} variant="outline">
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </>
            )}
            
            {isRecording && (
              <Button onClick={stopRecording} variant="destructive">
                <Square className="h-4 w-4 mr-2 fill-current" />
                Stop Recording
              </Button>
            )}
            
            {recordedUrl && (
              <>
                <Button onClick={handleDownload} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                {lessonId && (
                  <Button onClick={handleUpload} disabled={uploading}>
                    <Upload className="h-4 w-4 mr-2" />
                    {uploading ? "Uploading..." : "Upload to Lesson"}
                  </Button>
                )}
                <Button onClick={resetRecording} variant="ghost">
                  Re-record
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Script Panel */}
      <Card>
        <CardHeader>
          <CardTitle>Video Script</CardTitle>
        </CardHeader>
        <CardContent>
          {script ? (
            <ScrollArea className="h-[400px] pr-4">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                  {script}
                </pre>
              </div>
            </ScrollArea>
          ) : (
            <div className="h-[400px] flex items-center justify-center text-muted-foreground">
              <p>No script available. Generate video content for this lesson first.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
