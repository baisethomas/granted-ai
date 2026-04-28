ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "organization_type" text,
  ADD COLUMN IF NOT EXISTS "ein" text,
  ADD COLUMN IF NOT EXISTS "founded_year" integer,
  ADD COLUMN IF NOT EXISTS "primary_contact" text,
  ADD COLUMN IF NOT EXISTS "contact_email" text,
  ADD COLUMN IF NOT EXISTS "mission" text,
  ADD COLUMN IF NOT EXISTS "focus_areas" text[];

ALTER TABLE "documents"
  ADD COLUMN IF NOT EXISTS "project_id" varchar;

CREATE TABLE IF NOT EXISTS "organization_profile_suggestions" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" varchar NOT NULL,
  "document_id" varchar NOT NULL,
  "field" text NOT NULL,
  "suggested_value" text NOT NULL,
  "confidence" integer,
  "source_quote" text,
  "status" text NOT NULL DEFAULT 'pending',
  "reviewed_by" varchar,
  "reviewed_at" timestamp,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organization_profile_suggestions_organization_id_organizations_id_fk'
  ) THEN
    ALTER TABLE "organization_profile_suggestions"
      ADD CONSTRAINT "organization_profile_suggestions_organization_id_organizations_id_fk"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organization_profile_suggestions_document_id_documents_id_fk'
  ) THEN
    ALTER TABLE "organization_profile_suggestions"
      ADD CONSTRAINT "organization_profile_suggestions_document_id_documents_id_fk"
      FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organization_profile_suggestions_reviewed_by_users_id_fk'
  ) THEN
    ALTER TABLE "organization_profile_suggestions"
      ADD CONSTRAINT "organization_profile_suggestions_reviewed_by_users_id_fk"
      FOREIGN KEY ("reviewed_by") REFERENCES "users"("id");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'documents_project_id_projects_id_fk'
  ) THEN
    ALTER TABLE "documents"
      ADD CONSTRAINT "documents_project_id_projects_id_fk"
      FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "documents_org_project_idx"
  ON "documents" ("organization_id", "project_id");

CREATE INDEX IF NOT EXISTS "organization_profile_suggestions_org_status_idx"
  ON "organization_profile_suggestions" ("organization_id", "status");

-- Backfill a default workspace per user for legacy single-user data.
INSERT INTO "organizations" (
  "id",
  "name",
  "organization_type",
  "ein",
  "founded_year",
  "primary_contact",
  "contact_email",
  "mission",
  "focus_areas",
  "plan"
)
SELECT
  u."id",
  COALESCE(NULLIF(u."organization_name", ''), 'My Organization'),
  u."organization_type",
  u."ein",
  u."founded_year",
  u."primary_contact",
  u."email",
  u."mission",
  u."focus_areas",
  'starter'
FROM "users" u
ON CONFLICT ("id") DO UPDATE SET
  "name" = COALESCE(NULLIF(EXCLUDED."name", ''), "organizations"."name"),
  "organization_type" = COALESCE("organizations"."organization_type", EXCLUDED."organization_type"),
  "ein" = COALESCE("organizations"."ein", EXCLUDED."ein"),
  "founded_year" = COALESCE("organizations"."founded_year", EXCLUDED."founded_year"),
  "primary_contact" = COALESCE("organizations"."primary_contact", EXCLUDED."primary_contact"),
  "contact_email" = COALESCE("organizations"."contact_email", EXCLUDED."contact_email"),
  "mission" = COALESCE("organizations"."mission", EXCLUDED."mission"),
  "focus_areas" = COALESCE("organizations"."focus_areas", EXCLUDED."focus_areas"),
  "updated_at" = now();

INSERT INTO "memberships" ("user_id", "organization_id", "role")
SELECT u."id", u."id", 'owner'
FROM "users" u
WHERE NOT EXISTS (
  SELECT 1 FROM "memberships" m
  WHERE m."user_id" = u."id"
    AND m."organization_id" = u."id"
);

UPDATE "projects"
SET "organization_id" = "user_id"
WHERE "organization_id" IS NULL OR "organization_id" = '';

UPDATE "documents"
SET "organization_id" = "user_id"
WHERE "organization_id" IS NULL OR "organization_id" = '';
