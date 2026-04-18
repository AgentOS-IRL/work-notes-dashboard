-- Compatibility no-op.
-- Legacy databases may keep existing chat_sessions.toolCalls values, but new
-- installs no longer create the column on chat_sessions. The repository keeps
-- reading the legacy column when it exists so existing tool-call history stays
-- visible after upgrade.
SELECT 1;
