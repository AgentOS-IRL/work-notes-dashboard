import { Router, type Response } from 'express';
import {
  NotFoundError,
  TasksRepository,
  ValidationError,
  type TaskInput
} from '../tasks-repository';

function parseTaskId(rawId: string) {
  const id = Number.parseInt(rawId, 10);

  if (!Number.isInteger(id) || id <= 0 || String(id) !== rawId.trim()) {
    throw new ValidationError('A valid task id is required.');
  }

  return id;
}

function parseTaskInput(body: unknown): TaskInput {
  if (body === null || typeof body !== 'object') {
    throw new ValidationError('Request body must be a JSON object.');
  }

  return body as TaskInput;
}

function sendError(res: Response, error: unknown) {
  if (error instanceof ValidationError) {
    res.status(400).json({ error: error.message });
    return true;
  }

  if (error instanceof NotFoundError) {
    res.status(404).json({ error: error.message });
    return true;
  }

  return false;
}

export function createTasksRouter(repository: TasksRepository) {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({ tasks: repository.listTasks() });
  });

  router.get('/:id', (req, res) => {
    try {
      const task = repository.getTaskById(parseTaskId(req.params.id));

      if (!task) {
        res.status(404).json({ error: 'Task not found.' });
        return;
      }

      res.json({ task });
    } catch (error) {
      if (!sendError(res, error)) {
        throw error;
      }
    }
  });

  router.post('/', (req, res) => {
    try {
      const task = repository.createTask(parseTaskInput(req.body));
      res.status(201).json({ task });
    } catch (error) {
      if (!sendError(res, error)) {
        throw error;
      }
    }
  });

  router.put('/:id', (req, res) => {
    try {
      const task = repository.updateTask(parseTaskId(req.params.id), parseTaskInput(req.body));
      res.json({ task });
    } catch (error) {
      if (!sendError(res, error)) {
        throw error;
      }
    }
  });

  router.delete('/:id', (req, res) => {
    try {
      const task = repository.completeTask(parseTaskId(req.params.id));
      res.json({ task });
    } catch (error) {
      if (!sendError(res, error)) {
        throw error;
      }
    }
  });

  router.use((_, res) => {
    res.status(404).json({ error: 'Not found.' });
  });

  return router;
}
