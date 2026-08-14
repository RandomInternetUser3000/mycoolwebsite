-- ============================================================
-- Supabase Projects Migration
-- Run this in the Supabase SQL editor AFTER running projects.sql
-- to seed existing projects into the projects table.
--
-- content/projects.json currently has no entries (empty array).
-- Add your projects below using the template, then run this file.
-- ============================================================

-- Template — uncomment and fill in for each project:
--
-- INSERT INTO projects (title, slug, description, url, repo_url, status, tags, featured)
-- VALUES (
--   'My Project Title',
--   'my-project-title',
--   'Short description of the project.',
--   'https://example.com',               -- live URL (or NULL)
--   'https://github.com/COOLmanYT/...', -- repo URL (or NULL)
--   'Active',                            -- e.g. Active | Archived | WIP
--   ARRAY['tag1', 'tag2'],              -- tag array (or ARRAY[]::text[])
--   false                               -- true = featured on homepage
-- )
-- ON CONFLICT DO NOTHING;

-- Example — mycoolwebsite itself:
INSERT INTO projects (title, slug, description, url, repo_url, status, tags, featured)
VALUES (
  'mycoolwebsite',
  'mycoolwebsite',
  'My personal website built with plain HTML/CSS/JS, Vercel serverless functions, and Supabase.',
  'https://coolmanyt.com',
  'https://github.com/COOLmanYT/mycoolwebsite',
  'Active',
  ARRAY['website', 'open-source', 'vercel', 'supabase'],
  true
)
ON CONFLICT DO NOTHING;
