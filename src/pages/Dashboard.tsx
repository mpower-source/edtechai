import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, BookOpen, Plus, LogOut, User, MessageSquare, Calendar, BarChart3, Target, TrendingUp, Users } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { StudentChatbot } from "@/components/StudentChatbot";

type Course = Database["public"]["Tables"]["courses"]["Row"];

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [stats, setStats] = useState({
    totalCourses: 0,
    totalStudents: 0,
    totalRevenue: 0,
  });

  useEffect(() => {
    checkUser();
    fetchCourses();
    fetchStats();
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    setUser(session.user);

    // Fetch profile
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

    setProfile(profileData);
    setLoading(false);
  };

  const fetchCourses = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data, error } = await supabase
      .from("courses")
      .select("*")
      .eq("creator_id", session.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error loading courses",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setCourses(data || []);
    }
  };

  const fetchStats = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: courses } = await supabase
      .from("courses")
      .select("price, enrolled_count")
      .eq("creator_id", session.user.id);

    const totalRevenue = courses?.reduce((sum, c) => sum + (c.price || 0) * (c.enrolled_count || 0), 0) || 0;
    const totalStudents = courses?.reduce((sum, c) => sum + (c.enrolled_count || 0), 0) || 0;

    setStats({
      totalCourses: courses?.length || 0,
      totalStudents,
      totalRevenue,
    });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
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
      {/* Navigation */}
      <nav className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold text-foreground">EdTech Platform</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>{profile?.full_name || user?.email}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Welcome back, {profile?.full_name || "Creator"}!
          </h1>
          <p className="text-muted-foreground">
            Manage your courses and create new content with AI assistance
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Courses</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCourses}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalStudents}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">฿{stats.totalRevenue.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        {/* Feature Navigation */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Button variant="outline" className="h-24 flex-col gap-2" onClick={() => navigate("/community")}>
            <MessageSquare className="h-6 w-6" />
            <span>Community</span>
          </Button>
          <Button variant="outline" className="h-24 flex-col gap-2" onClick={() => navigate("/cohorts")}>
            <Calendar className="h-6 w-6" />
            <span>Cohorts</span>
          </Button>
          <Button variant="outline" className="h-24 flex-col gap-2" onClick={() => navigate("/analytics")}>
            <BarChart3 className="h-6 w-6" />
            <span>Analytics</span>
          </Button>
          <Button variant="outline" className="h-24 flex-col gap-2" onClick={() => navigate("/competitors")}>
            <Target className="h-6 w-6" />
            <span>Competitors</span>
          </Button>
        </div>

        {/* Create Course Section */}
        <Card className="mb-8 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Create Your Next Course with AI
            </CardTitle>
            <CardDescription>
              Use AI to generate course outlines, lesson content, and quizzes in minutes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/create-course")} size="lg">
              <Plus className="mr-2 h-5 w-5" />
              Create New Course with AI
            </Button>
          </CardContent>
        </Card>

        {/* Courses List */}
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-4">Your Courses</h2>
          
          {courses.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center mb-4">
                  You haven't created any courses yet
                </p>
                <Button onClick={() => navigate("/create-course")}>
                  Create Your First Course
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map((course) => (
                <Card key={course.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg">{course.title}</CardTitle>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        course.status === "published" 
                          ? "bg-success/10 text-success" 
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {course.status}
                      </span>
                    </div>
                    <CardDescription className="line-clamp-2">
                      {course.description || "No description"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => navigate(`/course/${course.id}`)}
                      >
                        Edit
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => navigate(`/course/${course.id}/lessons`)}
                      >
                        Lessons
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <StudentChatbot />
    </div>
  );
};

export default Dashboard;
