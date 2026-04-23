# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start development server (Express backend with Vite frontend)
- `npm run build` - Build production application (Vite + esbuild)
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run db:push` - Push database schema changes with Drizzle
- `npm run test:auth` - Run authentication smoke tests

## Architecture Overview

This is a **Vite + React + Express** application for AI-powered grant writing assistance. The frontend uses React with Vite for build tooling, while the backend is an Express server. The application integrates with Supabase for authentication and supports multiple LLM providers (OpenAI, Anthropic) for AI generation.

### Tech Stack

- **Frontend**: React 18, Vite 5, Wouter (routing), TanStack Query (data fetching)
- **Backend**: Express, Node.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Supabase Auth + Passport.js (Google OAuth, local)
- **UI Framework**: Tailwind CSS 4, Radix UI components, Lucide icons
- **State Management**: TanStack Query for server state, React hooks for local state
- **AI Integration**: OpenAI SDK, Anthropic SDK

### Core Application Flow

1. **Document Upload & Processing** (`client/src/pages/upload.tsx`) - Users upload documents which get processed by background workers
2. **Grant Form Creation** (`client/src/pages/forms.tsx`) - Users input grant questions and context
3. **AI Generation** (`server/routes.ts`, `api/simple.ts`) - Generates grant responses using document context via LLM providers
4. **Draft Management** (`client/src/pages/drafts.tsx`) - Display and manage generated drafts
5. **Export Functions** (`client/src/lib/export.ts`) - Export drafts to PDF, DOCX, or copy to clipboard

### Key Architectural Components

**Frontend Architecture** (`client/`):
- React SPA with client-side routing (Wouter)
- TanStack Query for API calls and cache management
- Component library based on Radix UI primitives
- Vite for fast development and optimized production builds

**Backend Architecture** (`server/`):
- Express REST API with TypeScript
- Drizzle ORM for type-safe database operations
- Passport authentication strategies
- Background workers for document processing (`server/workers/`)

**API Layer** (`api/`):
- `simple.ts` - Main AI generation logic and document processing
- RESTful endpoints for projects, documents, questions, and settings

**Database** (`server/db.ts`, `shared/schema-simple.ts`):
- PostgreSQL with Neon serverless driver
- Drizzle ORM schema definitions
- Type-safe queries with drizzle-zod

**Authentication** (`server/auth.ts`, `server/hybrid-auth.ts`):
- Hybrid authentication supporting both Supabase (primary) and Passport local
- Google OAuth 2.0 via Supabase Auth (client-side redirect flow)
- Session management with connect-pg-simple

### Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL (legacy naming, used via Vite define)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key (legacy naming, used via Vite define)
- `DATABASE_URL` - PostgreSQL connection string
- `OPENAI_API_KEY` - OpenAI API key
- `ANTHROPIC_API_KEY` - Anthropic API key
- `SESSION_SECRET` - Express session secret

> Google OAuth is configured via the Supabase dashboard (Authentication →
> Providers → Google). The client calls `supabase.auth.signInWithOAuth` and
> Supabase handles the redirect back to `/app`. No server-side Passport
> Google strategy exists.

### UI Components

- Radix UI primitives in `client/src/components/ui/` (Button, Card, Dialog, Select, etc.)
- Custom components: ClarificationPanel, EvidenceMap, UsageDashboard
- Tailwind CSS 4 with custom design system
- Lucide React for icons
- Framer Motion for animations

### File Structure

- `/client/` - React frontend application
  - `/src/pages/` - Page components (dashboard, forms, drafts, upload, settings)
  - `/src/components/` - React components including UI library
  - `/src/lib/` - Frontend utilities (API client, export functions, etc.)
  - `/src/hooks/` - Custom React hooks
- `/server/` - Express backend application
  - `routes.ts` - API route definitions
  - `auth.ts` - Authentication configuration
  - `db.ts` - Database connection
  - `/workers/` - Background job processors
- `/api/` - Core business logic
  - `simple.ts` - AI generation and document processing
- `/shared/` - Shared code between frontend and backend
  - `schema-simple.ts` - Database schema (Drizzle)
- `/migrations/` - Database migrations