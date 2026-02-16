import { Hono } from "hono";
import { randomUUID } from "crypto";
import { eq, desc, schema, type AppDatabase } from "@ai-assistant/db";
import type { JobScheduler } from "../scheduler";
import { parseExpression } from "cron-parser";

export function createJobRoutes(db: AppDatabase, scheduler: JobScheduler) {
  const app = new Hono();

  // List all jobs
  app.get("/", async (c) => {
    const jobs = await db.query.scheduledJobs.findMany({
      orderBy: [desc(schema.scheduledJobs.createdAt)],
    });
    return c.json({ jobs });
  });

  // Get single job
  app.get("/:id", async (c) => {
    const id = c.req.param("id");
    const job = await db.query.scheduledJobs.findFirst({
      where: eq(schema.scheduledJobs.id, id),
    });
    if (!job) return c.json({ error: "Job not found" }, 404);
    return c.json({ job });
  });

  // Create job
  app.post("/", async (c) => {
    const body = await c.req.json<{
      name: string;
      prompt: string;
      cronExpression: string;
      timezone?: string;
      platform: string;
      channelId: string;
      enabled?: boolean;
    }>();

    if (!body.name || !body.prompt || !body.cronExpression || !body.platform || !body.channelId) {
      return c.json({ error: "Missing required fields: name, prompt, cronExpression, platform, channelId" }, 400);
    }

    const tz = body.timezone || "Europe/Berlin";

    // Validate cron expression
    try {
      parseExpression(body.cronExpression, { tz });
    } catch (err) {
      return c.json({ error: "Invalid cron expression", details: String(err) }, 400);
    }

    if (!["telegram", "web"].includes(body.platform)) {
      return c.json({ error: "Platform must be 'telegram' or 'web'" }, 400);
    }

    const id = randomUUID();
    const now = new Date();

    await db.insert(schema.scheduledJobs).values({
      id,
      name: body.name,
      prompt: body.prompt,
      cronExpression: body.cronExpression,
      timezone: tz,
      platform: body.platform,
      channelId: body.channelId,
      enabled: body.enabled ?? true,
      createdAt: now,
      updatedAt: now,
    });

    const job = await db.query.scheduledJobs.findFirst({
      where: eq(schema.scheduledJobs.id, id),
    });

    if (job && job.enabled) {
      scheduler.scheduleJob(job);
    }

    return c.json({ job }, 201);
  });

  // Update job
  app.put("/:id", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json<{
      name?: string;
      prompt?: string;
      cronExpression?: string;
      timezone?: string;
      platform?: string;
      channelId?: string;
      enabled?: boolean;
    }>();

    const existing = await db.query.scheduledJobs.findFirst({
      where: eq(schema.scheduledJobs.id, id),
    });
    if (!existing) return c.json({ error: "Job not found" }, 404);

    // Validate cron if provided
    if (body.cronExpression || body.timezone) {
      const cron = body.cronExpression ?? existing.cronExpression;
      const tz = body.timezone ?? existing.timezone;
      try {
        parseExpression(cron, { tz });
      } catch (err) {
        return c.json({ error: "Invalid cron expression", details: String(err) }, 400);
      }
    }

    if (body.platform && !["telegram", "web"].includes(body.platform)) {
      return c.json({ error: "Platform must be 'telegram' or 'web'" }, 400);
    }

    await db
      .update(schema.scheduledJobs)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(schema.scheduledJobs.id, id));

    const updated = await db.query.scheduledJobs.findFirst({
      where: eq(schema.scheduledJobs.id, id),
    });

    if (updated) {
      scheduler.scheduleJob(updated);
    }

    return c.json({ job: updated });
  });

  // Delete job
  app.delete("/:id", async (c) => {
    const id = c.req.param("id");
    const existing = await db.query.scheduledJobs.findFirst({
      where: eq(schema.scheduledJobs.id, id),
    });
    if (!existing) return c.json({ error: "Job not found" }, 404);

    scheduler.unscheduleJob(id);
    await db.delete(schema.scheduledJobs).where(eq(schema.scheduledJobs.id, id));

    return c.json({ ok: true });
  });

  // Run job immediately — returns 202 Accepted (non-blocking)
  app.post("/:id/run", async (c) => {
    const id = c.req.param("id");
    try {
      await scheduler.runNow(id);
      return c.json({ ok: true, message: "Job started" }, 202);
    } catch (err) {
      return c.json({ error: String(err) }, 500);
    }
  });

  return app;
}
