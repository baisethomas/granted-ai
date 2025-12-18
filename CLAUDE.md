# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build production application
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Architecture Overview

This is a Next.js 15 application for AI-powered grant writing assistance. The application integrates with Supabase for data storage and supports multiple LLM providers (OpenAI, Anthropic) for AI generation.

### Core Application Flow

1. **Document Upload & Processing** (`src/app/upload/`) - Users upload documents which get summarized using LLM providers
2. **Grant Form Creation** (`src/app/grant-form/`) - Users input grant questions and context
3. **AI Generation** (`src/app/api/generate/route.ts`) - Generates grant responses using document context and user preferences
4. **Draft Management** (`src/app/draft/`) - Display and manage generated drafts
5. **Export Functions** (`src/lib/export/`) - Export drafts to PDF, DOCX, or copy to clipboard

### Key Architectural Components

**State Management**: Zustand store (`src/stores/app.ts`) manages:
- Organization settings and writing tone preferences
- Uploaded documents with summaries
- Generated drafts and project data

**LLM Integration** (`src/lib/llm/`):
- Provider-agnostic interface with OpenAI and Anthropic implementations
- Configurable via `GRANTED_DEFAULT_PROVIDER` environment variable
- Falls back to mock provider for development/testing

**Agent System** (`src/lib/agent/`):
- `context.ts` - Manages document context and memory
- `generator.ts` - Handles grant response generation with context awareness

**Database Integration** (`src/lib/supabase/`):
- Client-side and server-side Supabase clients
- Handles authentication and data persistence

### Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `GRANTED_DEFAULT_PROVIDER` - LLM provider ("openai" or "anthropic")
- Provider-specific API keys for OpenAI/Anthropic

### UI Components

- Custom UI components in `src/components/ui/` (Button, Card, Input, Select, Textarea)
- Uses Tailwind CSS with custom design system
- Lucide React for icons
- Headless UI for accessible components

### File Structure Notes

- `/src/app/` - Next.js App Router pages and API routes
- `/src/components/` - React components including shared UI components
- `/src/lib/` - Core business logic, integrations, and utilities
- `/src/stores/` - Zustand state management