-- Create storage bucket for lesson videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('lesson-videos', 'lesson-videos', true);

-- Allow authenticated users to upload their own videos
CREATE POLICY "Users can upload lesson videos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'lesson-videos' 
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to view all videos (for course content)
CREATE POLICY "Anyone can view lesson videos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'lesson-videos');

-- Allow authenticated users to delete their own videos
CREATE POLICY "Users can delete their own lesson videos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'lesson-videos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to update their own videos
CREATE POLICY "Users can update their own lesson videos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'lesson-videos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);