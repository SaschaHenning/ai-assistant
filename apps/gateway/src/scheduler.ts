import { randomUUID } from "crypto";
import { eq, schema, type AppDatabase } from "@ai-assistant/db";
import { invokeClaude } from "./claude";
import { parseExpression } from "cron-parser";

interface SchedulerOptions {
  db: AppDatabase;
  mcpConfigPath: string;
  messageSenders: Map<string, (channelId: string, text: string) => Promise<void>>;
}

interface ScheduledJobRow {
  id: string;
  name: string;
  prompt: string;
  cronExpression: string;
  timezone: string;
  platform: string;
  channelId: string;
  enabled: boolean;
}

export class JobScheduler {
  private timers = new Map<string, Timer>();
  private db: AppDatabase;
  private mcpConfigPath: string;
  private messageSenders: Map<string, (channelId: string, text: string) => Promise<void>>;
  private running = false;

  constructor(options: SchedulerOptions) {
    this.db = options.db;
    this.mcpConfigPath = options.mcpConfigPath;
    this.messageSenders = options.messageSenders;
  }

  async start() {
    if (this.running) return;
    this.running = true;

    const jobs = await this.db.query.scheduledJobs.findMany({
      where: eq(schema.scheduledJobs.enabled, true),
    });

    for (const job of jobs) {
      this.scheduleJob(job);
    }

    console.log(`[scheduler] Started with ${jobs.length} active jobs`);
  }

  async stop() {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.running = false;
    console.log("[scheduler] Stopped");
  }

  scheduleJob(job: ScheduledJobRow) {
    this.unscheduleJob(job.id);

    if (!job.enabled) return;

    const nextRun = this.calculateNextRun(job.cronExpression, job.timezone);
    if (!nextRun) {
      console.error(`[scheduler] Invalid cron for job ${job.id}: ${job.cronExpression}`);
      return;
    }

    const delay = nextRun.getTime() - Date.now();
    if (delay < 0) {
      // Missed window, schedule next occurrence
      console.log(`[scheduler] Job "${job.name}" missed, scheduling next occurrence`);
      const nextNext = this.calculateNextRun(job.cronExpression, job.timezone);
      if (nextNext) {
        const nextDelay = nextNext.getTime() - Date.now();
        if (nextDelay > 0) {
          const timer = setTimeout(() => this.executeJob(job), nextDelay);
          this.timers.set(job.id, timer);
        }
      }
      return;
    }

    const timer = setTimeout(() => this.executeJob(job), delay);
    this.timers.set(job.id, timer);

    // Update nextRunAt in DB
    this.db
      .update(schema.scheduledJobs)
      .set({ nextRunAt: nextRun })
      .where(eq(schema.scheduledJobs.id, job.id))
      .run();

    console.log(`[scheduler] Job "${job.name}" scheduled for ${nextRun.toISOString()}`);
  }

  unscheduleJob(jobId: string) {
    const timer = this.timers.get(jobId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(jobId);
    }
  }

  private calculateNextRun(cronExpression: string, timezone: string): Date | null {
    try {
      const interval = parseExpression(cronExpression, {
        currentDate: new Date(),
        tz: timezone,
      });
      return interval.next().toDate();
    } catch (err) {
      console.error(`[scheduler] Cron parse error: ${err}`);
      return null;
    }
  }

  private async executeJob(job: ScheduledJobRow) {
    console.log(`[scheduler] Executing job: ${job.name} (${job.id})`);

    const startTime = Date.now();
    let status: "success" | "error" = "success";
    let errorMsg: string | null = null;

    try {
      const result = await invokeClaude({
        prompt: job.prompt,
        systemPrompt: `You are executing a scheduled task named "${job.name}". This task runs automatically on a schedule. Be concise and focused on the task. Deliver actionable results.`,
        mcpConfigPath: this.mcpConfigPath,
      });

      const sender = this.messageSenders.get(job.platform);
      if (sender) {
        await sender(job.channelId, result.text);
      } else {
        console.warn(`[scheduler] No sender for platform: ${job.platform}`);
      }

      console.log(`[scheduler] Job "${job.name}" completed in ${Date.now() - startTime}ms`);
    } catch (err) {
      status = "error";
      errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[scheduler] Job "${job.name}" failed:`, errorMsg);

      // Notify user of failure
      try {
        const sender = this.messageSenders.get(job.platform);
        if (sender) {
          await sender(job.channelId, `⚠️ Scheduled job "${job.name}" failed: ${errorMsg}`);
        }
      } catch {
        // Ignore notification errors
      }
    }

    // Update last run info
    await this.db
      .update(schema.scheduledJobs)
      .set({
        lastRunAt: new Date(),
        lastRunStatus: status,
        lastRunError: errorMsg,
        updatedAt: new Date(),
      })
      .where(eq(schema.scheduledJobs.id, job.id));

    // Reschedule for next run
    const refreshedJob = await this.db.query.scheduledJobs.findFirst({
      where: eq(schema.scheduledJobs.id, job.id),
    });

    if (refreshedJob && refreshedJob.enabled) {
      this.scheduleJob(refreshedJob);
    }
  }

  async runNow(jobId: string) {
    const job = await this.db.query.scheduledJobs.findFirst({
      where: eq(schema.scheduledJobs.id, jobId),
    });

    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    await this.executeJob(job);
  }
}
