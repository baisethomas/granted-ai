# Data Persistence Implementation Plan

## Executive Summary

**Current State**: The application uses in-memory storage (`api/simple.ts`) which loses all data on server restart or browser refresh.

**Root Cause**: Vercel configuration routes all API requests to `/api/simple` instead of the database-backed server implementation.

**Solution**: Migrate from in-memory arrays to PostgreSQL/Supabase database persistence using the existing schema and infrastructure.

---

## Architecture Overview

### What Already Exists ✅

1. **PostgreSQL Database** with Supabase
   - Connection URL configured: `postgresql://postgres.ieicdrcpckcjgcgfylaj...`
   - Comprehensive schema with 25+ tables in `/shared/schema.ts`
   - Migration system with Drizzle ORM

2. **Database Tables Ready**
   - `users` - User accounts with OAuth support
   - `organizations` - Multi-tenant organization entities
   - `projects` - Grant application projects
   - `documents` - Uploaded files with metadata
   - `grantQuestions` - Questions within projects
   - `responseVersions` - Version history of responses
   - `userSettings` - User preferences and AI settings
   - Plus 18 more advanced tables for RAG, citations, billing, etc.

3. **Authentication Infrastructure**
   - Supabase Auth configured and working
   - JWT token validation in place
   - User ID available from `req.supabaseUser.id`

4. **Partially Implemented Database Logic**
   - `/api/index.ts` - Has document CRUD with database
   - `/server` folder - Full Express app with database integration (not being used)

### What's Missing ❌

1. **API Routing** - Vercel routes to wrong file (`api/simple.ts` instead of proper handlers)
2. **Projects Persistence** - Projects stored in memory arrays
3. **Questions Persistence** - Questions stored in memory arrays
4. **Settings Persistence** - Settings partially mocked
5. **User-Data Relationships** - No proper user ID scoping on data

---

## Implementation Strategy

### Phase 1: Switch to Database-Backed API ⚡ (Quick Win)

**Goal**: Route API requests to database-backed handlers instead of in-memory storage.

**Approach**: Two options:

#### Option A: Enhance `api/simple.ts` with Database Calls (Recommended)
- **Pros**: Minimal deployment changes, works with current Vercel setup
- **Cons**: Code duplication with existing `/server` logic
- **Effort**: 2-3 hours
- **Files to modify**:
  - `api/simple.ts` - Replace memory arrays with Supabase queries

#### Option B: Switch to Full `/server` Implementation
- **Pros**: Uses existing comprehensive codebase, full feature set
- **Cons**: Requires Vercel config changes, more complex migration
- **Effort**: 4-6 hours
- **Files to modify**:
  - `vercel.json` - Change API routing
  - `server/index.ts` - Ensure Vercel compatibility

**Recommendation**: **Option A** for faster implementation, then gradually migrate to Option B.

---

## Detailed Implementation Plan

### Step 1: Database Connection Setup ✅ (Already Done)

- [x] PostgreSQL database provisioned on Supabase
- [x] `DATABASE_URL` environment variable configured
- [x] Drizzle ORM installed and configured
- [x] Schema defined in `/shared/schema.ts`

**Status**: Complete, no action needed.

---

### Step 2: Migrate Documents to Database Storage

**Current State**:
```typescript
// api/simple.ts lines 102-104
let documents: any[] = [];
let nextId = 1;
```

**Target State**: Store in `documents` table with user_id foreign key.

**Implementation**:

1. **Upload Endpoint** (`POST /api/documents/upload`)
   - Already working in `api/index.ts` (lines 156-240)
   - Insert document metadata into `documents` table
   - Use authenticated `user.id` from Supabase token
   - Store file in Supabase Storage bucket (optional, can start with metadata only)

2. **List Endpoint** (`GET /api/documents`)
   - Query: `SELECT * FROM documents WHERE user_id = $1`
   - Filter by authenticated user
   - Transform database fields to frontend format

3. **Delete Endpoint** (`DELETE /api/documents/:id`)
   - Query: `DELETE FROM documents WHERE id = $1 AND user_id = $2`
   - Verify user owns document before deleting

