import "reflect-metadata";

export const CRON_JOBS_KEY = Symbol.for("imperium:cron:jobs");

export interface CronJobMeta {
  cronExpression: string;
  methodName: string;
  name?: string;
}

export interface CronOptions {
  /** Human-readable name for logging/debugging */
  name?: string;
}

/**
 * Mark a method to run on a cron schedule.
 *
 * @param expression - Cron expression (e.g. "* /5 * * * *" for every 5 minutes)
 * @param options - Optional name for the job
 */
export function Cron(expression: string, options?: CronOptions): MethodDecorator {
  return (target, propertyKey) => {
    const existing: CronJobMeta[] = Reflect.getMetadata(CRON_JOBS_KEY, target.constructor) ?? [];

    existing.push({
      cronExpression: expression,
      methodName: propertyKey as string,
      name: options?.name,
    });

    Reflect.defineMetadata(CRON_JOBS_KEY, existing, target.constructor);
  };
}
