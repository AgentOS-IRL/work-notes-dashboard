import { describe, expect, it, vi } from 'vitest';
import { useTasks } from '~/composables/useTasks';

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    }
  });
}

describe('useTasks', () => {
  it('loads tasks, groups them by status, and initializes collapse state', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

      if (url.endsWith('/api/tasks')) {
        return jsonResponse({
          tasks: [
            {
              id: 1,
              name: 'Ship board',
              status: 'in progress'
            },
            {
              id: 2,
              name: 'Draft follow-up',
              status: 'todo'
            },
            {
              id: 3,
              name: 'Old backlog item',
              status: 'backlog'
            },
            {
              id: 4,
              name: 'Closed item',
              status: 'completed'
            }
          ]
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const {
      tasks,
      groupedTasks,
      collapseState,
      loadTasks,
      openTask,
      openCreateTask,
      draftName,
      draftStatus,
      selectedTaskId,
      isEditorOpen
    } = useTasks();

    await loadTasks();

    expect(tasks.value.map((task) => task.id)).toEqual([1, 2, 3, 4]);
    expect(groupedTasks.value['in progress'].map((task) => task.id)).toEqual([1]);
    expect(groupedTasks.value.todo.map((task) => task.id)).toEqual([2]);
    expect(groupedTasks.value.backlog.map((task) => task.id)).toEqual([3]);
    expect(groupedTasks.value.completed.map((task) => task.id)).toEqual([4]);
    expect(collapseState.value['in progress']).toBe(false);
    expect(collapseState.value.todo).toBe(true);
    expect(collapseState.value.backlog).toBe(true);
    expect(collapseState.value.completed).toBe(true);

    openTask(tasks.value[1]);
    expect(selectedTaskId.value).toBe(2);
    expect(draftName.value).toBe('Draft follow-up');
    expect(draftStatus.value).toBe('todo');
    expect(isEditorOpen.value).toBe(true);

    openCreateTask();
    expect(selectedTaskId.value).toBeNull();
    expect(draftName.value).toBe('');
    expect(draftStatus.value).toBe('todo');
    expect(isEditorOpen.value).toBe(true);
  });

  it('creates, updates, and completes tasks through the API', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        expect(url).toBe('/api/tasks');
        expect(init?.method ?? 'GET').toBe('POST');
        expect(JSON.parse(init?.body as string)).toEqual({
          name: 'Draft task',
          status: 'backlog'
        });
        return jsonResponse({
          task: {
            id: 10,
            name: 'Draft task',
            status: 'backlog'
          }
        });
      })
      .mockImplementationOnce(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        expect(url).toBe('/api/tasks');
        return jsonResponse({
          tasks: [
            {
              id: 10,
              name: 'Draft task',
              status: 'backlog'
            }
          ]
        });
      })
      .mockImplementationOnce(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        expect(url).toBe('/api/tasks/10');
        expect(init?.method).toBe('PUT');
        expect(JSON.parse(init?.body as string)).toEqual({
          name: 'Draft task v2',
          status: 'in progress'
        });
        return jsonResponse({
          task: {
            id: 10,
            name: 'Draft task v2',
            status: 'in progress'
          }
        });
      })
      .mockImplementationOnce(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        expect(url).toBe('/api/tasks');
        return jsonResponse({
          tasks: [
            {
              id: 10,
              name: 'Draft task v2',
              status: 'in progress'
            }
          ]
        });
      })
      .mockImplementationOnce(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        expect(url).toBe('/api/tasks/10');
        expect(init?.method).toBe('DELETE');
        return jsonResponse({
          task: {
            id: 10,
            name: 'Draft task v2',
            status: 'completed'
          }
        });
      })
      .mockImplementationOnce(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        expect(url).toBe('/api/tasks');
        return jsonResponse({
          tasks: [
            {
              id: 10,
              name: 'Draft task v2',
              status: 'completed'
            }
          ]
        });
      });

    vi.stubGlobal('fetch', fetchMock);

    const {
      tasks,
      selectedTaskId,
      draftName,
      draftStatus,
      openCreateTask,
      saveTask,
      openTask,
      completeTask,
      loadTasks,
      errorMessage,
      statusMessage
    } = useTasks();

    openCreateTask();
    draftName.value = 'Draft task';
    draftStatus.value = 'backlog';
    await saveTask();

    expect(statusMessage.value).toBe('Task created.');
    expect(tasks.value[0]).toMatchObject({
      id: 10,
      name: 'Draft task',
      status: 'backlog'
    });

    openTask(tasks.value[0]);
    draftName.value = 'Draft task v2';
    draftStatus.value = 'in progress';
    await saveTask();

    expect(statusMessage.value).toBe('Task updated.');
    expect(tasks.value[0]).toMatchObject({
      id: 10,
      name: 'Draft task v2',
      status: 'in progress'
    });

    await completeTask();

    expect(statusMessage.value).toBe('Task completed.');
    expect(tasks.value[0]).toMatchObject({
      id: 10,
      name: 'Draft task v2',
      status: 'completed'
    });
    expect(selectedTaskId.value).toBe(10);

    expect(errorMessage.value).toBe('');
  });

  it('surfaces API errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(
          {
            error: 'Broken request'
          },
          { status: 400 }
        )
      )
    );

    const { loadTasks, errorMessage } = useTasks();

    await loadTasks();

    expect(errorMessage.value).toBe('Broken request');
  });
});
