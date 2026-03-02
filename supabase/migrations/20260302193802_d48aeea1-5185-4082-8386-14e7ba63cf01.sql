DROP POLICY IF EXISTS "Creators can select own lesson video objects" ON storage.objects;

CREATE POLICY "Creators can select own lesson video objects"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'lesson-videos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);