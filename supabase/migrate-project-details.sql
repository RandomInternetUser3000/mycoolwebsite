-- Project detail pages: run this once in the Supabase SQL editor.
-- Existing projects receive a stable, unique slug based on their title and ID.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS content_markdown text NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS image_urls text[] NOT NULL DEFAULT ARRAY[]::text[];

UPDATE projects
SET slug = COALESCE(
  NULLIF(TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER(title), '[^a-z0-9]+', '-', 'g')), ''),
  'project'
) || '-' || SUBSTRING(id::text FROM 1 FOR 8)
WHERE slug IS NULL OR slug = '';

ALTER TABLE projects ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS projects_slug_unique_idx ON projects (slug);
