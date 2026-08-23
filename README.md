# Granted AI

AI-assisted grant application software for nonprofit organizations.

Granted AI turns organizational documents and institutional knowledge into source-grounded draft responses for grant applications. The product is designed to help nonprofit teams spend less time searching for prior language and more time reviewing, refining, and submitting accurate applications.

## Status

**Launched.** The product is live and has been demonstrated to prospective nonprofit customers as part of early customer discovery and validation. Marketing and customer acquisition are the current focus.

## What it does

- Ingests organizational PDFs and Word documents
- Extracts and processes source material for retrieval
- Uses hybrid semantic and keyword search to find relevant context
- Generates grant responses grounded in organizational source material
- Maps citations back to retrieved document chunks
- Detects unsupported specifics and assumptions in generated responses
- Supports editing, versioning, collaboration, and export workflows

## AI approach

Granted AI uses retrieval-augmented generation rather than relying on a model's general knowledge alone. The retrieval layer combines vector similarity with keyword search, then passes bounded source context into generation. Citation normalization and unsupported-claim checks add a second reliability layer before generated content reaches the user.

## Architecture snapshot

- **Frontend:** React, TypeScript, Vite
- **Backend:** Express.js, TypeScript
- **Data:** PostgreSQL, pgvector, Drizzle ORM
- **Auth and storage:** Supabase
- **AI:** OpenAI generation and embeddings
- **Deployment:** Vercel

## Product principle

The goal is not to automate judgment. Granted AI accelerates the drafting process while keeping source material, assumptions, and final review visible to the person submitting the application.

## Technical documentation

The previous detailed repository README has been preserved at [`docs/technical-readme.md`](docs/technical-readme.md) for setup instructions, architecture details, API documentation, database structure, and development notes.
