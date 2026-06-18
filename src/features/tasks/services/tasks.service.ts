import { api } from '@/lib/api';

export type TaskStatus = 'TODO' | 'DOING' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Task {
  id: string;
  organizationId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: string | null;
  assigneeId: string | null;
  contactId: string | null;
  conversationId: string | null;
  createdById: string | null;
  completedAt: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueAt?: string | null;
  assigneeId?: string | null;
  contactId?: string;
  conversationId?: string;
}

export type UpdateTaskInput = Partial<
  Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'dueAt' | 'assigneeId' | 'order'>
>;

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'A fazer',
  DOING: 'Em andamento',
  DONE: 'Concluído',
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
};

export const tasksService = {
  async list(params?: { status?: string; assigneeId?: string }): Promise<Task[]> {
    const { data } = await api.get('/tasks', { params });
    return data.data ?? data;
  },
  async create(payload: CreateTaskInput): Promise<Task> {
    const { data } = await api.post('/tasks', payload);
    return data.data ?? data;
  },
  async update(id: string, payload: UpdateTaskInput): Promise<Task> {
    const { data } = await api.patch(`/tasks/${id}`, payload);
    return data.data ?? data;
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/tasks/${id}`);
  },
};
