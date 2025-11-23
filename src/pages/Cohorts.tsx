import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Calendar, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const Cohorts = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [cohorts, setCohorts] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    course_id: "",
    name: "",
    start_date: "",
    end_date: "",
    max_students: "",
  });

  useEffect(() => {
    fetchCohorts();
    fetchCourses();
  }, []);

  const fetchCohorts = async () => {
    const { data, error } = await supabase
      .from("cohorts")
      .select("*, courses(title)")
      .order("start_date", { ascending: true });

    if (error) {
      toast({ title: "Error loading cohorts", description: error.message, variant: "destructive" });
    } else {
      setCohorts(data || []);
    }
  };

  const fetchCourses = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("courses")
      .select("id, title")
      .eq("creator_id", userData.user?.id);

    if (!error) {
      setCourses(data || []);
    }
  };

  const createCohort = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await supabase.from("cohorts").insert({
      ...formData,
      max_students: parseInt(formData.max_students) || null,
    });

    if (error) {
      toast({ title: "Error creating cohort", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Cohort created successfully!" });
      setOpen(false);
      setFormData({ course_id: "", name: "", start_date: "", end_date: "", max_students: "" });
      fetchCohorts();
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
              <h1 className="text-3xl font-bold text-foreground">Cohorts</h1>
              <p className="text-muted-foreground">Manage scheduled course groups</p>
            </div>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Create Cohort</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Cohort</DialogTitle>
              </DialogHeader>
              <form onSubmit={createCohort} className="space-y-4">
                <div className="space-y-2">
                  <Label>Course</Label>
                  <Select value={formData.course_id} onValueChange={(value) => setFormData({ ...formData, course_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select course" />
                    </SelectTrigger>
                    <SelectContent>
                      {courses.map((course) => (
                        <SelectItem key={course.id} value={course.id}>
                          {course.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Cohort Name</Label>
                  <Input
                    placeholder="e.g., Fall 2025 Batch"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Max Students (optional)</Label>
                  <Input
                    type="number"
                    placeholder="Leave empty for unlimited"
                    value={formData.max_students}
                    onChange={(e) => setFormData({ ...formData, max_students: e.target.value })}
                  />
                </div>

                <Button type="submit" className="w-full">
                  Create Cohort
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cohorts.map((cohort) => (
            <Card key={cohort.id}>
              <CardHeader>
                <CardTitle>{cohort.name}</CardTitle>
                <CardDescription>{cohort.courses.title}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {new Date(cohort.start_date).toLocaleDateString()}
                    {cohort.end_date && ` - ${new Date(cohort.end_date).toLocaleDateString()}`}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {cohort.current_students}
                    {cohort.max_students && ` / ${cohort.max_students}`} students
                  </span>
                </div>

                <div className="pt-2">
                  {cohort.max_students && cohort.current_students >= cohort.max_students ? (
                    <span className="text-xs px-2 py-1 rounded-full bg-destructive/10 text-destructive">Full</span>
                  ) : (
                    <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">Open</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Cohorts;
