-- Fix the INSERT policy to properly validate user ownership
DROP POLICY IF EXISTS "Users can upload lesson videos" ON storage.objects;

CREATE POLICY "Users can upload lesson videos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'lesson-videos' 
  AND auth.role() = 'authenticated'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);