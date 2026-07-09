import logger from './logger';

/**
 * Verbose logger — emits at debug level, suppressed automatically in production.
 * Import and call directly from any class or module; no inheritance required.
 *
 * @param context - A label identifying the caller (e.g. 'BillingValidator')
 * @param message - The log message
 * @param args    - Optional structured data to include
 */
export function devLog(context: string, message: string, ...args: unknown[]): void {
  logger.debug({ context, data: args.length === 1 ? args[0] : args }, message);
}

export default function log(originalMethod: Function, ctx: ClassMethodDecoratorContext<any>) {
  return async function (this: any, ...args: any[]) {
    logger.debug({ args }, `Calling ${String(ctx.name)} with arguments`);
    const result = await originalMethod.apply(this, args);
    logger.debug({ result }, `Result from ${String(ctx.name)}`);
    return result;
  };
}
