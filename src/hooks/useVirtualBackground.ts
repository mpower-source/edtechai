import { useRef, useCallback, useState, useEffect } from "react";
import { SelfieSegmentation, Results } from "@mediapipe/selfie_segmentation";

export interface VirtualBackground {
  id: string;
  name: string;
  type: "gradient" | "professional" | "nature" | "blur" | "none";
  value: string; // CSS gradient, image URL, or special value
  preview: string; // Preview thumbnail or gradient
}

export const VIRTUAL_BACKGROUNDS: VirtualBackground[] = [
  // No background (original)
  { id: "none", name: "None", type: "none", value: "none", preview: "none" },
  
  // Blur background
  { id: "blur", name: "Blur", type: "blur", value: "blur", preview: "blur" },
  
  // Gradient backgrounds (4)
  { 
    id: "gradient-blue", 
    name: "Ocean Blue", 
    type: "gradient", 
    value: "linear-gradient(135deg, #1e3a5f 0%, #2d5a87 50%, #3d7ab0 100%)",
    preview: "linear-gradient(135deg, #1e3a5f 0%, #2d5a87 50%, #3d7ab0 100%)"
  },
  { 
    id: "gradient-purple", 
    name: "Purple Haze", 
    type: "gradient", 
    value: "linear-gradient(135deg, #2d1b4e 0%, #4a2c6a 50%, #6b3d8f 100%)",
    preview: "linear-gradient(135deg, #2d1b4e 0%, #4a2c6a 50%, #6b3d8f 100%)"
  },
  { 
    id: "gradient-warm", 
    name: "Warm Sunset", 
    type: "gradient", 
    value: "linear-gradient(135deg, #4a3728 0%, #6b4c35 50%, #8c6b4f 100%)",
    preview: "linear-gradient(135deg, #4a3728 0%, #6b4c35 50%, #8c6b4f 100%)"
  },
  { 
    id: "gradient-green", 
    name: "Forest Green", 
    type: "gradient", 
    value: "linear-gradient(135deg, #1a3a2a 0%, #2d5a42 50%, #3d7a5a 100%)",
    preview: "linear-gradient(135deg, #1a3a2a 0%, #2d5a42 50%, #3d7a5a 100%)"
  },
  
  // Professional backgrounds (4)
  { 
    id: "pro-gray", 
    name: "Studio Gray", 
    type: "professional", 
    value: "linear-gradient(180deg, #3a3a3a 0%, #2a2a2a 50%, #1a1a1a 100%)",
    preview: "linear-gradient(180deg, #3a3a3a 0%, #2a2a2a 50%, #1a1a1a 100%)"
  },
  { 
    id: "pro-cream", 
    name: "Soft Cream", 
    type: "professional", 
    value: "linear-gradient(180deg, #e8e0d5 0%, #d8d0c5 50%, #c8c0b5 100%)",
    preview: "linear-gradient(180deg, #e8e0d5 0%, #d8d0c5 50%, #c8c0b5 100%)"
  },
  { 
    id: "pro-navy", 
    name: "Corporate Navy", 
    type: "professional", 
    value: "linear-gradient(180deg, #1e2d4a 0%, #152238 50%, #0d1726 100%)",
    preview: "linear-gradient(180deg, #1e2d4a 0%, #152238 50%, #0d1726 100%)"
  },
  { 
    id: "pro-white", 
    name: "Clean White", 
    type: "professional", 
    value: "linear-gradient(180deg, #ffffff 0%, #f5f5f5 50%, #ebebeb 100%)",
    preview: "linear-gradient(180deg, #ffffff 0%, #f5f5f5 50%, #ebebeb 100%)"
  },
  
  // Nature-inspired solid gradients (4)
  { 
    id: "nature-sky", 
    name: "Clear Sky", 
    type: "nature", 
    value: "linear-gradient(180deg, #87ceeb 0%, #6bb3d9 50%, #4f98c6 100%)",
    preview: "linear-gradient(180deg, #87ceeb 0%, #6bb3d9 50%, #4f98c6 100%)"
  },
  { 
    id: "nature-sunset", 
    name: "Golden Hour", 
    type: "nature", 
    value: "linear-gradient(180deg, #ff9966 0%, #ff7744 50%, #ff5522 100%)",
    preview: "linear-gradient(180deg, #ff9966 0%, #ff7744 50%, #ff5522 100%)"
  },
  { 
    id: "nature-forest", 
    name: "Deep Forest", 
    type: "nature", 
    value: "linear-gradient(180deg, #228b22 0%, #1a6b1a 50%, #124b12 100%)",
    preview: "linear-gradient(180deg, #228b22 0%, #1a6b1a 50%, #124b12 100%)"
  },
  { 
    id: "nature-ocean", 
    name: "Deep Ocean", 
    type: "nature", 
    value: "linear-gradient(180deg, #006994 0%, #004d6e 50%, #003148 100%)",
    preview: "linear-gradient(180deg, #006994 0%, #004d6e 50%, #003148 100%)"
  },
];

interface UseVirtualBackgroundOptions {
  enabled: boolean;
  backgroundId: string;
}

