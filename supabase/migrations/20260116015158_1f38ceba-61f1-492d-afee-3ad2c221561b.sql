-- Make lesson-videos bucket private to protect paid content
UPDATE storage.buckets 
SET public = false 
WHERE id = 'lesson-videos';

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can view lesson videos" ON storage.objects;

-- Create secure policy: creators can view their videos, enrolled students or free lessons
CREATE POLICY "Enrolled students and creators can view lesson videos"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'lesson-videos' 
  AND auth.uid() IS NOT NULL
  AND (
    -- Course creators can always view their own videos
    EXISTS (
      SELECT 1 FROM public.lessons l
      JOIN public.courses c ON c.id = l.course_id
      WHERE l.video_url LIKE '%' || storage.objects.name || '%'
      AND c.creator_id = auth.uid()
    )
    OR
    -- Students can view videos from free lessons or courses they're enrolled in
    EXISTS (
      SELECT 1 FROM public.lessons l
      JOIN public.courses c ON c.id = l.course_id
      LEFT JOIN public.enrollments e ON e.course_id = c.id AND e.student_id = auth.uid()
      WHERE l.video_url LIKE '%' || storage.objects.name || '%'
      AND (l.is_free = true OR e.id IS NOT NULL)
    )
  )
);