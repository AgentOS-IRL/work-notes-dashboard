ALTER TABLE chat_sessions
ADD COLUMN createdAt INTEGER NOT NULL DEFAULT 0;

ALTER TABLE chat_sessions
ADD COLUMN lastActivityAt INTEGER NOT NULL DEFAULT 0;

ALTER TABLE chat_messages
ADD COLUMN createdAt INTEGER NOT NULL DEFAULT 0;

UPDATE chat_sessions
SET lastActivityAt = strftime('%s', 'now') * 1000
WHERE lastActivityAt = 0;

UPDATE chat_sessions
SET createdAt = lastActivityAt
WHERE createdAt = 0;

UPDATE chat_messages
SET createdAt = strftime('%s', 'now') * 1000
WHERE createdAt = 0;

CREATE INDEX IF NOT EXISTS idx_chat_sessions_last_activity_at
  ON chat_sessions(lastActivityAt);

CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at
  ON chat_messages(createdAt);