**Database Schema** (already exists):
```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  organization_id UUID REFERENCES organizations(id),
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  category TEXT,
  summary TEXT,
  processed BOOLEAN DEFAULT false,
  uploaded_at TIMESTAMP DEFAULT NOW()
);
```

**Code Changes**:
```typescript
// Replace in-memory array with Supabase query
app.get("/api/documents", requireSupabaseUser, async (req, res) => {
  const userId = req.supabaseUser.id;

  const { data, error } = await supabaseDB
    .from('documents')
    .select('*')
    .eq('user_id', userId)
    .order('uploaded_at', { ascending: false });

  if (error) {
    return res.status(500).json({ error: "Failed to fetch documents" });
  }

  res.json(transformToFrontendFormat(data));
});
```

**Rollout**:
- ✅ Documents upload already works in `api/index.ts`
- Copy working implementation to `api/simple.ts`
- Test with authenticated user

---

### Step 3: Migrate Projects to Database Storage

**Current State**:
```typescript
// api/simple.ts lines 103-104
let projects: any[] = [];
let nextProjectId = 1;
```

**Target State**: Store in `projects` table.

**Database Schema** (already exists):
```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  organization_id UUID REFERENCES organizations(id),
  title TEXT NOT NULL,
  funder TEXT,
  amount NUMERIC,
  deadline DATE,
  description TEXT,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Implementation**:

1. **Create Project** (`POST /api/projects`)
```typescript
app.post("/api/projects", requireSupabaseUser, async (req, res) => {
  const userId = req.supabaseUser.id;

  const { data, error } = await supabaseDB
    .from('projects')
    .insert({
      user_id: userId,
      title: req.body.title || "Untitled Project",
      funder: req.body.funder || "",
      amount: req.body.amount || null,
      deadline: req.body.deadline || null,
      description: req.body.description || "",
      status: "draft"
    })
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: "Failed to create project" });
  }

  res.json(data);
});
```

2. **List Projects** (`GET /api/projects`)
```typescript
app.get("/api/projects", requireSupabaseUser, async (req, res) => {
  const userId = req.supabaseUser.id;

  const { data, error } = await supabaseDB
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  res.json(data || []);
});
```

3. **Update Project** (`PUT /api/projects/:id`)
```typescript
app.put("/api/projects/:id", requireSupabaseUser, async (req, res) => {
  const userId = req.supabaseUser.id;
  const projectId = req.params.id;

  const { data, error } = await supabaseDB
    .from('projects')
    .update({
      ...req.body,
      updated_at: new Date().toISOString()
    })
    .eq('id', projectId)
    .eq('user_id', userId)  // Security: verify ownership
    .select()
    .single();

  if (error || !data) {
    return res.status(404).json({ error: "Project not found" });
  }

  res.json(data);
});
```

4. **Finalize Project** (`PUT /api/projects/:id/finalize`)
```typescript
app.put("/api/projects/:id/finalize", requireSupabaseUser, async (req, res) => {
  const userId = req.supabaseUser.id;
  const projectId = req.params.id;

  const { data, error } = await supabaseDB
    .from('projects')
    .update({
      status: 'final',
      updated_at: new Date().toISOString()
    })
    .eq('id', projectId)
    .eq('user_id', userId)
    .select()
    .single();

  res.json(data);
});
```

---

### Step 4: Migrate Questions to Database Storage

**Current State**:
```typescript
// api/simple.ts lines 104-107
let questions: any[] = [];
let nextQuestionId = 1;
```

**Target State**: Store in `grantQuestions` table.

**Database Schema** (already exists):
```sql
CREATE TABLE grant_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) NOT NULL,
  question TEXT NOT NULL,
  response TEXT,
  response_status TEXT DEFAULT 'pending',
  word_limit INTEGER,
  priority TEXT DEFAULT 'medium',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Implementation**:

