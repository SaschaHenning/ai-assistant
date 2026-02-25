import { EventEmitter } from "events";
import { randomUUID } from "crypto";

export interface TaskMetadata {
  messagePreview?: string;
  platform?: string;
  userName?: string;
}

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
  messagePreview?: string;
  platform?: string;
  userName?: string;
}

type WorkFn = (signal: AbortSignal) => Promise<string>;

/** Maximum queued tasks per channel before new messages are rejected */
const MAX_QUEUE_DEPTH = 10;

/** Orphaned queued tasks older than this are cleaned up */
const ORPHAN_QUEUE_AGE_MS = 30 * 60 * 1000;

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

  enqueue(channelId: string, work: WorkFn, metadata?: TaskMetadata): Task {
    // Enforce per-channel queue depth limit
    const currentDepth = this.queues.get(channelId)?.length ?? 0;
    if (currentDepth >= MAX_QUEUE_DEPTH) {
      const task: Task = {
        id: randomUUID(),
        channelId,
        status: "failed",
        error: "Too many queued messages — please wait for previous messages to complete",
        createdAt: new Date(),
        completedAt: new Date(),
        abortController: new AbortController(),
        messagePreview: metadata?.messagePreview,
        platform: metadata?.platform,
        userName: metadata?.userName,
      };
      this.tasks.set(task.id, task);
      // Emit failure asynchronously so caller can set up listeners first
      queueMicrotask(() => this.emit("task:failed", { task, channelId }));
      return task;
    }

    const task: Task = {
      id: randomUUID(),
      channelId,
      status: "queued",
      createdAt: new Date(),
      abortController: new AbortController(),
      messagePreview: metadata?.messagePreview,
      platform: metadata?.platform,
      userName: metadata?.userName,
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

  getAllTasks(includeRecent = false): Task[] {
    const now = Date.now();
    const recentCutoff = now - 5 * 60 * 1000;
    const tasks: Task[] = [];

    for (const task of this.tasks.values()) {
      if (task.status === "running" || task.status === "queued") {
        tasks.push(task);
      } else if (
        includeRecent &&
        task.completedAt &&
        task.completedAt.getTime() > recentCutoff
      ) {
        tasks.push(task);
      }
    }

    return tasks.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
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
    const completedCutoff = Date.now() - 60 * 60 * 1000;
    const orphanCutoff = Date.now() - ORPHAN_QUEUE_AGE_MS;

    for (const [id, task] of this.tasks) {
      // Clean up old completed/failed/cancelled tasks
      if (
        task.completedAt &&
        task.completedAt.getTime() < completedCutoff &&
        task.status !== "running" &&
        task.status !== "queued"
      ) {
        this.tasks.delete(id);
        this.workFns.delete(id);
        continue;
      }

      // Clean up orphaned queued tasks older than 30 minutes
      if (task.status === "queued" && task.createdAt.getTime() < orphanCutoff) {
        console.warn(`[task-queue] Cleaning up orphaned queued task ${id} (age: ${Math.round((Date.now() - task.createdAt.getTime()) / 60000)}min)`);
        task.status = "cancelled";
        task.completedAt = new Date();
        task.error = "Orphaned task cleaned up";
        this.workFns.delete(id);
        // Remove from channel queue
        const queue = this.queues.get(task.channelId);
        if (queue) {
          const idx = queue.indexOf(id);
          if (idx !== -1) queue.splice(idx, 1);
        }
        this.emit("task:cancelled", { task, channelId: task.channelId });
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
