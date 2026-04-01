import {LocalRequestMonitor} from "./local-request.monitor";

export function TraceableStage() {

  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    descriptor.value = function (...args: any[]) {
      const monitor = new LocalRequestMonitor();
      let exception;
      try {
        monitor.preProcess(propertyKey,target);
        return originalMethod.apply(this, args);
      } catch (e: any) {
        exception = resolveException(e);
        throw e;
      } finally {
        monitor.postProcess(exception);
      }
    }
    return descriptor;
  }
}
export function resolveException(e: any): { type: string | null; message: string | null } {
  let type = null, message = null;
  if (e) {
    if (typeof e === "string") {
      message = e;
    } else if (e instanceof Error) {
      type = e.name;
      message = e.message;
    } else {
      message = JSON.stringify(e)
    }
  }
  return { type, message };
}

