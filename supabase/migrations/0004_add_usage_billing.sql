-- Usage Tracking & Billing System tables

-- Enhanced usage_events table for comprehensive tracking
CREATE TABLE IF NOT EXISTS usage_events (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL, -- generation, embedding, clarification, export, upload
    provider TEXT NOT NULL, -- openai, anthropic, internal
    model TEXT, -- gpt-4, claude-3, text-embedding-3-small
    tokens_input INTEGER DEFAULT 0,
    tokens_output INTEGER DEFAULT 0,
    cost_usd DECIMAL(10,6) DEFAULT 0.0,
    processing_time_ms INTEGER,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Budget settings for organizations
CREATE TABLE budget_settings (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER UNIQUE NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    monthly_budget_usd DECIMAL(10,2) DEFAULT 0.0,
    alert_threshold_50 BOOLEAN DEFAULT true,
    alert_threshold_80 BOOLEAN DEFAULT true,
    alert_threshold_100 BOOLEAN DEFAULT true,
    auto_stop_at_limit BOOLEAN DEFAULT false,
    notification_emails TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Budget alerts tracking
CREATE TABLE budget_alerts (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL, -- threshold_50, threshold_80, threshold_100, spike_detected
    threshold_percentage INTEGER,
    current_usage_usd DECIMAL(10,6),
    budget_limit_usd DECIMAL(10,2),
    alert_sent BOOLEAN DEFAULT false,
    acknowledged BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Usage snapshots for historical tracking
CREATE TABLE usage_snapshots (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL,
    period_type TEXT DEFAULT 'daily', -- daily, weekly, monthly
    total_tokens INTEGER DEFAULT 0,
    total_cost_usd DECIMAL(10,6) DEFAULT 0.0,
    event_counts JSONB DEFAULT '{}', -- counts by event type
    provider_breakdown JSONB DEFAULT '{}', -- costs by provider
    top_projects JSONB DEFAULT '[]', -- highest usage projects
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, snapshot_date, period_type)
);

-- Plan definitions and limits
CREATE TABLE subscription_plans (
    id SERIAL PRIMARY KEY,
    plan_name TEXT UNIQUE NOT NULL, -- starter, pro, team, enterprise
    display_name TEXT NOT NULL,
    monthly_price_usd DECIMAL(10,2) NOT NULL,
    limits JSONB NOT NULL, -- projects, documents, ai_credits, team_members
    features JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Organization subscriptions
CREATE TABLE organization_subscriptions (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER UNIQUE NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_id INTEGER NOT NULL REFERENCES subscription_plans(id),
    status TEXT DEFAULT 'active', -- active, cancelled, past_due, trialing
    current_period_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    current_period_end TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '1 month',
    cancel_at_period_end BOOLEAN DEFAULT false,
    stripe_subscription_id TEXT,
    stripe_customer_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Usage optimization recommendations
CREATE TABLE optimization_recommendations (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    recommendation_type TEXT NOT NULL, -- cost_reduction, efficiency_improvement, plan_optimization
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    potential_savings_usd DECIMAL(10,6),
    effort_level TEXT DEFAULT 'medium', -- low, medium, high
    priority_score DECIMAL(4,3) DEFAULT 0.5,
    is_implemented BOOLEAN DEFAULT false,
    implementation_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS usage_events_org_id_created_at_idx ON usage_events(organization_id, created_at);
CREATE INDEX IF NOT EXISTS usage_events_project_id_idx ON usage_events(project_id);
CREATE INDEX IF NOT EXISTS usage_events_event_type_idx ON usage_events(event_type);
CREATE INDEX IF NOT EXISTS usage_snapshots_org_date_idx ON usage_snapshots(organization_id, snapshot_date);
CREATE INDEX IF NOT EXISTS budget_alerts_org_id_idx ON budget_alerts(organization_id);
CREATE INDEX IF NOT EXISTS optimization_recommendations_org_id_idx ON optimization_recommendations(organization_id);

-- Insert default subscription plans
INSERT INTO subscription_plans (plan_name, display_name, monthly_price_usd, limits, features) VALUES
('starter', 'Starter (Free)', 0.00, '{"projects": 3, "documents": 25, "ai_credits": 100000, "team_members": 1}', '["basic_generation", "pdf_export", "email_support"]'),
('pro', 'Pro', 29.00, '{"projects": 15, "documents": 200, "ai_credits": 1000000, "team_members": 5}', '["advanced_generation", "all_exports", "priority_support", "analytics"]'),
('team', 'Team', 99.00, '{"projects": 50, "documents": 1000, "ai_credits": 5000000, "team_members": 25}', '["team_collaboration", "custom_templates", "advanced_analytics", "sso"]'),
('enterprise', 'Enterprise', 299.00, '{"projects": -1, "documents": -1, "ai_credits": -1, "team_members": -1}', '["unlimited_everything", "dedicated_support", "custom_integrations", "on_premise"]')
ON CONFLICT (plan_name) DO NOTHING;

-- Function to check plan limits
CREATE OR REPLACE FUNCTION check_plan_limit(
    org_id_param INTEGER,
    limit_type TEXT, -- projects, documents, ai_credits, team_members
    requested_amount INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
    current_plan JSONB;
    limit_value INTEGER;
    current_usage INTEGER;
BEGIN
    -- Get current plan limits
    SELECT sp.limits INTO current_plan
    FROM organization_subscriptions os
    JOIN subscription_plans sp ON os.plan_id = sp.id
    WHERE os.organization_id = org_id_param AND os.status = 'active';
    
    IF current_plan IS NULL THEN
        RETURN false; -- No active subscription
    END IF;
    
    limit_value := (current_plan ->> limit_type)::INTEGER;
    
    -- -1 means unlimited
    IF limit_value = -1 THEN
        RETURN true;
    END IF;
    
    -- Calculate current usage based on limit type
    CASE limit_type
        WHEN 'projects' THEN
            SELECT COUNT(*) INTO current_usage FROM projects WHERE org_id = org_id_param;
        WHEN 'documents' THEN
            SELECT COUNT(*) INTO current_usage FROM documents WHERE org_id = org_id_param;
        WHEN 'ai_credits' THEN
            SELECT COALESCE(SUM(tokens_input + tokens_output), 0) INTO current_usage 
            FROM usage_events 
            WHERE organization_id = org_id_param 
            AND created_at >= date_trunc('month', NOW());
        WHEN 'team_members' THEN
            SELECT COUNT(*) INTO current_usage FROM memberships WHERE org_id = org_id_param;
        ELSE
            RETURN false;
    END CASE;
    
    RETURN (current_usage + requested_amount) <= limit_value;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate monthly usage and costs
CREATE OR REPLACE FUNCTION calculate_monthly_usage(org_id_param INTEGER, month_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
    total_tokens BIGINT,
    total_cost_usd DECIMAL(10,6),
    event_breakdown JSONB,
    daily_average DECIMAL(10,6)
) AS $$
DECLARE
    start_date DATE;
    end_date DATE;
BEGIN
    start_date := date_trunc('month', month_date)::DATE;
    end_date := (date_trunc('month', month_date) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
    
    RETURN QUERY
    SELECT 
        COALESCE(SUM(ue.tokens_input + ue.tokens_output), 0) as total_tokens,
        COALESCE(SUM(ue.cost_usd), 0.0) as total_cost_usd,
        COALESCE(
            jsonb_object_agg(
                ue.event_type, 
                jsonb_build_object(
                    'count', COUNT(*),
                    'tokens', SUM(ue.tokens_input + ue.tokens_output),
                    'cost', SUM(ue.cost_usd)
                )
            ), 
            '{}'::jsonb
        ) as event_breakdown,
        ROUND(COALESCE(SUM(ue.cost_usd), 0.0) / EXTRACT(day FROM end_date - start_date + 1), 6) as daily_average
    FROM usage_events ue
    WHERE ue.organization_id = org_id_param
    AND ue.created_at::DATE BETWEEN start_date AND end_date;
END;
$$ LANGUAGE plpgsql;