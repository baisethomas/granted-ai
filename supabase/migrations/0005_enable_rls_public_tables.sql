-- 0005_enable_rls_public_tables.sql
--
-- Security fix: enable Row Level Security (RLS) on every application table in
-- the `public` schema.
--
-- Why: Supabase auto-exposes every `public` table through PostgREST
-- (…supabase.co/rest/v1). With RLS disabled, the browser-shipped anon key
-- (NEXT_PUBLIC_SUPABASE_ANON_KEY) could read every row in every table with no
-- tenant filtering — a cross-tenant data leak that bypassed the Express /
-- requireSupabaseUser / organizationId isolation entirely. The Security Advisor
-- flagged this as 20 CRITICAL "RLS Disabled in Public" errors.
--
-- These tables are NOT accessed through PostgREST by the app. The app talks to
-- Postgres directly via DATABASE_URL as the table-owner `postgres` role, which
-- bypasses RLS. Enabling RLS with NO permissive policies therefore denies the
-- anon/authenticated PostgREST roles everything while leaving the app's
-- Drizzle path fully functional. (Defense-in-depth alongside disabling the
-- Data API in the Supabase dashboard.)

ALTER TABLE public.assumption_labels                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doc_chunks                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_extractions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_processing_jobs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_citations                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embedding_cache                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grant_metric_events              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grant_metrics                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_profile_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.response_versions                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_events                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users                            ENABLE ROW LEVEL SECURITY;
