CREATE TABLE IF NOT EXISTS "subscriptions" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" varchar NOT NULL,
  "plan" text DEFAULT 'starter' NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "current_period_start" timestamp DEFAULT now(),
  "current_period_end" timestamp NOT NULL DEFAULT (now() + interval '1 month'),
  "cancel_at_period_end" boolean DEFAULT false,
  "stripe_subscription_id" text,
  "stripe_customer_id" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "usage_events" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" varchar NOT NULL,
  "user_id" varchar,
  "project_id" varchar,
  "type" text NOT NULL,
  "provider" text DEFAULT 'internal' NOT NULL,
  "model" text,
  "tokens_in" integer DEFAULT 0,
  "tokens_out" integer DEFAULT 0,
  "cost_cents" integer DEFAULT 0,
  "metadata" jsonb DEFAULT '{}',
  "created_at" timestamp DEFAULT now()
);

ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "current_period_start" timestamp DEFAULT now();
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "current_period_end" timestamp NOT NULL DEFAULT (now() + interval '1 month');
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "cancel_at_period_end" boolean DEFAULT false;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "stripe_subscription_id" text;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "stripe_customer_id" text;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();

ALTER TABLE "usage_events" ADD COLUMN IF NOT EXISTS "user_id" varchar;
ALTER TABLE "usage_events" ADD COLUMN IF NOT EXISTS "provider" text DEFAULT 'internal' NOT NULL;
ALTER TABLE "usage_events" ADD COLUMN IF NOT EXISTS "model" text;
ALTER TABLE "usage_events" ADD COLUMN IF NOT EXISTS "cost_cents" integer DEFAULT 0;
ALTER TABLE "usage_events" ADD COLUMN IF NOT EXISTS "metadata" jsonb DEFAULT '{}';

DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'usage_events'
      AND column_name = 'cost'
  ) THEN
    EXECUTE 'UPDATE "usage_events" SET "cost_cents" = "cost" WHERE "cost_cents" = 0';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_organization_id_unique_idx"
  ON "subscriptions" ("organization_id");

CREATE INDEX IF NOT EXISTS "usage_events_organization_created_idx"
  ON "usage_events" ("organization_id", "created_at");

CREATE INDEX IF NOT EXISTS "usage_events_project_id_idx"
  ON "usage_events" ("project_id");

DO $$ BEGIN
  ALTER TABLE "subscriptions"
    ADD CONSTRAINT "subscriptions_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "usage_events"
    ADD CONSTRAINT "usage_events_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "usage_events"
    ADD CONSTRAINT "usage_events_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "usage_events"
    ADD CONSTRAINT "usage_events_project_id_projects_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
