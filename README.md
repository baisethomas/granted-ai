# Granted AI

**AI-powered grant writing assistant for nonprofit organizations**

Granted helps nonprofits streamline their grant application process by intelligently generating grant responses using your organization's documents, past grants, and institutional knowledge.

## Features

- **📄 Smart Document Management** - Upload and automatically summarize organizational documents (PDFs, Word docs)
- **🤖 AI-Powered Response Generation** - Generate grant answers using GPT-4 with context from your documents
- **🔍 Hybrid Search** - Semantic (vector) + keyword search to find the most relevant context
- **📝 Citation Tracking** - Automatic citation mapping shows which documents informed each response
- **⚠️ Assumption Detection** - AI identifies gaps and assumptions in generated content
- **✏️ Draft Management** - Edit, version, and refine AI-generated responses
- **📤 Multi-Format Export** - Export to PDF, Word, or clipboard with professional formatting
- **🎨 Customizable Tone** - Configure writing style, emphasis areas, and creativity levels
- **👥 Team Collaboration** - Organization-based access with role management

## Tech Stack

**Frontend**
- React 18 + TypeScript + Vite
- React Query (TanStack Query) for state management
- Tailwind CSS + Radix UI components
- Wouter (lightweight routing)

**Backend**
- Express.js + TypeScript
- Drizzle ORM with PostgreSQL
- Passport authentication (local + Google OAuth)
- pgvector for embeddings storage

**AI & ML**
- OpenAI GPT-4 (text generation)
- OpenAI text-embedding-3-small (1536-dim embeddings)
- Retrieval-Augmented Generation (RAG) architecture

