-- Compatibility no-op.
-- Legacy databases may keep existing chat_sessions.toolCalls values, but new
-- installs no longer create the column on chat_sessions.
SELECT 1;