export function useVirtualBackground(options: UseVirtualBackgroundOptions) {
  const { enabled, backgroundId } = options;
  
  const segmentationRef = useRef<SelfieSegmentation | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isProcessingRef = useRef(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const background = VIRTUAL_BACKGROUNDS.find(bg => bg.id === backgroundId) || VIRTUAL_BACKGROUNDS[0];

  // Draw gradient background
  const drawGradientBackground = useCallback((
    ctx: CanvasRenderingContext2D, 
    width: number, 
    height: number, 
    gradientValue: string
  ) => {
    // Parse the gradient string and create a canvas gradient
    // For simplicity, we'll handle linear-gradient patterns
    const gradientMatch = gradientValue.match(/linear-gradient\(([\d]+)deg,\s*(.+)\)/);
    if (!gradientMatch) {
      ctx.fillStyle = "#333";
      ctx.fillRect(0, 0, width, height);
      return;
    }

    const angle = parseInt(gradientMatch[1]) * (Math.PI / 180);
    const colorStops = gradientMatch[2].split(/,\s*(?=#|rgb)/).map(stop => {
      const match = stop.trim().match(/(#[a-fA-F0-9]+|rgb[a]?\([^)]+\))\s*(\d+)?%?/);
      if (match) {
        return { color: match[1], position: parseInt(match[2] || "0") / 100 };
      }
      return { color: "#333", position: 0 };
    });

    // Calculate gradient coordinates based on angle
    const x1 = width / 2 - Math.cos(angle) * width / 2;
    const y1 = height / 2 - Math.sin(angle) * height / 2;
    const x2 = width / 2 + Math.cos(angle) * width / 2;
    const y2 = height / 2 + Math.sin(angle) * height / 2;

    const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
    colorStops.forEach(stop => {
      gradient.addColorStop(stop.position, stop.color);
    });

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }, []);

  // Process segmentation results
  const onResults = useCallback((results: Results) => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    const offscreenCanvas = offscreenCanvasRef.current;
    const offscreenCtx = offscreenCtxRef.current;
    
    if (!canvas || !ctx || !offscreenCanvas || !offscreenCtx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.save();
    ctx.clearRect(0, 0, width, height);

    if (background.type === "none") {
      // No virtual background, just draw the original
      ctx.drawImage(results.image, 0, 0, width, height);
    } else if (background.type === "blur") {
      // Draw blurred background
      offscreenCtx.filter = "blur(15px)";
      offscreenCtx.drawImage(results.image, 0, 0, width, height);
      offscreenCtx.filter = "none";
      ctx.drawImage(offscreenCanvas, 0, 0, width, height);

      // Draw the mask
      ctx.globalCompositeOperation = "destination-in";
      ctx.drawImage(results.segmentationMask, 0, 0, width, height);
      ctx.globalCompositeOperation = "source-over";

      // Draw blurred background behind
      offscreenCtx.filter = "blur(15px)";
      offscreenCtx.drawImage(results.image, 0, 0, width, height);
      offscreenCtx.filter = "none";
      
      ctx.globalCompositeOperation = "destination-over";
      ctx.drawImage(offscreenCanvas, 0, 0, width, height);
    } else {
      // Draw the person first
      ctx.drawImage(results.image, 0, 0, width, height);
      
      // Apply mask to keep only the person
      ctx.globalCompositeOperation = "destination-in";
      ctx.drawImage(results.segmentationMask, 0, 0, width, height);
      
      // Draw background behind the person
      ctx.globalCompositeOperation = "destination-over";
      drawGradientBackground(ctx, width, height, background.value);
    }

    ctx.restore();
    isProcessingRef.current = false;
  }, [background, drawGradientBackground]);

  // Initialize segmentation
  const initialize = useCallback(async (
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement
  ) => {
    if (segmentationRef.current) return;
    
    setIsLoading(true);
    setError(null);

    try {
      videoRef.current = video;
      canvasRef.current = canvas;
      ctxRef.current = canvas.getContext("2d", { willReadFrequently: true });

      // Create offscreen canvas for effects
      offscreenCanvasRef.current = document.createElement("canvas");
      offscreenCanvasRef.current.width = canvas.width;
      offscreenCanvasRef.current.height = canvas.height;
      offscreenCtxRef.current = offscreenCanvasRef.current.getContext("2d", { willReadFrequently: true });

      const selfieSegmentation = new SelfieSegmentation({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
      });

      selfieSegmentation.setOptions({
        modelSelection: 1, // 0 = general, 1 = landscape (better for backgrounds)
        selfieMode: true,
      });

      selfieSegmentation.onResults(onResults);

      segmentationRef.current = selfieSegmentation;
      setIsReady(true);
    } catch (err: any) {
      console.error("Failed to initialize segmentation:", err);
      setError(err.message || "Failed to load background removal");
    } finally {
      setIsLoading(false);
    }
  }, [onResults]);

  // Process video frame
  const processFrame = useCallback(async () => {
    const video = videoRef.current;
    const segmentation = segmentationRef.current;
    
    if (!video || !segmentation || !enabled || isProcessingRef.current) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    if (video.readyState >= 2 && video.videoWidth > 0) {
      isProcessingRef.current = true;
      try {
        await segmentation.send({ image: video });
      } catch (err) {
        isProcessingRef.current = false;
      }
    }

    animationFrameRef.current = requestAnimationFrame(processFrame);
  }, [enabled]);

  // Start processing loop
  const startProcessing = useCallback(() => {
    if (animationFrameRef.current) return;
    animationFrameRef.current = requestAnimationFrame(processFrame);
  }, [processFrame]);

  // Stop processing
  const stopProcessing = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopProcessing();
      if (segmentationRef.current) {
        segmentationRef.current.close();
        segmentationRef.current = null;
      }
    };
  }, [stopProcessing]);

  // Get output stream from canvas
  const getOutputStream = useCallback((fps: number = 30): MediaStream | null => {
    if (!canvasRef.current) return null;
    return canvasRef.current.captureStream(fps);
  }, []);

  return {
    initialize,
    startProcessing,
    stopProcessing,
    getOutputStream,
    isLoading,
    isReady,
    error,
    canvasRef,
  };
}
