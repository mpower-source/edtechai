-- Fix lesson-videos storage RLS to support upsert and path variations
-- (handles both "{uid}/..." and "/{uid}/..." object names)

DROP POLICY IF EXISTS "Users can view their own lesson videos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own lesson videos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own lesson videos" ON storage.objects;

CREATE POLICY "Users can view their own lesson videos"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'lesson-videos'
  AND auth.uid() IS NOT NULL
  AND (public.has_role(auth.uid(), 'creator') OR public.has_role(auth.uid(), 'admin'))
  AND (
    name LIKE (auth.uid()::text || '/%')
    OR name LIKE ('/' || auth.uid()::text || '/%')
  )
);

CREATE POLICY "Authenticated users can upload to their own folder"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'lesson-videos'
  AND auth.uid() IS NOT NULL
  AND (public.has_role(auth.uid(), 'creator') OR public.has_role(auth.uid(), 'admin'))
  AND (
    name LIKE (auth.uid()::text || '/%')
    OR name LIKE ('/' || auth.uid()::text || '/%')
  )
);

CREATE POLICY "Users can update their own lesson videos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'lesson-videos'
  AND auth.uid() IS NOT NULL
  AND (public.has_role(auth.uid(), 'creator') OR public.has_role(auth.uid(), 'admin'))
  AND (
    name LIKE (auth.uid()::text || '/%')
    OR name LIKE ('/' || auth.uid()::text || '/%')
  )
)
WITH CHECK (
  bucket_id = 'lesson-videos'
  AND auth.uid() IS NOT NULL
  AND (public.has_role(auth.uid(), 'creator') OR public.has_role(auth.uid(), 'admin'))
  AND (
    name LIKE (auth.uid()::text || '/%')
    OR name LIKE ('/' || auth.uid()::text || '/%')
  )
);

CREATE POLICY "Users can delete their own lesson videos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'lesson-videos'
  AND auth.uid() IS NOT NULL
  AND (public.has_role(auth.uid(), 'creator') OR public.has_role(auth.uid(), 'admin'))
  AND (
    name LIKE (auth.uid()::text || '/%')
    OR name LIKE ('/' || auth.uid()::text || '/%')
  )
);