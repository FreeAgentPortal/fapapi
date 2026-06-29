export default function log(originalMethod: Function, ctx: ClassMethodDecoratorContext<any>) {
  return async function (this: any, ...args: any[]) {
    console.log(`Calling ${ctx.name as any} with arguments:`, args);
    const result = await originalMethod.apply(this, args);
    console.log(`Result from ${ctx.name as any}:`, result);
    return result;
  };
}