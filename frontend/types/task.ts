export type TaskStatus = 'todo' | 'backlog' | 'in progress' | 'completed';

export interface Task {
  id: number;
  name: string;
  status: TaskStatus;
}

export interface TaskInput {
  name: string;
  status: TaskStatus;
}

export interface TasksResponse {
  tasks: Task[];
}

export interface TaskResponse {
  task: Task;
}
