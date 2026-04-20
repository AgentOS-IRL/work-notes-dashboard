import { computed, ref } from 'vue';
import type { Task, TaskInput, TaskResponse, TaskStatus, TasksResponse } from '~/types/task';

export const TASK_STATUS_ORDER: TaskStatus[] = ['in progress', 'todo', 'backlog', 'completed'];

export type TaskGroups = Record<TaskStatus, Task[]>;
export type TaskCollapseState = Record<TaskStatus, boolean>;

function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  return fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    },
    ...init
  }).then(async (response) => {
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error ?? `Request failed with status ${response.status}`);
    }

    return response.status === 204 ? (undefined as T) : (response.json() as Promise<T>);
  });
}

export function groupTasksByStatus(tasks: Task[]): TaskGroups {
  return TASK_STATUS_ORDER.reduce(
    (groups, status) => {
      groups[status] = tasks.filter((task) => task.status === status);
      return groups;
    },
    {
      todo: [],
      backlog: [],
      'in progress': [],
      completed: []
    } as TaskGroups
  );
}

function createDefaultCollapseState(tasks: Task[]): TaskCollapseState {
  return {
    todo: true,
    backlog: true,
    'in progress': tasks.some((task) => task.status === 'in progress') ? false : true,
    completed: true
  };
}

function createEmptyTaskDraft(): TaskInput {
  return {
    name: '',
    status: 'todo'
  };
}

export function useTasks() {
  const tasks = ref<Task[]>([]);
  const selectedTaskId = ref<number | null>(null);
  const draftName = ref('');
  const draftStatus = ref<TaskStatus>('todo');
  const loading = ref(true);
  const saving = ref(false);
  const errorMessage = ref('');
  const statusMessage = ref('');
  const isEditorOpen = ref(false);
  const collapseState = ref<TaskCollapseState>(createDefaultCollapseState([]));
  const selectedTaskSnapshot = ref<Task | null>(null);

  const selectedTask = computed(
    () => tasks.value.find((task) => task.id === selectedTaskId.value) ?? null
  );
  const groupedTasks = computed(() => groupTasksByStatus(tasks.value));

  const isEditorDirty = computed(() => {
    if (selectedTaskSnapshot.value) {
      return (
        draftName.value !== selectedTaskSnapshot.value.name ||
        draftStatus.value !== selectedTaskSnapshot.value.status
      );
    }

    return draftName.value.trim().length > 0 || draftStatus.value !== 'todo';
  });

  function applyTaskToDraft(task: Task | null) {
    if (!task) {
      selectedTaskId.value = null;
      selectedTaskSnapshot.value = null;
      draftName.value = '';
      draftStatus.value = 'todo';
      return;
    }

    selectedTaskId.value = task.id;
    selectedTaskSnapshot.value = task;
    draftName.value = task.name;
    draftStatus.value = task.status;
  }

  function openCreateTask() {
    errorMessage.value = '';
    statusMessage.value = '';
    applyTaskToDraft(null);
    isEditorOpen.value = true;
  }

  function openTask(task: Task) {
    errorMessage.value = '';
    statusMessage.value = '';
    applyTaskToDraft(task);
    isEditorOpen.value = true;
  }

  function closeTaskEditor() {
    isEditorOpen.value = false;
    errorMessage.value = '';
  }

  function resetCollapseState(nextTasks: Task[]) {
    collapseState.value = createDefaultCollapseState(nextTasks);
  }

  function toggleStatusSection(status: TaskStatus) {
    collapseState.value = {
      ...collapseState.value,
      [status]: !collapseState.value[status]
    };
  }

  async function loadTasks() {
    loading.value = true;
    errorMessage.value = '';

    try {
      const data = await requestJson<TasksResponse>('/api/tasks', { method: 'GET' });
      tasks.value = data.tasks;
      resetCollapseState(data.tasks);

      if (selectedTaskId.value !== null) {
        const nextSelected = data.tasks.find((task) => task.id === selectedTaskId.value);
        if (nextSelected) {
          selectedTaskSnapshot.value = nextSelected;
          if (!isEditorDirty.value) {
            applyTaskToDraft(nextSelected);
          }
        }
      }
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Failed to load tasks.';
    } finally {
      loading.value = false;
    }
  }

  async function saveTask() {
    saving.value = true;
    errorMessage.value = '';
    statusMessage.value = '';

    const payload: TaskInput = {
      name: draftName.value,
      status: draftStatus.value
    };

    try {
      const response =
        selectedTaskId.value === null
          ? await requestJson<TaskResponse>('/api/tasks', {
              method: 'POST',
              body: JSON.stringify(payload)
            })
          : await requestJson<TaskResponse>(`/api/tasks/${selectedTaskId.value}`, {
              method: 'PUT',
              body: JSON.stringify(payload)
            });

      statusMessage.value = selectedTaskId.value === null ? 'Task created.' : 'Task updated.';
      isEditorOpen.value = false;
      applyTaskToDraft(response.task);
      await loadTasks();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Failed to save task.';
    } finally {
      saving.value = false;
    }
  }

  async function completeTask(taskId = selectedTaskId.value) {
    if (taskId === null) {
      return;
    }

    saving.value = true;
    errorMessage.value = '';
    statusMessage.value = '';

    try {
      const response = await requestJson<TaskResponse>(`/api/tasks/${taskId}`, {
        method: 'DELETE'
      });

      statusMessage.value = 'Task completed.';
      isEditorOpen.value = false;
      applyTaskToDraft(response.task);
      await loadTasks();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Failed to complete task.';
    } finally {
      saving.value = false;
    }
  }

  return {
    tasks,
    selectedTaskId,
    selectedTask,
    selectedTaskSnapshot,
    draftName,
    draftStatus,
    loading,
    saving,
    errorMessage,
    statusMessage,
    isEditorOpen,
    isEditorDirty,
    collapseState,
    groupedTasks,
    loadTasks,
    openCreateTask,
    openTask,
    closeTaskEditor,
    saveTask,
    completeTask,
    toggleStatusSection
  };
}
