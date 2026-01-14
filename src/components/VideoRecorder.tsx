import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
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
  MicOff,
  Scissors,
  Play,
  RotateCcw
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
  const recordingMimeTypeRef = useRef<string | null>(null);
  
  const [isRecording, setIsRecording] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordedMimeType, setRecordedMimeType] = useState<string>("video/webm");
  const [recordedFileExt, setRecordedFileExt] = useState<"webm" | "mp4">("webm");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [uploading, setUploading] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Trim state
  const [isTrimMode, setIsTrimMode] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [isTrimming, setIsTrimming] = useState(false);

  const getExtForMimeType = (mimeType: string): "webm" | "mp4" =>
    mimeType.includes("mp4") ? "mp4" : "webm";

  const pickRecordingMimeType = () => {
    const candidates = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
      "video/mp4",
    ];

    for (const type of candidates) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return "";
  };
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

    try {
      chunksRef.current = [];

      const mimeType = pickRecordingMimeType();
      recordingMimeTypeRef.current = mimeType || null;

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const finalMimeType =
          recordingMimeTypeRef.current || mediaRecorder.mimeType || "video/webm";

        const blob = new Blob(chunksRef.current, { type: finalMimeType });

        if (!blob.size) {
          toast({
            title: "Recording failed",
            description:
              "No video data was captured. Please try again (and ensure camera/mic permissions are granted).",
            variant: "destructive",
          });
          // Important: stop tracks AFTER MediaRecorder has finalized data
          stopCamera();
          return;
        }

        setRecordedBlob(blob);
        setRecordedMimeType(finalMimeType);
        setRecordedFileExt(getExtForMimeType(finalMimeType));
        setRecordedUrl(URL.createObjectURL(blob));

        // Important: stop tracks AFTER MediaRecorder has finalized data
        stopCamera();
      };

      mediaRecorderRef.current = mediaRecorder;
      // timeslice improves reliability of dataavailable in some browsers
      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error: any) {
      toast({
        title: "Recording not supported",
        description:
          error?.message ||
          "Your browser doesn't support recording with the current settings.",
        variant: "destructive",
      });
    }
  }, [stream, stopCamera, toast]);

  const stopRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && isRecording) {
      try {
        // Flush buffered chunks before stopping (fixes empty/unplayable blobs in some browsers)
        mr.requestData?.();
      } catch {
        // ignore
      }
      mr.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  }, [isRecording]);

  const resetRecording = useCallback(() => {
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
    }
    setRecordedBlob(null);
    setRecordedUrl(null);
    setRecordingTime(0);
    setIsTrimMode(false);
    setTrimStart(0);
    setTrimEnd(0);
    setVideoDuration(0);
  }, [recordedUrl]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimeSeconds = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
  };

  const handleVideoLoaded = useCallback(() => {
    const v = playbackVideoRef.current;
    if (!v) return;

    const duration = v.duration;
    if (isFinite(duration) && duration > 0) {
      setVideoDuration(duration);
      setTrimEnd((prev) => (prev > 0 ? prev : duration));
    }

    v.currentTime = 0;
  }, []);

  useEffect(() => {
    const v = playbackVideoRef.current;
    if (recordedUrl && v) {
      v.load();
    }
  }, [recordedUrl]);

  const previewTrimmedSection = useCallback(() => {
    if (playbackVideoRef.current) {
      playbackVideoRef.current.currentTime = trimStart;
      playbackVideoRef.current.play();
      
      const checkTime = () => {
        if (playbackVideoRef.current && playbackVideoRef.current.currentTime >= trimEnd) {
          playbackVideoRef.current.pause();
          playbackVideoRef.current.currentTime = trimStart;
        } else if (playbackVideoRef.current && !playbackVideoRef.current.paused) {
          requestAnimationFrame(checkTime);
        }
      };
      requestAnimationFrame(checkTime);
    }
  }, [trimStart, trimEnd]);

  const createTrimmedVideo = useCallback(async (): Promise<Blob | null> => {
    if (!recordedUrl || !recordedBlob) return null;

    // Trimming MP4 reliably in-browser is not supported in this simple client-side encoder.
    // Keep playback working by falling back to the original.
    if (recordedFileExt === "mp4") {
      toast({
        title: "Trimming not available",
        description: "Trimming isn't supported for MP4 recordings yet. Using the original video.",
      });
      return recordedBlob;
    }

    // If no trimming needed, return original
    if (trimStart === 0 && trimEnd === videoDuration) {
      return recordedBlob;
    }

    setIsTrimming(true);

    try {
      const video = document.createElement('video');
      video.src = recordedUrl;
      video.muted = true;

      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => resolve();
      });

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d')!;

      const canvasStream = canvas.captureStream(30);

      const trimMimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
          ? "video/webm;codecs=vp8,opus"
          : "video/webm";

      const mediaRecorder = new MediaRecorder(canvasStream, trimMimeType ? { mimeType: trimMimeType } : undefined);

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      
      const trimDuration = trimEnd - trimStart;
      
      return new Promise((resolve) => {
        mediaRecorder.onstop = () => {
          const trimmedBlob = new Blob(chunks, { type: 'video/webm' });
          resolve(trimmedBlob);
        };
        
        video.currentTime = trimStart;
        
        video.onseeked = () => {
          mediaRecorder.start();
          video.play();
          
          const drawFrame = () => {
            if (video.currentTime >= trimEnd || video.ended) {
              video.pause();
              mediaRecorder.stop();
              return;
            }
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            requestAnimationFrame(drawFrame);
          };
          
          drawFrame();
          
          setTimeout(() => {
            if (mediaRecorder.state === 'recording') {
              video.pause();
              mediaRecorder.stop();
            }
          }, (trimDuration + 1) * 1000);
        };
      });
    } catch (error) {
      console.error('Trim error:', error);
      toast({
        title: "Trim failed",
        description: "Could not trim video. Using original.",
        variant: "destructive",
      });
      return recordedBlob;
    } finally {
      setIsTrimming(false);
    }
  }, [recordedUrl, recordedBlob, trimStart, trimEnd, videoDuration, toast]);

  const handleDownload = useCallback(async () => {
    if (!recordedBlob) return;

    const blobToDownload = isTrimMode ? await createTrimmedVideo() : recordedBlob;
    if (!blobToDownload) return;

    const url = URL.createObjectURL(blobToDownload);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${lessonTitle || 'lesson'}-video.${recordedFileExt}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Video downloaded",
      description: isTrimMode
        ? "Trimmed video saved to your device."
        : "Your recording has been saved to your device.",
    });
  }, [recordedBlob, lessonTitle, toast, isTrimMode, createTrimmedVideo, recordedFileExt]);

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
      const blobToUpload = isTrimMode ? await createTrimmedVideo() : recordedBlob;
      if (!blobToUpload) throw new Error("Failed to process video");
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      
      const fileName = `${user.id}/${lessonId}/${Date.now()}.${recordedFileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('lesson-videos')
        .upload(fileName, blobToUpload, {
          contentType: blobToUpload.type || recordedMimeType,
          upsert: true,
        });
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('lesson-videos')
        .getPublicUrl(fileName);
      
      const { error: updateError } = await supabase
        .from('lessons')
        .update({ video_url: publicUrl })
        .eq('id', lessonId);
      
      if (updateError) throw updateError;
      
      toast({
        title: "Video uploaded",
        description: isTrimMode ? "Trimmed video attached to the lesson." : "Your recording has been attached to the lesson.",
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
  }, [recordedBlob, lessonId, toast, onVideoUploaded, isTrimMode, createTrimmedVideo, recordedFileExt, recordedMimeType]);

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
                preload="metadata"
                className="w-full h-full object-cover"
                onLoadedMetadata={handleVideoLoaded}
                onError={(e) => {
                  const code = e.currentTarget.error?.code;
                  toast({
                    title: "Playback failed",
                    description:
                      code === 4
                        ? "This recording format isn't supported in your browser."
                        : "Could not play this recording.",
                    variant: "destructive",
                  });
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
            
            {isTrimMode && (
              <div className="absolute top-4 left-4 flex items-center gap-2 bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-medium">
                <Scissors className="h-3 w-3" />
                Trim Mode
              </div>
            )}
            
            {!isPreviewing && !recordedUrl && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-muted-foreground">Click "Start Camera" to begin</p>
              </div>
            )}
          </div>
          
          {/* Trim Controls */}
          {isTrimMode && videoDuration > 0 && (
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Trim Video</span>
                <span className="text-muted-foreground">
                  Duration: {formatTimeSeconds(trimEnd - trimStart)}
                </span>
              </div>
              
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Start: {formatTimeSeconds(trimStart)}</span>
                  </div>
                  <Slider
                    value={[trimStart]}
                    min={0}
                    max={videoDuration}
                    step={0.1}
                    onValueChange={([value]) => {
                      setTrimStart(Math.min(value, trimEnd - 0.5));
                      if (playbackVideoRef.current) {
                        playbackVideoRef.current.currentTime = value;
                      }
                    }}
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>End: {formatTimeSeconds(trimEnd)}</span>
                  </div>
                  <Slider
                    value={[trimEnd]}
                    min={0}
                    max={videoDuration}
                    step={0.1}
                    onValueChange={([value]) => {
                      setTrimEnd(Math.max(value, trimStart + 0.5));
                      if (playbackVideoRef.current) {
                        playbackVideoRef.current.currentTime = value;
                      }
                    }}
                  />
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={previewTrimmedSection}>
                  <Play className="h-3 w-3 mr-1" />
                  Preview Selection
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => {
                    setTrimStart(0);
                    setTrimEnd(videoDuration);
                  }}
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Reset
                </Button>
              </div>
            </div>
          )}
          
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
                <Button 
                  onClick={() => setIsTrimMode(!isTrimMode)} 
                  variant={isTrimMode ? "default" : "outline"}
                  disabled={isTrimming}
                >
                  <Scissors className="h-4 w-4 mr-2" />
                  {isTrimMode ? "Done Trimming" : "Trim"}
                </Button>
                <Button onClick={handleDownload} variant="outline" disabled={isTrimming || uploading}>
                  <Download className="h-4 w-4 mr-2" />
                  {isTrimming ? "Processing..." : "Download"}
                </Button>
                {lessonId && (
                  <Button onClick={handleUpload} disabled={uploading || isTrimming}>
                    <Upload className="h-4 w-4 mr-2" />
                    {uploading ? "Uploading..." : isTrimming ? "Processing..." : "Upload to Lesson"}
                  </Button>
                )}
                <Button onClick={resetRecording} variant="ghost" disabled={isTrimming || uploading}>
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