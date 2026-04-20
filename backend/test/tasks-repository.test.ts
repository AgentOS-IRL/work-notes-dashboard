import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { initializeSqliteDatabase, openSqliteDatabase } from '../src/db/sqlite';
import { NotFoundError, TasksRepository, ValidationError } from '../src/tasks-repository';

test('TasksRepository supports create, list, read, update, and completion', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-tasks-repo-'));
  const databasePath = path.join(tempRoot, 'tasks.sqlite');
  const database = openSqliteDatabase(databasePath);
  initializeSqliteDatabase(database);
  const repository = new TasksRepository(database);

  try {
    const todo = repository.createTask({
      name: 'Write outline',
      status: 'todo'
    });
    const backlog = repository.createTask({
      name: 'Review backlog',
      status: 'backlog'
    });
    const inProgress = repository.createTask({
      name: 'Ship feature',
      status: 'in progress'
    });

    assert.equal(todo.id, 1);
    assert.equal(todo.name, 'Write outline');
    assert.equal(todo.status, 'todo');
    assert.deepEqual(todo.noteIds, []);

    assert.deepEqual(repository.listTasks().map((task) => task.id), [inProgress.id, todo.id, backlog.id]);

    assert.deepEqual(repository.getTaskById(todo.id), todo);

    const updated = repository.updateTask(todo.id, {
      name: 'Write outline v2',
      status: 'in progress'
    });

    assert.equal(updated.id, todo.id);
    assert.equal(updated.name, 'Write outline v2');
    assert.equal(updated.status, 'in progress');

    const completed = repository.completeTask(backlog.id);

    assert.equal(completed.id, backlog.id);
    assert.equal(completed.status, 'completed');

    assert.deepEqual(
      repository.listTasks().map((task) => ({ id: task.id, status: task.status })),
      [
        { id: todo.id, status: 'in progress' },
        { id: inProgress.id, status: 'in progress' },
        { id: backlog.id, status: 'completed' }
      ]
    );
  } finally {
    database.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('TasksRepository validates input and missing rows', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-tasks-invalid-'));
  const databasePath = path.join(tempRoot, 'tasks.sqlite');
  const database = openSqliteDatabase(databasePath);
  initializeSqliteDatabase(database);
  const repository = new TasksRepository(database);

  try {
    assert.throws(
      () =>
        repository.createTask({
          name: '',
          status: 'todo'
        }),
      ValidationError
    );

    assert.throws(
      () =>
        repository.createTask({
          name: 'Task',
          status: 'invalid'
        }),
      ValidationError
    );

    assert.throws(
      () =>
        repository.updateTask(1, {
          name: 'Task',
          status: 'todo'
        }),
      NotFoundError
    );

    assert.throws(() => repository.completeTask(1), NotFoundError);
    assert.equal(repository.getTaskById(1), null);
  } finally {
    database.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
