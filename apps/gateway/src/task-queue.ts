import { EventEmitter } from "events";
import { randomUUID } from "crypto";

export interface Task {
  id: string;
  channelId: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  result?: string;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  abortController: AbortController;
}

type WorkFn = (signal: AbortSignal) => Promise<string>;

export class TaskQueue extends EventEmitter {
  private queues = new Map<string, string[]>();
  private active = new Map<string, string>();
  private tasks = new Map<string, Task>();
  private workFns = new Map<string, WorkFn>();
  private cleanupTimer: Timer;

  constructor() {
    super();
    this.cleanupTimer = setInterval(() => this.cleanup(), 10 * 60 * 1000);
  }

  enqueue(channelId: string, work: WorkFn): Task {
    const task: Task = {
      id: randomUUID(),
      channelId,
      status: "queued",
      createdAt: new Date(),
      abortController: new AbortController(),
    };

    this.tasks.set(task.id, task);
    this.workFns.set(task.id, work);

    if (!this.queues.has(channelId)) {
      this.queues.set(channelId, []);
    }
    this.queues.get(channelId)!.push(task.id);

    this.processNext(channelId);

    return task;
  }

  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  getActiveTask(channelId: string): Task | undefined {
    const activeId = this.active.get(channelId);
    return activeId ? this.tasks.get(activeId) : undefined;
  }

  getQueuedCount(channelId: string): number {
    return this.queues.get(channelId)?.length ?? 0;
  }

  cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    if (task.status === "queued") {
      task.status = "cancelled";
      task.completedAt = new Date();
      const queue = this.queues.get(task.channelId);
      if (queue) {
        const idx = queue.indexOf(taskId);
        if (idx !== -1) queue.splice(idx, 1);
      }
      this.workFns.delete(taskId);
      this.emit("task:cancelled", { task, channelId: task.channelId });
      return true;
    }

    if (task.status === "running") {
      task.abortController.abort();
      return true;
    }

    return false;
  }

  cleanup() {
    const cutoff = Date.now() - 60 * 60 * 1000;
    for (const [id, task] of this.tasks) {
      if (
        task.completedAt &&
        task.completedAt.getTime() < cutoff &&
        task.status !== "running" &&
        task.status !== "queued"
      ) {
        this.tasks.delete(id);
        this.workFns.delete(id);
      }
    }
  }

  destroy() {
    clearInterval(this.cleanupTimer);
    this.queues.clear();
    this.active.clear();
    this.tasks.clear();
    this.workFns.clear();
    this.removeAllListeners();
  }

  private async processNext(channelId: string) {
    if (this.active.has(channelId)) return;

    const queue = this.queues.get(channelId);
    if (!queue || queue.length === 0) return;

    const taskId = queue.shift()!;
    const task = this.tasks.get(taskId);
    const work = this.workFns.get(taskId);

    if (!task || !work) return;

    this.active.set(channelId, taskId);
    task.status = "running";
    task.startedAt = new Date();
    this.emit("task:started", { task, channelId });

    try {
      const result = await work(task.abortController.signal);

      if (task.abortController.signal.aborted) {
        task.status = "cancelled";
        task.error = "Task was cancelled";
        task.completedAt = new Date();
        this.emit("task:cancelled", { task, channelId });
      } else {
        task.status = "completed";
        task.result = result;
        task.completedAt = new Date();
        this.emit("task:completed", { task, channelId });
      }
    } catch (err) {
      if (task.abortController.signal.aborted) {
        task.status = "cancelled";
        task.error = "Task was cancelled";
        task.completedAt = new Date();
        this.emit("task:cancelled", { task, channelId });
      } else {
        task.status = "failed";
        task.error = err instanceof Error ? err.message : String(err);
        task.completedAt = new Date();
        this.emit("task:failed", { task, channelId });
      }
    } finally {
      this.workFns.delete(taskId);
      this.active.delete(channelId);
      this.processNext(channelId);
    }
  }
}
