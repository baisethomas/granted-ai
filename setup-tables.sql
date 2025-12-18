-- Create tables if they don't exist for Granted AI app
-- Based on schema-simple.ts

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password TEXT,
  organization_name TEXT,
  organization_type TEXT,
  ein TEXT,
  founded_year INTEGER,
  primary_contact TEXT,
  email TEXT,
  mission TEXT,
  focus_areas TEXT[],
  google_id TEXT UNIQUE,
  avatar TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organizations (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  plan TEXT DEFAULT 'starter',
  billing_customer_id TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS memberships (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR REFERENCES users(id) NOT NULL,
  organization_id VARCHAR REFERENCES organizations(id) NOT NULL,
  role TEXT NOT NULL DEFAULT 'writer',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR REFERENCES users(id) NOT NULL,
  organization_id VARCHAR REFERENCES organizations(id) NOT NULL,
  title TEXT NOT NULL,
  funder TEXT NOT NULL,
  amount TEXT,
  deadline TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'draft',
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR REFERENCES users(id) NOT NULL,
  organization_id VARCHAR REFERENCES organizations(id) NOT NULL,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  summary TEXT,
  category TEXT,
  storage_bucket TEXT DEFAULT 'documents',
  storage_path TEXT,
  storage_url TEXT,
  processing_status TEXT DEFAULT 'pending',
  processing_error TEXT,
  processed_at TIMESTAMP,
  summary_extracted_at TIMESTAMP,
  embedding_generated_at TIMESTAMP,
  embedding_status TEXT DEFAULT 'pending',
  chunk_count INTEGER DEFAULT 0,
  embedding_model TEXT,
  uploaded_at TIMESTAMP DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS user_settings (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR REFERENCES users(id) NOT NULL UNIQUE,
  default_tone TEXT DEFAULT 'professional',
  length_preference TEXT DEFAULT 'balanced',
  emphasis_areas TEXT[] DEFAULT '{}',
  ai_model TEXT DEFAULT 'gpt-4o',
  fallback_model TEXT DEFAULT 'gpt-3.5-turbo',
  creativity INTEGER DEFAULT 30,
  context_usage INTEGER DEFAULT 80,
  email_notifications BOOLEAN DEFAULT TRUE,
  auto_save BOOLEAN DEFAULT TRUE,
  analytics BOOLEAN DEFAULT TRUE,
  auto_detection BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_questions_project_id ON questions(project_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