1. **Create Question** (`POST /api/projects/:projectId/questions`)
```typescript
app.post("/api/projects/:projectId/questions", requireSupabaseUser, async (req, res) => {
  const userId = req.supabaseUser.id;
  const projectId = req.params.projectId;

  // Verify project belongs to user
  const { data: project } = await supabaseDB
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single();

  if (!project) {
    return res.status(403).json({ error: "Project not found or unauthorized" });
  }

  const { data, error } = await supabaseDB
    .from('grant_questions')
    .insert({
      project_id: projectId,
      user_id: userId,
      question: req.body.question || "",
      word_limit: req.body.wordLimit || null,
      priority: req.body.priority || "medium"
    })
    .select()
    .single();

  res.json(data);
});
```

2. **List Questions** (`GET /api/projects/:id/questions`)
```typescript
app.get("/api/projects/:id/questions", requireSupabaseUser, async (req, res) => {
  const userId = req.supabaseUser.id;
  const projectId = req.params.id;

  // Verify project ownership
  const { data: project } = await supabaseDB
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single();

  if (!project) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  const { data } = await supabaseDB
    .from('grant_questions')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  res.json(data || []);
});
```

3. **Update Question Response** (in generation endpoint)
```typescript
// After AI generates response
await supabaseDB
  .from('grant_questions')
  .update({
    response: finalResponse,
    response_status: responseStatus,
    updated_at: new Date().toISOString()
  })
  .eq('id', questionId)
  .eq('user_id', userId);
```

---

### Step 5: Persist User Settings

**Current State**: Partially mocked in `api/simple.ts` and `api/index.ts`.

**Target State**: Store in `user_settings` table.

