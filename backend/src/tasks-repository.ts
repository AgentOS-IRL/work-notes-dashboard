import type { SqliteDatabase } from './db/sqlite';

export type TaskStatus = 'todo' | 'backlog' | 'in progress' | 'completed';

export interface Task {
  id: number;
  name: string;
  status: TaskStatus;
  noteIds: string[];
}

export interface TaskInput {
  name: unknown;
  status: unknown;
}

export class ValidationError extends Error {
  readonly statusCode = 400;
}

export class NotFoundError extends Error {
  readonly statusCode = 404;
}

const TASK_STATUS_ORDER: TaskStatus[] = ['in progress', 'todo', 'backlog', 'completed'];
const TASK_STATUSES = new Set<TaskStatus>(TASK_STATUS_ORDER);

function assertPositiveInteger(value: number, message = 'A valid task id is required.') {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ValidationError(message);
  }
}

function normalizeStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const entry of value) {
    if (typeof entry !== 'string') {
      continue;
    }

    const trimmed = entry.trim();
    if (trimmed === '' || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
}

function normalizeTaskStatus(value: unknown) {
  if (typeof value !== 'string') {
    throw new ValidationError('A valid task status is required.');
  }

  const trimmed = value.trim();
  if (!TASK_STATUSES.has(trimmed as TaskStatus)) {
    throw new ValidationError('A valid task status is required.');
  }

  return trimmed as TaskStatus;
}

function normalizeTaskInput(input: TaskInput) {
  if (typeof input.name !== 'string') {
    throw new ValidationError('A task name is required.');
  }

  const name = input.name.trim();
  if (name === '') {
    throw new ValidationError('A task name is required.');
  }

  return {
    name,
    status: normalizeTaskStatus(input.status)
  };
}

function parseTaskNoteIds(rawValue: unknown) {
  const parsedValue =
    typeof rawValue === 'string'
      ? (() => {
          if (rawValue.trim() === '') {
            return null;
          }

          try {
            return JSON.parse(rawValue) as unknown;
          } catch {
            return null;
          }
        })()
      : rawValue;

  return normalizeStringList(parsedValue);
}

function toTask(row: unknown): Task {
  const task = row as
    | (Pick<Task, 'id' | 'name' | 'status'> & { note_ids?: unknown })
    | undefined;

  if (!task) {
    throw new Error('Expected a task row.');
  }

  return {
    id: task.id,
    name: task.name,
    status: task.status as TaskStatus,
    noteIds: parseTaskNoteIds(task.note_ids)
  };
}

export class TasksRepository {
  constructor(private readonly database: SqliteDatabase) {}

  listTasks(): Task[] {
    return this.database
      .prepare(
        `
          SELECT id, name, status, note_ids
          FROM tasks
          ORDER BY
            CASE status
              WHEN 'in progress' THEN 0
              WHEN 'todo' THEN 1
              WHEN 'backlog' THEN 2
              WHEN 'completed' THEN 3
              ELSE 4
            END,
            id ASC
        `
      )
      .all()
      .map((row) => toTask(row));
  }

  getTaskById(id: number): Task | null {
    assertPositiveInteger(id);

    const task = this.database
      .prepare('SELECT id, name, status, note_ids FROM tasks WHERE id = ?')
      .get(id);

    return task ? toTask(task) : null;
  }

  createTask(input: TaskInput): Task {
    const taskInput = normalizeTaskInput(input);
    const info = this.database
      .prepare('INSERT INTO tasks (name, status, note_ids) VALUES (?, ?, ?)')
      .run(taskInput.name, taskInput.status, '[]');

    return this.getTaskById(Number(info.lastInsertRowid)) as Task;
  }

  updateTask(id: number, input: TaskInput): Task {
    assertPositiveInteger(id);
    const taskInput = normalizeTaskInput(input);

    const result = this.database
      .prepare('UPDATE tasks SET name = ?, status = ? WHERE id = ?')
      .run(taskInput.name, taskInput.status, id);

    if (result.changes === 0) {
      throw new NotFoundError(`Task ${id} was not found.`);
    }

    return this.getTaskById(id) as Task;
  }

  completeTask(id: number): Task {
    assertPositiveInteger(id);

    const result = this.database
      .prepare("UPDATE tasks SET status = 'completed' WHERE id = ?")
      .run(id);

    if (result.changes === 0) {
      throw new NotFoundError(`Task ${id} was not found.`);
    }

    return this.getTaskById(id) as Task;
  }
}
