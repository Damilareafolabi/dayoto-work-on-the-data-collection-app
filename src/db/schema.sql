-- =========================================================================
-- CMRG DATACOLLECT - PRODUCTION POSTGRESQL & POSTGIS DATABASE SCHEMA
-- Compatible with PostgreSQL 15+, Neon, Supabase, and Google Cloud SQL
-- Designed for High Availability, Spatial Indexing, and Enterprise Auditing
-- =========================================================================

-- Enable PostGIS extension for spatial analysis (if available)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- CREATE EXTENSION IF NOT EXISTS "postgis"; -- Uncomment if PostGIS extension is installed

-- 1. Projects and Organizations
CREATE TABLE IF NOT EXISTS cmrg_projects (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    organization VARCHAR(255) DEFAULT 'Communication and Marketing Research Group',
    status VARCHAR(32) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'paused')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Enumerators & Field Staff Profiles
CREATE TABLE IF NOT EXISTS cmrg_enumerators (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(64),
    region VARCHAR(128) NOT NULL,
    device_id VARCHAR(128) NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    total_submissions INTEGER DEFAULT 0,
    current_lat DOUBLE PRECISION,
    current_lng DOUBLE PRECISION,
    battery_level INTEGER,
    last_active_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Form Definitions (CMRG Questionnaires & JSON Schemas)
CREATE TABLE IF NOT EXISTS cmrg_forms (
    id VARCHAR(64) PRIMARY KEY,
    form_id VARCHAR(128) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    version VARCHAR(32) NOT NULL,
    description TEXT,
    category VARCHAR(64) DEFAULT 'General Fieldwork',
    schema_json JSONB NOT NULL,
    is_encrypted BOOLEAN DEFAULT FALSE,
    public_key TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. Central Survey Submissions (Universal Encrypted & Plain Table)
CREATE TABLE IF NOT EXISTS cmrg_submissions (
    id VARCHAR(64) PRIMARY KEY,
    instance_id VARCHAR(128) UNIQUE NOT NULL,
    form_id VARCHAR(128) NOT NULL REFERENCES cmrg_forms(form_id) ON DELETE CASCADE,
    form_title VARCHAR(255) NOT NULL,
    form_version VARCHAR(32) NOT NULL,
    enumerator_id VARCHAR(64) REFERENCES cmrg_enumerators(id) ON DELETE SET NULL,
    enumerator_name VARCHAR(255) NOT NULL,
    device_id VARCHAR(128) NOT NULL,
    status VARCHAR(32) DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'synced', 'flagged')),
    answers JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_encrypted BOOLEAN DEFAULT FALSE,
    encrypted_envelope JSONB,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    altitude DOUBLE PRECISION,
    accuracy DOUBLE PRECISION,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    audio_audit_recorded BOOLEAN DEFAULT FALSE,
    flag_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    synced_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. Normalized Question Responses for Fast Relational & Analytical Queries
CREATE TABLE IF NOT EXISTS cmrg_responses (
    id BIGSERIAL PRIMARY KEY,
    submission_id VARCHAR(64) NOT NULL REFERENCES cmrg_submissions(id) ON DELETE CASCADE,
    form_id VARCHAR(128) NOT NULL,
    question_name VARCHAR(128) NOT NULL,
    question_type VARCHAR(32) NOT NULL,
    response_text TEXT,
    response_numeric DOUBLE PRECISION,
    response_json JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 6. High-Frequency Audit Logs (Speed Audits, Sensor Telemetry)
CREATE TABLE IF NOT EXISTS cmrg_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    submission_id VARCHAR(64) REFERENCES cmrg_submissions(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL,
    enumerator_id VARCHAR(64),
    severity VARCHAR(32) DEFAULT 'low',
    message TEXT NOT NULL,
    payload JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- INDEXES FOR ADVANCED QUERY PERFORMANCE
-- =========================================================================

CREATE INDEX IF NOT EXISTS idx_submissions_form_id ON cmrg_submissions(form_id);
CREATE INDEX IF NOT EXISTS idx_submissions_enumerator_id ON cmrg_submissions(enumerator_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON cmrg_submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON cmrg_submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_answers_gin ON cmrg_submissions USING GIN (answers);
CREATE INDEX IF NOT EXISTS idx_submissions_coords ON cmrg_submissions (latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_responses_lookup ON cmrg_responses(form_id, question_name);
CREATE INDEX IF NOT EXISTS idx_responses_numeric ON cmrg_responses(response_numeric) WHERE response_numeric IS NOT NULL;

-- =========================================================================
-- SITUATION ROOM ANALYTICAL VIEWS
-- =========================================================================

-- View 1: Real-time Field Productivity & Speed Anomaly Detection
CREATE OR REPLACE VIEW v_situation_room_kpis AS
SELECT
    f.form_id,
    f.title AS form_title,
    COUNT(s.id) AS total_submissions,
    COUNT(s.id) FILTER (WHERE s.status = 'synced') AS synced_count,
    COUNT(s.id) FILTER (WHERE s.status = 'flagged') AS flagged_count,
    ROUND(AVG(s.duration_seconds)::numeric, 1) AS avg_duration_seconds,
    ROUND(MIN(s.duration_seconds)::numeric, 1) AS min_duration_seconds,
    ROUND(MAX(s.duration_seconds)::numeric, 1) AS max_duration_seconds,
    COUNT(DISTINCT s.enumerator_id) AS active_enumerators_count
FROM cmrg_forms f
LEFT JOIN cmrg_submissions s ON f.form_id = s.form_id
GROUP BY f.form_id, f.title;

-- View 2: Enumerator Daily Velocity and Performance Leaderboard
CREATE OR REPLACE VIEW v_enumerator_velocity AS
SELECT
    e.id AS enumerator_id,
    e.name AS enumerator_name,
    e.region,
    COUNT(s.id) AS completed_interviews,
    ROUND(AVG(s.duration_seconds)::numeric, 1) AS avg_interview_time_secs,
    COUNT(s.id) FILTER (WHERE s.duration_seconds < 120) AS rushed_interviews_flagged,
    e.battery_level,
    e.last_active_at
FROM cmrg_enumerators e
LEFT JOIN cmrg_submissions s ON e.id = s.enumerator_id
GROUP BY e.id, e.name, e.region, e.battery_level, e.last_active_at
ORDER BY completed_interviews DESC;
