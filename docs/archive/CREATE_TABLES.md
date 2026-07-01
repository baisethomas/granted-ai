# 🚨 URGENT: Create Database Tables

Your app won't persist data until you create the database tables in Supabase.

## Quick Setup (2 minutes)

### Step 1: Go to Supabase SQL Editor

1. Open: https://supabase.com/dashboard/project/ieicdrcpckcjgcgfylaj/sql
2. Click "+ New query"

### Step 2: Copy & Paste This SQL

```sql
-- GRANTED AI - Database Tables Setup
-- Run this once to create all required tables

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE,
  email TEXT,
  google_id TEXT UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR REFERENCES users(id) NOT NULL,
  organization_id VARCHAR NOT NULL,
  title TEXT NOT NULL,
  funder TEXT NOT NULL,
  amount TEXT,
  deadline TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'draft',
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR REFERENCES users(id) NOT NULL,
  organization_id VARCHAR NOT NULL,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  summary TEXT,
  category TEXT,
  processing_status TEXT DEFAULT 'complete',
  uploaded_at TIMESTAMP DEFAULT NOW()
);

-- Questions table
CREATE TABLE IF NOT EXISTS questions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR REFERENCES projects(id) NOT NULL,
  question TEXT NOT NULL,
  response TEXT,
  response_status TEXT DEFAULT 'pending',
  error_message TEXT,
  word_limit INTEGER,
  priority TEXT DEFAULT 'medium',
  created_at TIMESTAMP DEFAULT NOW()
);

-- User settings table
CREATE TABLE IF NOT EXISTS user_settings (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR REFERENCES users(id) NOT NULL UNIQUE,
  default_tone TEXT DEFAULT 'professional',
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_questions_project_id ON questions(project_id);

-- Success message
SELECT 'Tables created successfully! ✅' as status;
```

### Step 3: Click "RUN" (bottom right)

You should see: `Tables created successfully! ✅`

### Step 4: Refresh Your App

1. Go to https://granted-ai.vercel.app
2. Hard refresh (Cmd+Shift+R or Ctrl+Shift+F5)
3. Create a new project
4. Refresh again - **project should still be there!**

---

## What This Does

Creates 5 tables in your Supabase database:
- ✅ `users` - User accounts
- ✅ `projects` - Your grant projects
- ✅ `documents` - Uploaded files
- ✅ `questions` - Project questions
- ✅ `user_settings` - User preferences

## Why You Need This

Your code is trying to save data to these tables, but they don't exist yet. Once you run this SQL, everything will work!

---

## Troubleshooting

**If you see an error about "relation already exists":**
- That's fine! It means some tables already exist
- The `IF NOT EXISTS` clause will skip those

**If you see "Success. No rows returned":**
- That's also fine! Tables were created successfully

**To verify tables were created:**
Run this query in Supabase SQL Editor:
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('users', 'projects', 'documents', 'questions', 'user_settings');
```

You should see all 5 tables listed.
