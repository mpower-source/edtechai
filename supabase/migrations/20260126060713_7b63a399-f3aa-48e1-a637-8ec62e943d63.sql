-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Users can upload lesson videos" ON storage.objects;

-- Create simplified INSERT policy for lesson-videos bucket
CREATE POLICY "Users can upload to their own folder"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'lesson-videos' 
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );