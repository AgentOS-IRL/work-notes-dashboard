import fs from 'node:fs';
import path from 'node:path';
import Database = require('better-sqlite3');

type SqliteDatabase = InstanceType<typeof Database>;

export type { SqliteDatabase };

export function openSqliteDatabase(databasePath: string) {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  return new Database(databasePath);
}

function tableHasColumn(database: SqliteDatabase, tableName: string, columnName: string) {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
    name: string;
  }>;

  return columns.some((column) => column.name === columnName);
}

export function initializeSqliteDatabase(database: SqliteDatabase) {
  database.pragma('foreign_keys = ON');
  database.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      name TEXT,
      lastActivityAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sessionId TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (sessionId) REFERENCES chat_sessions(id) ON DELETE CASCADE
    );
  `);

  if (!tableHasColumn(database, 'chat_sessions', 'lastActivityAt')) {
    database.exec(`
      ALTER TABLE chat_sessions
      ADD COLUMN lastActivityAt INTEGER NOT NULL DEFAULT 0;
    `);
  }

  if (!tableHasColumn(database, 'chat_messages', 'createdAt')) {
    database.exec(`
      ALTER TABLE chat_messages
      ADD COLUMN createdAt INTEGER NOT NULL DEFAULT 0;
    `);
  }

  const migrationTimestamp = Date.now();
  database
    .prepare('UPDATE chat_sessions SET lastActivityAt = ? WHERE lastActivityAt = 0')
    .run(migrationTimestamp);
  database
    .prepare('UPDATE chat_messages SET createdAt = ? WHERE createdAt = 0')
    .run(migrationTimestamp);

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_chat_sessions_last_activity_at
      ON chat_sessions(lastActivityAt);

    CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at
      ON chat_messages(createdAt);
  `);
}
