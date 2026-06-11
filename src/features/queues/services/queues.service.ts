import { api } from '@/lib/api';

export type JobStatus =
  | 'active'
  | 'waiting'
  | 'waiting-children'
  | 'delayed'
  | 'completed'
  | 'failed'
  | 'paused';

export interface QueueCounts {
  active: number;
  waiting: number;
  waitingChildren: number;
  delayed: number;
  completed: number;
  failed: number;
  paused: number;
}

export interface QueueSummary {
  name: string;
  isPaused: boolean;
  counts: QueueCounts;
}

export interface BullJob {
  id: string;
  name: string;
  data: unknown;
  opts: Record<string, unknown>;
  progress: number | object;
  delay: number;
  timestamp: number;
  attemptsMade: number;
  stacktrace: string[];
  returnvalue: unknown;
  finishedOn: number | null;
  processedOn: number | null;
  failedReason: string | null;
  status: JobStatus;
}

export interface JobsPage {
  jobs: BullJob[];
  total: number;
}

export const queuesService = {
  async listQueues(): Promise<QueueSummary[]> {
    const { data } = await api.get('/bull/queues');
    return data.data ?? data;
  },

  async getQueue(name: string): Promise<QueueSummary> {
    const { data } = await api.get(`/bull/queues/${encodeURIComponent(name)}`);
    return data.data ?? data;
  },

  async listJobs(
    name: string,
    params: { status?: JobStatus; start?: number; end?: number } = {},
  ): Promise<JobsPage> {
    const { data } = await api.get(
      `/bull/queues/${encodeURIComponent(name)}/jobs`,
      { params },
    );
    return data.data ?? data;
  },

  async retryJob(name: string, jobId: string): Promise<void> {
    await api.post(
      `/bull/queues/${encodeURIComponent(name)}/jobs/${jobId}/retry`,
    );
  },

  async removeJob(name: string, jobId: string): Promise<void> {
    await api.delete(
      `/bull/queues/${encodeURIComponent(name)}/jobs/${jobId}`,
    );
  },

  async pauseQueue(name: string): Promise<void> {
    await api.post(`/bull/queues/${encodeURIComponent(name)}/pause`);
  },

  async resumeQueue(name: string): Promise<void> {
    await api.post(`/bull/queues/${encodeURIComponent(name)}/resume`);
  },

  async cleanQueue(
    name: string,
    status: 'completed' | 'failed',
    gracePeriodMs = 0,
  ): Promise<void> {
    await api.post(`/bull/queues/${encodeURIComponent(name)}/clean`, {
      status,
      gracePeriodMs,
    });
  },
};
