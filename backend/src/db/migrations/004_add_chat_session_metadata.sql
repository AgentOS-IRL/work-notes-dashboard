ALTER TABLE chat_sessions
ADD COLUMN metadata TEXT NOT NULL DEFAULT '{}';

UPDATE chat_sessions
SET metadata = '{}'
WHERE metadata IS NULL OR trim(metadata) = '';
