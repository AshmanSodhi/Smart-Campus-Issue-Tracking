-- Smart Campus - Supabase Database Setup
-- Run these SQL commands in Supabase SQL Editor

-- ============ CREATE ISSUES TABLE ============
CREATE TABLE issues (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  location VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Pending',
  technician VARCHAR(255) DEFAULT 'Not Assigned',
  student_email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add index for faster queries
CREATE INDEX idx_issues_student_email ON issues(student_email);
CREATE INDEX idx_issues_status ON issues(status);

-- ============ CREATE ISSUE_IMAGES TABLE ============
CREATE TABLE issue_images (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  issue_id BIGINT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add index for faster queries
CREATE INDEX idx_issue_images_issue_id ON issue_images(issue_id);

-- ============ CREATE STORAGE BUCKET ============
-- Do this via Supabase Dashboard:
-- 1. Go to Storage → Buckets
-- 2. Click "New Bucket"
-- 3. Name: issue-images
-- 4. Make it PUBLIC (toggle on)
-- 5. Click Create

-- ============ ENABLE RLS (Row Level Security) - Optional but Recommended ============
-- ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE issue_images ENABLE ROW LEVEL SECURITY;

-- Create policy for students to see only their issues
-- CREATE POLICY "Students see own issues"
-- ON issues FOR SELECT
-- USING (auth.jwt() ->> 'email' = student_email);
