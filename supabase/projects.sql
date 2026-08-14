-- ============================================================
-- Supabase Projects System — Database Setup
-- Run this in the Supabase SQL editor to initialise the projects table,
-- enable RLS, and wire up the auto-update trigger.
-- ============================================================

-- Ensure uuid-ossp extension is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Table: projects
-- ============================================================
CREATE TABLE IF NOT EXISTS projects (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title           text NOT NULL,
  slug            text NOT NULL UNIQUE,
  description     text,
  content_markdown text NOT NULL DEFAULT '',
  image_urls      text[] NOT NULL DEFAULT ARRAY[]::text[],
  url             text,
  repo_url        text,
  status          text,
  tags            text[],
  featured        boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Index for the public listing query
CREATE INDEX IF NOT EXISTS projects_featured_created_idx ON projects (featured DESC, created_at DESC);

-- ============================================================
-- Trigger: auto-update updated_at on row modification
-- ============================================================
-- Re-uses set_updated_at() from blogs.sql if already created, otherwise creates it.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS projects_set_updated_at ON projects;
CREATE TRIGGER projects_set_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Public read: all projects are publicly visible
DROP POLICY IF EXISTS "Public can read projects" ON projects;
CREATE POLICY "Public can read projects"
  ON projects
  FOR SELECT
  USING (true);

-- Authenticated (admin) full access
DROP POLICY IF EXISTS "Authenticated users have full access to projects" ON projects;
CREATE POLICY "Authenticated users have full access to projects"
  ON projects
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
