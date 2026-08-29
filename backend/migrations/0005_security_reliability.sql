-- Short-lived access tokens are paired with rotating, server-revocable refresh sessions.
CREATE TABLE refresh_tokens (
    refresh_token_id SERIAL PRIMARY KEY,
    account_id       INTEGER NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
    token_hash       CHAR(64) NOT NULL UNIQUE,
    expires_at       TIMESTAMPTZ NOT NULL,
    revoked_at       TIMESTAMPTZ,
    replaced_by      INTEGER REFERENCES refresh_tokens(refresh_token_id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_tokens_active ON refresh_tokens (account_id, expires_at) WHERE revoked_at IS NULL;

-- Keep failures only: this avoids retaining successful-login telemetry unnecessarily.
CREATE TABLE login_failures (
    failure_id   SERIAL PRIMARY KEY,
    email        VARCHAR(255) NOT NULL,
    remote_addr  VARCHAR(255) NOT NULL,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_login_failures_email_time ON login_failures (email, attempted_at DESC);
CREATE INDEX idx_login_failures_addr_time ON login_failures (remote_addr, attempted_at DESC);

-- Immutable delivery evidence for SLA review. `error_detail` is populated for failures.
CREATE TABLE notification_delivery_attempts (
    delivery_attempt_id SERIAL PRIMARY KEY,
    notification_id     INTEGER NOT NULL REFERENCES notifications(notification_id) ON DELETE CASCADE,
    attempted_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    delivered           BOOLEAN NOT NULL,
    error_detail        TEXT
);
CREATE INDEX idx_delivery_attempts_notification_time ON notification_delivery_attempts (notification_id, attempted_at DESC);
