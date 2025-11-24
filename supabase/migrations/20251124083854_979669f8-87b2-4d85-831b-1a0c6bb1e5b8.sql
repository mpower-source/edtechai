-- Add separate content columns for each lesson type
ALTER TABLE lessons 
ADD COLUMN IF NOT EXISTS text_content TEXT,
ADD COLUMN IF NOT EXISTS video_content TEXT,
ADD COLUMN IF NOT EXISTS quiz_content TEXT,
ADD COLUMN IF NOT EXISTS assignment_content TEXT;

-- Migrate existing content to text_content if lesson_type is text
UPDATE lessons 
SET text_content = content 
WHERE lesson_type = 'text' AND content IS NOT NULL AND text_content IS NULL;

-- Migrate existing content to video_content if lesson_type is video
UPDATE lessons 
SET video_content = content 
WHERE lesson_type = 'video' AND content IS NOT NULL AND video_content IS NULL;

-- Migrate existing content to quiz_content if lesson_type is quiz
UPDATE lessons 
SET quiz_content = content 
WHERE lesson_type = 'quiz' AND content IS NOT NULL AND quiz_content IS NULL;

-- Migrate existing content to assignment_content if lesson_type is assignment
UPDATE lessons 
SET assignment_content = content 
WHERE lesson_type = 'assignment' AND content IS NOT NULL AND assignment_content IS NULL;