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
  Pause,
  RotateCcw,
  AlertTriangle,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  ChevronsUp,
  Pencil,
  Save,
  Sparkles
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface VideoRecorderProps {
  script?: string;
  lessonId?: string;
  lessonTitle?: string;
  lessonDescription?: string;
  courseContext?: string;
  existingVideoUrl?: string | null;
  onVideoUploaded?: (videoUrl: string) => void;
  onClose?: () => void;
  onSaveScript?: (script: string) => void;
}

export const VideoRecorder = ({ 
  script, 
  lessonId, 
  lessonTitle,
  lessonDescription,
  courseContext,
  existingVideoUrl,
  onVideoUploaded,
  onClose,
  onSaveScript
}: VideoRecorderProps) => {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const playbackVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingMimeTypeRef = useRef<string | null>(null);
  
  // Audio analyzer refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioAnimationRef = useRef<number | null>(null);
  
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
  
  // Audio level state
  const [audioLevel, setAudioLevel] = useState(0);
  const [peakLevel, setPeakLevel] = useState(0);
  
  // Trim state
  const [isTrimMode, setIsTrimMode] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [isTrimming, setIsTrimming] = useState(false);
  
  // Playback error state
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [isFixingPlayback, setIsFixingPlayback] = useState(false);
  
  // Teleprompter state
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(15); // pixels per second
  const [editableScript, setEditableScript] = useState(script || "");
  const [isEditingScript, setIsEditingScript] = useState(false);
  const [isRegeneratingScript, setIsRegeneratingScript] = useState(false);
  const scriptContainerRef = useRef<HTMLDivElement>(null);
  const scrollAnimationRef = useRef<number | null>(null);
  const lastScrollTimeRef = useRef<number>(0);
  // Accumulate fractional scroll for low speeds (some browsers effectively quantize scrollTop)
  const scrollPositionRef = useRef<number>(0);

  // Sync editableScript when script prop changes
  useEffect(() => {
    setEditableScript(script || "");
  }, [script]);

  // Track recording sessions and lesson "draft recording" status
  const wasRecordingRef = useRef(false);
  const previousLessonVideoUrlRef = useRef<string | null>(null);
  const markedNewRecordingRef = useRef(false);
  const hasUploadedRef = useRef(false);

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
  const startAudioAnalyzer = useCallback((mediaStream: MediaStream) => {
    try {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      
      const source = audioContext.createMediaStreamSource(mediaStream);
      source.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let peak = 0;
      
      const updateLevel = () => {
        if (!analyserRef.current) return;
        
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Calculate average level
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        const normalizedLevel = Math.min(100, (average / 128) * 100);
        
        // Track peak with decay
        if (normalizedLevel > peak) {
          peak = normalizedLevel;
        } else {
          peak = Math.max(0, peak - 0.5);
        }
        
        setAudioLevel(normalizedLevel);
        setPeakLevel(peak);
        
        audioAnimationRef.current = requestAnimationFrame(updateLevel);
      };
      
      updateLevel();
    } catch (error) {
      console.error("Audio analyzer error:", error);
    }
  }, []);

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
      
      // Start audio analyzer for level meter when camera starts
      if (micEnabled) {
        startAudioAnalyzer(mediaStream);
      }
    } catch (error) {
      toast({
        title: "Camera access denied",
        description: "Please allow camera and microphone access to record video.",
        variant: "destructive",
      });
    }
  }, [cameraEnabled, micEnabled, toast, startAudioAnalyzer]);

  const stopAudioAnalyzer = useCallback(() => {
    if (audioAnimationRef.current) {
      cancelAnimationFrame(audioAnimationRef.current);
      audioAnimationRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
    setPeakLevel(0);
  }, []);

  const stopCamera = useCallback(() => {
    stopAudioAnalyzer();
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsPreviewing(false);
  }, [stream, stopAudioAnalyzer]);

  const markLessonVideoAsPending = useCallback(async () => {
    if (!lessonId) return;
    if (markedNewRecordingRef.current) return;

    // Only mark after we successfully update the backend
    const { error } = await supabase
      .from("lessons")
      .update({ video_url: null })
      .eq("id", lessonId);

    if (error) {
      console.warn("Failed to mark lesson as new recording:", error.message);
      return;
    }

    markedNewRecordingRef.current = true;
  }, [lessonId]);

  useEffect(() => {
    previousLessonVideoUrlRef.current = existingVideoUrl ?? null;
  }, [existingVideoUrl]);

  useEffect(() => {
    // New lesson / new recorder mount should reset session flags
    markedNewRecordingRef.current = false;
    hasUploadedRef.current = false;
  }, [lessonId]);

  const startRecording = useCallback(() => {
    if (!stream) return;

    // Mark the lesson as having a "new recording" in progress until upload completes.
    void markLessonVideoAsPending();

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
          stopCamera();
          return;
        }

        setRecordedBlob(blob);
        setRecordedMimeType(finalMimeType);
        setRecordedFileExt(getExtForMimeType(finalMimeType));
        setRecordedUrl(URL.createObjectURL(blob));

        stopCamera();
      };

      mediaRecorderRef.current = mediaRecorder;
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
  }, [stream, stopCamera, toast, markLessonVideoAsPending]);

  const stopRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && isRecording) {
      try {
        mr.requestData?.();
      } catch {
        // ignore
      }
      mr.stop();
      setIsRecording(false);
      stopAudioAnalyzer();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  }, [isRecording, stopAudioAnalyzer]);

  // Teleprompter auto-scroll functions - defined before resetRecording so it can use stopAutoScroll
  const stopAutoScroll = useCallback(() => {
    if (scrollAnimationRef.current) {
      cancelAnimationFrame(scrollAnimationRef.current);
      scrollAnimationRef.current = null;
    }

    const container = scriptContainerRef.current;
    if (container) {
      scrollPositionRef.current = container.scrollTop;
    }

    setIsAutoScrolling(false);
  }, []);

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
    setPlaybackError(null);
    // Stop auto-scroll using the proper function and reset teleprompter position
    stopAutoScroll();
    // Reset scroll position after a brief delay to ensure DOM is ready
    setTimeout(() => {
      const container = scriptContainerRef.current;
      scrollPositionRef.current = 0;
      if (container) {
        container.scrollTop = 0;
      }
    }, 0);
  }, [recordedUrl, stopAutoScroll]);


  const startAutoScroll = useCallback(() => {
    const container = scriptContainerRef.current;
    if (!container) return;

    // Ensure we never run multiple RAF loops
    if (scrollAnimationRef.current) {
      cancelAnimationFrame(scrollAnimationRef.current);
      scrollAnimationRef.current = null;
    }

    const maxScrollTop = container.scrollHeight - container.clientHeight;
    if (maxScrollTop <= 0) {
      // Nothing to scroll
      setIsAutoScrolling(false);
      return;
    }

    setIsAutoScrolling(true);
    lastScrollTimeRef.current = performance.now();
    scrollPositionRef.current = container.scrollTop;

    const animate = (currentTime: number) => {
      const el = scriptContainerRef.current;
      if (!el) {
        stopAutoScroll();
        return;
      }

      const deltaTime = (currentTime - lastScrollTimeRef.current) / 1000;
      lastScrollTimeRef.current = currentTime;

      // Accumulate into our own float ref so low speeds still move smoothly
      scrollPositionRef.current += scrollSpeed * deltaTime;

      const elMaxScrollTop = el.scrollHeight - el.clientHeight;
      if (elMaxScrollTop <= 0) {
        stopAutoScroll();
        return;
      }

      if (scrollPositionRef.current >= elMaxScrollTop) {
        scrollPositionRef.current = elMaxScrollTop;
        el.scrollTop = elMaxScrollTop;
        stopAutoScroll();
        return;
      }

      el.scrollTop = scrollPositionRef.current;
      scrollAnimationRef.current = requestAnimationFrame(animate);
    };

    scrollAnimationRef.current = requestAnimationFrame(animate);
  }, [scrollSpeed, stopAutoScroll]);

  const toggleAutoScroll = useCallback(() => {
    if (isAutoScrolling) {
      stopAutoScroll();
    } else {
      startAutoScroll();
    }
  }, [isAutoScrolling, startAutoScroll, stopAutoScroll]);

  const adjustScrollSpeed = useCallback((delta: number) => {
    setScrollSpeed((prev) => Math.max(10, Math.min(100, prev + delta)));
  }, []);

  const resetScriptScroll = useCallback(() => {
    if (scriptContainerRef.current) {
      scriptContainerRef.current.scrollTop = 0;
    }
  }, []);

  const handleRegenerateScript = useCallback(async () => {
    if (!lessonId || !lessonTitle) {
      toast({
        title: "Cannot regenerate script",
        description: "Lesson information is missing",
        variant: "destructive",
      });
      return;
    }

    setIsRegeneratingScript(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        throw new Error("Please sign in to regenerate the script");
      }

      const response = await supabase.functions.invoke("generate-video-content", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: {
          lessonTitle,
          lessonDescription: lessonDescription || "",
          courseContext: courseContext || "",
        },
      });

      if (response.error) throw response.error;

      const newScript = response.data?.content || "";
      
      // Update the database
      const { error: updateError } = await supabase
        .from("lessons")
        .update({ video_content: newScript })
        .eq("id", lessonId);

      if (updateError) throw updateError;

      // Update local state
      setEditableScript(newScript);
      onSaveScript?.(newScript);

      toast({
        title: "Script regenerated",
        description: "A new voiceover script has been generated",
      });
    } catch (error: any) {
      toast({
        title: "Error regenerating script",
        description: error.message || "Failed to regenerate script",
        variant: "destructive",
      });
    } finally {
      setIsRegeneratingScript(false);
    }
  }, [lessonId, lessonTitle, lessonDescription, courseContext, toast, onSaveScript]);

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

    // Clear any previous error since we loaded successfully
    setPlaybackError(null);

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
      setPlaybackError(null);
      v.load();
    }
  }, [recordedUrl]);

  // Re-encode video to fix playback issues
  const fixPlayback = useCallback(async () => {
    if (!recordedBlob) return;
    
    setIsFixingPlayback(true);
    setPlaybackError(null);
    
    try {
      // Create a video element to decode the original
      const video = document.createElement('video');
      video.src = recordedUrl!;
      video.muted = true;
      video.playsInline = true;
      
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error("Could not decode video"));
        setTimeout(() => reject(new Error("Video decode timeout")), 10000);
      });
      
      // Set up canvas for re-encoding
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d')!;
      
      const canvasStream = canvas.captureStream(30);
      
      // Try different codecs for better compatibility
      const compatibleMimeTypes = [
        "video/webm;codecs=vp8",
        "video/webm",
      ];
      
      let selectedMimeType = "";
      for (const type of compatibleMimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          selectedMimeType = type;
          break;
        }
      }
      
      if (!selectedMimeType) {
        throw new Error("No compatible video codec available");
      }
      
      const mediaRecorder = new MediaRecorder(canvasStream, { mimeType: selectedMimeType });
      const chunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      
      const duration = video.duration;
      
      await new Promise<void>((resolve) => {
        mediaRecorder.onstop = () => resolve();
        
        video.currentTime = 0;
        
        video.onseeked = () => {
          mediaRecorder.start(100);
          video.play();
          
          const drawFrame = () => {
            if (video.ended || video.currentTime >= duration) {
              video.pause();
              mediaRecorder.stop();
              return;
            }
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            requestAnimationFrame(drawFrame);
          };
          
          drawFrame();
          
          // Fallback timeout
          setTimeout(() => {
            if (mediaRecorder.state === 'recording') {
              video.pause();
              mediaRecorder.stop();
            }
          }, (duration + 2) * 1000);
        };
      });
      
      const newBlob = new Blob(chunks, { type: selectedMimeType });
      
      if (newBlob.size === 0) {
        throw new Error("Re-encoding produced empty video");
      }
      
      // Clean up old URL
      if (recordedUrl) {
        URL.revokeObjectURL(recordedUrl);
      }
      
      const newUrl = URL.createObjectURL(newBlob);
      setRecordedBlob(newBlob);
      setRecordedMimeType(selectedMimeType);
      setRecordedFileExt("webm");
      setRecordedUrl(newUrl);
      
      toast({
        title: "Video fixed",
        description: "The recording has been re-encoded for better compatibility.",
      });
    } catch (error: any) {
      console.error("Fix playback error:", error);
      setPlaybackError(`Re-encoding failed: ${error.message}`);
      toast({
        title: "Could not fix video",
        description: error.message || "Re-encoding failed. Try downloading the original file.",
        variant: "destructive",
      });
    } finally {
      setIsFixingPlayback(false);
    }
  }, [recordedBlob, recordedUrl, toast]);

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

      // Prevent cleanup from restoring the previous URL once upload succeeded
      hasUploadedRef.current = true;
      
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

  // Stop auto-scroll only when a recording session ends (not while idle/previewing)
  useEffect(() => {
    if (wasRecordingRef.current && !isRecording) {
      stopAutoScroll();
    }
    wasRecordingRef.current = isRecording;
  }, [isRecording, stopAutoScroll]);

  useEffect(() => {
    return () => {
      stopAudioAnalyzer();
      stopAutoScroll();

      // If the user started a replacement recording but never uploaded it,
      // restore the previous lesson video URL so the lesson doesn't look "empty".
      if (lessonId && markedNewRecordingRef.current && !hasUploadedRef.current) {
        const previousUrl = previousLessonVideoUrlRef.current;
        if (previousUrl) {
          supabase.from("lessons").update({ video_url: previousUrl }).eq("id", lessonId);
        }
      }

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
  }, [stream, recordedUrl, stopAudioAnalyzer, stopAutoScroll, lessonId]);

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
              <>
                <video
                  ref={playbackVideoRef}
                  src={recordedUrl}
                  controls
                  autoPlay={false}
                  playsInline
                  preload="auto"
                  className="w-full h-full object-cover"
                  onLoadedMetadata={handleVideoLoaded}
                  onCanPlay={() => setPlaybackError(null)}
                  onError={(e) => {
                    const err = e.currentTarget.error;
                    const code = err?.code;
                    const codeNames: Record<number, string> = {
                      1: "MEDIA_ERR_ABORTED",
                      2: "MEDIA_ERR_NETWORK", 
                      3: "MEDIA_ERR_DECODE",
                      4: "MEDIA_ERR_SRC_NOT_SUPPORTED",
                    };
                    const errorName = code ? codeNames[code] || `Error ${code}` : "Unknown error";
                    setPlaybackError(`${errorName}: ${err?.message || "Cannot play this recording"}`);
                  }}
                />
                {/* Playback Error Overlay */}
                {playbackError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                    <div className="text-center p-4 max-w-sm">
                      <AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-3" />
                      <p className="font-medium text-foreground mb-1">Playback Error</p>
                      <p className="text-sm text-muted-foreground mb-4">{playbackError}</p>
                      <div className="flex gap-2 justify-center">
                        <Button 
                          size="sm" 
                          onClick={fixPlayback} 
                          disabled={isFixingPlayback}
                        >
                          {isFixingPlayback ? (
                            <>
                              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                              Fixing...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-3 w-3 mr-1" />
                              Fix Playback
                            </>
                          )}
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleDownload}>
                          <Download className="h-3 w-3 mr-1" />
                          Download Anyway
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </>
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
            
            {isTrimMode && !playbackError && (
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
          
          {/* Recording Info */}
          {recordedUrl && !playbackError && (
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>Format: {recordedMimeType}</span>
              <span>Size: {recordedBlob ? (recordedBlob.size / 1024 / 1024).toFixed(2) + " MB" : "—"}</span>
            </div>
          )}
          
          {/* Trim Controls */}
          {isTrimMode && videoDuration > 0 && !playbackError && (
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
          
          {/* Audio Level Meter - shown during recording */}
          {isRecording && micEnabled && (
            <div className="flex items-center gap-2 px-2">
              <Mic className="h-3 w-3 text-muted-foreground shrink-0" />
              <div className="flex-1 relative h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="absolute inset-y-0 left-0 transition-all duration-75 rounded-full"
                  style={{ 
                    width: `${audioLevel}%`,
                    background: audioLevel > 80 
                      ? 'hsl(var(--destructive))' 
                      : audioLevel > 50 
                        ? 'hsl(45 100% 50%)' 
                        : 'hsl(var(--primary))'
                  }}
                />
                <div 
                  className="absolute inset-y-0 w-0.5 bg-foreground/50 transition-all duration-150"
                  style={{ left: `${Math.min(peakLevel, 100)}%` }}
                />
              </div>
              <span className="text-xs font-mono text-muted-foreground w-7 text-right">
                {Math.round(audioLevel)}%
              </span>
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
                {playbackError && (
                  <Button 
                    onClick={fixPlayback} 
                    variant="default"
                    disabled={isFixingPlayback}
                  >
                    {isFixingPlayback ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Fixing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Fix Playback
                      </>
                    )}
                  </Button>
                )}
                <Button 
                  onClick={() => setIsTrimMode(!isTrimMode)} 
                  variant={isTrimMode ? "default" : "outline"}
                  disabled={isTrimming || !!playbackError}
                >
                  <Scissors className="h-4 w-4 mr-2" />
                  {isTrimMode ? "Done Trimming" : "Trim"}
                </Button>
                <Button onClick={handleDownload} variant="outline" disabled={isTrimming || uploading}>
                  <Download className="h-4 w-4 mr-2" />
                  {isTrimming ? "Processing..." : "Download"}
                </Button>
                {lessonId && (
                  <Button onClick={handleUpload} disabled={uploading || isTrimming || !!playbackError}>
                    <Upload className="h-4 w-4 mr-2" />
                    {uploading ? "Uploading..." : isTrimming ? "Processing..." : "Upload to Lesson"}
                  </Button>
                )}
                <Button onClick={resetRecording} variant="ghost" disabled={isTrimming || uploading || isFixingPlayback}>
                  Re-record
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Script Panel with Teleprompter */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle>Video Script</CardTitle>
          {editableScript && (
            <div className="flex items-center gap-1">
              {isEditingScript ? (
                <>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      onSaveScript?.(editableScript);
                      setIsEditingScript(false);
                    }}
                    title="Save script"
                  >
                    <Save className="h-4 w-4 mr-1" />
                    Save
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditableScript(script || "");
                      setIsEditingScript(false);
                    }}
                    title="Cancel editing"
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleRegenerateScript}
                    disabled={isRegeneratingScript}
                    title="Regenerate script"
                  >
                    {isRegeneratingScript ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsEditingScript(true)}
                    title="Edit script"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={resetScriptScroll}
                    title="Scroll to top"
                  >
                    <ChevronsUp className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {editableScript ? (
            <>
              {/* Teleprompter Controls - only show when not editing */}
              {!isEditingScript && (
                <div className="flex items-center justify-between gap-2 p-2 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={isAutoScrolling ? "default" : "outline"}
                      onClick={toggleAutoScroll}
                      className="gap-1"
                    >
                      {isAutoScrolling ? (
                        <>
                          <Pause className="h-3 w-3" />
                          Pause
                        </>
                      ) : (
                        <>
                          <Play className="h-3 w-3" />
                          Auto-Scroll
                        </>
                      )}
                    </Button>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => adjustScrollSpeed(-10)}
                      disabled={scrollSpeed <= 10}
                      title="Slower"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <span className="text-xs font-mono w-14 text-center text-muted-foreground">
                      {scrollSpeed} px/s
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => adjustScrollSpeed(10)}
                      disabled={scrollSpeed >= 100}
                      title="Faster"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
              
              {/* Script Content - Editable or Read-only */}
              {isEditingScript ? (
                <textarea
                  value={editableScript}
                  onChange={(e) => setEditableScript(e.target.value)}
                  className="w-full h-[350px] p-4 text-lg leading-relaxed font-sans bg-background border border-input rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Enter your video script here..."
                />
              ) : (
                <div 
                  ref={scriptContainerRef}
                  className="h-[350px] overflow-y-auto pr-4 scroll-smooth"
                  style={{ scrollBehavior: isAutoScrolling ? 'auto' : 'smooth' }}
                >
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <pre className="whitespace-pre-wrap font-sans text-lg leading-relaxed text-foreground">
                      {editableScript}
                    </pre>
                  </div>
                </div>
              )}
              
              {/* Auto-scroll indicator */}
              {isAutoScrolling && !isEditingScript && (
                <div className="flex items-center justify-center gap-2 text-xs text-primary animate-pulse">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Auto-scrolling...
                </div>
              )}
            </>
          ) : (
            <div className="h-[400px] flex items-center justify-center text-muted-foreground">
              <p>No script available. Click Record on a lesson to generate one.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};