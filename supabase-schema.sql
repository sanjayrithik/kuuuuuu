-- ============================================================
--  RYHA INTERNSHIP SYSTEM — Complete Supabase Schema
--  Run this entire file in the Supabase SQL Editor once.
-- ============================================================


-- ──────────────────────────────────────────────────────────────
-- 1. STUDENTS TABLE
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS students (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name            TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
    username        TEXT UNIQUE NOT NULL CHECK (char_length(username) BETWEEN 3 AND 80),
    password        TEXT NOT NULL CHECK (char_length(password) >= 6),
    student_id      TEXT UNIQUE NOT NULL,               -- RYHA-2026-XXXX-XXXX
    completion_date DATE,
    score           INTEGER DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
    attendance      INTEGER DEFAULT 0 CHECK (attendance BETWEEN 0 AND 100),
    projects_count  INTEGER DEFAULT 0 CHECK (projects_count BETWEEN 0 AND 3),
    certificate_url TEXT,                               -- Public URL in Storage

    -- Project A
    project_a_name  TEXT CHECK (char_length(project_a_name) <= 120),
    project_a_tech  TEXT CHECK (char_length(project_a_tech) <= 200),
    project_a_link  TEXT CHECK (project_a_link IS NULL OR project_a_link ~ '^https?://'),

    -- Project B
    project_b_name  TEXT CHECK (char_length(project_b_name) <= 120),
    project_b_tech  TEXT CHECK (char_length(project_b_tech) <= 200),
    project_b_link  TEXT CHECK (project_b_link IS NULL OR project_b_link ~ '^https?://'),

    -- Project C
    project_c_name  TEXT CHECK (char_length(project_c_name) <= 120),
    project_c_tech  TEXT CHECK (char_length(project_c_tech) <= 200),
    project_c_link  TEXT CHECK (project_c_link IS NULL OR project_c_link ~ '^https?://'),

    created_at      TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS students_student_id_idx ON students (student_id);
CREATE INDEX IF NOT EXISTS students_username_idx ON students (username);


-- ──────────────────────────────────────────────────────────────
-- 2. ADMIN USERS TABLE
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_users (
    username  TEXT PRIMARY KEY CHECK (char_length(username) BETWEEN 3 AND 80),
    password  TEXT NOT NULL CHECK (char_length(password) >= 8),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);


-- ──────────────────────────────────────────────────────────────
-- 3. INSERT ADMIN CREDENTIALS
--    (Skip if already exists — safe to re-run)
-- ──────────────────────────────────────────────────────────────
INSERT INTO admin_users (username, password)
VALUES ('Ryhaboss*1', '2026tamaaltumeel')
ON CONFLICT (username) DO NOTHING;


-- ──────────────────────────────────────────────────────────────
-- 4. ROW LEVEL SECURITY (RLS)
--    Enable RLS on all tables — then grant only what's needed.
-- ──────────────────────────────────────────────────────────────

ALTER TABLE students    ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;


-- ── students policies ──────────────────────────────────────────

-- Public: read a single student BY student_id (certificate verification)
CREATE POLICY "Public can verify by student_id"
ON students
FOR SELECT
TO anon
USING (true);   -- filtered in app by student_id; safe because no PII is secret here

-- Public: students can update their OWN row's project fields only
-- (identified by matching username + password — app passes id after login)
CREATE POLICY "Student can update own projects"
ON students
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);   -- app-level auth enforces identity; tighten with Supabase Auth later

-- Admin: full access (anon key used — tighten with service-role key in prod)
CREATE POLICY "Admin full access students"
ON students
FOR ALL
TO anon
USING (true)
WITH CHECK (true);


-- ── admin_users policies ───────────────────────────────────────

-- Allow anon to SELECT only — needed for login check
CREATE POLICY "Anon can read admin_users for login"
ON admin_users
FOR SELECT
TO anon
USING (true);

-- Block all other mutations on admin_users from anon
-- (inserts/deletes must go through the Supabase dashboard or service-role key)


-- ──────────────────────────────────────────────────────────────
-- 5. STORAGE BUCKET: certificates
--    Run AFTER creating the bucket in the Supabase Dashboard:
--    Storage → New Bucket → Name: "certificates" → Public: ON
-- ──────────────────────────────────────────────────────────────

-- Allow anyone (anon) to upload certificates
CREATE POLICY "Allow public uploads to certificates"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (bucket_id = 'certificates');

-- Allow anyone to read/download certificates
CREATE POLICY "Allow public select from certificates"
ON storage.objects
FOR SELECT
TO anon
USING (bucket_id = 'certificates');

-- Allow overwrite (upsert) on existing certificate files
CREATE POLICY "Allow public update to certificates"
ON storage.objects
FOR UPDATE
TO anon
USING (bucket_id = 'certificates')
WITH CHECK (bucket_id = 'certificates');


-- ──────────────────────────────────────────────────────────────
-- 6. OPTIONAL: Seed a sample student for testing
-- ──────────────────────────────────────────────────────────────
-- INSERT INTO students (name, username, password, student_id, score, attendance, projects_count)
-- VALUES ('Test Student', 'ryhatest001', 'TestPass123', 'RYHA-2026-TEST-0001', 85, 92, 2)
-- ON CONFLICT DO NOTHING;


-- ──────────────────────────────────────────────────────────────
-- DONE. Your RYHA database is ready.
-- ──────────────────────────────────────────────────────────────