**Database Schema** (already exists):
```sql
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) UNIQUE NOT NULL,
  default_tone TEXT DEFAULT 'professional',
  length_preference TEXT DEFAULT 'medium',
  emphasis_areas TEXT[] DEFAULT '{}',
  ai_model TEXT DEFAULT 'gpt-4',
  fallback_model TEXT DEFAULT 'gpt-3.5-turbo',
  creativity NUMERIC DEFAULT 0.7,
  context_usage NUMERIC DEFAULT 0.8,
  auto_detection BOOLEAN DEFAULT true,
  email_notifications BOOLEAN DEFAULT true,
  auto_save BOOLEAN DEFAULT true,
  analytics BOOLEAN DEFAULT true,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Implementation**:

1. **Get Settings** (`GET /api/settings`)
```typescript
app.get("/api/settings", requireSupabaseUser, async (req, res) => {
  const userId = req.supabaseUser.id;

  let { data, error } = await supabaseDB
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .single();

  // Create default settings if none exist
  if (error || !data) {
    const { data: newSettings } = await supabaseDB
      .from('user_settings')
      .insert({ user_id: userId })
      .select()
      .single();
    data = newSettings;
  }

  res.json(data);
});
```

2. **Update Settings** (`PUT /api/settings`)
```typescript
app.put("/api/settings", requireSupabaseUser, async (req, res) => {
  const userId = req.supabaseUser.id;

  const { data, error } = await supabaseDB
    .from('user_settings')
    .upsert({
      user_id: userId,
      ...req.body,
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  res.json(data);
});
```

---

### Step 6: Add User Onboarding Flow

**Purpose**: Ensure user record exists in `users` table when they first sign up.

**Implementation**:

1. **Create User on First Login**
```typescript
// In requireSupabaseUser middleware or /api/auth/me
async function ensureUserExists(supabaseUser: any) {
  const { data: existingUser } = await supabaseDB
    .from('users')
    .select('id')
    .eq('id', supabaseUser.id)
    .single();

  if (!existingUser) {
    // Create user record
    await supabaseDB
      .from('users')
      .insert({
        id: supabaseUser.id,
        email: supabaseUser.email,
        username: supabaseUser.email?.split('@')[0] || 'user',
        google_id: supabaseUser.app_metadata?.provider === 'google'
          ? supabaseUser.user_metadata?.sub
          : null
      });

    // Create default settings
    await supabaseDB
      .from('user_settings')
      .insert({ user_id: supabaseUser.id });
  }
}
```

---

### Step 7: Handle Data Migration (If Needed)

**Scenario**: If there's production data in memory that needs preserving.

**Implementation**:

1. **Export Current Data** (before deployment)
```typescript
// Add temporary admin endpoint
app.get("/api/admin/export", (req, res) => {
  res.json({
    documents,
    projects,
    questions,
    exported_at: new Date().toISOString()
  });
});
```

2. **Import to Database**
```typescript
// One-time migration script
async function migrateData(exportedData: any) {
  for (const doc of exportedData.documents) {
    await supabaseDB.from('documents').insert({
      filename: doc.filename,
      // ... map fields
    });
  }
  // Repeat for projects, questions
}
```

**Note**: Since this is early development and data is lost on refresh anyway, migration is likely **not needed**.

---

## Security Considerations

### Authentication & Authorization

1. **Always Verify User Ownership**
```typescript
// BAD: Anyone can access any project
.select('*').eq('id', projectId)

// GOOD: User can only access their own projects
.select('*').eq('id', projectId).eq('user_id', userId)
```

2. **Use Supabase RLS (Row Level Security)**
   - Enable RLS on all tables
   - Create policies: `user_id = auth.uid()`
   - Prevents data leaks even if queries are malformed

3. **Validate User Input**
   - Already implemented in `/api/simple.ts` lines 273-293
   - Validate tone, emphasisAreas, etc.
   - Prevent SQL injection via parameterized queries (Supabase handles this)

### Data Privacy

1. **User Isolation**: All queries filter by `user_id`
2. **Organization Scoping**: Add `organization_id` filtering when multi-tenant features enabled
3. **Soft Deletes**: Consider adding `deleted_at` column instead of hard deletes

---

## Testing Strategy

### Unit Tests

1. **API Endpoint Tests**
```typescript
describe('POST /api/projects', () => {
  it('creates project for authenticated user', async () => {
    const response = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({ title: 'Test Project' });

    expect(response.status).toBe(200);
    expect(response.body.title).toBe('Test Project');
    expect(response.body.user_id).toBe(testUserId);
  });

  it('prevents unauthorized access', async () => {
    const response = await request(app)
      .post('/api/projects')
      .send({ title: 'Test' });

    expect(response.status).toBe(401);
  });
});
```

### Integration Tests

1. **End-to-End Workflow**
   - Sign up → Upload document → Create project → Add questions → Generate response
   - Logout → Login → Verify data persists

2. **Database Consistency**
   - Create project → Delete project → Verify questions cascade deleted
   - Foreign key constraints working

### Manual Testing Checklist

- [ ] Upload document → Refresh page → Document still visible
- [ ] Create project → Logout → Login → Project still exists
- [ ] Add question → Generate response → Response saved
- [ ] Update settings → Refresh → Settings persisted
- [ ] Delete document → Verify removed from database
- [ ] Multi-user: User A cannot see User B's data

---

## Deployment Plan

### Phase 1: Prepare Database

1. **Verify Schema**
```bash
npm run db:push  # Push schema to Supabase
```

2. **Enable RLS (Optional but Recommended)**
```sql
-- Run in Supabase SQL Editor
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE grant_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only see own documents"
  ON documents FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Users can only see own projects"
  ON projects FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Users can only see own questions"
  ON grant_questions FOR ALL
  USING (user_id = auth.uid());
```

### Phase 2: Update API Code

1. **Modify `api/simple.ts`**
   - Replace all in-memory arrays with Supabase queries
   - Add `requireSupabaseUser` middleware to protected endpoints
   - Test locally with `npm run dev`

2. **Update Environment Variables**
   - Verify `DATABASE_URL` in Vercel dashboard
   - Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Phase 3: Deploy to Vercel

1. **Commit Changes**
```bash
git add .
git commit -m "feat: migrate from in-memory to database persistence"
git push
```

2. **Vercel Auto-Deploy**
   - Vercel will automatically build and deploy
   - Monitor deployment logs for errors

3. **Verify Deployment**
   - Test all endpoints: upload, projects, questions, settings
   - Check database in Supabase dashboard for new records

### Phase 4: Monitor & Rollback Plan

1. **Monitor**
   - Check Vercel logs for errors
   - Monitor Supabase database metrics (connections, queries)
   - Test critical user flows

2. **Rollback Plan** (if needed)
   - Revert to previous commit: `git revert HEAD && git push`
   - Vercel will auto-deploy previous version

---

## Performance Considerations

### Database Indexing

**Already Optimized** (schema includes):
- Primary keys on all tables (indexed by default)
- Foreign keys on `user_id`, `project_id`, `organization_id`
- Indexes on frequently queried columns

**Additional Indexes to Consider**:
```sql
-- If querying by status is slow
CREATE INDEX idx_projects_status ON projects(status);

-- If document category filtering is slow
CREATE INDEX idx_documents_category ON documents(category);

-- If question priority sorting is slow
CREATE INDEX idx_questions_priority ON grant_questions(priority);
```

### Caching Strategy

1. **React Query Cache** (frontend)
   - Already implemented in client components
   - Automatic cache invalidation on mutations

2. **Database Connection Pooling**
   - Supabase handles this automatically
   - Lazy initialization in `server/db.ts` already implemented

3. **Eager Loading**
   - Load related data in single query:
```typescript
// Instead of multiple queries
const project = await getProject(id);
const questions = await getQuestions(projectId);

// Use joins
const { data } = await supabaseDB
  .from('projects')
  .select(`
    *,
    grant_questions (*)
  `)
  .eq('id', id)
  .single();
```

---

## Migration from In-Memory to Database: Code Diff

### Before (In-Memory)
```typescript
// api/simple.ts
let documents: any[] = [];
let projects: any[] = [];
let questions: any[] = [];

app.get("/api/documents", (req, res) => {
  res.json(documents);
});

app.post("/api/documents/upload", upload.single('file'), (req, res) => {
  const document = {
    id: `doc-${nextId++}`,
    filename: req.file.originalname,
    userId: "user-123"  // Hardcoded!
  };
  documents.push(document);
  res.json(document);
});
```

### After (Database)
```typescript
// api/simple.ts
import { createClient } from "@supabase/supabase-js";

const supabaseDB = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

app.get("/api/documents", requireSupabaseUser, async (req, res) => {
  const userId = req.supabaseUser.id;

  const { data, error } = await supabaseDB
    .from('documents')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});

app.post("/api/documents/upload", requireSupabaseUser, upload.single('file'), async (req, res) => {
  const userId = req.supabaseUser.id;

  const { data, error } = await supabaseDB
    .from('documents')
    .insert({
      filename: req.file.originalname,
      original_name: req.file.originalname,
      file_type: req.file.mimetype,
      file_size: req.file.size,
      category: req.body.category || "organization-info",
      user_id: userId,
      processed: true
    })
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});
```

---

## Alternative: Use Full Server Implementation

### Option B Details

**Instead of modifying `api/simple.ts`, switch to the existing `/server` implementation.**

**Benefits**:
- Already has database integration
- Includes advanced features (RAG, citations, billing)
- Better code organization
- Middleware architecture

**Changes Required**:

1. **Update `vercel.json`**
```json
{
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/index"  // Changed from /api/simple
    }
  ]
}
```

2. **Ensure Vercel Compatibility in `server/index.ts`**
```typescript
// Export Express app for Vercel serverless
export default app;
```

3. **Update `api/index.ts`**
   - Currently has basic document CRUD
   - Add full project and question endpoints from `/server/routes.ts`

**Trade-offs**:
- More complex migration
- Requires testing all 20+ endpoints
- Longer deployment time

**Recommendation**: Start with Option A (enhance `api/simple.ts`), then gradually migrate to `/server` implementation for advanced features.

---

## Success Metrics

### After Implementation, Verify:

1. **Data Persistence**
   - ✅ Upload document → Refresh → Document visible
   - ✅ Create project → Logout → Login → Project exists
   - ✅ Generated responses saved and visible after refresh

2. **User Isolation**
   - ✅ User A cannot see User B's documents/projects
   - ✅ API returns 401 when not authenticated
   - ✅ API returns 403 when accessing other user's data

3. **Performance**
   - ✅ Document list loads in < 500ms
   - ✅ Project creation completes in < 300ms
   - ✅ No visible slowdown compared to in-memory version

4. **Data Integrity**
   - ✅ Foreign keys enforced (can't create question for non-existent project)
   - ✅ Cascade deletes work (delete project → questions deleted)
   - ✅ Timestamps auto-update on modifications

---

## Timeline Estimate

### Quick Implementation (Option A)

- **Step 1**: Database setup ✅ - Already done
- **Step 2**: Documents migration - 1 hour (copy from `api/index.ts`)
- **Step 3**: Projects migration - 1.5 hours (write CRUD endpoints)
- **Step 4**: Questions migration - 1.5 hours (write CRUD endpoints)
- **Step 5**: Settings migration - 0.5 hours (simple upsert)
- **Step 6**: User onboarding - 0.5 hours (middleware update)
- **Step 7**: Testing - 1 hour (manual + automated)
- **Step 8**: Deployment - 0.5 hours (git commit + monitor)

**Total: ~6-7 hours** for basic persistence.

### Comprehensive Implementation (Option B)

- All of Option A: 6-7 hours
- Migrate to `/server` architecture: +3-4 hours
- Implement advanced features: +5-8 hours
- Comprehensive testing: +2-3 hours

**Total: ~16-22 hours** for full-featured implementation.

---

## Recommended Approach

### Immediate Action (Today)

**Goal**: Get basic persistence working ASAP.

1. ✅ Verify database connection (already done)
2. Modify `api/simple.ts`:
   - Add Supabase client initialization
   - Replace documents array with Supabase queries (copy from `api/index.ts`)
   - Replace projects array with Supabase queries
   - Replace questions array with Supabase queries
3. Test locally with `npm run dev`
4. Deploy to Vercel
5. Verify data persists across refreshes

**Effort**: 3-4 hours

### Short-term (This Week)

1. Add user settings persistence
2. Implement RLS policies for security
3. Add proper error handling and validation
4. Write integration tests
5. Monitor production metrics

**Effort**: 4-6 hours

### Medium-term (Next 2 Weeks)

1. Migrate to full `/server` implementation
2. Enable advanced features (RAG, citations, version history)
3. Implement document processing pipeline
4. Add usage tracking and billing hooks
5. Performance optimization (indexing, caching)

**Effort**: 10-15 hours

---

## Questions to Clarify

Before starting implementation, please confirm:

1. **Preferred Option**: Option A (quick fix to `api/simple.ts`) or Option B (migrate to `/server`)?

2. **Data Migration**: Is there any production data in the current in-memory storage that needs to be preserved?

3. **Multi-Tenancy**: Should we implement organization-level data scoping now, or just user-level?

4. **RLS Security**: Enable Supabase Row Level Security policies immediately, or add later?

5. **Advanced Features**: Priority for RAG document retrieval, citations, and version history?

6. **Testing**: Preference for automated tests vs manual testing for initial release?

---

## Files to Modify (Option A - Quick Implementation)

1. **`api/simple.ts`** - Main API file
   - Replace in-memory arrays with Supabase queries
   - Add database helper functions
   - Update all CRUD endpoints

2. **`.env`** (Vercel dashboard)
   - Verify `DATABASE_URL` is set
   - Verify Supabase keys are configured

3. **`client/src/lib/supabase.ts`** (if needed)
   - Ensure client-side Supabase configured correctly

4. **Testing files** (create new)
   - `test/integration-persistence.test.ts`

---

## Files to Modify (Option B - Full Migration)

1. **`vercel.json`**
   - Change API routing destination

2. **`api/index.ts`**
   - Add all endpoints from `/server/routes.ts`
   - Ensure Vercel serverless compatibility

3. **`server/index.ts`**
   - Export Express app for Vercel

4. **`server/routes.ts`**
   - Ensure all routes have proper auth

5. **`server/db.ts`**
   - Verify lazy initialization works in serverless

---

## Conclusion

Your application **already has** all the infrastructure needed for data persistence:
- ✅ Database provisioned and connected
- ✅ Schema defined with 25+ tables
- ✅ Authentication working
- ✅ Partial database implementation in `api/index.ts`

**The only issue**: Vercel routes requests to `api/simple.ts` which uses in-memory storage instead of the database.

**The fix**: Replace the in-memory arrays in `api/simple.ts` with Supabase queries.

**Estimated time**: 3-4 hours for basic persistence, 6-7 hours for comprehensive implementation.

Let me know which option you prefer and I'll proceed with the implementation!
