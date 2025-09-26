import { createClient } from '@supabase/supabase-js';
import { documents, projects, questions, users, organizations } from '../shared/schema-simple';

// Use Supabase client for database operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ieicdrcpckcjgcgfylaj.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllaWNkcmNwY2tjamdjZ2Z5bGFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4MDAzODQsImV4cCI6MjA3MDM3NjM4NH0.5mgWjDuVk4-udmSC23TocxZjlXooF4ciWRRTAIdF2mo';

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Database operations using Supabase client
export const db = {
  // Documents
  documents: {
    async insert(data: any) {
      return await supabase.from('documents').insert(data).select().single();
    },
    async findByUserId(userId: string) {
      return await supabase.from('documents').select('*').eq('user_id', userId);
    },
    async deleteById(id: string, userId: string) {
      return await supabase.from('documents').delete().eq('id', id).eq('user_id', userId);
    }
  },

  // Projects
  projects: {
    async findByUserId(userId: string) {
      return await supabase.from('projects').select('*').eq('user_id', userId);
    },
    async insert(data: any) {
      return await supabase.from('projects').insert(data).select().single();
    }
  },

  // Questions
  questions: {
    async findByProjectId(projectId: string) {
      return await supabase.from('questions').select('*').eq('project_id', projectId);
    }
  }
};

// Export tables
export { documents, projects, questions, users, organizations };