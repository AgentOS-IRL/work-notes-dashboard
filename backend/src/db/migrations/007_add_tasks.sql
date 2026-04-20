CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('todo', 'backlog', 'in progress', 'completed')
  ),
  note_ids TEXT NOT NULL DEFAULT '[]'
);
