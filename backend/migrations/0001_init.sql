-- Baselium+ initial schema
-- Source of truth: schema.dbml / README.md ERD

CREATE TABLE accounts (
    account_id      SERIAL PRIMARY KEY,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(20)  NOT NULL CHECK (role IN ('caregiver', 'elder', 'family')),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login      TIMESTAMPTZ
);

CREATE TABLE users ( -- elders
    user_id         SERIAL PRIMARY KEY,
    account_id      INTEGER NOT NULL UNIQUE REFERENCES accounts(account_id) ON DELETE CASCADE,
    full_name       VARCHAR(255) NOT NULL,
    date_of_birth   DATE,
    gender          VARCHAR(20),
    address         TEXT,
    contact_number  VARCHAR(50),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE caregivers (
    caregiver_id    SERIAL PRIMARY KEY,
    account_id      INTEGER NOT NULL UNIQUE REFERENCES accounts(account_id) ON DELETE CASCADE,
    full_name       VARCHAR(255) NOT NULL,
    contact_number  VARCHAR(50),
    relationship    VARCHAR(100),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE family_access (
    family_id       SERIAL PRIMARY KEY,
    account_id      INTEGER NOT NULL UNIQUE REFERENCES accounts(account_id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    full_name       VARCHAR(255) NOT NULL,
    relationship    VARCHAR(100),
    granted_by      INTEGER REFERENCES caregivers(caregiver_id),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_caregiver (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    caregiver_id    INTEGER NOT NULL REFERENCES caregivers(caregiver_id) ON DELETE CASCADE,
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (user_id, caregiver_id)
);

CREATE TABLE check_ins (
    checkin_id      SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    checkin_time    TIMESTAMPTZ NOT NULL DEFAULT now(),
    mood            INTEGER CHECK (mood BETWEEN 1 AND 5),
    activity_level  INTEGER CHECK (activity_level BETWEEN 1 AND 5),
    notes           TEXT,
    context_note    TEXT,
    is_missed       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_checkins_user_time ON check_ins (user_id, checkin_time DESC);

CREATE TABLE behavioral_baselines (
    baseline_id         SERIAL PRIMARY KEY,
    user_id              INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    avg_mood_score       DOUBLE PRECISION,
    avg_activity_level   DOUBLE PRECISION,
    stddev_mood          DOUBLE PRECISION,
    stddev_activity      DOUBLE PRECISION,
    checkin_frequency    DOUBLE PRECISION, -- fraction of expected checkins submitted
    sample_size          INTEGER NOT NULL DEFAULT 0,
    period_days          INTEGER NOT NULL DEFAULT 7,
    is_cold_start         BOOLEAN NOT NULL DEFAULT FALSE,
    is_active            BOOLEAN NOT NULL DEFAULT TRUE,
    computed_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Only one active baseline per elder (D11)
CREATE UNIQUE INDEX uniq_active_baseline_per_user ON behavioral_baselines (user_id) WHERE is_active;

CREATE TABLE anomalies (
    anomaly_id          SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    baseline_id         INTEGER REFERENCES behavioral_baselines(baseline_id),
    checkin_id          INTEGER REFERENCES check_ins(checkin_id),
    anomaly_type        VARCHAR(30) NOT NULL CHECK (anomaly_type IN
                            ('mood_deviation','activity_deviation','frequency_deviation','missed_checkin')),
    severity             VARCHAR(10) NOT NULL CHECK (severity IN ('low','medium','high')),
    deviation_metric      VARCHAR(30),
    deviation_magnitude   DOUBLE PRECISION,
    duration_days         INTEGER NOT NULL DEFAULT 1,
    detected_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_resolved            BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX idx_anomalies_user ON anomalies (user_id, detected_at DESC);

CREATE TABLE notifications (
    notification_id     SERIAL PRIMARY KEY,
    anomaly_id           INTEGER NOT NULL REFERENCES anomalies(anomaly_id) ON DELETE CASCADE,
    caregiver_id          INTEGER NOT NULL REFERENCES caregivers(caregiver_id) ON DELETE CASCADE,
    message                TEXT NOT NULL,
    sent_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_read                 BOOLEAN NOT NULL DEFAULT FALSE,
    acknowledged_at          TIMESTAMPTZ,
    acknowledged_by          INTEGER REFERENCES caregivers(caregiver_id) -- D7: who actually acked
);

CREATE TABLE health_notes (
    note_id         SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    caregiver_id    INTEGER NOT NULL REFERENCES caregivers(caregiver_id) ON DELETE CASCADE,
    note_text       TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
    log_id         SERIAL PRIMARY KEY,
    account_id     INTEGER REFERENCES accounts(account_id),
    action         VARCHAR(50) NOT NULL, -- view_checkin, export_report, acknowledge_alert, ...
    target_type    VARCHAR(50),
    target_id      INTEGER,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
