import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import request from 'supertest';

import { createServer } from '../src/server';

function createTempFrontendDist() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-api-'));
  const frontendDistPath = path.join(tempRoot, 'public');
  fs.mkdirSync(frontendDistPath, { recursive: true });
  fs.writeFileSync(
    path.join(frontendDistPath, 'index.html'),
    '<!doctype html><html><body>notes</body></html>'
  );

  return {
    tempRoot,
    frontendDistPath
  };
}

test('notes API supports create, list, read, update, delete, and validation', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-api-db-'));
  const databasePath = path.join(tempRoot, 'notes.sqlite');
  const { tempRoot: frontendRoot, frontendDistPath } = createTempFrontendDist();
  const server = createServer({
    databasePath,
    frontendDistPath
  });

  try {
    const createdResponse = await request(server.app)
      .post('/api/notes')
      .send({
        title: 'Release notes',
        content: 'Initial content'
      })
      .expect(201);

    assert.ok(createdResponse.body.note.id);
    assert.equal(createdResponse.body.note.title, 'Release notes');
    assert.equal(createdResponse.body.note.content, 'Initial content');

    const noteId = createdResponse.body.note.id as number;

    await request(server.app)
      .get('/api/notes')
      .expect(200)
      .expect((response) => {
        assert.deepEqual(response.body.notes, [createdResponse.body.note]);
      });

    await request(server.app)
      .get(`/api/notes/${noteId}`)
      .expect(200)
      .expect((response) => {
        assert.deepEqual(response.body.note, createdResponse.body.note);
      });

    const updatedResponse = await request(server.app)
      .put(`/api/notes/${noteId}`)
      .send({
        title: 'Release notes v2',
        content: 'Updated body'
      })
      .expect(200);

    assert.equal(updatedResponse.body.note.id, noteId);
    assert.equal(updatedResponse.body.note.title, 'Release notes v2');
    assert.equal(updatedResponse.body.note.content, 'Updated body');

    await request(server.app)
      .delete(`/api/notes/${noteId}`)
      .expect(204);

    await request(server.app)
      .get(`/api/notes/${noteId}`)
      .expect(404);

    await request(server.app)
      .post('/api/notes')
      .send({ content: 'Missing title' })
      .expect(400);

    await request(server.app)
      .put('/api/notes/abc')
      .send({
        title: 'Invalid id',
        content: 'Body'
      })
      .expect(400);
  } finally {
    server.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
    fs.rmSync(frontendRoot, { recursive: true, force: true });
  }
});
