import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Heart, Flame, ThumbsUp, ArrowLeft } from "lucide-react";

interface Post {
  id: string;
  content: string;
  reactions: any;
  created_at: string;
  user_id: string;
  profiles: { full_name: string };
  comments: Comment[];
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  profiles: { full_name: string };
}

const Community = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [spaces, setSpaces] = useState<any[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState("");
  const [newComment, setNewComment] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSpaces();
  }, []);

  useEffect(() => {
    if (selectedSpace) {
      fetchPosts();
      subscribeToRealtime();
    }
  }, [selectedSpace]);

  const fetchSpaces = async () => {
    const { data, error } = await supabase
      .from("community_spaces")
      .select("*, courses(title)")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error loading spaces", description: error.message, variant: "destructive" });
    } else {
      setSpaces(data || []);
    }
  };

  const fetchPosts = async () => {
    if (!selectedSpace) return;

    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .eq("space_id", selectedSpace)
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error loading posts", description: error.message, variant: "destructive" });
      return;
    }

    // Fetch profiles and comments separately due to relation constraints
    const postsWithData = await Promise.all(
      (data || []).map(async (post) => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", post.user_id)
          .single();

        const { data: comments } = await supabase
          .from("comments")
          .select("*")
          .eq("post_id", post.id)
          .order("created_at");

        const commentsWithProfiles = await Promise.all(
          (comments || []).map(async (comment) => {
            const { data: commentProfile } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", comment.user_id)
              .single();
            return { ...comment, profiles: commentProfile || { full_name: "Unknown" } };
          })
        );

        return {
          ...post,
          profiles: profile || { full_name: "Unknown" },
          comments: commentsWithProfiles,
        };
      })
    );

    setPosts(postsWithData as any);
  };

  const subscribeToRealtime = () => {
    const channel = supabase
      .channel("community-changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, () => fetchPosts())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "comments" }, () => fetchPosts())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const createPost = async () => {
    if (!newPost.trim() || !selectedSpace) return;
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("posts").insert({
      space_id: selectedSpace,
      user_id: userData.user?.id,
      content: newPost,
    });

    if (error) {
      toast({ title: "Error creating post", description: error.message, variant: "destructive" });
    } else {
      setNewPost("");
      toast({ title: "Post created!" });
    }
    setLoading(false);
  };

  const createComment = async (postId: string) => {
    const content = newComment[postId];
    if (!content?.trim()) return;

    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("comments").insert({
      post_id: postId,
      user_id: userData.user?.id,
      content,
    });

    if (error) {
      toast({ title: "Error adding comment", description: error.message, variant: "destructive" });
    } else {
      setNewComment({ ...newComment, [postId]: "" });
    }
  };

  const addReaction = async (postId: string, type: "like" | "thanks" | "fire") => {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    const newReactions = { ...post.reactions, [type]: post.reactions[type] + 1 };
    const { error } = await supabase.from("posts").update({ reactions: newReactions }).eq("id", postId);

    if (!error) {
      setPosts(posts.map((p) => (p.id === postId ? { ...p, reactions: newReactions } : p)));
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Community</h1>
            <p className="text-muted-foreground">Connect with fellow learners</p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle>Spaces</CardTitle>
              <CardDescription>Join course discussions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {spaces.map((space) => (
                <Button
                  key={space.id}
                  variant={selectedSpace === space.id ? "default" : "outline"}
                  className="w-full justify-start"
                  onClick={() => setSelectedSpace(space.id)}
                >
                  {space.title}
                </Button>
              ))}
            </CardContent>
          </Card>

          <div className="md:col-span-2 space-y-4">
            {selectedSpace && (
              <Card>
                <CardHeader>
                  <CardTitle>New Post</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="Share your thoughts..."
                    value={newPost}
                    onChange={(e) => setNewPost(e.target.value)}
                    rows={3}
                  />
                  <Button onClick={createPost} disabled={loading || !newPost.trim()}>
                    Post
                  </Button>
                </CardContent>
              </Card>
            )}

            {posts.map((post) => (
              <Card key={post.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-base">{post.profiles.full_name}</CardTitle>
                      <CardDescription>{new Date(post.created_at).toLocaleDateString()}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-foreground">{post.content}</p>

                  <div className="flex gap-4">
                    <Button variant="ghost" size="sm" onClick={() => addReaction(post.id, "like")}>
                      <ThumbsUp className="h-4 w-4 mr-1" />
                      {post.reactions.like}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => addReaction(post.id, "thanks")}>
                      <Heart className="h-4 w-4 mr-1" />
                      {post.reactions.thanks}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => addReaction(post.id, "fire")}>
                      <Flame className="h-4 w-4 mr-1" />
                      {post.reactions.fire}
                    </Button>
                  </div>

                  {post.comments && post.comments.length > 0 && (
                    <div className="border-t pt-4 space-y-3">
                      {post.comments.map((comment) => (
                        <div key={comment.id} className="bg-muted/50 rounded-lg p-3">
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-medium text-sm">{comment.profiles.full_name}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(comment.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm">{comment.content}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Add a comment..."
                      value={newComment[post.id] || ""}
                      onChange={(e) => setNewComment({ ...newComment, [post.id]: e.target.value })}
                      rows={2}
                      className="flex-1"
                    />
                    <Button size="sm" onClick={() => createComment(post.id)}>
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Community;
