import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Wand2, Sparkles, DollarSign, Megaphone, Lightbulb } from "lucide-react";

interface AIFeaturesProps {
  courseTitle: string;
  courseDescription?: string;
  onContentGenerated?: (content: string) => void;
}

export const AIFeatures = ({ courseTitle, courseDescription, onContentGenerated }: AIFeaturesProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const generatePricingSuggestions = async () => {
    setLoading("pricing");
    try {
      const { data, error } = await supabase.functions.invoke("pricing-suggestions", {
        body: { courseTitle, courseDescription },
      });

      if (error) throw error;

      setResult(data.suggestions);
      setDialogOpen(true);
      toast({ title: "Pricing suggestions generated!" });
    } catch (error: any) {
      toast({
        title: "Failed to generate pricing",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  const generateMarketingHeadlines = async () => {
    setLoading("marketing");
    try {
      const { data, error } = await supabase.functions.invoke("marketing-headlines", {
        body: { courseTitle, courseDescription },
      });

      if (error) throw error;

      setResult(data.headlines);
      setDialogOpen(true);
      toast({ title: "Marketing headlines generated!" });
    } catch (error: any) {
      toast({
        title: "Failed to generate headlines",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  const generateContentSuggestions = async () => {
    setLoading("content");
    try {
      const { data, error } = await supabase.functions.invoke("content-suggestions", {
        body: { courseTitle, targetAudience: "General learners" },
      });

      if (error) throw error;

      setResult(data.suggestions);
      setDialogOpen(true);
      toast({ title: "Content suggestions generated!" });
    } catch (error: any) {
      toast({
        title: "Failed to generate suggestions",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Button
          variant="outline"
          onClick={generatePricingSuggestions}
          disabled={loading !== null}
          className="h-auto flex-col gap-2 p-4"
        >
          <DollarSign className="h-5 w-5 text-primary" />
          <span className="text-sm">Pricing AI</span>
          {loading === "pricing" && <span className="text-xs">Generating...</span>}
        </Button>

        <Button
          variant="outline"
          onClick={generateMarketingHeadlines}
          disabled={loading !== null}
          className="h-auto flex-col gap-2 p-4"
        >
          <Megaphone className="h-5 w-5 text-primary" />
          <span className="text-sm">Marketing AI</span>
          {loading === "marketing" && <span className="text-xs">Generating...</span>}
        </Button>

        <Button
          variant="outline"
          onClick={generateContentSuggestions}
          disabled={loading !== null}
          className="h-auto flex-col gap-2 p-4"
        >
          <Lightbulb className="h-5 w-5 text-primary" />
          <span className="text-sm">Content Ideas</span>
          {loading === "content" && <span className="text-xs">Generating...</span>}
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>AI Generated Results</DialogTitle>
            <DialogDescription>Review and use these AI-generated suggestions</DialogDescription>
          </DialogHeader>
          <div className="whitespace-pre-wrap text-sm">{result}</div>
          <Button onClick={() => setDialogOpen(false)}>Close</Button>
        </DialogContent>
      </Dialog>
    </>
  );
};
