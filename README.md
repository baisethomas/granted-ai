## Environment Configuration

The Express backend validates its environment at startup. Set the following variables in `.env` (or system environment) before running the server:

| Variable options | Purpose | Required |
| --- | --- | --- |
| `SUPABASE_URL` (`SUPABASE_PROJECT_URL`, `VITE_SUPABASE_URL`, or `NEXT_PUBLIC_SUPABASE_URL`) | Supabase project REST endpoint used to verify JWTs | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` (`SUPABASE_SERVICE_KEY`, `SUPABASE_SECRET_KEY`) | Service role key used by the API to validate Supabase-authenticated requests | Yes |
| `DATABASE_URL` | Postgres connection string for Drizzle ORM | Recommended (falls back to in-memory storage if omitted) |
| `DOCUMENTS_BUCKET` | Supabase Storage bucket for uploads (defaults to `documents`) | Optional |
| `DOCUMENT_WORKER_API_KEY` | Shared secret used to secure the `/api/workers/process-documents` endpoint | Optional (required for scheduled processing) |

When `DATABASE_URL` is not provided the API will use an in-memory store, and all data will reset whenever the process restarts.

After starting the server you can confirm auth is working by running:

```bash
SUPABASE_TEST_ACCESS_TOKEN=<your-jwt> npm run test:auth
```

The script verifies that anonymous requests are rejected while a valid Supabase JWT can reach protected endpoints.

To process pending document ingestion jobs (chunking + embeddings) run:

```bash
npm run doc:process
```

### Scheduling automated document processing

1. Generate a strong random value and set it as `DOCUMENT_WORKER_API_KEY` in your deployment environment.
2. Deploy the new secured endpoint: `POST /api/workers/process-documents` with header `X-API-KEY: <DOCUMENT_WORKER_API_KEY>`.
3. In Supabase, navigate to **Database → Cron** and create a schedule (e.g., every 10 minutes) that calls the endpoint above.
   - Method: `POST`
   - URL: `https://<your-domain>/api/workers/process-documents`
   - Header: `X-API-KEY: <DOCUMENT_WORKER_API_KEY>`
4. Monitor logs in Supabase Cron or your deployment provider; the endpoint returns a summary of processed jobs for quick diagnostics.

---

This project was originally created with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app); the default Next.js instructions follow.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
