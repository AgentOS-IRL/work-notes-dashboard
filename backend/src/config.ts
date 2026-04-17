import path from 'node:path';

export const defaultDatabasePath = path.resolve(process.cwd(), 'data', 'notes.sqlite');

export function resolveDatabasePath(databasePath = process.env.SQLITE_DB_PATH ?? defaultDatabasePath) {
  return path.resolve(databasePath);
}
