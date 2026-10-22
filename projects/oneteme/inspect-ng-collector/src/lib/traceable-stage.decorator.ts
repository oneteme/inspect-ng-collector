import {LocalRequestMonitor} from "./local-request.monitor";
import {createException} from "./configuration";
import {TraceType} from "./trace.model";

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
        exception = createException(e, undefined,  TraceType.LCL_RQT,false);
        throw e;
      } finally {
        monitor.postProcess(exception)
      }
    }
    return descriptor;
  }
}

