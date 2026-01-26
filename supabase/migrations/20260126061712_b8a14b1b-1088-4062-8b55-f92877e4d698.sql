-- Drop and recreate the INSERT policy with explicit authentication check
DROP POLICY IF EXISTS "Users can upload to their own folder" ON storage.objects;

CREATE POLICY "Authenticated users can upload to their own folder"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'lesson-videos'
    AND auth.uid() IS NOT NULL
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );