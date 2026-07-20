import "reflect-metadata";
import { Cron as CronerJob } from "croner";
import { injectable } from "tsyringe";

import type { CronJobMeta } from "./cron.decorators.js";
import { CRON_JOBS_KEY } from "./cron.decorators.js";

type ErrorReporter = (error: unknown, context: { type: "cron"; handler: string; controller: string }) => void;

interface RegisteredJob {
  meta: CronJobMeta;
  cronerJob: CronerJob;
  providerName: string;
}

@injectable()
export class CronService {
  private readonly jobs: RegisteredJob[] = [];
  private logger: { error: (...args: unknown[]) => void } = console;
  private onError?: ErrorReporter;

  setLogger(logger: { error: (...args: unknown[]) => void }): void {
    this.logger = logger;
  }

  setOnError(callback: ErrorReporter): void {
    this.onError = callback;
  }

  /**
   * Scan a provider instance for @Cron() decorated methods and register them.
   */
  registerProvider(instance: object, providerName: string): void {
    const constructor = instance.constructor;
    const metas: CronJobMeta[] = Reflect.getMetadata(CRON_JOBS_KEY, constructor) ?? [];

    for (const meta of metas) {
      const method = (instance as Record<string, unknown>)[meta.methodName];

      if (typeof method !== "function") {
        throw new Error(`@Cron() target ${providerName}.${meta.methodName} is not a function`);
      }

      const bound = method.bind(instance) as () => void | Promise<void>;
      const jobName = meta.name ?? `${providerName}.${meta.methodName}`;

      const cronerJob = new CronerJob(meta.cronExpression, async () => {
        try {
          await bound();
        } catch (error) {
          this.logger.error(`[imperium-cron] Job "${jobName}" failed:`, error);
          this.onError?.(error, { type: "cron", handler: jobName, controller: providerName });
        }
      });

      this.jobs.push({ meta, cronerJob, providerName });
    }
  }

  /**
   * Check if a provider class has any @Cron() decorated methods.
   */
  static hasCronJobs(target: Function): boolean {
    const metas: CronJobMeta[] | undefined = Reflect.getMetadata(CRON_JOBS_KEY, target);
    return (metas?.length ?? 0) > 0;
  }

  /**
   * Stop all registered cron jobs.
   */
  stopAll(): void {
    for (const job of this.jobs) {
      job.cronerJob.stop();
    }
  }

  /**
   * Get all registered jobs (for introspection/testing).
   */
  getJobs(): readonly { name: string; expression: string; running: boolean }[] {
    return this.jobs.map((j) => ({
      name: j.meta.name ?? `${j.providerName}.${j.meta.methodName}`,
      expression: j.meta.cronExpression,
      running: j.cronerJob.isRunning(),
    }));
  }
}
