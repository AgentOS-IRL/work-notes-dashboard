import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import request from 'supertest';

import { createServer } from '../src/server';

function createTempFrontendDist() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-tasks-api-'));
  const frontendDistPath = path.join(tempRoot, 'public');
  fs.mkdirSync(frontendDistPath, { recursive: true });
  fs.writeFileSync(
    path.join(frontendDistPath, 'index.html'),
    '<!doctype html><html><body>tasks</body></html>'
  );

  return {
    tempRoot,
    frontendDistPath
  };
}

test('tasks API supports create, list, read, update, complete, and validation', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-tasks-api-db-'));
  const databasePath = path.join(tempRoot, 'tasks.sqlite');
  const { tempRoot: frontendRoot, frontendDistPath } = createTempFrontendDist();
  const server = createServer({
    databasePath,
    frontendDistPath
  });

  try {
    const createdResponse = await request(server.app)
      .post('/api/tasks')
      .send({
        name: 'Launch checklist',
        status: 'todo'
      })
      .expect(201);

    assert.ok(createdResponse.body.task.id);
    assert.equal(createdResponse.body.task.name, 'Launch checklist');
    assert.equal(createdResponse.body.task.status, 'todo');
    assert.deepEqual(createdResponse.body.task.noteIds, []);

    const taskId = createdResponse.body.task.id as number;

    await request(server.app)
      .get('/api/tasks')
      .expect(200)
      .expect((response) => {
        assert.deepEqual(response.body.tasks, [createdResponse.body.task]);
      });

    await request(server.app)
      .get(`/api/tasks/${taskId}`)
      .expect(200)
      .expect((response) => {
        assert.deepEqual(response.body.task, createdResponse.body.task);
      });

    const updatedResponse = await request(server.app)
      .put(`/api/tasks/${taskId}`)
      .send({
        name: 'Launch checklist v2',
        status: 'in progress'
      })
      .expect(200);

    assert.equal(updatedResponse.body.task.id, taskId);
    assert.equal(updatedResponse.body.task.name, 'Launch checklist v2');
    assert.equal(updatedResponse.body.task.status, 'in progress');

    const completedResponse = await request(server.app).delete(`/api/tasks/${taskId}`).expect(200);

    assert.equal(completedResponse.body.task.id, taskId);
    assert.equal(completedResponse.body.task.status, 'completed');

    await request(server.app)
      .get(`/api/tasks/${taskId}`)
      .expect(200)
      .expect((response) => {
        assert.equal(response.body.task.status, 'completed');
      });

    await request(server.app)
      .post('/api/tasks')
      .send({ status: 'todo' })
      .expect(400);

    await request(server.app)
      .put('/api/tasks/abc')
      .send({
        name: 'Invalid id',
        status: 'todo'
      })
      .expect(400);

    await request(server.app)
      .get('/api/tasks/1/history')
      .expect(404)
      .expect((response) => {
        assert.deepEqual(response.body, { error: 'Not found.' });
      });
  } finally {
    server.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
    fs.rmSync(frontendRoot, { recursive: true, force: true });
  }
});

