-- Add indexes for performance optimization

-- Vector similarity search index for doc_chunks embeddings
CREATE INDEX IF NOT EXISTS "doc_chunks_embedding_idx" ON "doc_chunks" USING GIN ("embedding");

-- Usage tracking indexes
CREATE INDEX IF NOT EXISTS "usage_events_organization_id_idx" ON "usage_events" ("organization_id");
CREATE INDEX IF NOT EXISTS "usage_events_type_idx" ON "usage_events" ("type");
CREATE INDEX IF NOT EXISTS "usage_events_created_at_idx" ON "usage_events" ("created_at");
CREATE INDEX IF NOT EXISTS "usage_events_project_id_idx" ON "usage_events" ("project_id");

-- Document and project organization indexes
CREATE INDEX IF NOT EXISTS "documents_organization_id_idx" ON "documents" ("organization_id");
CREATE INDEX IF NOT EXISTS "documents_user_id_idx" ON "documents" ("user_id");
CREATE INDEX IF NOT EXISTS "projects_organization_id_idx" ON "projects" ("organization_id");
CREATE INDEX IF NOT EXISTS "projects_user_id_idx" ON "projects" ("user_id");
CREATE INDEX IF NOT EXISTS "projects_status_idx" ON "projects" ("status");

-- Membership and organization indexes
CREATE INDEX IF NOT EXISTS "memberships_user_id_idx" ON "memberships" ("user_id");
CREATE INDEX IF NOT EXISTS "memberships_organization_id_idx" ON "memberships" ("organization_id");
CREATE INDEX IF NOT EXISTS "memberships_role_idx" ON "memberships" ("role");

-- Grant questions and responses indexes
CREATE INDEX IF NOT EXISTS "grant_questions_project_id_idx" ON "grant_questions" ("project_id");
CREATE INDEX IF NOT EXISTS "grant_questions_status_idx" ON "grant_questions" ("response_status");
CREATE INDEX IF NOT EXISTS "response_versions_question_id_idx" ON "response_versions" ("question_id");
CREATE INDEX IF NOT EXISTS "response_versions_is_current_idx" ON "response_versions" ("is_current");

-- Draft and citation indexes
CREATE INDEX IF NOT EXISTS "drafts_project_id_idx" ON "drafts" ("project_id");
CREATE INDEX IF NOT EXISTS "drafts_version_idx" ON "drafts" ("version");
CREATE INDEX IF NOT EXISTS "draft_citations_draft_id_idx" ON "draft_citations" ("draft_id");
CREATE INDEX IF NOT EXISTS "draft_citations_source_document_id_idx" ON "draft_citations" ("source_document_id");

-- Clarifications and evaluations indexes
CREATE INDEX IF NOT EXISTS "clarifications_project_id_idx" ON "clarifications" ("project_id");
CREATE INDEX IF NOT EXISTS "clarifications_resolved_at_idx" ON "clarifications" ("resolved_at");
CREATE INDEX IF NOT EXISTS "evaluations_project_id_idx" ON "evaluations" ("project_id");
CREATE INDEX IF NOT EXISTS "evaluations_evaluated_by_idx" ON "evaluations" ("evaluated_by");

-- Knowledge profile and templates indexes
CREATE INDEX IF NOT EXISTS "knowledge_profile_organization_id_idx" ON "knowledge_profile" ("organization_id");
CREATE INDEX IF NOT EXISTS "knowledge_profile_last_refreshed_at_idx" ON "knowledge_profile" ("last_refreshed_at");
CREATE INDEX IF NOT EXISTS "grant_templates_is_public_idx" ON "grant_templates" ("is_public");
CREATE INDEX IF NOT EXISTS "grant_templates_created_by_idx" ON "grant_templates" ("created_by");

-- Invites and subscriptions indexes
CREATE INDEX IF NOT EXISTS "invites_organization_id_idx" ON "invites" ("organization_id");
CREATE INDEX IF NOT EXISTS "invites_email_idx" ON "invites" ("email");
CREATE INDEX IF NOT EXISTS "invites_expires_at_idx" ON "invites" ("expires_at");
CREATE INDEX IF NOT EXISTS "subscriptions_organization_id_idx" ON "subscriptions" ("organization_id");
CREATE INDEX IF NOT EXISTS "subscriptions_status_idx" ON "subscriptions" ("status");
CREATE INDEX IF NOT EXISTS "subscriptions_renewal_at_idx" ON "subscriptions" ("renewal_at");

-- User settings and organization indexes
CREATE INDEX IF NOT EXISTS "user_settings_user_id_idx" ON "user_settings" ("user_id");
CREATE INDEX IF NOT EXISTS "organizations_plan_idx" ON "organizations" ("plan");
CREATE INDEX IF NOT EXISTS "organizations_billing_customer_id_idx" ON "organizations" ("billing_customer_id");

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS "usage_events_org_type_created_idx" ON "usage_events" ("organization_id", "type", "created_at");
CREATE INDEX IF NOT EXISTS "projects_org_status_idx" ON "projects" ("organization_id", "status");
CREATE INDEX IF NOT EXISTS "documents_org_category_idx" ON "documents" ("organization_id", "category");
CREATE INDEX IF NOT EXISTS "grant_questions_project_status_idx" ON "grant_questions" ("project_id", "response_status");
