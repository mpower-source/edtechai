import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Sparkles, BookOpen, Users, TrendingUp } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold text-foreground">EdTech Platform</span>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => navigate("/auth")}>
              Sign In
            </Button>
            <Button onClick={() => navigate("/auth?mode=signup")}>
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-3xl mx-auto space-y-6">
          <h1 className="text-5xl font-bold text-foreground leading-tight">
            Create & Sell Online Courses with{" "}
            <span className="text-primary">AI-Powered</span> Assistance
          </h1>
          <p className="text-xl text-muted-foreground">
            Build beautiful courses in minutes with AI course generation, automated content creation, 
            and powerful analytics. Start teaching today.
          </p>
          <div className="flex gap-4 justify-center pt-6">
            <Button size="lg" onClick={() => navigate("/auth?mode=signup")}>
              Start Creating For Free
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/explore")}>
              Explore Courses
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Everything You Need to Succeed
          </h2>
          <p className="text-lg text-muted-foreground">
            Powerful tools designed for creators, students, and educators
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <Card>
            <CardHeader>
              <Sparkles className="h-12 w-12 text-primary mb-4" />
              <CardTitle>AI Course Generation</CardTitle>
              <CardDescription>
                Generate complete course outlines, lesson content, and quizzes with AI assistance. 
                Save hours of planning time.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <BookOpen className="h-12 w-12 text-secondary mb-4" />
              <CardTitle>Beautiful Course Builder</CardTitle>
              <CardDescription>
                Drag-and-drop lesson creation, video hosting, interactive quizzes, 
                and automatic progress tracking.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Users className="h-12 w-12 text-accent mb-4" />
              <CardTitle>Student Engagement</CardTitle>
              <CardDescription>
                Built-in community features, discussion forums, 
                and real-time progress monitoring for your students.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <TrendingUp className="h-12 w-12 text-success mb-4" />
              <CardTitle>Analytics & Insights</CardTitle>
              <CardDescription>
                Track student progress, course performance, and revenue. 
                Get AI-powered recommendations to improve your courses.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                💳 Payment Integration
              </CardTitle>
              <CardDescription>
                Accept payments in Thai Baht with Stripe, Omise, or 2C2P. 
                Automatic invoicing and payout management.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🚀 Scale Your Business
              </CardTitle>
              <CardDescription>
                Host unlimited students, courses, and content. 
                Grow from your first student to thousands.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-muted py-20">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 max-w-4xl mx-auto text-center">
            <div>
              <div className="text-4xl font-bold text-primary mb-2">10K+</div>
              <div className="text-muted-foreground">Active Students</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-secondary mb-2">500+</div>
              <div className="text-muted-foreground">Course Creators</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-accent mb-2">2K+</div>
              <div className="text-muted-foreground">Published Courses</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-success mb-2">95%</div>
              <div className="text-muted-foreground">Satisfaction Rate</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-2xl mx-auto space-y-6">
          <h2 className="text-4xl font-bold text-foreground">
            Ready to Start Teaching?
          </h2>
          <p className="text-xl text-muted-foreground">
            Join thousands of creators building successful online course businesses
          </p>
          <Button size="lg" onClick={() => navigate("/auth?mode=signup")}>
            Create Your First Course Free
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="container mx-auto px-4 py-8 text-center text-muted-foreground">
          <p>&copy; 2025 EdTech Platform. Built with Lovable.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
