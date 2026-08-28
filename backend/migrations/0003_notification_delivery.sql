-- Durable WebSocket delivery queue. Pending alerts survive API restarts.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS delivery_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS next_delivery_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_notifications_pending_delivery ON notifications (next_delivery_at) WHERE delivered_at IS NULL;
