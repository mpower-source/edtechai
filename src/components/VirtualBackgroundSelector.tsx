import { cn } from "@/lib/utils";
import { VIRTUAL_BACKGROUNDS, VirtualBackground } from "@/hooks/useVirtualBackground";
import { Check, ImageOff, Sparkles } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface VirtualBackgroundSelectorProps {
  selectedId: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
}

export function VirtualBackgroundSelector({
  selectedId,
  onSelect,
  disabled = false,
}: VirtualBackgroundSelectorProps) {
  const selectedBackground = VIRTUAL_BACKGROUNDS.find(bg => bg.id === selectedId);

  const renderPreview = (bg: VirtualBackground) => {
    if (bg.type === "none") {
      return (
        <div className="w-full h-full flex items-center justify-center bg-muted">
          <ImageOff className="h-4 w-4 text-muted-foreground" />
        </div>
      );
    }
    
    if (bg.type === "blur") {
      return (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/20 backdrop-blur">
          <div className="w-4 h-4 rounded-full bg-foreground/30 blur-sm" />
        </div>
      );
    }
    
    return (
      <div
        className="w-full h-full"
        style={{ background: bg.preview }}
      />
    );
  };

  const groupedBackgrounds = {
    basic: VIRTUAL_BACKGROUNDS.filter(bg => bg.type === "none" || bg.type === "blur"),
    gradient: VIRTUAL_BACKGROUNDS.filter(bg => bg.type === "gradient"),
    professional: VIRTUAL_BACKGROUNDS.filter(bg => bg.type === "professional"),
    nature: VIRTUAL_BACKGROUNDS.filter(bg => bg.type === "nature"),
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="gap-2"
        >
          <Sparkles className="h-4 w-4" />
          <span className="hidden sm:inline">Background</span>
          {selectedBackground && selectedBackground.type !== "none" && (
            <div
              className="w-4 h-4 rounded border border-border"
              style={{ background: selectedBackground.preview }}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Virtual Background</h4>
            <span className="text-xs text-muted-foreground">
              {selectedBackground?.name || "None"}
            </span>
          </div>
          
          <ScrollArea className="w-full">
            <div className="space-y-3">
              {/* Basic options */}
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium">Basic</p>
                <div className="flex gap-2">
                  {groupedBackgrounds.basic.map((bg) => (
                    <button
                      key={bg.id}
                      onClick={() => onSelect(bg.id)}
                      className={cn(
                        "relative w-12 h-8 rounded-md overflow-hidden border-2 transition-all hover:scale-105",
                        selectedId === bg.id
                          ? "border-primary ring-2 ring-primary/20"
                          : "border-border hover:border-primary/50"
                      )}
                      title={bg.name}
                    >
                      {renderPreview(bg)}
                      {selectedId === bg.id && (
                        <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                          <Check className="h-3 w-3 text-primary" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Gradient backgrounds */}
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium">Gradients</p>
                <div className="flex gap-2">
                  {groupedBackgrounds.gradient.map((bg) => (
                    <button
                      key={bg.id}
                      onClick={() => onSelect(bg.id)}
                      className={cn(
                        "relative w-12 h-8 rounded-md overflow-hidden border-2 transition-all hover:scale-105",
                        selectedId === bg.id
                          ? "border-primary ring-2 ring-primary/20"
                          : "border-border hover:border-primary/50"
                      )}
                      title={bg.name}
                    >
                      {renderPreview(bg)}
                      {selectedId === bg.id && (
                        <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                          <Check className="h-3 w-3 text-primary" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Professional backgrounds */}
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium">Professional</p>
                <div className="flex gap-2">
                  {groupedBackgrounds.professional.map((bg) => (
                    <button
                      key={bg.id}
                      onClick={() => onSelect(bg.id)}
                      className={cn(
                        "relative w-12 h-8 rounded-md overflow-hidden border-2 transition-all hover:scale-105",
                        selectedId === bg.id
                          ? "border-primary ring-2 ring-primary/20"
                          : "border-border hover:border-primary/50"
                      )}
                      title={bg.name}
                    >
                      {renderPreview(bg)}
                      {selectedId === bg.id && (
                        <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                          <Check className="h-3 w-3 text-primary" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nature backgrounds */}
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium">Nature</p>
                <div className="flex gap-2">
                  {groupedBackgrounds.nature.map((bg) => (
                    <button
                      key={bg.id}
                      onClick={() => onSelect(bg.id)}
                      className={cn(
                        "relative w-12 h-8 rounded-md overflow-hidden border-2 transition-all hover:scale-105",
                        selectedId === bg.id
                          ? "border-primary ring-2 ring-primary/20"
                          : "border-border hover:border-primary/50"
                      )}
                      title={bg.name}
                    >
                      {renderPreview(bg)}
                      {selectedId === bg.id && (
                        <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                          <Check className="h-3 w-3 text-primary" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
          
          <p className="text-xs text-muted-foreground">
            Virtual backgrounds use AI to replace your real background.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
