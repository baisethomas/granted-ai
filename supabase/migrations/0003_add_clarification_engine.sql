-- Clarification Engine tables for intelligent question-asking system

-- Clarification sessions to track Q&A workflows
CREATE TABLE clarification_sessions (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    session_type TEXT DEFAULT 'initial', -- initial, follow_up, assumption_resolution
    status TEXT DEFAULT 'active', -- active, completed, abandoned
    total_questions INTEGER DEFAULT 0,
    answered_questions INTEGER DEFAULT 0,
    completion_rate DECIMAL(4,3) DEFAULT 0.0,
    quality_improvement_score DECIMAL(4,3) DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- Individual clarification questions
CREATE TABLE clarification_questions (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES clarification_sessions(id) ON DELETE CASCADE,
    question_category TEXT NOT NULL, -- budget, timeline, outcomes, methodology, team, sustainability, evidence, specificity
    priority_level TEXT NOT NULL, -- critical, high, medium, low
    question_text TEXT NOT NULL,
    context_explanation TEXT,
    example_answer TEXT,
    related_grant_questions JSONB DEFAULT '[]',
    is_answered BOOLEAN DEFAULT false,
    answer_text TEXT,
    answer_quality_score DECIMAL(4,3) DEFAULT 0.0,
    follow_up_needed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    answered_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- Clarification answers with metadata
CREATE TABLE clarification_answers (
    id SERIAL PRIMARY KEY,
    question_id INTEGER NOT NULL REFERENCES clarification_questions(id) ON DELETE CASCADE,
    answer_text TEXT NOT NULL,
    confidence_level TEXT DEFAULT 'medium', -- low, medium, high
    completeness_score DECIMAL(4,3) DEFAULT 0.0,
    specificity_score DECIMAL(4,3) DEFAULT 0.0,
    evidence_provided BOOLEAN DEFAULT false,
    requires_follow_up BOOLEAN DEFAULT false,
    follow_up_questions JSONB DEFAULT '[]',
    integration_status TEXT DEFAULT 'pending', -- pending, integrated, rejected
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Assumption tracking and resolution
CREATE TABLE assumption_tracking (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    content_section TEXT NOT NULL,
    assumption_text TEXT NOT NULL,
    assumption_type TEXT NOT NULL, -- factual, methodological, financial, temporal
    confidence_level DECIMAL(4,3) DEFAULT 0.5,
    resolution_question TEXT,
    is_resolved BOOLEAN DEFAULT false,
    resolution_answer TEXT,
    impact_on_quality DECIMAL(4,3) DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- Gap analysis results for future reference
CREATE TABLE gap_analysis_results (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    analysis_type TEXT DEFAULT 'comprehensive', -- comprehensive, focused, follow_up
    identified_gaps JSONB NOT NULL, -- array of gap objects with categories and severity
    question_count INTEGER DEFAULT 0,
    critical_gaps_count INTEGER DEFAULT 0,
    analysis_confidence DECIMAL(4,3) DEFAULT 0.0,
    recommendations JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quality metrics tracking
CREATE TABLE clarification_quality_metrics (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES clarification_sessions(id) ON DELETE CASCADE,
    before_metrics JSONB NOT NULL, -- quality scores before clarification
    after_metrics JSONB NOT NULL, -- quality scores after clarification
    improvement_areas JSONB DEFAULT '[]',
    assumption_reduction_count INTEGER DEFAULT 0,
    specificity_improvement DECIMAL(4,3) DEFAULT 0.0,
    evidence_integration_count INTEGER DEFAULT 0,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS clarification_sessions_project_id_idx ON clarification_sessions(project_id);
CREATE INDEX IF NOT EXISTS clarification_sessions_status_idx ON clarification_sessions(status);
CREATE INDEX IF NOT EXISTS clarification_questions_session_id_idx ON clarification_questions(session_id);
CREATE INDEX IF NOT EXISTS clarification_questions_category_idx ON clarification_questions(question_category);
CREATE INDEX IF NOT EXISTS clarification_answers_question_id_idx ON clarification_answers(question_id);
CREATE INDEX IF NOT EXISTS assumption_tracking_project_id_idx ON assumption_tracking(project_id);
CREATE INDEX IF NOT EXISTS assumption_tracking_is_resolved_idx ON assumption_tracking(is_resolved);

-- Function to calculate clarification completion rate
CREATE OR REPLACE FUNCTION update_clarification_completion_rate(session_id_param INTEGER)
RETURNS VOID AS $$
DECLARE
    total_questions INTEGER;
    answered_questions INTEGER;
    completion_rate DECIMAL(4,3);
BEGIN
    SELECT COUNT(*) INTO total_questions 
    FROM clarification_questions 
    WHERE session_id = session_id_param;
    
    SELECT COUNT(*) INTO answered_questions 
    FROM clarification_questions 
    WHERE session_id = session_id_param AND is_answered = true;
    
    IF total_questions = 0 THEN
        completion_rate := 0.0;
    ELSE
        completion_rate := ROUND((answered_questions::DECIMAL / total_questions::DECIMAL), 3);
    END IF;
    
    UPDATE clarification_sessions 
    SET 
        total_questions = total_questions,
        answered_questions = answered_questions,
        completion_rate = completion_rate,
        updated_at = NOW()
    WHERE id = session_id_param;
    
    -- Mark session as completed if all questions answered
    IF completion_rate >= 1.0 THEN
        UPDATE clarification_sessions 
        SET status = 'completed', completed_at = NOW()
        WHERE id = session_id_param;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to get top gap categories for an organization
CREATE OR REPLACE FUNCTION get_top_gap_categories(org_id_param INTEGER, limit_param INTEGER DEFAULT 5)
RETURNS TABLE (
    category TEXT,
    occurrence_count BIGINT,
    avg_severity DECIMAL(4,3)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cq.question_category as category,
        COUNT(*) as occurrence_count,
        ROUND(AVG(
            CASE cq.priority_level 
                WHEN 'critical' THEN 1.0 
                WHEN 'high' THEN 0.8 
                WHEN 'medium' THEN 0.6 
                ELSE 0.4 
            END
        ), 3) as avg_severity
    FROM clarification_questions cq
    JOIN clarification_sessions cs ON cq.session_id = cs.id
    WHERE cs.organization_id = org_id_param
    GROUP BY cq.question_category
    ORDER BY occurrence_count DESC, avg_severity DESC
    LIMIT limit_param;
END;
$$ LANGUAGE plpgsql;