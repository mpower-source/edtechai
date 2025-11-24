import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Sparkles, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const Competitors = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    pricing: "",
    notes: "",
  });

  useEffect(() => {
    fetchCompetitors();
  }, []);

  const fetchCompetitors = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("competitor_entries")
      .select("*")
      .eq("creator_id", userData.user?.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error loading competitors", description: error.message, variant: "destructive" });
    } else {
      setCompetitors(data || []);
    }
  };

  const createCompetitor = async (e: React.FormEvent) => {
    e.preventDefault();

    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("competitor_entries").insert({
      ...formData,
      creator_id: userData.user?.id,
    });

    if (error) {
      toast({ title: "Error adding competitor", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Competitor added!" });
      setOpen(false);
      setFormData({ name: "", pricing: "", notes: "" });
      fetchCompetitors();
    }
  };

  const deleteCompetitor = async (id: string) => {
    const { error } = await supabase.from("competitor_entries").delete().eq("id", id);

    if (error) {
      toast({ title: "Error deleting competitor", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Competitor removed" });
      fetchCompetitors();
    }
  };

  const analyzeCompetitors = async () => {
    setAiAnalyzing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("competitor-analysis", {
        body: { competitors },
      });

      if (error) throw error;

      toast({
        title: "AI Analysis Complete",
        description: "Check the results below",
      });
      
      // Show results in a modal or update UI with analysis
      console.log("Analysis:", data.analysis);
    } catch (error: any) {
      toast({
        title: "AI Analysis Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAiAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Competitor Analysis</h1>
              <p className="text-muted-foreground">Track and analyze your competition</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={analyzeCompetitors} disabled={aiAnalyzing || competitors.length === 0}>
              <Sparkles className="h-4 w-4 mr-2" />
              {aiAnalyzing ? "Analyzing..." : "AI Analysis"}
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>Add Competitor</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Competitor</DialogTitle>
                </DialogHeader>
                <form onSubmit={createCompetitor} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      placeholder="Competitor name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Pricing</Label>
                    <Input
                      placeholder="e.g., ฿2,500/course"
                      value={formData.pricing}
                      onChange={(e) => setFormData({ ...formData, pricing: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea
                      placeholder="Key features, strengths, weaknesses..."
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={4}
                    />
                  </div>

                  <Button type="submit" className="w-full">
                    Add Competitor
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Competitor Overview</CardTitle>
            <CardDescription>Compare pricing and features</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Pricing</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {competitors.map((competitor) => (
                  <TableRow key={competitor.id}>
                    <TableCell className="font-medium">{competitor.name}</TableCell>
                    <TableCell>{competitor.pricing}</TableCell>
                    <TableCell className="max-w-md truncate">{competitor.notes}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteCompetitor(competitor.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Competitors;