**External Services**
- Supabase (authentication + file storage)
- PostgreSQL (primary database with pgvector extension)

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+ with pgvector extension
- Supabase account
- OpenAI API key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/granted-ai.git
   cd granted-ai
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env` file in the root directory:
   ```bash
   # Supabase
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

   # Database
   DATABASE_URL=postgresql://user:password@localhost:5432/granted

   # OpenAI
   OPENAI_API_KEY=sk-your-openai-api-key

   # Optional
   SESSION_SECRET=your-random-secret
   GOOGLE_CLIENT_ID=your-google-oauth-id
   GOOGLE_CLIENT_SECRET=your-google-oauth-secret
   DOCUMENTS_BUCKET=documents
   DOCUMENT_WORKER_API_KEY=your-worker-api-key
   ```

4. **Set up the database**
   ```bash
   # Run migrations
   npm run db:push
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**

   Navigate to [http://localhost:5000](http://localhost:5000)

## Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `SUPABASE_URL` | Supabase project REST endpoint for JWT verification | ✅ Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for validating authenticated requests | ✅ Yes |
| `OPENAI_API_KEY` | OpenAI API key for GPT-4 and embeddings | ✅ Yes |
| `DATABASE_URL` | PostgreSQL connection string | ⚠️ Recommended* |
| `SESSION_SECRET` | Express session secret (auto-generated if omitted) | ❌ Optional |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | ❌ Optional |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | ❌ Optional |
| `DOCUMENTS_BUCKET` | Supabase storage bucket name (defaults to `documents`) | ❌ Optional |
| `DOCUMENT_WORKER_API_KEY` | API key for background processing endpoint | ❌ Optional |
| `PORT` | Server port (defaults to `5000`) | ❌ Optional |

*Falls back to in-memory storage if omitted (data resets on server restart)

## Project Structure

```
granted-ai/
├── client/                    # React frontend (Vite)
│   └── src/
│       ├── pages/            # Application pages
│       │   ├── dashboard.tsx    # Projects overview
│       │   ├── upload.tsx       # Document upload
│       │   ├── forms.tsx        # Grant question builder
│       │   ├── drafts.tsx       # Response editor
│       │   └── settings.tsx     # User preferences
│       ├── components/       # React components
│       │   ├── ui/             # Reusable UI components
│       │   └── layout/         # Layout components
│       ├── lib/              # Client utilities
│       │   ├── api.ts          # React Query API client
│       │   ├── export.ts       # PDF/DOCX export
│       │   └── supabase.ts     # Supabase client
│       └── hooks/            # Custom React hooks
│
├── server/                    # Express backend
│   ├── index.ts              # Server entry point
│   ├── routes.ts             # API endpoints (40+ routes)
│   ├── db.ts                 # Drizzle ORM setup
│   ├── auth.ts               # Passport authentication
│   ├── services/
│   │   ├── ai.ts                # OpenAI integration
│   │   ├── retrieval.ts         # Hybrid search
│   │   ├── fileProcessor.ts     # PDF/DOCX extraction
│   │   └── embedding.ts         # Embedding generation
│   ├── workers/
│   │   └── documentProcessor.ts # Background chunking/embeddings
│   └── middleware/
│       ├── supabaseAuth.ts      # JWT validation
│       └── rateLimiter.ts       # Rate limiting
│
├── shared/                    # Shared code
│   └── schema.ts             # Drizzle ORM schema (14 tables)
│
├── migrations/               # Database migrations
├── scripts/                  # Utility scripts
└── public/                   # Static assets
```

## How It Works

### 1. Document Processing Pipeline

```
User uploads PDF/DOCX
    ↓
Extract text (pdf-parse / mammoth)
    ↓
Generate AI summary (GPT-4)
    ↓
Background job: chunk text (1200 chars, 200 overlap)
    ↓
Generate embeddings for each chunk (text-embedding-3-small)
    ↓
Store in PostgreSQL with pgvector
```

### 2. Grant Response Generation (RAG)

```
User enters grant question
    ↓
Embed question with OpenAI
    ↓
Hybrid Search:
  - Semantic: Vector similarity (top 8 chunks)
  - Keyword: Full-text search (top 4 chunks)
    ↓
Combine & de-duplicate results
    ↓
GPT-4 generates response with context
  - 60-second timeout
  - Exponential backoff (2 retries)
  - Fallback responses for failures
    ↓
Extract citations (map response → source chunks)
    ↓
Detect assumptions (AI-identified gaps)
    ↓
Return response + citations + assumptions
```

### 3. Key Architectural Patterns

- **Retrieval-Augmented Generation (RAG)**: Combines semantic search with LLM generation
- **Hybrid Search**: Vector similarity + keyword matching for better retrieval
- **Background Processing**: Document chunking/embedding happens asynchronously
- **Citation Tracking**: Every AI response links back to source documents
- **Resilient AI Calls**: Timeout handling, retries, and fallback responses
- **Type Safety**: End-to-end TypeScript from database to UI

## Development

### Available Scripts

```bash
npm run dev          # Start development server (Vite HMR + hot reload)
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run db:push      # Push schema changes to database
npm run db:studio    # Open Drizzle Studio (database GUI)
npm run doc:process  # Manually trigger document processing
```

### Build Process

**Development** (`npm run dev`):
- Express server with Vite middleware
- Hot module replacement (HMR) for client
- Server auto-reload with tsx

**Production** (`npm run build`):
- Client: Vite bundles React SPA → `dist/`
- Server: esbuild bundles Express → `dist/index.js`

### Database Migrations

```bash
# Generate migration from schema changes
npm run db:generate

# Apply migrations to database
npm run db:push

# Open database GUI
npm run db:studio
```

### Background Document Processing

Process pending document jobs (chunking + embeddings):

```bash
npm run doc:process
```

Or schedule automated processing:

1. Set `DOCUMENT_WORKER_API_KEY` in your environment
2. Deploy with the secured endpoint: `POST /api/workers/process-documents`
3. In Supabase Dashboard → Database → Cron, create a schedule:
   - Method: `POST`
   - URL: `https://your-domain.com/api/workers/process-documents`
   - Header: `X-API-KEY: your-worker-api-key`
   - Schedule: Every 10 minutes

## API Structure

### Authentication
- `POST /auth/login` - Local login
- `POST /auth/signup` - Register new user
- `GET /auth/google` - Initiate Google OAuth
- `POST /auth/logout` - Logout

### Projects
- `GET /api/projects` - List user's projects
- `POST /api/projects` - Create project
- `GET /api/projects/:id` - Get project details
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### Documents
- `GET /api/documents` - List user's documents
- `POST /api/documents/upload` - Upload & process document
- `DELETE /api/documents/:id` - Delete document

### Grant Questions
- `GET /api/projects/:projectId/questions` - List questions
- `POST /api/projects/:projectId/questions` - Create question
- `POST /api/questions/:id/generate` - Generate AI response
- `PUT /api/questions/:id/response` - Update response
- `DELETE /api/questions/:id` - Delete question

### Settings
- `GET /api/settings` - Get user settings
- `PUT /api/settings` - Update settings

All endpoints (except `/auth/*`) require Supabase JWT authentication via `Authorization: Bearer <token>` header.

## Database Schema

**Key Tables:**
- `users` - User accounts and organization info
- `organizations` - Multi-user organizations (Stripe billing)
- `memberships` - User-organization relationships
- `projects` - Grant applications
- `documents` - Uploaded files with AI summaries
- `documentExtractions` - Raw text from files
- `docChunks` - **Text chunks with embeddings (pgvector)**
- `grantQuestions` - Grant questions and AI responses
- `responseVersions` - Version history for responses
- `draftCitations` - Maps responses to source chunks
- `assumptionLabels` - AI-detected assumptions
- `userSettings` - Per-user AI preferences

**Vector Storage:**
The `docChunks` table uses PostgreSQL's pgvector extension to store 1536-dimensional embeddings, enabling fast semantic similarity search.

## Testing Authentication

Verify Supabase auth is working:

```bash
SUPABASE_TEST_ACCESS_TOKEN=<your-jwt> npm run test:auth
```

This confirms that:
- Anonymous requests are properly rejected
- Valid Supabase JWTs can access protected endpoints

## Deployment

### Vercel (Recommended)

1. **Connect your repository** to Vercel
2. **Set environment variables** in Vercel dashboard
3. **Deploy** - Vercel automatically runs `npm run vercel-build`

### Manual Deployment

```bash
# Build for production
npm run build

# Set environment variables
export DATABASE_URL=postgresql://...
export SUPABASE_URL=https://...
export SUPABASE_SERVICE_ROLE_KEY=...
export OPENAI_API_KEY=sk-...

# Start production server
npm run start
```

Server runs on `PORT` (default: 5000) and serves:
- API endpoints at `/api/*` and `/auth/*`
- Static client files from `dist/`

## Key Implementation Details

### Resilient AI Generation
- 60-second timeout on all OpenAI requests
- Exponential backoff retry (max 2 attempts)
- Fallback responses for timeout/insufficient context scenarios
- Status tracking: `pending → generating → complete/failed/timeout/needs_context`

### Hybrid Search Algorithm
Combines two search strategies:
1. **Semantic Search**: Embed query → vector similarity → top 8 chunks
2. **Keyword Search**: Full-text search → top 4 chunks
3. De-duplicate and sort by relevance score

### Document Processing
- Supported formats: PDF, DOCX, TXT
- Extraction: pdf-parse (PDFs), mammoth (Word docs)
- Chunking: 1200 characters with 200-character overlap
- Embeddings: OpenAI text-embedding-3-small (1536 dimensions)
- Background processing prevents blocking the main thread

### Security
- Passwords hashed with scrypt (Node.js crypto)
- Timing-safe comparison to prevent timing attacks
- JWT validation via Supabase admin client
- Rate limiting on API endpoints
- User data isolation (users can only access their own data)

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is proprietary and confidential. All rights reserved.

## Support

For issues, questions, or feature requests, please open an issue on GitHub or contact the development team.

---

**Built with ❤️ for nonprofits making a difference**
