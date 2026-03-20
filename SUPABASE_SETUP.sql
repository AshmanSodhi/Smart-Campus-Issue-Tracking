-- Smart Campus - Supabase Database Setup
-- Run these SQL commands in Supabase SQL Editor

-- ============ CREATE ISSUES TABLE ============
CREATE TABLE issues (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  location VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'Medium',
  status VARCHAR(50) NOT NULL DEFAULT 'Pending',
  technician VARCHAR(255) DEFAULT 'Not Assigned',
  student_email VARCHAR(255) NOT NULL,
  completion_note TEXT,
  student_feedback TEXT,
  resolved_at TIMESTAMP,
  closed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add index for faster queries
CREATE INDEX idx_issues_student_email ON issues(student_email);
CREATE INDEX idx_issues_status ON issues(status);
CREATE INDEX idx_issues_technician ON issues(technician);
CREATE INDEX idx_issues_priority ON issues(priority);

-- ============ CREATE ISSUE_IMAGES TABLE ============
CREATE TABLE issue_images (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  issue_id BIGINT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add index for faster queries
CREATE INDEX idx_issue_images_issue_id ON issue_images(issue_id);

-- ============ CREATE NOTIFICATIONS TABLE ============
CREATE TABLE notifications (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  recipient_email VARCHAR(255) NOT NULL,
  issue_id BIGINT REFERENCES issues(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_recipient_email ON notifications(recipient_email);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);

-- ============ CREATE USER_ROLES TABLE ============
CREATE TABLE user_roles (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  email VARCHAR(255) NOT NULL UNIQUE,
  role VARCHAR(30) NOT NULL CHECK (role IN ('student', 'admin', 'technician')),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_roles_email ON user_roles(email);
CREATE INDEX idx_user_roles_role ON user_roles(role);

-- ============ CREATE TECHNICIAN APPLICATIONS TABLE ============
CREATE TABLE technician_applications (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  department VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  review_note TEXT,
  reviewed_by VARCHAR(255),
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_technician_applications_email ON technician_applications(email);
CREATE INDEX idx_technician_applications_status ON technician_applications(status);

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

-- ============ OPTIONAL MIGRATION FOR EXISTING DATABASES ============
-- If your tables already exist, run these ALTERs instead of recreating tables:
-- ALTER TABLE issues ADD COLUMN IF NOT EXISTS priority VARCHAR(20) NOT NULL DEFAULT 'Medium';
-- ALTER TABLE issues ADD COLUMN IF NOT EXISTS completion_note TEXT;
-- ALTER TABLE issues ADD COLUMN IF NOT EXISTS student_feedback TEXT;
-- ALTER TABLE issues ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP;
-- ALTER TABLE issues ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP;
-- CREATE TABLE IF NOT EXISTS notifications (
--   id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
--   recipient_email VARCHAR(255) NOT NULL,
--   issue_id BIGINT REFERENCES issues(id) ON DELETE CASCADE,
--   title VARCHAR(255) NOT NULL,
--   message TEXT NOT NULL,
--   is_read BOOLEAN NOT NULL DEFAULT FALSE,
--   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );
-- CREATE TABLE IF NOT EXISTS technician_applications (
--   id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
--   full_name VARCHAR(255) NOT NULL,
--   email VARCHAR(255) NOT NULL,
--   department VARCHAR(255) NOT NULL,
--   phone VARCHAR(50) NOT NULL,
--   reason TEXT NOT NULL,
--   status VARCHAR(30) NOT NULL DEFAULT 'pending',
--   review_note TEXT,
--   reviewed_by VARCHAR(255),
--   reviewed_at TIMESTAMP,
--   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );
-- CREATE TABLE IF NOT EXISTS user_roles (
--   id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
--   email VARCHAR(255) NOT NULL UNIQUE,
--   role VARCHAR(30) NOT NULL CHECK (role IN ('student', 'admin', 'technician')),
--   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );
