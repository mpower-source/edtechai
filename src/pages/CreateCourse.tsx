import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, ArrowLeft, Wand2 } from "lucide-react";

const CreateCourse = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [courseData, setCourseData] = useState({
    title: "",
    description: "",
    price: "",
  });

  const generateWithAI = async () => {
    if (!courseData.title) {
      toast({
        title: "Course title required",
        description: "Please enter a course title to generate AI suggestions",
        variant: "destructive",
      });
      return;
    }

    setAiLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("generate-course-outline", {
        body: { courseTitle: courseData.title },
      });

      if (error) throw error;

      setCourseData(prev => ({
        ...prev,
        description: data.description || prev.description,
      }));

      toast({
        title: "AI suggestions generated!",
        description: "Review and edit the generated content as needed",
      });
    } catch (error: any) {
      console.error("AI generation error:", error);
      toast({
        title: "AI generation failed",
        description: error.message || "Failed to generate course content",
        variant: "destructive",
      });
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("courses")
        .insert({
          creator_id: session.user.id,
          title: courseData.title,
          description: courseData.description,
          price: parseFloat(courseData.price) || 0,
          currency: "THB",
          status: "draft",
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Course created!",
        description: "Your course has been created successfully",
      });

      navigate(`/course/${data.id}`);
    } catch (error: any) {
      toast({
        title: "Failed to create course",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Create New Course
          </h1>
          <p className="text-muted-foreground">
            Use AI to generate course outlines and content, or create from scratch
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Course Details
            </CardTitle>
            <CardDescription>
              Fill in the basic information about your course
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Course Title *</Label>
                <div className="flex gap-2">
                  <Input
                    id="title"
                    value={courseData.title}
                    onChange={(e) => setCourseData({ ...courseData, title: e.target.value })}
                    placeholder="e.g., Introduction to Web Development"
                    required
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={generateWithAI}
                    disabled={aiLoading || !courseData.title}
                  >
                    {aiLoading ? (
                      <>Generating...</>
                    ) : (
                      <>
                        <Wand2 className="mr-2 h-4 w-4" />
                        AI Generate
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Course Description</Label>
                <Textarea
                  id="description"
                  value={courseData.description}
                  onChange={(e) => setCourseData({ ...courseData, description: e.target.value })}
                  placeholder="Describe what students will learn in this course..."
                  rows={6}
                />
                <p className="text-xs text-muted-foreground">
                  Click "AI Generate" to automatically create a description based on your title
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Price (THB)</Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={courseData.price}
                  onChange={(e) => setCourseData({ ...courseData, price: e.target.value })}
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground">
                  Leave as 0 for a free course
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="submit" disabled={loading}>
                  {loading ? "Creating..." : "Create Course"}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => navigate("/dashboard")}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="mt-6 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">💡 AI-Powered Course Creation</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              <strong>How it works:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Enter a course title</li>
              <li>Click "AI Generate" to create a description</li>
              <li>Edit and refine the AI suggestions</li>
              <li>Save your course and add lessons</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CreateCourse;
