import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Sparkles, Trash2, Save, Video, ClipboardList, FileText, Pencil, Camera, User } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { VideoRecorder } from "@/components/VideoRecorder";
import { AIAvatarRecorder } from "@/components/AIAvatarRecorder";
import { TextToSpeechPlayer } from "@/components/TextToSpeechPlayer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Lesson = Database["public"]["Tables"]["lessons"]["Row"];
type LessonType = Database["public"]["Enums"]["lesson_type"];

const Lessons = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingContent, setGeneratingContent] = useState<{ type: string; lessonId: string } | null>(null);
  const [course, setCourse] = useState<any>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [editingLesson, setEditingLesson] = useState<Partial<Lesson> | null>(null);
  const [recordingLesson, setRecordingLesson] = useState<Lesson | null>(null);
  const [generatingScript, setGeneratingScript] = useState<string | null>(null);

  useEffect(() => {
    fetchCourseAndLessons();
  }, [id]);

  const fetchCourseAndLessons = async () => {
    if (!id) return;

    const { data: courseData } = await supabase
      .from("courses")
      .select("*")
      .eq("id", id)
      .single();

    setCourse(courseData);

    const { data: lessonsData } = await supabase
      .from("lessons")
      .select("*")
      .eq("course_id", id)
      .order("order_index", { ascending: true });

    setLessons(lessonsData || []);
    setLoading(false);
  };

  const handleGenerateLessons = async () => {
    if (!course) return;

    setGenerating(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        throw new Error("You must be signed in to generate lessons.");
      }

      const { data, error } = await supabase.functions.invoke("generate-lessons", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: {
          courseTitle: course.title,
          courseDescription: course.description,
          courseId: id,
        },
      });

      if (error) throw error;

      toast({
        title: "Lessons generated",
        description: "AI has generated lessons for your course",
      });

      fetchCourseAndLessons();
    } catch (error: any) {
      toast({
        title: "Error generating lessons",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveLesson = async () => {
    if (!editingLesson || !id || !editingLesson.title) return;

    if (editingLesson.id) {
      const { error } = await supabase
        .from("lessons")
        .update({
          title: editingLesson.title,
          description: editingLesson.description,
          text_content: (editingLesson as any).text_content,
          video_content: (editingLesson as any).video_content,
          quiz_content: (editingLesson as any).quiz_content,
          assignment_content: (editingLesson as any).assignment_content,
          lesson_type: editingLesson.lesson_type,
          duration_minutes: editingLesson.duration_minutes,
        })
        .eq("id", editingLesson.id);

      if (error) {
        toast({
          title: "Error updating lesson",
          description: error.message,
          variant: "destructive",
        });
        return;
      }
    } else {
      const { error } = await supabase.from("lessons").insert({
        course_id: id,
        title: editingLesson.title,
        description: editingLesson.description,
        text_content: (editingLesson as any).text_content,
        video_content: (editingLesson as any).video_content,
        quiz_content: (editingLesson as any).quiz_content,
        assignment_content: (editingLesson as any).assignment_content,
        lesson_type: editingLesson.lesson_type || "text",
        duration_minutes: editingLesson.duration_minutes || 30,
        order_index: editingLesson.order_index ?? lessons.length,
      });

      if (error) {
        toast({
          title: "Error creating lesson",
          description: error.message,
          variant: "destructive",
        });
        return;
      }
    }

    toast({
      title: "Lesson saved",
      description: "Your lesson has been saved successfully",
    });

    setEditingLesson(null);
    fetchCourseAndLessons();
  };

  const handleDeleteLesson = async (lessonId: string) => {
    const { error } = await supabase.from("lessons").delete().eq("id", lessonId);

    if (error) {
      toast({
        title: "Error deleting lesson",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Lesson deleted",
      description: "The lesson has been removed",
    });

    fetchCourseAndLessons();
  };

  const handleRecordClick = async (lesson: Lesson) => {
    // If no video script exists, generate one first
    if (!lesson.video_content) {
      setGeneratingScript(lesson.id);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;

        if (!accessToken) {
          toast({
            title: "Please sign in",
            description: "You need to be signed in to generate a script.",
            variant: "destructive",
          });
          return;
        }

        const { data, error } = await supabase.functions.invoke('generate-video-content', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          body: {
            lessonTitle: lesson.title,
            lessonDescription: lesson.description,
            courseContext: course?.title,
          },
        });

        if (error) throw error;

        // Update the lesson with the generated script
        const { error: updateError } = await supabase
          .from("lessons")
          .update({ video_content: data.content })
          .eq("id", lesson.id);

        if (updateError) throw updateError;

        // Fetch updated lesson data and open recorder
        const { data: updatedLesson } = await supabase
          .from("lessons")
          .select("*")
          .eq("id", lesson.id)
          .single();

        setRecordingLesson(updatedLesson || lesson);
        fetchCourseAndLessons();
        
        toast({
          title: "Script generated",
          description: "AI has generated a video script for your lesson",
        });
      } catch (error: any) {
        toast({
          title: "Error generating script",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setGeneratingScript(null);
      }
    } else {
      setRecordingLesson(lesson);
    }
  };

  const handleSaveScript = async (lessonId: string, script: string) => {
    const { error } = await supabase
      .from("lessons")
      .update({ video_content: script })
      .eq("id", lessonId);

    if (error) {
      toast({
        title: "Error saving script",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Script saved",
      description: "Your video script has been saved",
    });

    // Update the recording lesson state with new script
    if (recordingLesson?.id === lessonId) {
      setRecordingLesson({ ...recordingLesson, video_content: script });
    }
    fetchCourseAndLessons();
  };

  const handleGenerateContent = async (lesson: Lesson, contentType: 'text' | 'video' | 'quiz' | 'assignment') => {
    setGeneratingContent({ type: contentType, lessonId: lesson.id });
    
    const functionMap = {
      text: 'lesson-content-generator',
      video: 'generate-video-content',
      quiz: 'generate-quiz',
      assignment: 'generate-assignment'
    };

    const contentFieldMap: Record<string, string> = {
      text: 'text_content',
      video: 'video_content',
      quiz: 'quiz_content',
      assignment: 'assignment_content'
    };

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        throw new Error("You must be signed in to generate content.");
      }

      const { data, error } = await supabase.functions.invoke(functionMap[contentType], {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: contentType === 'text' 
          ? {
              lessonTitle: lesson.title,
              courseContext: course?.title,
              lessonType: "text"
            }
          : {
              lessonTitle: lesson.title,
              lessonDescription: lesson.description,
              courseContext: course?.title,
            },
      });

      if (error) throw error;

      // Update the lesson with the generated content in the appropriate column
      const { error: updateError } = await supabase
        .from("lessons")
        .update({
          [contentFieldMap[contentType]]: data.content,
        })
        .eq("id", lesson.id);

      if (updateError) throw updateError;

      toast({
        title: `${contentType.charAt(0).toUpperCase() + contentType.slice(1)} content generated`,
        description: `AI has generated ${contentType} content for "${lesson.title}"`,
      });

      fetchCourseAndLessons();
    } catch (error: any) {
      toast({
        title: `Error generating ${contentType} content`,
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGeneratingContent(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard")}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Manage Lessons: {course?.title}
          </h1>
          <p className="text-muted-foreground">
            Create and organize lessons for your course
          </p>
        </div>

        <div className="grid gap-6 mb-8">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                AI Content Generation
              </CardTitle>
              <CardDescription>
                Generate course lessons and content with AI
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handleGenerateLessons}
                  disabled={generating}
                  size="lg"
                >
                  <Sparkles className="mr-2 h-5 w-5" />
                  {generating ? "Generating..." : "Generate Lessons with AI"}
                </Button>
                <div className="text-sm text-muted-foreground flex items-center">
                  Use the buttons below on each lesson to generate videos, quizzes, or assignments
                </div>
              </div>
            </CardContent>
          </Card>

          {recordingLesson && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="h-5 w-5" />
                  Create Video: {recordingLesson.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="webcam" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="webcam" className="flex items-center gap-2">
                      <Camera className="h-4 w-4" />
                      Record Yourself
                    </TabsTrigger>
                    <TabsTrigger value="ai-avatar" className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      AI Avatar
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="webcam">
                    <VideoRecorder
                      script={recordingLesson.video_content || undefined}
                      lessonId={recordingLesson.id}
                      lessonTitle={recordingLesson.title}
                      lessonDescription={recordingLesson.description || undefined}
                      courseContext={course?.title || undefined}
                      existingVideoUrl={recordingLesson.video_url}
                      onVideoUploaded={() => {
                        setRecordingLesson(null);
                        fetchCourseAndLessons();
                      }}
                      onClose={() => setRecordingLesson(null)}
                      onSaveScript={(script) => handleSaveScript(recordingLesson.id, script)}
                    />
                  </TabsContent>
                  
                  <TabsContent value="ai-avatar">
                    <AIAvatarRecorder
                      script={recordingLesson.video_content || undefined}
                      lessonId={recordingLesson.id}
                      lessonTitle={recordingLesson.title}
                      lessonDescription={recordingLesson.description || undefined}
                      courseContext={course?.title || undefined}
                      onVideoUploaded={() => {
                        setRecordingLesson(null);
                        fetchCourseAndLessons();
                      }}
                      onClose={() => setRecordingLesson(null)}
                      onSaveScript={(script) => handleSaveScript(recordingLesson.id, script)}
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}

          {editingLesson && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {editingLesson.id ? "Edit Lesson" : "Create New Lesson"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={editingLesson.title || ""}
                    onChange={(e) =>
                      setEditingLesson({ ...editingLesson, title: e.target.value })
                    }
                    placeholder="Lesson title"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={editingLesson.description || ""}
                    onChange={(e) =>
                      setEditingLesson({
                        ...editingLesson,
                        description: e.target.value,
                      })
                    }
                    placeholder="Lesson description"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="text_content">Text Content</Label>
                  <Textarea
                    id="text_content"
                    value={(editingLesson as any).text_content || ""}
                    onChange={(e) =>
                      setEditingLesson({ ...editingLesson, text_content: e.target.value } as any)
                    }
                    placeholder="Text lesson content"
                    rows={5}
                  />
                  {(editingLesson as any).text_content && (
                    <TextToSpeechPlayer text={(editingLesson as any).text_content} />
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quiz_content">Quiz Content</Label>
                  <Textarea
                    id="quiz_content"
                    value={(editingLesson as any).quiz_content || ""}
                    onChange={(e) =>
                      setEditingLesson({ ...editingLesson, quiz_content: e.target.value } as any)
                    }
                    placeholder="Quiz content"
                    rows={5}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assignment_content">Assignment Content</Label>
                  <Textarea
                    id="assignment_content"
                    value={(editingLesson as any).assignment_content || ""}
                    onChange={(e) =>
                      setEditingLesson({ ...editingLesson, assignment_content: e.target.value } as any)
                    }
                    placeholder="Assignment content"
                    rows={5}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="video_content">Video Content/Script</Label>
                  <Textarea
                    id="video_content"
                    value={(editingLesson as any).video_content || ""}
                    onChange={(e) =>
                      setEditingLesson({ ...editingLesson, video_content: e.target.value } as any)
                    }
                    placeholder="Video script content"
                    rows={5}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="type">Type</Label>
                    <Select
                      value={editingLesson.lesson_type || "text"}
                      onValueChange={(value) =>
                        setEditingLesson({
                          ...editingLesson,
                          lesson_type: value as LessonType,
                        })
                      }
                    >
                      <SelectTrigger id="type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="video">Video</SelectItem>
                        <SelectItem value="quiz">Quiz</SelectItem>
                        <SelectItem value="assignment">Assignment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="duration">Duration (minutes)</Label>
                    <Input
                      id="duration"
                      type="number"
                      value={editingLesson.duration_minutes || ""}
                      onChange={(e) =>
                        setEditingLesson({
                          ...editingLesson,
                          duration_minutes: parseInt(e.target.value) || 0,
                        })
                      }
                      placeholder="30"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleSaveLesson}>
                    <Save className="h-4 w-4 mr-2" />
                    Save Lesson
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setEditingLesson(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Course Lessons ({lessons.length})</CardTitle>
                <Button
                  onClick={() =>
                    setEditingLesson({
                      title: "",
                      description: "",
                      content: "",
                      lesson_type: "text",
                      duration_minutes: 30,
                      order_index: lessons.length,
                    })
                  }
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Lesson
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {lessons.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No lessons yet. Generate lessons with AI or create one manually.
                </div>
              ) : (
                <div className="space-y-4">
                  {lessons.map((lesson, index) => (
                    <div
                      key={lesson.id}
                      className="relative flex flex-col p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      {/* Edit/Delete buttons - top right on mobile only */}
                      <div className="absolute top-2 right-2 flex gap-1 md:hidden">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingLesson(lesson)}
                        >
                          <Pencil className="h-4 w-4 text-blue-500" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Lesson</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{lesson.title}"? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteLesson(lesson.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>

                      {/* Desktop: Title and buttons on same row */}
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between">
                        <div className="flex-1 pr-20 md:pr-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-muted-foreground">
                              {index + 1}.
                            </span>
                            <h3 className="font-semibold text-foreground">
                              {lesson.title}
                            </h3>
                          </div>
                        </div>

                        {/* AI Generation buttons - inline on desktop */}
                        <div className="hidden md:flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleGenerateContent(lesson, 'text')}
                            disabled={generatingContent?.lessonId === lesson.id}
                          >
                            Text
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRecordClick(lesson)}
                            disabled={generatingScript === lesson.id}
                          >
                            Record
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleGenerateContent(lesson, 'quiz')}
                            disabled={generatingContent?.lessonId === lesson.id}
                          >
                            Quiz
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleGenerateContent(lesson, 'assignment')}
                            disabled={generatingContent?.lessonId === lesson.id}
                          >
                            Assignment
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleGenerateContent(lesson, 'video')}
                            disabled={generatingContent?.lessonId === lesson.id}
                          >
                            Video
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingLesson(lesson)}
                          >
                            <Pencil className="h-4 w-4 text-blue-500" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Lesson</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{lesson.title}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteLesson(lesson.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>

                      {/* Description - full width below title on both, but mobile shows before buttons */}
                      {lesson.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1 md:mt-2">
                          {lesson.description}
                        </p>
                      )}

                      {/* Mobile only: AI Generation buttons below description */}
                      <div className="flex flex-wrap gap-2 mt-2 md:hidden">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleGenerateContent(lesson, 'text')}
                          disabled={generatingContent?.lessonId === lesson.id}
                        >
                          Text
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRecordClick(lesson)}
                          disabled={generatingScript === lesson.id}
                        >
                          Record
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleGenerateContent(lesson, 'quiz')}
                          disabled={generatingContent?.lessonId === lesson.id}
                        >
                          Quiz
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleGenerateContent(lesson, 'assignment')}
                          disabled={generatingContent?.lessonId === lesson.id}
                        >
                          Assignment
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleGenerateContent(lesson, 'video')}
                          disabled={generatingContent?.lessonId === lesson.id}
                        >
                          Video
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Lessons;
