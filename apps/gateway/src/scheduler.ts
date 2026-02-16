import { eq, schema, type AppDatabase } from "@ai-assistant/db";
import { invokeClaude } from "./claude";
import { parseExpression } from "cron-parser";

interface SchedulerOptions {
  db: AppDatabase;
  mcpConfigPath: string;
  messageSenders: Map<string, (channelId: string, text: string) => Promise<void>>;
  sendTypingAction?: (platform: string, chatId: string) => Promise<void>;
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

const TYPING_INTERVAL_MS = 4_000;
const PROGRESS_INTERVAL_MS = 3 * 60 * 1_000; // 3 minutes

export class JobScheduler {
  private timers = new Map<string, Timer>();
  private runningJobs = new Set<string>();
  private db: AppDatabase;
  private mcpConfigPath: string;
  private messageSenders: Map<string, (channelId: string, text: string) => Promise<void>>;
  private sendTypingAction?: (platform: string, chatId: string) => Promise<void>;
  private running = false;

  constructor(options: SchedulerOptions) {
    this.db = options.db;
    this.mcpConfigPath = options.mcpConfigPath;
    this.messageSenders = options.messageSenders;
    this.sendTypingAction = options.sendTypingAction;
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

  private async sendMessage(platform: string, channelId: string, text: string) {
    const sender = this.messageSenders.get(platform);
    if (sender) {
      await sender(channelId, text);
    }
  }

  private async executeJob(job: ScheduledJobRow) {
    if (this.runningJobs.has(job.id)) {
      console.warn(`[scheduler] Job "${job.name}" already running, skipping`);
      return;
    }

    this.runningJobs.add(job.id);
    console.log(`[scheduler] Executing job: ${job.name} (${job.id})`);

    const startTime = Date.now();
    let status: "success" | "error" = "success";
    let errorMsg: string | null = null;

    // Mark as running in DB
    await this.db
      .update(schema.scheduledJobs)
      .set({ lastRunStatus: "running", updatedAt: new Date() })
      .where(eq(schema.scheduledJobs.id, job.id));

    // Send start notification
    try {
      await this.sendMessage(job.platform, job.channelId, `⏳ Job "<b>${job.name}</b>" gestartet...`);
    } catch {
      // Don't fail the job if notification fails
    }

    // Start typing indicator loop (Telegram only, every 4s)
    let typingInterval: Timer | null = null;
    if (this.sendTypingAction) {
      try {
        await this.sendTypingAction(job.platform, job.channelId);
      } catch {}
      typingInterval = setInterval(async () => {
        try {
          await this.sendTypingAction?.(job.platform, job.channelId);
        } catch {}
      }, TYPING_INTERVAL_MS);
    }

    // Start progress update timer (every 3 min)
    let progressInterval: Timer | null = null;
    progressInterval = setInterval(async () => {
      const elapsed = Math.round((Date.now() - startTime) / 60_000);
      try {
        await this.sendMessage(
          job.platform,
          job.channelId,
          `⏳ Job "<b>${job.name}</b>" läuft seit ${elapsed} Min...`
        );
      } catch {}
    }, PROGRESS_INTERVAL_MS);

    try {
      const result = await invokeClaude({
        prompt: job.prompt,
        systemPrompt: `You are executing a scheduled task named "${job.name}". This task runs automatically on a schedule. Be concise and focused on the task. Deliver actionable results.`,
        mcpConfigPath: this.mcpConfigPath,
      });

      await this.sendMessage(job.platform, job.channelId, result.text);

      console.log(`[scheduler] Job "${job.name}" completed in ${Date.now() - startTime}ms`);
    } catch (err) {
      status = "error";
      errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[scheduler] Job "${job.name}" failed:`, errorMsg);

      // Notify user of failure
      try {
        await this.sendMessage(
          job.platform,
          job.channelId,
          `❌ Job "<b>${job.name}</b>" fehlgeschlagen:\n<code>${errorMsg}</code>`
        );
      } catch {
        // Ignore notification errors
      }
    } finally {
      // Always clean up intervals and running guard
      this.runningJobs.delete(job.id);
      if (typingInterval) clearInterval(typingInterval);
      if (progressInterval) clearInterval(progressInterval);
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

  /** Run a job immediately. Returns immediately (fire-and-forget). */
  async runNow(jobId: string) {
    const job = await this.db.query.scheduledJobs.findFirst({
      where: eq(schema.scheduledJobs.id, jobId),
    });

    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (this.runningJobs.has(jobId)) {
      throw new Error(`Job "${job.name}" is already running`);
    }

    // Fire and forget — don't await
    this.executeJob(job).catch((err) => {
      console.error(`[scheduler] runNow error for job "${job.name}":`, err);
    });
  }
}
