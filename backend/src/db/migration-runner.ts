import fs from 'node:fs';
import path from 'node:path';
import type { SqliteDatabase } from './sqlite';

const MIGRATIONS_TABLE = '_migrations';
const MIGRATION_DIRECTORY = path.join(__dirname, 'migrations');
const TIMESTAMP_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_chat_sessions_last_activity_at
    ON chat_sessions(lastActivityAt);

  CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at
    ON chat_messages(createdAt);
`;

function ensureMigrationTable(database: SqliteDatabase) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      executed_at INTEGER NOT NULL
    );
  `);
}

function listAppliedMigrations(database: SqliteDatabase) {
  const rows = database.prepare(`SELECT name FROM ${MIGRATIONS_TABLE}`).all() as Array<{
    name: string;
  }>;

  return new Set(rows.map((row) => row.name));
}

function listTableColumns(database: SqliteDatabase, tableName: string) {
  return database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
    name: string;
  }>;
}

function hasColumns(database: SqliteDatabase, tableName: string, columnNames: string[]) {
  const columns = new Set(listTableColumns(database, tableName).map((column) => column.name));
  return columnNames.every((columnName) => columns.has(columnName));
}

function listMigrationFiles() {
  if (!fs.existsSync(MIGRATION_DIRECTORY)) {
    return [];
  }

  return fs
    .readdirSync(MIGRATION_DIRECTORY)
    .filter((fileName) => fileName.endsWith('.sql'))
    .sort();
}

export function runMigrations(database: SqliteDatabase) {
  ensureMigrationTable(database);

  const migrationFiles = listMigrationFiles();
  if (migrationFiles.length === 0) {
    return;
  }

  const appliedMigrations = listAppliedMigrations(database);
  const insertMigration = database.prepare(
    `INSERT INTO ${MIGRATIONS_TABLE} (name, executed_at) VALUES (?, ?)`
  );

  const executeMigration = database.transaction((fileName: string, sql: string) => {
    database.exec(sql);
    insertMigration.run(fileName, Date.now());
  });

  const skipTimestampMigration = database.transaction((fileName: string) => {
    database.exec(TIMESTAMP_INDEXES);
    insertMigration.run(fileName, Date.now());
  });

  for (const fileName of migrationFiles) {
    if (appliedMigrations.has(fileName)) {
      continue;
    }

    const sql = fs.readFileSync(path.join(MIGRATION_DIRECTORY, fileName), 'utf8');

    if (fileName === '002_add_timestamps.sql') {
      const hasTimestampColumns =
        hasColumns(database, 'chat_sessions', ['createdAt', 'lastActivityAt']) &&
        hasColumns(database, 'chat_messages', ['createdAt']);

      if (hasTimestampColumns) {
        skipTimestampMigration(fileName);
        console.log(`Applied migration: ${fileName}`);
        continue;
      }
    }

    executeMigration(fileName, sql);
    console.log(`Applied migration: ${fileName}`);
  }
}
