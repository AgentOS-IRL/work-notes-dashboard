import fs from 'node:fs';
import path from 'node:path';
import Database = require('better-sqlite3');
import { runMigrations } from './migration-runner';

type SqliteDatabase = InstanceType<typeof Database>;

export type { SqliteDatabase };

export function openSqliteDatabase(databasePath: string) {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  return new Database(databasePath);
}

export function initializeSqliteDatabase(database: SqliteDatabase) {
  database.pragma('foreign_keys = ON');
  runMigrations(database);
}
